---
title: Spring 获取客户端真实IP地址
key: spring-get-real-ip-address
permalink: spring-get-real-ip-address.html
tags: http
---

相信很多人都遇到过，使用HttpServletRequest的getRemoteAddr()方法获取客户端IP得到的是127.0.0.1或0:0:0:0:0:0:0:1。出现这种情况多半是因为:

1. 本地访问
2. 设置了反向代理,通过反向代理访问

本地访问好说，不用解决，是正常现象。如果是反向代理，需要获取http头<code>X-Forwarded-For</code>(前提是有正确设置)。

```java
String ip = request.getHeader("x-forwarded-for");

if (StringUtils.isEmpty(ip)) {
    ip = request.getRemoteAddr();
}
```
上面代码可以解决反向代理的问题，不过代码不够健壮，存在安全隐患。想知道为啥，请接着往下看。
<!--more-->

## RemoteAddress

为什么会获取到本地地址呢？这还得了解一下RemoteAddr。我们来看一下HttpServletRequest中对getRemoteAddr的注释

> Returns the Internet Protocol (IP) address of the client or **last proxy
that sent the request**. For HTTP servlets, same as the value of the CGI
variable <code>REMOTE_ADDR</code>.

通俗点说，getRemoteAddr()获取到的是直接与Server连接的Client的IP地址。本地访问或反向代理服务器刚好和Server是在同一个地方，就会出现remote addr刚好都是12.0.0.1。

这就解释了为什么反向代理会导致127.0.0.1的结果。


## X-Forwarded-For
X-Forwarded-For简称为XFF，是一个非标准的Http头。它主要的作用维基百科说的非常清楚。

> X-Forwarded-For（XFF）是用来识别通过HTTP代理或负载均衡方式连接到Web服务器的客户端最原始的IP地址的HTTP请求头字段。- [维基百科](https://zh.wikipedia.org/wiki/X-Forwarded-For)

从上面的例子可以看出通过getRemoteAddr只能获取到直接与服务器建立连接的设备的ip地址。如果使用了代理服务器，那么将无法检测到源设备的IP地址，所以需要一种机制告诉服务器，因此就有了X-Forwarded-For。

Nginx是这样配置的

```nginx
server {
   listen 5000;
   server_name 192.168.10.10;
   location / {
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_pass http://192.168.10.1:8104/;
   }
}
```

配置了后，Nginx会自动把源ip放在X-Forwarded-For头里面。如果经历了多级代理，最后一个反向代理会记录前面所有的ip，顺序如下:

> X-Forwarded-For: $origin,proxy1,proxy2,proxy3

上面说了，X-Forwarded-For是一个普通的Http Header,这就存在一个隐患: Http头可以随便更改。

现在我们有2台机器，分别为192.168.10.1(client), 192.168.10.10(server)，client通过下面方式请求server，观察一下结果。


直接访问:

```json
{
	"remoteAddr": "192.168.10.1",
	"x-forwarded-for": null
}
```

反向代理(Server同时也是一台反向代理服务器)

```json
{
  "x-forwarded-for": "192.168.10.1",
  "remoteAddr": "127.0.0.1"
}
```

自定义Http头

```shell
curl --header "X-Forwarded-For: 8.8.8.8" http://192.168.10.10:8104/api/test
```

```json
{
  "x-forwarded-for": "8.8.8.8",
  "remoteAddr": "192.168.10.1"
}
```

最后一次请求可以看到X-Forwarded-For变成了8.8.8.8。因此我们不能盲目信任客户端的Http头，想安全获取真正的IP地址，必须要确定getRemoteAddr()是我们信任的服务器地址。所以必须把所有的反向代理服务器以及负载均衡的ip记录在一个白名单列表，我们**仅信任这个白名单的X-Forwarded-For**头。

```java
public static String getIpAddress(HttpServletRequest request) {
    String remoteAddr = request.getRemoteAddr();

    /* 信任来自白名单的远程反向代理服务器 */
    if (whileList.contains(remoteAddr)) {
        String ip = request.getHeader("x-forwarded-for");
        if (ip != null) {
            /* 经过多重反向代理会带有多个反向代理服务器ip */
            String[] ipArr = ip.split(",");

            return ipArr[0];
        }
    }

    return remoteAddr;
}
```

**完**
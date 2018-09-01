---
title: 使用Dnsmasq Debug微信JSSDK
key: dnsmasq-debug-wechat-jssdk
permalink: dnsmasq-debug-wechat-jssdk.html
tags: dns 微信公众号
---

微信公众号提供的jssdk限制很多，其中一个就是必须在安全域名之下才能成功调用微信的api，这样在本地就无法调试。本文介绍使用Dnsmasq突破这个限制，实现在本地调试公众号的js api。

<!--more-->

## Dnsmasq
Dnsmasq是一个简单的DNS缓存服务器，可用作DNS解析，同时也支持DHCP。如果你玩过Dnscrypt，相信你也肯定用过Dnsmasq。

我们可以利用Dnsmasq把域名解析到本地，从而突破微信的限制在本地调试微信的js接口。

### 安装
Mac下可以直接通过homebrew安装

```shell
brew install dnsmasq
```

就是这么简单，修改一下配置文件
```shell
vim /usr/local/etc/dnsmasq
```

> listen-address=192.168.x.x,127.0.0.1

请注意把192.168.x.x替换为你的内网地址，这个必须要填。如果你嫌麻烦，也可以直接填0.0.0.0
最后修改一下host，修改指定的域名为本地的ip地址。

> 192.168.1.10 weixin.com   

至此，dnsmasq就配置完成了，基本上不用怎么配置。dnsmasq默认会自动读取系统的/etc/hosts文件，如果发现有指定就直接解析。

最后在手机修改一下dns地址，访问weixin.com就会被指定到本地地址，从而绕过微信的限制。

<img src="/assets/images/dnsmasq/ios_change_wifi_dns.png" alt="ios修改DNS" width="270"/>
<br>
<img src="/assets/images/dnsmasq/dns-weixin.jpg" width="270"/>

本文只是提供一种思路，Dnsmasq的作用不仅于此，更多的要靠大家自己去探索了。同样的思路，在windows和linux下只要找到能DNS服务器的软件即可。当然，如果能修改手机的hosts，直接修改是最省事的。不过修改手机hosts比以前麻烦太多了，即便你懂修改，公司的其他人不一定懂。搭建一个DNS服务相对比较省事~
---
title: Nginx Http Auth Basic简单网页认证
key: nginx-http-auth-basic
permalink: nginx-http-auth-basic.html
tags: Nginx
---

有些资料我们需要把一些东西放在外网，但又不希望被不相关的人访问。这种场景需要一种简单的认证，查了一下nginx的 **ngx_http_auth_basic_module**，刚好可以实现这个功能。

nginx编译时默认已经包含这个模块，我们只需要做一下简单的配置即可实现http认证。

Example:

```nginx
location / {
    auth_basic           "closed site";
    auth_basic_user_file conf/htpasswd;
}
```

* auth_basic 认证开关，默认是off(即关闭认证)。除了off以外的都是启用auth。
* auth_basic_user_file  账户密码文件，可以通过htpasswd生成。
<!--more-->

**htpasswd**

htpasswd可以用于生成用户信息

> htpasswd [-cimBdpsDv][-C cost] passwordfile username

```shell
htpasswd -c -m htpasswd.conf bigbyto
# New password: 
# Re-type new password: 
# Adding password for user bigbyto
```

把这个配置文件的目录填写到nginx的配置文件即可。

![/assets/images/nginx/http_base_auth.png](https://user-images.githubusercontent.com/3600657/91549734-f4fffe00-e959-11ea-9d8d-127f14098873.png)

**访问限制**

为了防止暴力破解，我们可以用nginx的**ngx_http_limit_req_module**模块进行访问限制

```nginx
limit_req_zone $binary_remote_addr zone=limiter:10m rate=20r/s;
server {
    ....
    location / {
      auth_basic           "closed site";
      auth_basic_user_file conf/htpasswd;
      limit_req zone=limiter burst=1 nodelay;
    }
}
```

上面表示同一ip地址1秒最多只能访问20次，超过限制会立即返回错误。详细配置可以参考[ngx_http_limit_req_module](https://nginx.org/en/docs/http/ngx_http_auth_basic_module.html)。


参考链接:  
[https://nginx.org/en/docs/http/ngx_http_auth_basic_module.html](https://nginx.org/en/docs/http/ngx_http_auth_basic_module.html)
[https://nginx.org/en/docs/http/ngx_http_limit_req_module.html](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html)
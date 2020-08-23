---
title: 给gitalk添加匿名评论功能
key: gitalk-anonymous-comment
permalink: gitalk-anonymous-comment.html
tags: javascript
---

gitalk是一个基于github issue的评论系统，这个想法是非常具有创意的。不过一直以来这个项目都存在一些问题。

1. 整个OAuth流程放在前端，暴露了client_id和client_secret
2. github权限粒度较高，用户授权时会把仓库所有的权限授权出去，容易被人恶意利用
3. 获取access_token是通过第三方api代理获取，有被恶意利用的可能

这几个重要缺陷一直是我的心头刺，因此我Fork了一份代码自己把这两个问题fix了。首先我把授权流程放到了server端，解决第一个和第三个问题。然后我新增了一个匿名评论功能，来打消访客的安全疑虑，同时匿名评论也能增加游客评论欲望。本文着重讲一下怎样实现匿名评论的功能。

<!--more-->
### Implementation
因为要新增一条issue的comment，必须要有一个github账号，我的思路就是用一个独立账号专门作为访客，用它的accessToken存放于服务端，访客提交匿名评论时，把评论提交到指定的server，由server完成创建评论的流程，返回给前端。整体流程如下

**创建一个新的github账号**

获取Personal access token
> Account-->Settings-->Developer settings-->Personal access tokens-->Generate new token

Scope选项中 `repo` 和 `user` 是必选的。   
最后生成access token，存放于服务端。

**编写服务端api**   
gitalk原本是在客户端完成创建issue comment流程，虽然我们也可以把匿名账户的token写死在前端，不过这样很容易被恶意利用，所以我选择使用服务端代理github的api。

**配置Gitalk**   
相对于原来的项目，现在新增了一个配置参数`server`

```js
var gitalk = new Gitalk({
  clientID: '',
  clientSecret: '', //已废弃
  repo: 'reponame',
  owner: 'bigbyto',
  admin: ['bibgyto'],
  id: '{{ test }}',
  perPage: 20,
  server: {
    oauth_api: 'http://oauthapi', //授权api
    anonymous_api: 'http://anonymous_api' //
  }
});
```

**匿名评论请求信息**

当配置了`anonymous_api`时，如果用户点击了`匿名评论`，将会发起一个post请求到`anonymous_api`

> Url: anonymous_api
>
> Method: POST
>
> Content-type:  application/x-www-form-*urlencoded* 因为存在跨域，为了防止发起preflight request
>
> Body: postUrl=issueUrl&content=comment

具体案例可以直接在本博客的留言区发送一条匿名评论。

**授权请求信息**

用户点击登录时，跳转格式如下

> http://oauthapi.com?origin=window.location.href

授权成功后会返回当前页面，且带上参数`access_token`，该参数会被存到localStorage，切马上从url中删除。

### 总结

我对gitalk大致的改动就是这些，还有一些细微的调整，都是按照我个人意愿作出的调整。还有是这个改动不会向主项目发起pull request，因为风格差异太大。主项目把所有的东西放到了前端，我改动后把敏感的数据都放到后端，两者存在巨大差异。
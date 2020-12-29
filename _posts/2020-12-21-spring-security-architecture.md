---
title: '深入理解Spring Security—框架设计'
key: spring-security-architecture
permalink: spring-security-architecture.html
tags: Java Spring
---

上个章节用一个Demo展示了Spring Security的基本配置。整体来说，Spring Security是一个配置简单，设计优雅，但不是很容易理解的框架。本文将叙述Spring Security的框架设计，带领大家更进一步理解Spring Security的设计细节。

注: 本文仅叙述Servlet部分的设计，不对WebFlux做任何补充，读者有兴趣请自己翻阅文档和源码。

### 知识准备

读者在阅读本文之前，最好具备下面的知识点，以便更容易理解文章内容
* 了解Servlet Filter
* 了解设计模式中的责任链模式
* 最好是了解Spring Web Mvc的工作原理

<!--more-->
### 简介

在上个章节我们已经展示过Spring Security对不同路由的拦截功能。熟悉Servlet的朋友都知道FilterChain可以轻易实现拦截功能，实际上Spring Security也设计了一套FilterChain对路由进行拦截。

### Servlet FilterChain

在正式开始之前，首先了解一下在一个Servlet程序中，当一个请求从发起到响应的过程中，会经历哪些流程。

![~replace~https://user-images.githubusercontent.com/3600657/102799594-b51fc380-43ed-11eb-9a16-803351303cd3.png](https://docs.spring.io/spring-security/site/docs/5.4.2/reference/html5/images/servlet/architecture/filterchain.png)

上图是Servlet的预览图，当一个请求到达Servlet Container(通常是Tomcat)，容器会开始构造HttpServletRequest和HttpServletResponse对象，同时也会创建FilterChain对象，把HttpServletRequest和HttpServletResponse交由FilterChain进行处理。在这个过程中:

* 所有Filter按照注册的顺序进行调用
* 任一Filter可以根据实际情况决定终止调用链(调用HttpServletResposne返回)，或继续传递到下游的Filter
* 当一个请求经过了所有的Filter，最终会抵达Servlet中

### SecurityFilterChain

上面一小节简单介绍了Servlet FilterChain的工作流程，实际上Spring Security的核心也是FilterChain模式，只不过在Spring Security中，它维护了一套自己的FilterChain，叫`SecurityFilterChain`。

![~replace~https://user-images.githubusercontent.com/3600657/102799616-bb15a480-43ed-11eb-98e3-ba43b1dda2f8.png](https://docs.spring.io/spring-security/site/docs/5.4.2/reference/html5/images/servlet/architecture/securityfilterchain.png)

如上图所示，在Spring Security的应用程序中，会存在2套FilterChain，分别是Servlet FilterChain和Spring SecurityFilterChain。事实上两者没有本质上的区别，甚至它们Filter的接口都是`javax.servlet`下的Filter。

为什么要创造一套新的FilterChain呢？这样有很多好处，最主要有下面两点:

1. 和Servlet Container解耦

   这个设计和`Core J2EE Patterns`中的`Front Controller`有点相似。

   ![~replace~https://user-images.githubusercontent.com/3600657/102799629-bf41c200-43ed-11eb-9919-8a0574f70020.png](http://www.corej2eepatterns.com/images/FCMainClass.gif)

   Spring Web Mvc底层容器是Servlet Container，而Spring Security是构建在Spring Web Mvc中的一套框架，本质上这两套是不同的体系。拆分出SecurityFilterChain逻辑上更加清晰，和底层容器的耦合也会降低。

   这个逻辑就跟Spring Web Mvc用一个DispatcherServlet接收所有请求，再分发到Controller的思想是有点类似的。

2. 解耦Servlet Container 和 Spring IoC Container

   Spring Security对Spring框架是强依赖关系，其中大量使用了Spring Bean。对于Servlet Filter而言，本不能感知到Spring Bean。而SecurityFilterChain中的Filter，可以在上下文轻易注入Spring Bean。


### DelegatingFilterProxy

`DelegatingFilterProxy`主要的作用是桥接Spring IoC Container和Servlet Container。在上面小节提到Servlet Filter无法感知Spring Bean，而`DelegatingFilterProxy`可以实现这一功能。

![~replace~https://user-images.githubusercontent.com/3600657/102799644-c537a300-43ed-11eb-9c32-5e78597f71c9.png](https://docs.spring.io/spring-security/site/docs/5.4.2/reference/html5/images/servlet/architecture/delegatingfilterproxy.png)

`DelegatingFilterProxy`主要的职责可以用下面的代码概括

```java
public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) {
    // Lazily get Filter that was registered as a Spring Bean
    // For the example in DelegatingFilterProxy delegate is an instance of Bean Filter0
    Filter delegate = getFilterBean(someBeanName);
    // delegate work to the Spring Bean
    delegate.doFilter(request, response);
}
```

### FilterChainProxy

`FilterChainProxy`是一个特殊的Filter。在默认情况下，它会被注册到Spring IoC Container中，beanName为`springSecurityFilterChain`，同时它会被DelegatingFilterProxy持有(从Spring容器中取出)，且DelegatingFilterProxy会把自己注册到ServletFilter中。

![~replace~https://user-images.githubusercontent.com/3600657/102799616-bb15a480-43ed-11eb-98e3-ba43b1dda2f8.png](https://docs.spring.io/spring-security/site/docs/5.4.2/reference/html5/images/servlet/architecture/securityfilterchain.png)

因此，FilterChainProxy**最大的作用是连接SecurityFilterChain**，当请求经过它时，他会构造出所需要的Filter，在内部创建一个叫**VitrualFilterChain**的类，开始进行Spring Security Filter内部的过滤。

它的工作过程可以用下面伪代码展示

```java
private void doFilterInternal(ServletRequest request, ServletResponse response,
		FilterChain chain) throws IOException, ServletException {

	List<Filter> filters = getFilters(request);

	VirtualFilterChain vfc = new VirtualFilterChain(request, chain, filters);
	vfc.doFilter(fwRequest, fwResponse);
}
```

下面同样贴一段**VirtualFilterChain**的代码

```java
public void doFilter(ServletRequest request, ServletResponse response)
		throws IOException, ServletException {
	if (currentPosition == size) {
		if (logger.isDebugEnabled()) {
			logger.debug(UrlUtils.buildRequestUrl(firewalledRequest)
					+ " reached end of additional filter chain; proceeding with original chain");
		}

		// Deactivate path stripping as we exit the security filter chain
		this.firewalledRequest.reset();

		originalChain.doFilter(request, response);
	}
	else {
		currentPosition++;

		Filter nextFilter = additionalFilters.get(currentPosition - 1);

		if (logger.isDebugEnabled()) {
			logger.debug(UrlUtils.buildRequestUrl(firewalledRequest)
					+ " at position " + currentPosition + " of " + size
					+ " in additional filter chain; firing Filter: '"
					+ nextFilter.getClass().getSimpleName() + "'");
		}

		nextFilter.doFilter(request, response, this);
	}
}
```

### Security Filters

Security Filters是Spring Security设计的Filter，它和ServletFilter没有本质上的不同。只不过它单独应用于SecurityFilterChain上，这些Filter会被FilterChainProxy加载，构造出VitrualFilterChain进行过滤。下面是Spring Security内置的一些Security Filters。

- ChannelProcessingFilter
- WebAsyncManagerIntegrationFilter
- SecurityContextPersistenceFilter
- HeaderWriterFilter
- CorsFilter
- CsrfFilter
- LogoutFilter
- OAuth2AuthorizationRequestRedirectFilter
- Saml2WebSsoAuthenticationRequestFilter
- X509AuthenticationFilter
- AbstractPreAuthenticatedProcessingFilter
- CasAuthenticationFilter
- OAuth2LoginAuthenticationFilter
- Saml2WebSsoAuthenticationFilter
- [`UsernamePasswordAuthenticationFilter`](https://docs.spring.io/spring-security/site/docs/5.4.2/reference/html5/#servlet-authentication-usernamepasswordauthenticationfilter)
- OpenIDAuthenticationFilter
- DefaultLoginPageGeneratingFilter
- DefaultLogoutPageGeneratingFilter
- ConcurrentSessionFilter
- [`DigestAuthenticationFilter`](https://docs.spring.io/spring-security/site/docs/5.4.2/reference/html5/#servlet-authentication-digest)
- BearerTokenAuthenticationFilter
- [`BasicAuthenticationFilter`](https://docs.spring.io/spring-security/site/docs/5.4.2/reference/html5/#servlet-authentication-basic)
- RequestCacheAwareFilter
- SecurityContextHolderAwareRequestFilter
- JaasApiIntegrationFilter
- RememberMeAuthenticationFilter
- AnonymousAuthenticationFilter
- OAuth2AuthorizationCodeGrantFilter
- SessionManagementFilter
- [`ExceptionTranslationFilter`](https://docs.spring.io/spring-security/site/docs/5.4.2/reference/html5/#servlet-exceptiontranslationfilter)
- [`FilterSecurityInterceptor`](https://docs.spring.io/spring-security/site/docs/5.4.2/reference/html5/#servlet-authorization-filtersecurityinterceptor)
- SwitchUserFilter

### 总结

通过本文的叙述相信你已经理解了Spring Security大概的工作流程和原理，它的本质就是一套拦截链，和Servlet中的FilterChain本质上是一样的。只不过Spring Security在设计上做了更多的考量，使得整体设计更加优雅。

在下一篇文章中，我将带大家理解[Spring Security认证(Authencation)流程](https://wiyi.org/spring-security-authentication.html)，有兴趣的朋友敬请期待。
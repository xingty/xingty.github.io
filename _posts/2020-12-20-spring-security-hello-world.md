---
title: '深入理解Spring Security - HelloWorld'
key: spring-security-hello-world
permalink: spring-security-hello-world.html
tags: Java Spring
---

### 前言
之前公司一直使用Apache Shiro作为认证和授权的框架，前些天朋友叫我研究SSO时，发现在Spring的技术栈中，Spring Security是个更好的选择，于是花几天时间研究了一下Spring Security，打算把研究所得记录下来。

在我的理解中，Spring Security是一个配置简单，却不是很容易理解的框架。主要是它的内容所涵盖的领域很广，在代码层面，它构造Filter的流程可能也会有点难以理解。这个系列将带大家抽丝剥茧Spring Security的细节。
<!--more-->

### 创建Hello World工程
在开始讲解之前，先让我们跑起来一个Spring Security的项目，下面将创建一个Hello World简单的Hello World工程，先对这个框架有一个感性的认识。源代码可以在[spring-security-lesson](https://github.com/xingty/spring-security-lesson)下载。

#### maven pom
构建Maven工程所需的依赖如下

```xml
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-security</artifactId>
    </dependency>

    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-thymeleaf</artifactId>
    </dependency>
  </dependencies>
```

#### Config

```java
@Configuration
@EnableWebSecurity
public class MySecurityConfiguration extends WebSecurityConfigurerAdapter {

  @Override
  protected void configure(HttpSecurity http) throws Exception {
    http
      .authorizeRequests()
      .antMatchers("/", "/home").permitAll()
      .antMatchers("/user/**").hasRole("USER")
      .anyRequest().authenticated()
      .and()
      .formLogin()
      .permitAll()
      .and()
      .logout()
      .permitAll();
  }

  @Bean
  public UserDetailsService userDetailsService() {
    UserDetails normal =
        User.withDefaultPasswordEncoder()
              .username("user")
              .password("123456")
              .roles("NORMAL")
              .build();

    UserDetails user =
        User.withDefaultPasswordEncoder()
              .username("bigbyto")
              .password("123456")
              .roles("USER")
              .build();

    return new InMemoryUserDetailsManager(normal,user);
  }
}
```

简单解释一下上面代码，在configure中配置了路由拦截对"/home"放行，对任意匹配"/user/**"的路由，需要拥有`User`这个身份才能访问。同时我们定义了2个用户存放到内存中，分别是"user"和"bigbyto"，它们的权限角色分别是"NORMAL"和"USER"。

#### Controller

```java
@Controller
public class HomeController {

  @GetMapping("/home")
  public String home() {
    return "home";
  }

  @GetMapping("/user")
  public String users(ModelMap map) {
    List<String> users = Arrays.asList("user1","user2","user3");
    map.addAttribute("users",users);
    return "user";
  }
}
```

### 访问测试

get http://localhost:8090/home

不需要登录即可访问
![](https://user-images.githubusercontent.com/3600657/102798975-cd431300-43ec-11eb-882e-3df3f74152b7.png)

Get http://localhost:8090/user --> redirect to http://localhost:8090/login

![](https://user-images.githubusercontent.com/3600657/102798979-ce744000-43ec-11eb-8a2a-ec9a13eb2f0e.png)

使用bigbyto账户登录

![](https://user-images.githubusercontent.com/3600657/102798985-cf0cd680-43ec-11eb-86af-27dcdc3b6dc7.png)

使用user账户登录

![](https://user-images.githubusercontent.com/3600657/102798957-c9af8c00-43ec-11eb-8eff-c7554b585c5c.png)
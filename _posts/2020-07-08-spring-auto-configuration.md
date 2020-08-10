---
title: Spring和SpringBoot自动装配原理
key: spring-auto-configuration
permalink: spring-auto-configuration.html
tags: Java Spring
---

"自动装配"这个概念Spring官方提到的不多，仅在SpringBoot中有大概的介绍。根据功能对他总结，可以把自动装配理解为: 通过注解或者特定的配置，能实现自动加载一整个模块的功能，不需要开发者做太多的配置。

 在Spring Boot的时代，这功能非常常见，我们所使用的所有Spring Boot Starter都实现了自动装配。不过这个功能并不是Spring Boot的专利，实际上Spring Framework早就实现了这个功能。

要解释Spring的自动装配，先要了解一下Spring配置的历史。

<!--more-->

### XML时代的手动装配

Java早期并不支持Annotation，受限于此早期的Spring主流的配置方式都是通过XML。虽然Java5后正式支持Annotation，不过因为XML配置早已约定成俗，当时使用的非常多。使用过XML的朋友都知道，XML的配置相当繁琐(相对于现在的Annotation)，尤其是当你引入了其他的模块，也需要为其他模块去配置上下文，比较典型的是SpringMVC，举个例子。

SpringMVC应用，必须要在WEB-INF目录创建web.xml和app-context.xml，用于配置servlet和spring application。

```xml
<!-- web.xml 典型的配置 -->
<web-app>
  <servlet>
    <servlet-name>app</servlet-name>
    <servlet-class>org.springframework.web.servlet.DispatcherServlet</servlet-class>
    <init-param>
      <param-name>contextConfigLocation</param-name>
      <param-value>/WEB-INF/app-context.xml</param-value>
    </init-param>
    <load-on-startup>1</load-on-startup>
  </servlet>

  <servlet-mapping>
    <servlet-name>app</servlet-name>
    <url-pattern>/</url-pattern>
  </servlet-mapping>

</web-app>
```

```xml
<!-- app-context 配置文件 -->
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:p="http://www.springframework.org/schema/p"
       xmlns:context="http://www.springframework.org/schema/context"
       xsi:schemaLocation="
        http://www.springframework.org/schema/beans
        https://www.springframework.org/schema/beans/spring-beans.xsd
        http://www.springframework.org/schema/context
        https://www.springframework.org/schema/context/spring-context.xsd">

  <context:component-scan base-package="org.wiyi.mvc"/>

  <bean class="org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping"/>

  <bean class="org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerAdapter"/>

  <bean id="viewResolver" class="org.springframework.web.servlet.view.InternalResourceViewResolver">
    <property name="viewClass" value="org.springframework.web.servlet.view.JstlView"/>
    <property name="prefix" value="/WEB-INF/jsp/"/>
    <property name="suffix" value=".jsp"/>
  </bean>
  <!-- ... -->

</beans>
```

从上面的配置可以看到，SpringMVC的配置步骤稍微有点多，尤其是当项目复杂度变高，你引入了其他模块，你不但需要为他配置，还需要把它加入到自己的上下文中，整个过程是非常繁琐的。



### Spring Framework时代的自动装配

很多人对自动装配的了解仅限于SpringBoot，但实际上在Spring 3.0开始就已经提供了一个注解实现自动装配的能力，它就是`@Import`注解。

```java
/**
 * Indicates one or more <em>component classes</em> to import &mdash; typically
 * {@link Configuration @Configuration} classes.
 *
 * <p>Provides functionality equivalent to the {@code <import/>} element in Spring XML.
 * Allows for importing {@code @Configuration} classes, {@link ImportSelector} and
 * {@link ImportBeanDefinitionRegistrar} implementations, as well as regular component
 * classes (as of 4.2; analogous to {@link AnnotationConfigApplicationContext#register}).
 *
 * <p>{@code @Bean} definitions declared in imported {@code @Configuration} classes should be
 * accessed by using {@link org.springframework.beans.factory.annotation.Autowired @Autowired}
 * injection. Either the bean itself can be autowired, or the configuration class instance
 * declaring the bean can be autowired. The latter approach allows for explicit, IDE-friendly
 * navigation between {@code @Configuration} class methods.
 *
 * <p>May be declared at the class level or as a meta-annotation.
 *
 * <p>If XML or other non-{@code @Configuration} bean definition resources need to be
 * imported, use the {@link ImportResource @ImportResource} annotation instead.
 *
 * @author Chris Beams
 * @author Juergen Hoeller
 * @since 3.0
 * @see Configuration
 * @see ImportSelector
 * @see ImportBeanDefinitionRegistrar
 * @see ImportResource
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Import {

	/**
	 * {@link Configuration @Configuration}, {@link ImportSelector},
	 * {@link ImportBeanDefinitionRegistrar}, or regular component classes to import.
	 */
	Class<?>[] value();

}
```

`@Import`注解提供了XML`<import>`标签同样的功能，它能实现导入4种类型的元素，分别是: ImportSelector、ImportBeanDefinitionRegistrar、ImportResource，Configuration。关于`@Import`注解是如何加载它们的，请移步我另外一篇文章 - [Spring @Enable编程风格](https://wiyi.org/spring-programming-style.html)。



在SpringBoot之前，SpringMVC就已经利用了`@Improt`注解实现自动装配功能，那就是`@EneableWebMvc`注解，使用这个功能，就可以非常方便的启用Spring Web Mvc。



通过简单一行代码，我们就实现了启用SpringMVC。如果熟悉Servlet和SpringMvc的朋友肯定知道，SpringMVC必不可少需要注册`DispatcherServlet`到Servlet容器中，同时也需要添加默认的ViewResolver，这个注解必然也是通过某种方式动态注册，否则SpringMVC根本不可能正常工作。那么`@EneableWebMvc`是如何实现动态注册的呢？如下

```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@Documented
@Import(DelegatingWebMvcConfiguration.class)
public @interface EnableWebMvc {
}
```



在`@EnableWebMvc`注解中import了DelegatingWebMvcConfiguration这个类，因此会被Spring加载，而这个类内部已经实现了ViewResolver的注册。

```java
	@Bean
	public ViewResolver mvcViewResolver(
			@Qualifier("mvcContentNegotiationManager") ContentNegotiationManager contentNegotiationManager) {
		ViewResolverRegistry registry =
				new ViewResolverRegistry(contentNegotiationManager, this.applicationContext);
		configureViewResolvers(registry);

		if (registry.getViewResolvers().isEmpty() && this.applicationContext != null) {
			String[] names = BeanFactoryUtils.beanNamesForTypeIncludingAncestors(
					this.applicationContext, ViewResolver.class, true, false);
			if (names.length == 1) {
				registry.getViewResolvers().add(new InternalResourceViewResolver());
			}
		}

		ViewResolverComposite composite = new ViewResolverComposite();
		composite.setOrder(registry.getOrder());
		composite.setViewResolvers(registry.getViewResolvers());
		if (this.applicationContext != null) {
			composite.setApplicationContext(this.applicationContext);
		}
		if (this.servletContext != null) {
			composite.setServletContext(this.servletContext);
		}
		return composite;
	}
```

而`DispatcherServlet`的装载是另外一个话题，碍于篇幅，本文略过，有空写一篇详细介绍SpringMVC自动装配的文章。



### SpringBoot时代的自动装配

SpringBoto时代的自动装配是自动装配的终极形态，它使用SPI的方式加载配置，且提供了内置的SpringFactoriesLoader加载SPI的配置类实现自动装配，不仅如此，它还大量使用了条件装配和外部化配置，实现高伸缩性。

SpringBoot自动装配有下面特点

1. SPI加载配置类(SpringFactoriesLoader)
2. 条件装配(注意这并非SpringBoot的专利，只是SpringBoot中大量使用)
3. 加载顺序保证
4. 外部化配置



#### @EnableAutoConfiguration

启动SpringBoot自动装配条件是必须使用`@EnableAutoConfiguration`注解，这个注解Import了AutoConfigurationImportSelector这个类，用以初始化自动装配的一些配置(调用SpringFactoriesLoader)，如下面的源码。

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@AutoConfigurationPackage
@Import(AutoConfigurationImportSelector.class)
public @interface EnableAutoConfiguration {

	String ENABLED_OVERRIDE_PROPERTY = "spring.boot.enableautoconfiguration";

	/**
	 * Exclude specific auto-configuration classes such that they will never be applied.
	 * @return the classes to exclude
	 */
	Class<?>[] exclude() default {};

	/**
	 * Exclude specific auto-configuration class names such that they will never be
	 * applied.
	 * @return the class names to exclude
	 * @since 1.3.0
	 */
	String[] excludeName() default {};

}
```

有朋友可能会说我在使用SpringBoot时并没有用这个注解为什么也能实现自动装配呢？那时因为我们平时使用的`@SpringBootApplication`注解已经包含了`@EnableAutoConfiguration`

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@SpringBootConfiguration
@EnableAutoConfiguration
@ComponentScan(excludeFilters = { @Filter(type = FilterType.CUSTOM, classes = TypeExcludeFilter.class),
		@Filter(type = FilterType.CUSTOM, classes = AutoConfigurationExcludeFilter.class) })
public @interface SpringBootApplication {
//...
}
```



#### spring.factories

通过`@EnableAutoConfiguration`启用自动装配后，我们必须配置我们的"自动装配类"让SpringBoot自动加载，这时我们需要把我们的类注册到Spring.factories的配置文件中，这个配置会被我们的SpringFactoriesLoader类加载。

**配置spring.factories**

配置方式十分简单，采用的是key=value的方式，就跟我们的properties文件一样，如果一个key有多个value，使用`,`作为切割，下面配置用于配置自动装配类。

```properties
# Auto Configure
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
org.springframework.boot.autoconfigure.admin.SpringApplicationAdminJmxAutoConfiguration,\
org.springframework.boot.autoconfigure.aop.AopAutoConfiguration,\
```

SpringBoot定义了很多自己的key，包括不限于自动装配、监听、初始化等等，详情可以参考[META-INF/spring.factories](https://github.com/spring-projects/spring-boot/blob/v2.0.0.M3/spring-boot-autoconfigure/src/main/resources/META-INF/spring.factories)。

需要注意的是，如果我们的配置类使用了`@After`之类要求顺序的注解，它必须要注册在spring.factories文件才会生效，原因下面会提及。



#### SpringFactoriesLoader

SpringFactoriesLoader是Spring提供的SPI，它的作用就类似于JDK 的SPI。区别在于SpringFactoriesLoader是只加载spring.factories文件，而JDK SPI则更为灵活。

SpringFactoriesLoader虽然在SpringBoot中很常用，不过它是Spring Framework中的成员，Spring3.2就已经加入了这个类。这个类的作用是提供给框架内部实现加载机制，它会寻找classpath下的spring.factories文件，对这个文件中的配置类进行加载和排序等操作。

```java
	public static <T> List<T> loadFactories(Class<T> factoryType, @Nullable ClassLoader classLoader) {
		Assert.notNull(factoryType, "'factoryType' must not be null");
		ClassLoader classLoaderToUse = classLoader;
		if (classLoaderToUse == null) {
			classLoaderToUse = SpringFactoriesLoader.class.getClassLoader();
		}
		List<String> factoryImplementationNames = loadFactoryNames(factoryType, classLoaderToUse);
		if (logger.isTraceEnabled()) {
			logger.trace("Loaded [" + factoryType.getName() + "] names: " + factoryImplementationNames);
		}
		List<T> result = new ArrayList<>(factoryImplementationNames.size());
		for (String factoryImplementationName : factoryImplementationNames) {
			result.add(instantiateFactory(factoryImplementationName, factoryType, classLoaderToUse));
		}
		AnnotationAwareOrderComparator.sort(result);
		return result;
	}
```

留意加载的倒数第二行，对它的结果进行了一次排序，这就是为什么`@After`之类的注解想要生效必须把类注册到spring.factories的原因。

### 总结
自动装配并不是SpringBoot的专属，早在Spring Framework时代就有框架做了相关的自动装配功能。只是SpringBoot又对它进行了一定的规范，使得它更加强大、易用以及高度可扩展。
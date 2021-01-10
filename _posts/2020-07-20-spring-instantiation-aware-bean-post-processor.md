---
title: 谈谈Spring中的InstantiationAwareBeanPostProcessor
key: spring-instantiation-aware-bean-post-processor
permalink: spring-instantiation-aware-bean-post-processor.html
tags: Java Spring
---

熟悉Spring的朋友应该都知道`InstantiationAwareBeanPostProcessor`这个接口。从它的继承结构可以看出它是一个BeanPostProcessor，不过它是一个非常特殊的BeanPostProcessor，因为它的贯穿了bean创建的每一个周期。

### Bean创建流程

![/assets/images/bean/spring-iiap-class.png](https://bigbyto.gitee.io/assets/images/bean/spring-iiap-class.png){:.img-fallback}

上面展示了`InstantiationAwareBeanPostProcessor`3个主要的方法，它们都会在Bean的创建周期中被回调，用以实现拦截或其他的自定义处理。前三个方法分别是实例化之前阶段、实例化后阶段、赋值阶段。因为第四个已经被废弃，这里也不在赘述。

上面提到的三个方法，其实正好是对应了Spring Bean创建周期，对于一个普通的Spring Bean，当它被请求创建时，会经历下面的流程

![/assets/images/bean/bean-creation.jpg](https://bigbyto.gitee.io/assets/images/bean/bean-creation.jpg){:.img-fallback}
<!--more-->

对于`InstantiationAwareBeanPostProcessor`而言，它的每个方法都会在Bean的创建周期被回调，我大概画了一下图

![/assets/images/bean/instantation.jpg](https://bigbyto.gitee.io/assets/images/bean/instantation.jpg){:.img-fallback}


### 源码分析

本小节将结合源代码展示InstantiationAwareBeanPostProcessor是如何贯穿一整个Bean的创建周期。上面提到Bean创建主要有四个流程，分别为

* createBean
* instantation
* populate
* initialization

这个流程都在默认的DefaultListableBeanFactory中，我们打开这个类，一个个解开其中的秘密。

#### createBean

```java
protected Object createBean(String beanName, RootBeanDefinition mbd, @Nullable Object[] args)
			throws BeanCreationException {

	if (logger.isTraceEnabled()) {
		logger.trace("Creating instance of bean '" + beanName + "'");
	}
	RootBeanDefinition mbdToUse = mbd;

	// Make sure bean class is actually resolved at this point, and
	// clone the bean definition in case of a dynamically resolved Class
	// which cannot be stored in the shared merged bean definition.
	Class<?> resolvedClass = resolveBeanClass(mbd, beanName);
	if (resolvedClass != null && !mbd.hasBeanClass() && mbd.getBeanClassName() != null) {
		mbdToUse = new RootBeanDefinition(mbd);
		mbdToUse.setBeanClass(resolvedClass);
	}

	// Prepare method overrides.
	try {
		mbdToUse.prepareMethodOverrides();
	}
	catch (BeanDefinitionValidationException ex) {
		throw new BeanDefinitionStoreException(mbdToUse.getResourceDescription(),
				beanName, "Validation of method overrides failed", ex);
	}

	try {
		// Give BeanPostProcessors a chance to return a proxy instead of the target bean instance.
		Object bean = resolveBeforeInstantiation(beanName, mbdToUse);
		if (bean != null) {
			return bean;
		}
	}
	catch (Throwable ex) {
		throw new BeanCreationException(mbdToUse.getResourceDescription(), beanName,
				"BeanPostProcessor before instantiation of bean failed", ex);
	}

	try {
		Object beanInstance = doCreateBean(beanName, mbdToUse, args);
		if (logger.isTraceEnabled()) {
			logger.trace("Finished creating instance of bean '" + beanName + "'");
		}
		return beanInstance;
	}
	catch (BeanCreationException | ImplicitlyAppearedSingletonException ex) {
		// A previously detected exception with proper bean creation context already,
		// or illegal singleton state to be communicated up to DefaultSingletonBeanRegistry.
		throw ex;
	}
	catch (Throwable ex) {
		throw new BeanCreationException(
				mbdToUse.getResourceDescription(), beanName, "Unexpected exception during bean creation", ex);
	}
}

```

在createBean阶段有个重要部分，即图片圈出部分，在这里调用了resolveBeforeInstantiation，如果返回值不为null，直接返回bean，结束bean的创建流程。根据第一小节的叙述，相信你很容易就猜出这里肯定回调了InstantiationAwareBeanPostProcessor的postProcessBeforeInstantiation方法。

```java
protected Object resolveBeforeInstantiation(String beanName, RootBeanDefinition mbd) {
	Object bean = null;
	if (!Boolean.FALSE.equals(mbd.beforeInstantiationResolved)) {
		// Make sure bean class is actually resolved at this point.
		if (!mbd.isSynthetic() && hasInstantiationAwareBeanPostProcessors()) {
			Class<?> targetType = determineTargetType(beanName, mbd);
			if (targetType != null) {
				bean = applyBeanPostProcessorsBeforeInstantiation(targetType, beanName);
				if (bean != null) {
					bean = applyBeanPostProcessorsAfterInitialization(bean, beanName);
				}
			}
		}
		mbd.beforeInstantiationResolved = (bean != null);
	}
	return bean;
}

/**
	* Apply InstantiationAwareBeanPostProcessors to the specified bean definition
	* (by class and name), invoking their {@code postProcessBeforeInstantiation} methods.
	* <p>Any returned object will be used as the bean instead of actually instantiating
	* the target bean. A {@code null} return value from the post-processor will
	* result in the target bean being instantiated.
	* @param beanClass the class of the bean to be instantiated
	* @param beanName the name of the bean
	* @return the bean object to use instead of a default instance of the target bean, or {@code null}
	* @see InstantiationAwareBeanPostProcessor#postProcessBeforeInstantiation
	*/
@Nullable
protected Object applyBeanPostProcessorsBeforeInstantiation(Class<?> beanClass, String beanName) {
	for (BeanPostProcessor bp : getBeanPostProcessors()) {
		if (bp instanceof InstantiationAwareBeanPostProcessor) {
			InstantiationAwareBeanPostProcessor ibp = (InstantiationAwareBeanPostProcessor) bp;
			Object result = ibp.postProcessBeforeInstantiation(beanClass, beanName);
			if (result != null) {
				return result;
			}
		}
	}
	return null;
}
```

上面代码可以看到它会遍历所有的InstantiationAwareBeanPostProcessor，回调postProcessBeforeInstantiation，得到结果立即返回。就如我们流程图展示的一样，当这里返回值不为空，那么bean的创建流程已经结束(因为实例化、赋值、依赖关系都交给postProcessBeforeInstantiation处理了，因此不需要ioc容器进行进一步处理)。


#### Instantation

上一步如果没被拦截，那么会进入doCreateBean方法，正式开始Bean的创建流程，首先第一步会调用createBeanInstance创建一个bean的实例。

![/assets/images/bean/spring-create-instance.png](https://bigbyto.gitee.io/assets/images/bean/spring-create-instance.png){:.img-fallback}


#### Populate

当bean实例完成创建时，此时需要对bean进行赋值。

![/assets/images/bean/populate-1.png](https://bigbyto.gitee.io/assets/images/bean/populate-1.png){:.img-fallback}

我们跟进populateBean方法，就能发现在这里会调用InstantiationAwareBeanPostProcessor的postProcessProperties方法。这里是重点，因为Bean的依赖注入是在这里完成的。

 ![/assets/images/bean/spring-bean-post-process.png](https://bigbyto.gitee.io/assets/images/bean/spring-bean-post-process.png){:.img-fallback}

在这里可以看到我们`InstantiationAwareBeanPostProcessor`有一个实现类是`AutowiredAnnotationBeanPostProcessor`，打开查看它的`postProcessProperties`方法，就会在那里发现依赖注入的流程。

```java
public PropertyValues postProcessProperties(PropertyValues pvs, Object bean, String beanName) {
	InjectionMetadata metadata = findAutowiringMetadata(beanName, bean.getClass(), pvs);
	try {
		metadata.inject(bean, beanName, pvs);
	}
	catch (BeanCreationException ex) {
		throw ex;
	}
	catch (Throwable ex) {
		throw new BeanCreationException(beanName, "Injection of autowired dependencies failed", ex);
	}
	return pvs;
}
```


#### Initialization
当bean赋值完成后(完成依赖注入)，就来到了最后一步: 初始化。这里会回调Bean的一些生命周期方法。

```java
protected Object initializeBean(final String beanName, final Object bean, @Nullable RootBeanDefinition mbd) {
	if (System.getSecurityManager() != null) {
		AccessController.doPrivileged((PrivilegedAction<Object>) () -> {
			invokeAwareMethods(beanName, bean);
			return null;
		}, getAccessControlContext());
	}
	else {
		invokeAwareMethods(beanName, bean);
	}

	Object wrappedBean = bean;
	if (mbd == null || !mbd.isSynthetic()) {
		wrappedBean = applyBeanPostProcessorsBeforeInitialization(wrappedBean, beanName);
	}

	try {
		invokeInitMethods(beanName, wrappedBean, mbd);
	}
	catch (Throwable ex) {
		throw new BeanCreationException(
				(mbd != null ? mbd.getResourceDescription() : null),
				beanName, "Invocation of init method failed", ex);
	}
	if (mbd == null || !mbd.isSynthetic()) {
		wrappedBean = applyBeanPostProcessorsAfterInitialization(wrappedBean, beanName);
	}

	return wrappedBean;
}
```

留意一下invokeAwareMethods和invokeInitMethods即可，这里没什么太多值得讲的。



### InstantiationAwareBeanPostProcessor注册
上面提到的`AutowiredAnnotationBeanPostProcessor`是用来帮我们解决注解驱动的依赖注入，那么它是什么时候被添加到Spring上下文的呢？实际上不同的ApplicationContext在创建时会有不同的行为。当ApplicationContext是AutowiredAnnotationBeanPostProcessor时，在创建的同时，也会创建`AnnotatedBeanDefinitionReader`这个类

```java
public AnnotationConfigApplicationContext(DefaultListableBeanFactory beanFactory) {
	super(beanFactory);
	this.reader = new AnnotatedBeanDefinitionReader(this);
	this.scanner = new ClassPathBeanDefinitionScanner(this);
}
```

```java
public AnnotatedBeanDefinitionReader(BeanDefinitionRegistry registry, Environment environment) {
	Assert.notNull(registry, "BeanDefinitionRegistry must not be null");
	Assert.notNull(environment, "Environment must not be null");
	this.registry = registry;
	this.conditionEvaluator = new ConditionEvaluator(registry, environment, null);
	AnnotationConfigUtils.registerAnnotationConfigProcessors(this.registry);
}
```

留意上面的`AnnotationConfigUtils.registerAnnotationConfigProcessors(this.registry)`，就是在这里进行了大量的注册。

![/assets/images/bean/spring-annotation-utils.png](https://bigbyto.gitee.io/assets/images/bean/spring-annotation-utils.png){:.img-fallback}


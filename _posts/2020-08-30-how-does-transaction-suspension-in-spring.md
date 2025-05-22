---
title: '深入理解Spring事务: Spring如何实现挂起事务'
key: how-does-transaction-suspension-in-spring
permalink: how-does-transaction-suspension-in-spring.html
tags: Spring Transaction
---

我们在看Spring的事务传播行为(Propagation)时会发现在某些条件下，线程会被挂起(suspend)，接着去执行其他事务。比如`Propagation.REQUIRES_NEW`有一段这样的描述:

> Create a new transaction, and suspend the current transaction if one exists.

这个挂起要怎么去理解呢？

**事务和线程的关系**

要理解事务挂起必须先了解事务和线程的关系。Oracle的文档中有个描述。

> When a transaction is created, it is associated with the thread that created it. As long as the transaction is associated with the thread, no other transaction can be created for that thread.
>
> Ref: https://docs.oracle.com/cd/E23095_01/Platform.93/ATGProgGuide/html/s1204transactionsuspension01.html

spring-tx的Propagation其实就是参考了EJB的Transaction设计。作为参考者，这方面和Oracle的设计是一致的。

当事务创建时，就会被绑定到一个线程上。该线程会伴随着事务整个生命周期，直到事务提交、回滚或挂起(临时解绑)。线程和事务的关系是1:1，当线程绑定了一个事务后，其他事务不可以再绑定该线程，反之亦然。
<!--more-->

**什么是事务挂起，如何实现挂起**

了解事务和线程的关系，也很容易理解事务挂起。对事务的配置在Spring内部会被封装资源(Resource)，线程绑定了事务，自然也绑定了事务相关的资源。挂起事务时，把这些资源取出临时存储，等待执行完成后，把之前临时存储的资源重新绑定到该线程上。

```java
//#TransactionSynchronizationManager.bindResource
public abstract class TransactionSynchronizationManager {
  //使用ThreadLocal, Resource和线程关系是1:1
	private static final ThreadLocal<Map<Object, Object>> resources =
			new NamedThreadLocal<>("Transactional resources");
	
  public static void bindResource(Object key, Object value) throws IllegalStateException {
		Object actualKey = TransactionSynchronizationUtils.unwrapResourceIfNecessary(key);
		Assert.notNull(value, "Value must not be null");
		Map<Object, Object> map = resources.get();
		// set ThreadLocal Map if none found
		if (map == null) {
			map = new HashMap<>();
			resources.set(map);
		}
		Object oldValue = map.put(actualKey, value);
		// Transparently suppress a ResourceHolder that was marked as void...
		if (oldValue instanceof ResourceHolder && ((ResourceHolder) oldValue).isVoid()) {
			oldValue = null;
		}
		if (oldValue != null) {
			throw new IllegalStateException("Already value [" + oldValue + "] for key [" +
					actualKey + "] bound to thread [" + Thread.currentThread().getName() + "]");
		}
		if (logger.isTraceEnabled()) {
			logger.trace("Bound value [" + value + "] for key [" + actualKey + "] to thread [" +
					Thread.currentThread().getName() + "]");
		}
	}
  
  //.....
}
```

事务挂起主要的代码在`AbstractPlatformTransactionManager#handleExistingTransaction`，下图可以看出在当前事务已经存在的情况下，部分`Propagation`会导致当前事务被挂起(suspend)。

![/assets/images/spring-tx/spring-tx-propagation.png](https://wiyi.org/assets/images/spring-tx/spring-tx-propagation.png)

当前事务挂起后会继续执行，直到执行完成再执行resume

`AbstractPlatformTransactionManager#cleanupAfterCompletion`

![/assets/images/spring-tx/resume-suspend-resource-after-commit.png](https://wiyi.org/assets/images/spring-tx/resume-suspend-resource-after-commit.png)

`cleanupAfterCompletion`这方法会在commit和rollback后执行。

![/assets/images/spring-tx/resume-invocation.png](https://wiyi.org/assets/images/spring-tx/resume-invocation.png)

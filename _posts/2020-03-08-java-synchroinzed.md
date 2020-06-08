---
title: Java什么时候才能用synchronized
key: java-synchronized
permalink: java-synchronized.html
tags: Java Concurrent
---

编写多线程的代码时，使用synchronized关键字能提供JVM级的线程同步。因为synchronized本身性能不高，于是Doug Lea编写了JUC模块，提供了AQS这样强大的接口，以及ReentrantLock这样方便的类。

也许你会听到有人跟你讲，jdk6后synchronized得到了优化，性能已经不低了。但实际上，在多线程竞争时，synchronized效率依然很低，线程竞争激烈时，还是不可以用synchronized，为什么呢？

![](https://wiki.openjdk.java.net/download/attachments/11829266/Synchronization.gif?version=4&modificationDate=1208918680000&api=v2)

上面的图片出自openjdk HotSpot对synchronized的描述，右边是jdk6以前的加锁流程，左边是jdk6后的优化，即加入了偏向锁。简单来说，当第一个线程进入synchronized代码块时，JVM会利用对象头的mark word存下当前线程ID，下次同一线程再进入，只需要对比线程ID即可，不需要经过右边那样的加锁过程。

因此我们可以看到，jdk6优化的是同一线程的进入，但在竞争激烈的情况下，还是要走普通的加锁流程。右边的流程，即是是同一线程进入，也要经过一次CAS操作判断锁的归属，CAS操作变多，带来的是很大的性能损耗。

那么ReentrantLock为什么性能更高呢？我们可以看看它的加锁过程。

```java
final boolean nonfairTryAcquire(int acquires) {
  final Thread current = Thread.currentThread();
  int c = getState();
  if (c == 0) {
    if (compareAndSetState(0, acquires)) {
      setExclusiveOwnerThread(current);
      return true;
    }
  }
  else if (current == getExclusiveOwnerThread()) {
    int nextc = c + acquires;
    if (nextc < 0) // overflow
      throw new Error("Maximum lock count exceeded");
    setState(nextc);
    return true;
  }
  return false;
}
```

上面代码，只有第一次获得锁时才会执行CAS操作，加锁失败会执行park进入队列等待唤醒。else if 判断的是线程重进入，只是对比线程，不需要执行CAS操作。因此，ReentrantLock在资源竞争激烈时，也能保持较高的性能。

回到原本的问题，什么情况下才能用synchronized呢? 很简单，在肯定资源几乎不会有竞争的情况下，才可以使用，比如spring的代码。

```java
	@Override
	public void refresh() throws BeansException, IllegalStateException {
		synchronized (this.startupShutdownMonitor) {
			// Prepare this context for refreshing.
			prepareRefresh();

			// Tell the subclass to refresh the internal bean factory.
			ConfigurableListableBeanFactory beanFactory = obtainFreshBeanFactory();

			// Prepare the bean factory for use in this context.
			prepareBeanFactory(beanFactory);

			......
		}
	}
```

还有一点需要注意，使用synchronized最好创建一个Object作为Lock，不要尝试去锁定某个对象本身。因为一旦访问了对象的hash code，偏向锁会失效。

```java
Object lock = new Object();
synchronized(lock) {
  //do something...
}

//不要这样做
//synchronized(this) {
//}
```

想要知道这些的所有原因，就必须去读一下openjdk这篇文章了。[Synchronization and Object Locking](https://wiki.openjdk.java.net/display/HotSpot/Synchronization)。



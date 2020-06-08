---
title: Java调用wait()和notify()必须获得锁的原因
key: why-wait-notify-must-called-in-synchronized-block
permalink: why-wait-notify-must-called-in-synchronized-block.html
tags: Java Concurrent
---

今天看到个很有意思的问题，《为什么使用 notify 和 notifyAll 的时候要先获得锁》？

这个问题其实真不好回答，就像大家习以为常的事物，突然被问为什么了。这问题我思考了一下，同时也去stackoverflow找到同类型的问题，不过答案都无法令我满意。最后翻到了jls(Java Language Specification)，大概知道了真正的原因。

我觉得为什么notify必须要synchorized，根本原因在于对jls规范中规定了对wait set的操作必须是原子的。先看看jls对wait set的描述。

> Every object, in addition to having an associated monitor, has an associated *wait set*. A wait set is a set of threads.
>
> When an object is first created, its wait set is empty. **Elementary actions that add threads to and remove threads from wait sets are atomic**. Wait sets are manipulated solely through the methods `Object.wait`, `Object.notify`, and `Object.notifyAll`.
>
> Ref: https://docs.oracle.com/javase/specs/jls/se8/html/jls-17.html

简单来说，当对象创建时，会顺带创建Monitor和Wait Set，这些是在C语言层面去创建的。然后它告诉我们对Wait Set的操作都是原子的，这就能解释，为什么wait和notify必须获得锁。因为没有锁，就没办法保证对wait set的操作是原子的。



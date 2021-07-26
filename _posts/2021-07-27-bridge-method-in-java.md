---
title: '理解Java中的Bridge Method'
key: bridge-method-in-java
permalink: bridge-method-in-java.html
tags: 多态
---

bridge method又叫synthetic method，它是由Java编译器自动生成的一个合成方法，这个方法不会出现在源码中，也不能显式调用。我们先通过一个例子对bridge method有一个感性的认识。

```java
// Code 1-1
class Animal {
  public Animal getAnimal() {
    return new Animal();
  }
}

class Dog extends Animal {
  public Dog getAnimal() {
    return new Dog();
  }
}
```

上面定义了Animal和Dog两个类，Dog是Animal的subclass，且Dog类override了Animal的`getAnimal`方法。如果你现在尝试去编译Dog，很大概率是可以直接通过编译，不过当我们尝试使用JDK 1.4以下版本编译，就是另外一回事了。

```shell
javac org/wiyi/bridge/Dog.java
org/wiyi/bridge/Dog.java:6: getAnimal() in org.wiyi.bridge.Dog cannot override g
etAnimal() in org.wiyi.bridge.Animal; attempting to use incompatible return type

found   : org.wiyi.bridge.Dog
required: org.wiyi.bridge.Animal
  public Dog getAnimal() {
             ^
1 error
```
<!--more-->

低版本的JDK编译会报错，提示的错误为"cannot override getAnimal() in org.wiyi.bridge.Animal;"。为什么无法override getAnimal方法呢？要了解这个，我们需要知道在JVM中对method override的定义。

> An instance method `m1` declared in class C overrides another instance method `m2` declared in class A iff either `m1` is the same as `m2`, or all of the following are true:
>
> - C is a subclass of A.  //C是A的subclass
> - `m1` has the same name and descriptor as `m2`. // m1和m2的方法名和descriptor相同
> - `m1` is not marked `ACC_PRIVATE`. //m1不能为private
> - One of the following is true:
>   - `m2` is marked `ACC_PUBLIC`; or is marked `ACC_PROTECTED`; or is marked neither `ACC_PUBLIC` nor `ACC_PROTECTED` nor `ACC_PRIVATE` and A belongs to the same run-time package as C.
>   - `m1` overrides a method `m'` (`m'` distinct from `m1` and `m2`) such that `m'` overrides `m2`.

根据上面的定义，我们可以逐个对比Dog类中到底哪条不满足，使用高版本的JDK编译Animal和Dog并查看对比它们的字节码。

```shell
#openjdk version "11.0.6
javap -v org.wiyi.bridge.Dog
javap -v org.wiyi.bridge.Animal
```

```java
//Dog.class
org.wiyi.java9.generic.Dog getAnimal(); //1.方法名都是getAnimal
    descriptor: ()Lorg/wiyi/java9/generic/Dog; //2.Dog的descriptor为Lorg/wiyi/java9/generic/Dog
    flags: (0x0000)
    Code:
      stack=2, locals=1, args_size=1
         0: new           #2                  // class org/wiyi/java9/generic/Dog
         3: dup
         4: invokespecial #3                  // Method "<init>":()V
         7: areturn
        Start  Length  Slot  Name   Signature
            0       8     0  this   Lorg/wiyi/java9/generic/Dog;
```

```java
//Animal.class
org.wiyi.java9.generic.Animal getAnimal(); //1.方法名为Animal
    descriptor: ()Lorg/wiyi/java9/generic/Animal; //2.Animal的descriptor为Lorg/wiyi/java9/generic/Animal;
    flags: (0x0000)
    Code:
      stack=2, locals=1, args_size=1
         0: new           #2                  // class org/wiyi/java9/generic/Animal
         3: dup
         4: invokespecial #3                  // Method "<init>":()V
         7: areturn
      LocalVariableTable:
        Start  Length  Slot  Name   Signature
            0       8     0  this   Lorg/wiyi/java9/generic/Animal;
```

从上面的字节码可以看出，Dog的`getAnimal()`方法和Animal的`getAnimal`方法的descriptor不同，因此，在JVM的层面上，它们是**完全没有任何关系的两个方法**，不能构成Override;因为方法重名参数一致，同时也不构成Overload，因此编译器会报错。

那么为什么高版本的Java编译器不会报错呢？因为JDK 1.5以上的版本支持了方法返回值的协变，编译源码时会生成一个Bridge Method实现Override。我们查看Dog类完整的字节码，会发现有两个getAnimal方法。

```java
Classfile Dog.class
  Compiled from "Dog.java"
public class org.wiyi.java9.generic.Dog extends org.wiyi.java9.generic.Animal
  minor version: 0
  major version: 55
{
  public org.wiyi.java9.generic.Dog();
    descriptor: ()V
    flags: (0x0001) ACC_PUBLIC
    Code:
      stack=1, locals=1, args_size=1
         0: aload_0
         1: invokespecial #1                  // Method org/wiyi/java9/generic/Animal."<init>":()V
         4: return
      LineNumberTable:
        line 3: 0
      LocalVariableTable:
        Start  Length  Slot  Name   Signature
            0       5     0  this   Lorg/wiyi/java9/generic/Dog;

  org.wiyi.java9.generic.Dog getAnimal(); //bigbyto注: 第一个getAnimal
    descriptor: ()Lorg/wiyi/java9/generic/Dog;
    flags: (0x0000)
    Code:
      stack=2, locals=1, args_size=1
         0: new           #2                  // class org/wiyi/java9/generic/Dog
         3: dup
         4: invokespecial #3                  // Method "<init>":()V
         7: areturn
      LineNumberTable:
        line 5: 0
      LocalVariableTable:
        Start  Length  Slot  Name   Signature
            0       8     0  this   Lorg/wiyi/java9/generic/Dog;

  org.wiyi.java9.generic.Animal getAnimal();//bigbyto注: 第二个getAnimal
    descriptor: ()Lorg/wiyi/java9/generic/Animal;
    flags: (0x1040) ACC_BRIDGE, ACC_SYNTHETIC
    Code:
      stack=1, locals=1, args_size=1
         0: aload_0
         1: invokevirtual #4                  // Method getAnimal:()Lorg/wiyi/java9/generic/Dog;
         4: areturn
      LineNumberTable:
        line 3: 0
      LocalVariableTable:
        Start  Length  Slot  Name   Signature
            0       5     0  this   Lorg/wiyi/java9/generic/Dog;
}
SourceFile: "Dog.java"
```

我们留意第二个`getAnimal`方法，它的descriptor依然是`Lorg/wiyi/java9/generic/Animal`，且它的flags多了两个**ACC_BRIDGE**, **ACC_SYNTHETIC**，这两个flag的意思即表明这是由编译器生成的Bridge Method。

第二个`getAnimal`内部使用了invokevirtual这条指令，这意味着这个Bridge Method内部主要的逻辑就是直接调用第一个`getAnimal`方法返回结果，它的伪代码如下:

```java
class Dog extends Animal {
  Dog getAnimal() {
    return new Dog();
  }
  
  synthetic bridge Animal getAnimal() {
    return ((Dog)this).getAnimal();
  }
}
```

从上面的结果可以看出，Java语言和JVM它们对类型系统的定义其实存在一些差异。在本文的例子中，Dog的getAnimal方法把原返回值Animal改为了Dog，这属于方法返回值协变，是多态中的一部分。但在JVM中它们对它们的定义并不相同，因此通过Bridge Method的方式把两套类型系统连接到一起。

当我们理解了Bridge Method的本质，在看Oracle官网的[Effects of Type Erasure and Bridge Methods](https://docs.oracle.com/javase/tutorial/java/generics/bridgeMethods.html)就可以理解它为什么对于泛型会有很大的帮助。

**参考资料:**   
[JVM Bridge Methods with Dan Heidinga](https://www.youtube.com/watch?v=kOBHtmqavXc&list=WL&index=8&t=705s)   
[https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-5.html#jvms-5.4.5](https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-5.html#jvms-5.4.5)
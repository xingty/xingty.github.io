---
title: 谈谈Java的变异(不变 协变 逆变)
key: variance-in-java
permalink: variance-in-java.html
tags: Java OOP Generic
---

### Subtyping

要想了解变异先要理解Subtyping的概念。Subtyping是面向对象里"类型多态(Type Polymorphism)"的其中一种表现形式，它主要描述"is a"这样的关系。比如`S`是`T`的子类型，那么他们的关系可以表达为 **S is a subtype of T**。维基百科有一段对Subtyping的描述。

> In programming language theory, subtyping (also subtype polymorphism or inclusion polymorphism) is a form of type polymorphism in which a subtype is a datatype that is related to another datatype (the supertype) by some notion of substitutability.
>
> **If S is a subtype of T, the subtyping relation is often written S <: T**, to mean that any term of type S can be **safely used in a context where** a term of type T is expected

Subtyping和变异有什么联系呢？变异其实就是指Subtyping在更复杂的场景下，比如**If S is a subtype of T**, **Generic&lt;S&gt; is subtype of Generic&lt;T&gt;**这种关系是否还能成立。
<!--more-->
### 变异 (Variance)

"变异"，在面向对象编程中是非常重要的一个概念。在Java8新增的Stream API和Functional中大量使用了<? extends T> 和 <? super T>这类语法，不从根本上去理解Java的变异，看到这些源码时就会有点吃力和费解。

变异，英文单词是Variance，或者称为变型。维基百科对变异的解释为

> Variance refers to how subtyping between more complex types relates to subtyping between their components

通过上面对Subtyping的介绍，我们也可以得知变异和Subtyping关系是非常密切的。那么上面提到的更复杂的场景是指什么呢？举个例子，现在有Fruit、Apple、Orange三个类; 已知 Apple和Orange是Fruit的子类型。

```java
class Fruit {
  
}

class Apple extends Fruit {
  
}

class Orange extends Fruit {
  
}
```

在Java中，我们可以这样表达它们之间的关系，这也是我们上面提到的Subtyping。

```java
Fruit apple = new Apple();

Fruit orange = new Orange();
```

上面的语句是完全合法的，因为Fruit是Apple和Orange的父类型，因此我们可以描述"苹果是水果的子类型"，"橘子是水果子类型"这样的一类关系。不过，当关系变得更加复杂时，它们的关系可能会变得难以捉摸。比如装苹果的篮子是水果篮子的子类型吗?

```java
class Basket<T> {
  T t;
  
  public void set(T t) {
    this.t = t;
  }
  
  public T get() {
    return this.t;
  }
}
//这种关系是否正确?
Basket<Fruit> basket = new Basket<Apple>();
```

Basket<Fruit> basket = new Basket<Apple>() 这个语句是否合法，取决于编程语言的设计。在Java中，明确并不支持这种定义(2019年暂未实现，未来不一定)。

变异分为下面几种形式

* 不变(Invariance)
* 协变(Covariance)
* 逆变(Contravariance)
* 双变(Bi-variance)

因为java中不存在双变，本文不与讨论这种场景。下面将会分开讨论前3者具体的作用，以及他们的使用场景。

### 不变 (Invariance)

不变描述的是这样一种关系:  **如果B是A的子类型(SubType)，那么GenericType&lt;B&gt; 不是 GenericType&lt;A&gt;的子类型。**从上面的介绍可以看到在Java中，泛型是不变的。

```java
Basket<Fruit> basket = new Basket<Apple>(); //编译报错
```

上面代码编译会直接报错，因为在Java中泛型是不变的。

#### 优点

保证类型安全，因为水果篮子并不一定是装着苹果，也可以装橘子。如basket.set(new Orange())，我们期望的是一个苹果，如果set一个橘子，这样无法保证类型安全。 不变的泛型从根本上杜绝了类型安全问题。

#### 缺点

虽然保证了类型安全，不过灵活性大大下降，因为我们无法描述Basket<Fruit> basket = new Basket<Apple>()这种关系。



### 协变 (Covariance)

如果B是A的子类型，那么GenericType&lt;B&gt; 是 GenericType&lt;A&gt;的子类型。或者更通俗一点，以上面苹果橘子为例，协变描述的是: **装苹果的篮子是水果篮子**这样一种关系。

很遗憾，Java不支持Declaration-site variance，不过Java支持Use-site variance。

#### Java中的协变

虽然Java的泛型不是协变，不过数组是协变的。

```java
Fruit[] fruits = new Apple[2]; //合法
fruits[0] = new Apple(); //合法
fruits[1] = new Orange(); //编译时合法,运行时 throw ArrayStoreException
```

我们在泛型中使用"extends"关键字，可以让Java的泛型支持协变。

```java
public static void covariance() {
  Basket<? extends Fruit> basket = new Basket<Apple>(); //合法
  List<? extends Fruit> list = new Arraylist<Orange>(); //合法
  
  //basket.set(new Orange()); //报错
  //basket.set(new Apple()); //报错
  //basket.set(new Fruit()); //报错
  
  Basket<Apple> applesOfBasket = new Basket<>();
  applesOfBasket.set(new Apple());
  basket = applesOfBasket; // 正确
  
  // list同理
}
```

如我们所见，每次调用set时都无法通过编译，因为此时编译器并不知道确切的类型。Basket<? extends Fruit>表达的意思是: 一个Basket类型，它的Type Argument是一个extends Fruit的未知类型。这样的目的是为了保证类型安全。

Basket<? extends Fruit> basket = xx这种叫**Use-site variance**。JEP300有一个提案，说不定java以后会支持Declaration-site variance，有兴趣的朋友可以自己去瞄几眼。[JEP 300: Augment Use-Site Variance with Declaration-Site Defaults](https://openjdk.java.net/jeps/300)。

如果支持Declaration-site variance，下面语句将会合法。

```java
interface Basket<covariance T> {
}

Basket<Apple> apples = new Basket<>();
Basket<Fruit> fruits = apples;
```

#### 优点

显而易见的，协变可以让我们的编码变得更加灵活。

### 逆变 (Contravariance)

在Subtyping一节有提到，当`S`是`T`的子类型，那么他们的关系可以表达为 **S is a subtype of T**，记作 `S <: T` 逆变就是逆转次序，**`T`  is a supertype of `S`**,记作 `T :> S`。

```java
//协变 S<:T
Basket<? extends Fruit> basket1 = new Basket<>();
//逆变 T:>S
Basket<? super Apple> basket2 = new Basket<Fruit>();
```

仔细看上面代码，协变和逆变在代码描述上面，次序是相反的。

#### 类型安全

逆变同样是无法保证类型安全，不过它和协变不一样，它支持更新或添加数据。

```java
Basket<? super Apple> basket = new Basket<Fruit>();
basket.setApple(new Apple()); //合法

Apple apple = basket.get(); //合法

Basket<Fruit> tmp = new Basket<Fruit>();
tmp.set(new Orange());

Basket<? super Apple> basket2 = tmp;
// Apple apple2 = basket2.get(); //无法通过编译
Apple apple2 = (Apple)basket2.get(); //ClassCastException
```

上面倒数第二行代码会报错，原因是Java无法保证你取出来的一定是Apple，这个很好理解。代码最后一行运行时会抛出ClassCastException，因为我们放进去的是Orange，因此逆变也无法保证类型安全。



### PECS

PECS 全称是 Producer Extends Consumer Super，我觉得叫Supplier Extends Consumer Super更贴切一些。这是《effective java》作者提出的一种什么情况下选择extends和super的办法。

stackoverflow有个答案解释的很不错，简单来说需要获取(get)T的实例时，使用extends;当需要使用T的实例时，用super。原因上面描述过了，extends虽然支持协变，但是无法知道T到底是什么类型，因此无法使用。

> This means that when a parameterized type being passed to a method will *produce* instances of `T` (they will be retrieved from it in some way), `? extends T` should be used, since any instance of a subclass of `T` is also a `T`.
>
> When a parameterized type being passed to a method will *consume* instances of `T` (they will be passed to it to do something), `? super T` should be used because an instance of `T` can legally be passed to any method that accepts some supertype of `T`. A `Comparator` could be used on a `Collection`, for example. `? extends T` would not work, because a `Comparator` could not operate on a `Collection`.
>
> Ref: https://stackoverflow.com/a/2248503



### 结语

通过本文叙述，相信一定程度上能让你理解变异。如果熟悉面向对象编程的概念，会更加容易理解。所谓"面向对象"存在着大量的定义和概念。定义，必须严谨，必定晦涩难懂，因此对于初学者会很不友好。于是很多初学者(包括我~)刚接触面向对象编程时就会找一些"通俗易懂"的资料方便理解。但"通俗"通常意味着不严谨，存在信息丢失，因此如果想真正学好面向对象编程，还是非常有必要看看它们原本的定义和概念。

个人觉得支持Declaration-Site Variance Java泛型才算完整。不过让人吐槽的是JEP 2014年就开始提出，直到2019年了也没见出现在JSR，标准化流程的效率真是漫长啊...希望在Java能早日用上Declaration-Site Variance。



### 参考资料   
[Declaration-site and use-site variance explained](https://schneide.blog/2015/05/11/declaration-site-and-use-site-variance-explained/)   
[Covariance and contravariance (computer science)](https://en.wikipedia.org/wiki/Covariance_and_contravariance_(computer_science))   
[JEP 300: Augment Use-Site Variance with Declaration-Site Defaults](https://openjdk.java.net/jeps/300)   
[https://stackoverflow.com/a/2248503](https://stackoverflow.com/a/2248503)


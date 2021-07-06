---
title: '深入理解面向对象中的多态'
key: polymorphism-in-java
permalink: polymorphism-in-java.html
tags: 多态
---

## 多态

多态并非是计算机科学领域的专有名词，在其他领域比如生物领域也有使用。比如猫科动物中，有狮子、老虎、豹、山猫等，其中雄性狮子会有很长的胡须等，都是现实生活中的多态。

基于上面的描述，我们不难理解计算机领域中的"多态"，实际上它也是对现实世界的一种抽象。在现实中，猫可以代指小猫咪、老虎、狮子等动物，具体到计算机领域的抽象，可以用下面语法表达:

```java
Cat cat = new Tiger();
```

用一个符号来表现同一种类型的不同形态，这就是多态。相信所有Java程序员对上面语法早已烂熟于心，这种语法属于多态中的一个分支，叫Subtyping(也叫subtype polymorphism，子类型多态)。

多态是类型系统中一个重要的概念，在Java语言中，实现了3种类型的多态，分别为:

* Ad hoc polymorphism (特殊的多态)
* subtype polymorphism (子类型多态)
* Parametric polymorphism (参数化多态)

本文将详细介绍这3种类型的多态，进一步加深对多态的理解。
<!--more-->

## Ad hoc polymorphism

开始之前我们先了解下Ad hoc要表达的意思，维基百科解释如下:

> ***Ad hoc*** 是一个拉丁文常用短语。这个短语的意思是“特设的、特定目的的、临时的、将就的、专案的”。这个短语通常用来形容一些特殊的、不能用于其它方面的，为一个特定的问题、任务而专门设定的解决方案。

看完上面的定义，可以大概理解到这种类型的多态只适用于一些比较特设的场景，维基百科对它的定义如下:

> the term ad hoc polymorphism to refer to polymorphic functions that can be applied to arguments of different types, but that behave differently depending on the type of the argument to which they are applied (also known as function overloading or operator overloading).

ad hoc polymorphism是指多态函数可以填入不同类型的参数，根据不同类型的参数产生不同的行为。比如java中常见的方法重载(method overloading)就符合这个定义。打开String类的valueOf方法，可以看到很多个同样名字，不同参数，不同行为的方法，这种就是所谓"特设"。

```java
public final class String
    implements java.io.Serializable, Comparable<String>, CharSequence {
  public static String valueOf(boolean b) {
        return b ? "true" : "false";
    }

    public static String valueOf(char c) {
        if (COMPACT_STRINGS && StringLatin1.canEncode(c)) {
            return new String(StringLatin1.toBytes(c), LATIN1);
        }
        return new String(StringUTF16.toBytes(c), UTF16);
    }

    public static String valueOf(int i) {
        return Integer.toString(i);
    }

    public static String valueOf(long l) {
        return Long.toString(l);
    }
}
```

同样的，C++中的操作符重载也归类于此。因为我不懂C++，这里就不再赘述。


## Subtype polymorphism

Subtype polymorphism又叫subtyping，中文名称叫"子类型多态"。在文章开头已经通过一个小例子阐述子类型多态，但要严谨的阐述它的概念，还是要看一下定义。维基百科对subtyping有如下描述

> subtyping is a form of type polymorphism in **which a subtype is a datatype that is related to another datatype (the supertype) by some notion of substitutability**, meaning that program elements, typically subroutines or functions, written to operate on elements of the supertype can also operate on elements of the subtype. 
>

subtyping是类型多态其中一种形式，它指的是**subtype(一种数据类型)和另一种数据类型(supertype)的一种可替换关系**。这意味着在我们的程序中，supertype的所有函数调用，可以被subtype完全替换。

举个例子，Java中的String完整实现了CharSequence，CharSequence的任何方法调用都可被String替换，那么我们可以说String is a subtype of CharSequence.

简单来说，subtyping描述的是类型之间"可替换"的关系，它是**一种抽象的概念**，**一种理论**。当A是B的subtype时，可以用`A <: B`表示，且存在以下关系: 

* 自反性

  即`A <: A`，`B <: B`

* 传递性

  如果满足 `A <: B`，`B <: C`，那么 `A <: C`

* 隐式类型转换

  `A <: B`，说明B的所有函数调用都可以被A替换，那么可以认为A可以安全的转换为B，写作 `A → B`。

  比如String就可以被隐式转换为CharSequence，这就是Java中最常用的多态

  ```java
  CharSequence cs = "polymorphism";
  ```

### subtyping和inheritance

子类型和继承是最容易被混淆的概念，实际上它们是完全独立的两个概念。subtyping是一种描述类型之间可替换关系的一种概念，而inheritance是一种代码复用的手段。对于满足subtypeing关系的类型，它们不一定存在inheritance关系，上面的String就是很好的例子。

对于类型S和T而言，它们存在以下subtypping和inheritance的可能

1. *S* 既不是T的subtype也不继承于*T*

   这个非常容易理解，比如String和Number就是没有任何关系的两种类型

2. *S* 是T的subtype，但S不继承于*T*

   例如java中的long和int就属于这种关系。long并不是继承int，不过long是int的subtype，因为任何int的调用都可以用long取代。

   **注意: Long不是Integer的subtype，它们都是Number的subtype。**

   ```java
   long l = 10;
   ```

3. *S* 不是T的subtype，但S继承于*T*

   这个可能很多朋友难以理解，其实有个很典型的例子，比如泛型的情况下，ArrayList&lt;Number&gt;不是 AbstractList&lt;String&gt;的subtype，但ArrayList继承自AbstractList。

4. *S* 继承于T，同时S是T的subtype

## Parametric polymorphism

参数化多态在现代大部分面向对象编程语言都支持，维基百科对它的定义如下:

> In [programming languages](https://en.wikipedia.org/wiki/Programming_language) and [type theory](https://en.wikipedia.org/wiki/Type_theory), **parametric polymorphism** is a way to make a language more expressive, while still maintaining full static [type-safety](https://en.wikipedia.org/wiki/Type-safety). Using parametric [polymorphism](https://en.wikipedia.org/wiki/Polymorphism_(computer_science)), a function or a data type can be written generically so that it can handle values *identically* without depending on their type

上面意思大概是说: 参数化多态可以保证完全的静态类型安全的前提下，使编程语言更具表现力的一种形式。使用它，函数和数据类型可以编写的更加"通用化"，因为并不需要依赖具体的数据类型(翻译水平差将就看)。

上面的概念很抽象，实际上说得简单点，就是Java中的泛型。比如Java中的List&lt;T&gt;就是参数化多态的一种型式，通过泛型可以避免直接依赖数据类型，从而可以实例化诸如 List&lt;String&gt;、List&lt;Tiger&gt;、List&lt;Cat&gt;等不同的型态。

关于参数化多态还会引出另一个比较大的话题，即型变(variance)。比如List&lt;Cat&gt;和List&lt;Tiger&gt;，这两种类型是否存在subtyping的关系？那么Cat[]和Tiger[]呢？ 

如有兴趣，请期待下一篇关于型变的文章，或者参考之前写过的[谈谈Java的型变(不变 协变 逆变)](https://wiyi.org/variance-in-java.html)。


## 结语

多态并非编程独有的概念，它是对现实世界的一种抽象。在编程语言中，实现多态并没有我们想的那么简单，这也会牵扯类型检测，以及方法分派(method dispatch)。在未来有机会将会讲解Java中的静态分派(static dispatch)和动态分派(dynamic dispatch)，以加深对多态的认识。

anyway，关于[Java泛型的型变](https://wiyi.org/talk-about-variance-in-java.html)是一定会说的，这篇文章就是为其做的铺垫:)。

## 参考资料
[https://en.wikipedia.org/wiki/Subtyping](https://en.wikipedia.org/wiki/Subtyping   )   
[https://en.wikipedia.org/wiki/Polymorphism_(computer_science)](https://en.wikipedia.org/wiki/Polymorphism_(computer_science)   )   
[https://www.cmi.ac.in/~madhavan/courses/pl2009/lecturenotes/lecture-notes/node28.html](https://www.cmi.ac.in/~madhavan/courses/pl2009/lecturenotes/lecture-notes/node28.html ) 


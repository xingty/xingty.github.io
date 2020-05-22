---
title: Java泛型几个常见的术语
key: generic-in-java
permalink: generic-in-java.html
tags: Java OOP
---

泛型有几个专业术语: Generic Type、Parameterized Type、Type Parameter、Type Arguments。这几个东西我也不知道怎么翻译，直接照搬外网的解释了。不想翻译内容，就当个人笔记~

### Generic type

**A generic type is a type with formal type parameters. A parameterized type is an instantiation of a generic type with actual type arguments.**

A *generic type* is a reference type that has one or more type parameters. These type parameters are later replaced by type arguments when the generic type is instantiated (or *declared* ). 

Example (of a generic type): 

> ```java
> interface Collection<E> {
>   public void add (E x);
>   public Iterator iterator();
> }
> ```
<!--more-->
The interface `Collection` has one type parameter `E` . The type parameter `E `is a place holder that will later be replaced by a type argument when the generic type is instantiated and used. 

### Parameterized type

The instantiation of a generic type with actual type arguments is called a *parameterized type* . 

Example of a parameterized type: 

> ```java
> Collection<String> coll = new LinkedList<>();
> ```

The declaration `Collection<String>` denotes a parameterized type, which is an instantiation of the generic type `Collection` , where the place holder `E` has been replaced by the concrete type `String` .



### Type parameter

**A place holder for a type argument.**

Generic types have one or more type parameters. 

Example of a generic type: 

> ```java
> interface Comparable<E> { 
>  int compareTo(E other);
> }
> ```

The identifier `E` is a type parameter. Each type parameter is replaced by a type argument when an instantiation of the generic type, such as `Comparable<Object>` or `Comparable<? extends Number>` , is used.

### Type arguments

Generic types and methods have formal type parameters, which are replaced by actual type arguments when the parameterized type or method is instantiated. 

```java
class Box <T> {
  private T theObject;
  public Box( T arg) { theObject = arg; }
  ...
}
class Test {
  public static void main(String[] args) {
    Box <String> box = new Box <String> ("Jack");
  }
}
```

In the example we see a generic class `Box` with one formal type parameter `T.` This formal type parameter is replaced by actual type argument `String` , when the `Box` type is used in the test program. 



文章内容全部来自，这里有很多泛型的解释，强推一波。[GenericsFAQ](http://www.angelikalanger.com/GenericsFAQ) 




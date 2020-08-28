---
title: Java泛型的类型擦除始末,找回被擦除的类型
key: type-erasure-in-java
permalink: type-erasure.html
tags: Java Generic
---

Java设计之初，语言的规范和虚拟机的规范是分开的。Java语言的规范叫JLS(Java Language Specification)，Java虚拟机规范叫JVMS(Java Virtual Machine Specification)。

最初，JLS和JVMS都没有考虑到泛型。泛型在JDK 5开始引入，虽然Java语言支持泛型，不过JVM并没有这个概念，如果需要JVM支持，大量的字节码可能会被重新定义，因为变化实在太大，因此只能在编译时，把类型擦除掉，实现向下兼容。为了更好地理解本文，读者最好准备以下知识:

* 熟悉泛型的概念

  Generic、Parameterized、Type Parameter、Type Argument等，可在[Java泛型几个常见的术语](https://wiyi.org/generic-in-java.html)补充相关知识。

* Java反射
* JVM简单的字节码
<!--more-->

### 类型擦除

Java5开始引入泛型，为了兼容老版本的JDK，综合权衡之下，同时也引入了类型擦除。相信大部分的Java程序员都知道Java的泛型会有类型擦除问题，《Thinking in java》中对此也有提及。

不过对于被擦除的类型是否能找回来，以及擦除后的类型在字节码层面是怎样的并没有描述，本文将由浅入深带你进入泛型的世界。

在Java中，所有泛型的类型参数(type parameter)都会在编译期被擦除为指定的边界(Bounds)，如果没有指定边界，编译器会把它们擦除为Object。

**代码0-1**

```java
public interface CrudRepository<E> {
    E findAll();

    void add(E e);

    boolean contain(E e);
}
```

因为类型擦除，且上面代码没有指定形参(type parameter)的边界，因此E会被编译器擦除为Object。如何证明被擦除为Object呢？看看class文件的字节码即可。

**字节码0-1**

```java
//javap -v CrudRepository
{
  public abstract E find();
    descriptor: ()Ljava/lang/Object;
    flags: ACC_PUBLIC, ACC_ABSTRACT
    Signature: #6                           // ()TE;

  public abstract void add(E);
    descriptor: (Ljava/lang/Object;)V
    flags: ACC_PUBLIC, ACC_ABSTRACT
    Signature: #9                           // (TE;)V

  public abstract boolean contain(E);
    descriptor: (Ljava/lang/Object;)Z
    flags: ACC_PUBLIC, ACC_ABSTRACT
    Signature: #12                          // (TE;)Z
}
Signature: #13                          // <E:Ljava/lang/Object;>Ljava/lang/Object;
SourceFile: "CrudRepository.java"
```

请注意每个方法的descriptor，E都被擦除为Object，类的Signature也是Object。在本例中，泛型参数完全被擦除。

#### 擦除的补偿机制

Java提供了extends和super关键字，用于指定类型擦除的边界，这是类型擦除的一种补偿机制。

**代码0-2**

```java
public interface CrudRepository<E extends Serializable> {
    E findAll();

    void add(E e);

    boolean contain(E e);
}
```

我们指定了参数的边界为Serializable，此时我们完全可以把E当作Serializable的实例。编译器在编译时会把参数擦除到我们设置的边界，即Serializable，再观察CrudRepository的字节码。

**字节码0-2**

```java
{
  public abstract E find();
    descriptor: ()Ljava/io/Serializable;
    flags: ACC_PUBLIC, ACC_ABSTRACT
    Signature: #6                           // ()TE;

  public abstract void add(E);
    descriptor: (Ljava/io/Serializable;)V
    flags: ACC_PUBLIC, ACC_ABSTRACT
    Signature: #9                           // (TE;)V

  public abstract boolean contain(E);
    descriptor: (Ljava/io/Serializable;)Z
    flags: ACC_PUBLIC, ACC_ABSTRACT
    Signature: #12                          // (TE;)Z
}
Signature: #13                          // <E::Ljava/io/Serializable;>Ljava/lang/Object;
SourceFile: "CrudRepository.java"
```

再观察descriptor，可以看到现在全部擦除到我们指定的Serializable类型。从**代码0-1**可以看到类型被擦除的一干二净，字节码都看不到任何的类型信息，那么有没有办法找回被擦除的类型呢? 办法是有的，只是存在一些条件。



### 找回被擦除的类型

找回被擦除类型的前提是，该类的class signature必须记录了泛型的类型信息，**字节码0-1**和**字节码0-2**中，留意倒数第一行，它代表的是class signature，分别被擦除为Object和Serializable，这也意味着类型信息已经丢失，无法找回。

#### Class Signature

在JVM中，所有的字段、方法、类都有属于自己的签名。比如方法签名由方法名、参数、访问修饰符等构成，用于确定唯一的方法。而类的签名主要是记录一些JVM类型系统以外的额外的类型信息，比如泛型的类型信息，JVM不支持泛型，但是提供了class signature来存储类泛型的类型信息。

> A *signature* is a string representing the generic type of a field or method, or generic type information for a class declaration.
>
> Signatures are used to encode Java programming language type information that is not part of the Java Virtual Machine type system, such as generic type and method declarations and parameterized types. See *The Java Language Specification, Java SE 7 Edition* for details about such types.
>
> This kind of type information is needed to support reflection and debugging, and by a Java compiler.
>
> A class type signature gives complete type information for a class or interface type. The class type signature must be formulated such that it can be reliably mapped to the binary name of the class it denotes by erasing any type arguments and converting each . character in the signature to a $ character.
>
> Ref: [jvms 4.3](https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-4.html#jvms-4.3)

那么怎么样才能保留泛型的类型信息在class signature中呢? 当类的泛型信息被子类填写了实际的类型信息，这些类型信息在编译时会编码为class signature。举个例子

```java
import org.wiyi.generic.domain.User;
import java.util.LinkedList;

public class UserRepository implements CrudRepository<User> {

    private final LinkedList<User> users = new LinkedList<User>();

    @Override
    public User find() {
        return users.getFirst();
    }

    @Override
    public void add(User user) {
        users.add(user);
    }

    @Override
    public boolean contain(User user) {
        return users.contains(user);
    }
}
```

UserRepository实现了CrudRepository接口，且指定类型为User，这些类型在编译时就会被编码。看看字节码。

```java
//...忽略上面的
{
  public java.io.Serializable find();
    descriptor: ()Ljava/io/Serializable;
    flags: ACC_PUBLIC, ACC_BRIDGE, ACC_SYNTHETIC
    Code:
      stack=1, locals=1, args_size=1
         0: aload_0
         1: invokevirtual #11                 // Method find:()Lorg/wiyi/generic/domain/User;
         4: areturn
      LineNumberTable:
        line 8: 0
      LocalVariableTable:
        Start  Length  Slot  Name   Signature
            0       5     0  this   Lorg/wiyi/generic/UserRepository;
}
Signature: #37                          // Ljava/lang/Object;Lorg/wiyi/generic/CrudRepository<Lorg/wiyi/generic/domain/User;>;
SourceFile: "UserRepository.java"
```

留意这时候的class signature，已经包含了泛型的实际类型。在这种情况下，我们才能获取到被擦除的类型信息。JDK提供了2个方法获取Class的Signature，分别是:

```java
Class.getGenericInterfaces();
Class.getGenericSuperclass();
```

查看Class文件的源码，上面两个方法都会访问getGenericInfo获取泛型信息

```java
private ClassRepository getGenericInfo() {
  ClassRepository genericInfo = this.genericInfo;
  if (genericInfo == null) {
    String signature = getGenericSignature0();
    if (signature == null) {
      genericInfo = ClassRepository.NONE;
    } else {
      genericInfo = ClassRepository.make(signature, getFactory());
    }
    this.genericInfo = genericInfo;
  }
  return (genericInfo != ClassRepository.NONE) ? genericInfo : null;
}

private native String getGenericSignature0();
```

在这里可以写个demo去看看这里加载的signature到底是什么东西。

```java
package org.wiyi.generic;

import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.util.stream.Stream;

public class GenericDemo {

    public static void main(String[] args) {
        Class<?> klass = UserRepository.class;
        Type[] types = klass.getGenericInterfaces();

        printActualArguments(types);
    }

    private static boolean isParameterizedType(Type type) {
        return type instanceof ParameterizedType;
    }

    private static ParameterizedType toParameterizedType(Type type) {
        return (ParameterizedType) type;
    }

    private static void printActualArguments(Type[] types) {
        Stream.of(types)
                .filter(GenericDemo::isParameterizedType)
                .map(GenericDemo::toParameterizedType)
                .forEach(t -> printArguments(t.getActualTypeArguments()));
    }

    private static void printArguments(Type[] types) {
        Stream.of(types).forEach(System.out::println);
    }
}
```

Debug把断点设置到Type[] types = klass.getGenericInterfaces();，然后跟进去getGenericInfo看看。

![/assets/images/generic/class-signature.png](https://user-images.githubusercontent.com/3600657/91568958-3bfcec00-e978-11ea-895d-fa2c8f880462.png)

可以看到，这个签名和我们在字节码看到的class signature一模一样，这里会把signature decode为我们的所需要的类型信息。

#### Jackson的应用

这里再举一个非常典型，就是Jaskson是如何把json数组转换为List。

```java
package org.wiyi.generic;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.wiyi.generic.domain.User;

import java.io.IOException;
import java.util.List;

public class JacksonDemo {
    public static void main(String[] args) throws IOException {
        String json = "[{\"id\":1,\"name\":\"bigbyto\"},{\"id\":2,\"name\":\"bigbyto2\"}]";

        List<User> users = jsonToList(json);
        System.out.println(users);
    }

    private static List<User> jsonToList(String json) throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        return mapper.readValue(json,new TypeReference<List<User>>(){});
    }
}
```

注意TypeReference的{}，这里实际上是创建了一个TypeReference的子类型。点进去看看TypeReference的代码，可以看到TypeReference在这里顺利的获取到了泛型的类型。

```java
protected TypeReference()
{
  Type superClass = getClass().getGenericSuperclass();
  if (superClass instanceof Class<?>) { // sanity check, should never happen
    throw new IllegalArgumentException("Internal error: TypeReference constructed without actual type information");
  }

  _type = ((ParameterizedType) superClass).getActualTypeArguments()[0];
}
```

如果你看过[Java泛型几个常见的术语](https://wiyi.org/generic-in-java.html)这篇文章，那么你肯定能理解ParameterizedType必然会存在getActualTypeArguments()方法。这个Type属于java反射的内容，要讲又是一个很大的篇幅，这里先略过。



### 类型擦除的未来

很多人会有疑问，为什么JDK当前的版本都到14了，类型擦除这个还没被移除呢？实际上这个功能在未来还真的有可能发生变化。JEP 218有个提议，[Generics over Primitive Types](https://openjdk.java.net/jeps/218)。

JEP 218要解决的是泛型无法使用原生类型(primitive types，如int)，当需要原生类型，不得不使用包装类型(Box，如Integer)，我们都知道包装类型需要更多的内存，不利于性能。举一个JEP的例子:

假设我们指定下面类的泛型的参数为 `T=int`:

```java
class Box<T> {
    private final T t;

    public Box(T t) { this.t = t; }

    public T get() { return t; }
}
```

编译后，将会产生下面的字节码。

```java
class Box extends java.lang.Object{
private final java.lang.Object t;

public Box(java.lang.Object);
  Code:
   0:    aload_0
   1:    invokespecial    #1; //Method java/lang/Object."<init>":()V
   4:    aload_0
   5:    aload_1
   6:    putfield    #2; //Field t:Ljava/lang/Object;
   9:    return

public java.lang.Object get();
  Code:
   0:    aload_0
   1:    getfield    #2; //Field t:Ljava/lang/Object;
   4:    areturn
}
```

让我们所见Box的Field和Method类型都被擦除为Object，JEP 218要实现的是保留原生类型，即getfield时，不再是一个Object，而是int。一些`a`的字节码操作会被`i`替代(JVM约定俗成的规则，a开头的字节码代表操作引用，i开头代表操作int)。

按照JEP 218的描述，意味着泛型将不再一定被擦除为Object，不过这会带来很多很多问题。比如

List<int>和raw type的List它们将会是什么样的子类型关系?

ArrayList<int>调用remove时该如何处理? (remove的参数object，是一个引用)

...

还有很多问题，有兴趣可以去翻[JEP 218](https://openjdk.java.net/jeps/218)，同时这个和JEP 300也有一些关系，我在之前[Java变型的文章](https://wiyi.org/variance-in-java.html)中也有提到过。

虽然JEP有提议，不过由JEP到JSR再到实现是个非常漫长的过程，我们只能慢慢等候了~ 类型擦除的原因没我们想的那么简单，向下兼容的背后，牵扯着一大堆需要改进的东西，甚至还涉及到编程模式。要改进确实也是个非常庞大的工程。

### 代码

本文代码都放在github [java-generic](https://github.com/xingty/java-generic)

### 参考资料

[https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-4.html#jvms-4.3](https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-4.html#jvms-4.3)   
[https://docs.oracle.com/javase/tutorial/java/generics/erasure.html](https://docs.oracle.com/javase/tutorial/java/generics/erasure.html)   
[https://openjdk.java.net/jeps/218](https://openjdk.java.net/jeps/218)   



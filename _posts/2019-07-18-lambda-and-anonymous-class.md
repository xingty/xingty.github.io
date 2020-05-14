---
title: Lambda表达式和匿名类的区别，不只是语法糖
key: lambda-and-anonymous-class
permalink: lambda-and-anonymous-class.html
tags: Java
---

Java8中引入了Lambda表达式，可以简化我们的编码，使用起来非常方便。

Java8之前用Runnable通常会new一个匿名类

```java
public class LambdaDemo {
    public static void main(String[] args) {
        //jdk 1.7
        Runnable r = new Runnable() {
            @Override
            public void run() {
                //do something...
            }
        };

        //jdk 1.8
        Runnable r2 = () -> {
            //do something...
        };
    }
}
```

有些人觉得Lambda仅仅是个语法糖，实际上并不是这样的。这里可以先抛出结论：普通匿名类方式的调用，编译时会生成XX$YY这类匿名类(在本例中是LambdaDemo$1)，而Lambda不会生成类。在字节码层面，匿名类是通过invokespecial调用。 lambda是通过invokedymanic调用。下面我们来看看。
<!--more-->

```shell
javac LambdaDemo.java
ls -l

# lsit
# -rw-r--r--  1 bigbyto  user  524  5 14 12:42 LambdaDemo$1.class
# -rw-r--r--  1 bigbyto  user  545  5 14 12:42 LambdaDemo.class
```

再看一下LambdaDemo.class的字节码

```shell
javap -v LambdaDemo.class
```

> {
>
> ​	public static void main(java.lang.String[]);
>
>   descriptor: ([Ljava/lang/String;)V
>
>   flags: ACC_PUBLIC, ACC_STATIC
>
>   Code:
>
>    stack=2, locals=2, args_size=1
>
> ​     0: **new**      #2         // class org/wiyi/java9/LambdaDemo$1
>
> ​     3: **dup**
>
> ​     4: **invokespecial** #3         // Method org/wiyi/java9/LambdaDemo$1."<init>":()V
>
> ​     7: astore_1
>
> ​     8: return
>
>    LineNumberTable:
>
> ​    line 6: 0
>
> ​    line 17: 8
>
>    LocalVariableTable:
>
> ​    Start Length Slot Name  Signature
>
> ​      0    9   0 args  [Ljava/lang/String;
>
> ​      8    1   1   r  Ljava/lang/Runnable;
>
> }



接着，把匿名类的代码去掉，清除刚刚编译好的两个类，重新执行一次编译流程

```shell
javac LambdaDemo.java
ls -l

# lsit
# -rw-r--r--  1 bigbyto  user  545  5 14 12:42 LambdaDemo.class
```

可以看到，Lambda表达式并不会生成一个匿名类。再看一下字节码

```shell
javap -v LambdaDemo.class
```

> public static void main(java.lang.String[]);
>
>   descriptor: ([Ljava/lang/String;)V
>
>   flags: ACC_PUBLIC, ACC_STATIC
>
>   Code:
>
>    stack=1, locals=2, args_size=1
>
> ​     0: **invokedynamic** #2, 0       // InvokeDynamic #0:run:()Ljava/lang/Runnable;
>
> ​     5: astore_1
>
> ​     6: return
>
>    LineNumberTable:
>
> ​    line 14: 0
>
> ​    line 17: 6
>
>    LocalVariableTable:
>
> ​    Start Length Slot Name  Signature
>
> ​      0    7   0 args  [Ljava/lang/String;
>
> ​      6    1   1  r2  Ljava/lang/Runnable;

留意一下两者的异同

```java
//匿名类
0: new      #2         // class org/wiyi/java9/LambdaDemo$1
3: dup
4: **invokespecial** #3         // Method org/wiyi/java9/LambdaDemo$1."<init>":()V
  
//lambda
0: invokedynamic #2, 0       // InvokeDynamic #0:run:()Ljava/lang/Runnable;
```

可以看到上面两个在字节码上存在根本的区别，匿名类走的是一个类标准的创建流程，而字节码是直接用invokedynamic指令。

由上面可以看到，Lambda表达式不仅在代码层面上简洁，字节码层面也更简洁。
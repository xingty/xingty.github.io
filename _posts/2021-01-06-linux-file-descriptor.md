---
title: '理解linux中的file descriptor(文件描述符)'
key: linux-file-descriptor
permalink: linux-file-descriptor.html
tags: 操作系统
---

file descriptor(以下简称fd)又叫文件描述符，他是一个抽象的指示符，用一个整数表示(非负整数)。它指向了由系统内核维护的一个file table中的某个条目(entry)。这个解释可能过于抽象，不过在正式详细介绍fd之前，有必要先了解用户程序和系统内核之间的工作过程。

注: 本文描述的所有场景仅限于类unix系统环境，在windows中这玩意叫file handle(臭名昭著的翻译: 句柄)。

## User space & Kernel space

现代操作系统会把内存划分为2个区域，分别为Use space(用户空间) 和 Kernel space(内核空间)。用户的程序在User space执行，系统内核在Kernel space中执行。

用户的程序没有权限直接访问硬件资源，但系统内核可以。比如读写本地文件需要访问磁盘，创建socket需要网卡等。因此用户程序想要读写文件，必须要向内核发起读写请求，这个过程叫system call。

内核收到用户程序system call时，负责访问硬件，并把结果返回给程序。

```java
FileInputStream fis = new FileInputStream("/tmp/test.txt");
byte[] buf = new byte[256];
fis.read(buf);
```

上面代码的流程如下图所示

![/assets/images/fd/us_ks.png](https://bigbyto.gitee.io/assets/images/fd/us_ks.png)

<!--more-->

## File Descriptor

上面简单介绍了User space和Kernel space，这对于理解fd有很大的帮助。fd会存在，就是因为用户程序无法直接访问硬件，因此当程序向内核发起system call打开一个文件时，在用户进程中必须有一个东西标识着打开的文件，这个东西就是fd。

### file tables

和fd相关的一共有3张表，分别是file descriptor、file table、inode table，如下图所示。

![~replace~https://user-images.githubusercontent.com/3600657/103748658-67d36100-503f-11eb-960b-e77683e751f7.png](https://www.computerhope.com/jargon/f/file-descriptor.jpg)

* file descriptors

  file descriptors table由用户进程所有，每个进程都有一个这样的表，这里记录了进程打开的文件所代表的fd，fd的值映射到file table中的条目(entry)。

  另外，每个进程都会预留3个默认的fd: stdin、stdout、stderr;它们的值分别是0、1，2。

  | Integer value |                          Name                           | symbolic constant | file stream |
  | :-----------: | :-----------------------------------------------------: | :---------------: | :---------: |
  |       0       |  [Standard input](https://en.wikipedia.org/wiki/Stdin)  |   STDIN_FILENO    |    stdin    |
  |       1       | [Standard output](https://en.wikipedia.org/wiki/Stdout) |   STDOUT_FILENO   |   stdout    |
  |       2       | [Standard error](https://en.wikipedia.org/wiki/Stderr)  |   STDERR_FILENO   |   stderr    |
  
* file table

  file table是全局唯一的表，由系统内核维护。这个表记录了所有进程打开的文件的状态(是否可读、可写等状态)，同时它也映射到inode table中的entry。

* inode table

  inode table同样是全局唯一的，它指向了真正的文件地址(磁盘中的位置)，每个entry全局唯一。

### 流程

当程序向内核发起system call `open()`，内核将会

1. 允许程序请求
2. 创建一个entry插入到file table，并返回file descriptor
3. 程序把fd插入到fds中。

当程序再次发起`read()`system call时，需要把相关的fd传给内核，内核定位到具体的文件(fd --> file table --> inode table)向磁盘发起读取请求，再把读取到的数据返回给程序处理。

下面是`read`这个函数的定义，第一个参数`fd`即file descriptor。

```c
ssize_t read(int fd, void *buf, size_t count);
```

  同样的，`write`system call函数如下

```c
 ssize_t write(int fd, const void *buf, size_t nbytes);
```

从上面的结果来看，fd就是file table的一个索引，指向了file table中的entry。

## 查看进程的file descriptors

### linux

linux系统可以通过`/proc/pid/fd`文件夹查看进程的fd，比如我的redis进程id为96104，执行以下命令查看

```shell
ls -l /proc/96104/fd
```

![/assets/images/fd/linux_fd.png](https://bigbyto.gitee.io/assets/images/fd/linux_fd.png)

上图中的数字即fd。

### mac os x

```shell
lsof -p pid
```

![/assets/images/fd/mac_fd.png](https://bigbyto.gitee.io/assets/images/fd/mac_fd.png)


## 操作file descriptors

下面是一些系统函数。当程序发起system call，大多需要传递fd到这些函数中，kernel去访问具体的资源。

* open()
* read()
* write()
* select()
* poll()


更多系统函数可以参考维基百科[File Descriptor](https://en.wikipedia.org/wiki/File_descriptor)，整理了大量常见的函数

## Java中的File Descriptor

Java封装了`FileDescriptor`类表示fd，FileInputStrem和FileOutputStream中都会持有这个类。

```java
public final class FileDescriptor {
  private int fd;  
  //.......
}
```

上面可以看到fd和之前描述的一致，是一个整数。

```java
public class FileInputStream extends InputStream {
    /* File Descriptor - handle to the open file */
  private final FileDescriptor fd;

  public FileInputStream(File file) throws FileNotFoundException {
    String name = (file != null ? file.getPath() : null);
    SecurityManager security = System.getSecurityManager();
    if (security != null) {
      security.checkRead(name);
    }
    if (name == null) {
      throw new NullPointerException();
    }
    if (file.isInvalid()) {
      throw new FileNotFoundException("Invalid file path");
    }
    fd = new FileDescriptor();
    fd.attach(this);
    path = name;
    open(name);
  }
  //......
}
```

fd在输入输出流的构造器中创建，JVM会发起system call `open()`初始化资源并返回fd。

**stand stream fd**

下面代码可以查看标准输入/输出/错误流中的fd，用debug启动即可在面板中看到fd的值。

```java
public class FDTester {
    public static void main(String[] args) throws Exception{
        BufferedInputStream in = (BufferedInputStream) System.in;
        PrintStream out = System.out;
        PrintStream err = System.err;
        FileInputStream fis = new FileInputStream("/tmp/test.txt");

        System.in.read();
    }
}
```

![/assets/images/fd/fd_stdin.png](https://bigbyto.gitee.io/assets/images/fd/fd_stdin.png)

![/assets/images/fd/fd_stdout.png](https://bigbyto.gitee.io/assets/images/fd/fd_stdout.png)

![/assets/images/fd/fd_stderr.png](https://bigbyto.gitee.io/assets/images/fd/fd_stderr.png)

![/assets/images/fd/fd_java_process.png](https://bigbyto.gitee.io/assets/images/fd/fd_java_process.png)


## 参考资料

[https://en.wikipedia.org/wiki/File_descriptor](https://en.wikipedia.org/wiki/File_descriptor)   
[https://www.computerhope.com/jargon/f/file-descriptor.htm](https://www.computerhope.com/jargon/f/file-descriptor.htm)   
[https://en.wikipedia.org/wiki/Open_(system_call)](https://en.wikipedia.org/wiki/Open_(system_call))   
[https://en.wikipedia.org/wiki/Read_(system_call)](https://en.wikipedia.org/wiki/Read_(system_call))   
[https://en.wikipedia.org/wiki/Write_(system_call)](https://en.wikipedia.org/wiki/Write_(system_call))  
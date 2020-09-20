---
title: '深入理解Spring事务: 物理事务和逻辑事务'
key: physical-and-logical-transactions
permalink: physical-and-logical-transactions.html
tags: Spring Transaction
---

Spring事务模块的文档中有描述了两个专业术语，分别是**物理事务(physical transaciton)**和**逻辑事务(logic transaction)**。读者可能会一头雾水，因为Spring文档中并没有对这两个术语进行过多的介绍。

> In Spring-managed transactions, be aware of the difference between physical and logical transactions, and how the propagation setting applies to this difference.
>
> Ref:  https://docs.spring.io/spring-framework/docs/current/spring-framework-reference/data-access.html#tx-propagation

<!--more-->
### 物理事务

在[JDBC的事务API](https://wiyi.org/jdbc-transaction-api.html)中展示了事务对应的是Connection，一个Connection只能开启一个事务。所谓物理事务指的就是一个Connection。

### 逻辑事务

在一个复杂的业务系统中，可能会调用多个service，每个service都有自己的事务(标注了@Transactional)，此时我们需要根据事务传播方式(Propagation)来决定当前事务的行为(比如要挂起创建新事物，还是加入当前事务)。

我们可以认为每个注解了@Transactional的方法都是一个逻辑事务，这些逻辑事务被Spring事务管理，Spring会根据事务传播方式来决定是否开启新事务。

### 案例

```java
@Service
public class UserService {

    @Autowired
    private InvoiceService invoiceService;

    @Transactional
    public void invoice() {
        invoiceService.createPdf();
        // send invoice as email, etc.
    }
}

@Service
public class InvoiceService {

    @Transactional
    public void createPdf() {
        // ...
    }
}
```

在上面的例子中，`UserService`的invoice()方法有一个`@Transactional`注解，同时在方法内部又调用了`InvoiceService`的createPdf()方法，同样的，它也有个`@Transactional`注解。

根据Spring事务传播方式，`@Transactional`默认的传播方式为`Require`，因此上面例子中的invoice()和createPdf()方法会共用同一个事务(connection)，因此**只存在一个物理事务**。

不过在Spring这头，上面一共存在**两个逻辑事务**，分别为invoice()和createPdf()。Spring需要判断这两个逻辑事务是共用一个Connection，还是打开新的Connection(取决于Propagation)。

如果想了解Spring是如何实现挂起当前事务，创建新的物理事务执行当前方法，请移步[《深入理解Spring事务: Spring如何实现挂起事务》](https://wiyi.org/how-does-transaction-suspension-in-spring.html)

### 总结

一个物理事务对应着一个JDBC Connection。一个Connection可能会存在多个逻辑事务，这取决于Propagation的配置。


### 参考资料

[Spring Transaction Management: @Transactional In-Depth](https://www.marcobehler.com/guides/spring-transaction-management-transactional-in-depth)


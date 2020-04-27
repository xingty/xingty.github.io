---
title: DAO还是Repository,傻傻的分不清?
key: DAO-VS-Repository
permalink: dao-vs-repository.html
tags: DDD
---

# DAO vs Repository

在Java开发中，我们经常会接触到DAO，有时，我们也能看到Repository。从代码上看，这两者似乎区别不是很大，很容易让人混淆。究竟这两个该在什么场景使用，我看网上讨论的不是很多。要想知道它们该怎么用，还是要先区分清楚它们的概念。

本文大部分内容都来自于参考资料中的文章，建议英文阅读能力好的朋友直接去看英文原文。

<!--more-->

### 起源

使用面向对象开发程序时，当需要获取或保存数据时，需要连接我们的数据源。这个数据源可能是数据库、缓存或者是远程仓库。为了代码能更整洁和模块化，我们需要抽象出一个数据发访问层，这个即DAL(Data Access Layer)。实际上，DAO 和 Repository都是DAL的一种实现。接下来会分别 讨论两者区别。



### DAO

DAO即Data-Access-Object，直译过来就是数据访问对象。很多人对DAO的理解是负责链接数据库，实际上并不是。它是一个接口，一个DAL的实现，可能连接数据库，也可能连接到Redis。包括Wikipedia在内，我没找到更多讨论DAO职责的内容，很多人使用它都是基于一些约定俗成的规则，包括以下:

1. 一个Model 对应一个DAO。比如Account --> AccountDAO; Book --> BookDAO
2. DAO不限制identifier方式的参数。比如你可以在get方法上定义String参数。与之相对，Repository侧重于"领域(Domain)"

一个标准的DAO如下:

```java
public interface AccountDAO {
    Account get(String userName);
    void create(Account account);
    void update(Account account);
    void delete(String userName);
}
```

有一点开发经验的朋友可能知道，随着开发不断推进，可能AccountDAO会变成下面这样

```java
public interface AccountDAO {
 
    Account get(String userName);
    void create(Account account);
    void update(Account account);
    void delete(String userName);
 
    List getAccountByLastName(String lastName);
    List getAccountByAgeRange(int minAge, int maxAge);
    void updateEmailAddress(String userName, String newEmailAddress);
    void updateFullName(String userName, String firstName, String lastName);
 
}
```

再过一段时间，可能这个类会变的更复杂。我们DAO开始变得臃肿，对于调用者而言变得复杂，当一个DAO出现几十个query时，调用时可能会一头雾水。



### Repository

Repository这个概念出自"DDD"(Domain-Driven-Design)，Repository Pattern提议所有操作最好是基于领域(Domain)进行。同时，他的行为像Java里面的Collection。当然，这是一种抽象的概念。如Collection中存在add、update、remove，contains等函数。同样的，你应该把这些定义到Repository中。

```java
import java.util.List;
import com.thinkinginobjects.domainobject.Account;
 
public interface AccountRepository {
 
    void addAccount(Account account);
    void removeAccount(Account account);
    void updateAccount(Account account); // Think it as replace for set
 
    List query(AccountSpecification specification);

}
```

我们可以看出AccountRepository中removeAccount并不像DAO那样传进一个userName，而是传入一个Account对象。如果理解不了这点，想一下你在java里面是怎么操作删除List<Account>的即可。

上面DAO中提到可能随着业务复杂度增加，DAO会出现大量的查询接口。我们可以注意到AccountRepository多了个List query(AccountSpecification specification);

```java
import com.thinkinginobjects.domainobject.Account;
 
public interface AccountSpecification {
    boolean specified(Account account);
}
```

```java
public class AccountSpecificationByUserName implements AccountSpecification, HibernateSpecification {
 
    private String desiredUserName;
 
    public AccountSpecificationByUserName(String desiredUserName) {
        super();
        this.desiredUserName = desiredUserName;
    }
 
    @Override
    public boolean specified(Account account) {
        return account.hasUseName(desiredUserName);
    }
 
    @Override
    public Criterion toCriteria() {
        return Restrictions.eq("userName", desiredUserName);
    }
 
}
```


这是DDD里面的解决方案，使用Specification Pattern来解决上述问题。需要注意的是，这不是Respository特有的东西，你完全可以用到DAO上。而且个人对是否应该使用这个模式持保留态度。

### 总结

从上面的讨论你可以看出，Repository Pattern更加面向对象，提出了更多的规约对以往的DAO Pattern做了一些补充，不过实现起来更加复杂。事实上，没有人阻止你把Repository那些东西应用在DAO上。所以不必要过于纠结这两者，你可以把二者结合一起用，也可以分开用，具体怎么用，就是看自己的业务场景。

最后，我十分赞同StackOverFlow的一个答案。

> Frankly, this looks like a semantic distinction, not a technical distinction. The phrase Data Access Object doesn't refer to a "database" at all. And, although you could design it to be database-centric, I think most people would consider doing so a design flaw.
>
> The purpose of the DAO is to hide the implementation details of the data access mechanism. How is the Repository pattern different? As far as I can tell, it isn't. Saying a Repository is *different* to a DAO because you're dealing with/return a collection of objects can't be right; DAOs can also return collections of objects.
>
> Everything I've read about the repository pattern seems rely on this distinction: bad DAO design vs good DAO design (aka repository design pattern).
>
> Ref: https://stackoverflow.com/a/11384997



### 参考资料

[What is the difference between DAO and Repository patterns?](https://stackoverflow.com/questions/8550124/what-is-the-difference-between-dao-and-repository-patterns)   
[Don’t use DAO, use Repository](https://thinkinginobjects.com/2012/08/26/dont-use-dao-use-repository/)  
《领域驱动设计》Respository章节
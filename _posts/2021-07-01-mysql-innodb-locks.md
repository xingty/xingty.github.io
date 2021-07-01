---
title: '理解Mysql InnoDB引擎中的锁'
key: mysql-innodb-locking
permalink: mysql-innodb-locking.html
tags: 数据库
---

Mysql是支持ACID特性的数据库。我们都知道"C"代表Consistent，当不同事务操作同一行记录时，为了保证一致性，需要对记录加锁。在Mysql中，不同的引擎下的锁行为也会不同，本文将重点介绍Mysql InnoDB引擎中常见的锁。


## 准备

```sql
CREATE TABLE `user` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(32) DEFAULT NULL,
  `age` tinyint(4) DEFAULT '0',
  `phone` varchar(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_age` (`age`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4;

#插入基础数据
INSERT INTO `user` (`id`, `name`, `age`, `phone`)
VALUES
	(1, '张三', 18, '13800138000'),
	(2, '李四', 20, '13800138001'),
	(3, '王五', 22, '13800138002'),
	(4, '赵六', 26, '13800138003'),
	(5, '孙七', 30, '13800138004');

```

为了方便讲解，创建一张user表，设置age的字段为普通索引，并填充以下数据。本文所有的sql语句均基于这张表。

| id   | name | age  | Phone       |
| ---- | ---- | ---- | ----------- |
| 1    | 张三 | 18   | 13800138000 |
| 2    | 李四 | 20   | 13800138001 |
| 3    | 王五 | 22   | 13800138002 |
| 4    | 赵六 | 26   | 13800138003 |
| 5    | 孙七 | 30   | 13800138004 |

<!--more-->

## 锁的分类

### 行级锁和表级锁(Row-level and Table-level Locks)

按照锁的粒度划分，可分为行级锁和表级锁。表级锁作用于数据库表，不同的事务对同一个表加锁，根据实际情况，后加锁的事务可能会发生block，直到表锁被释放。表级锁的优点是资源占用低，可防止死锁等。缺点是锁的粒度太高，不利于高并发的场景。

行级锁行级锁作用于数据库行，它允许多个事务同时访问同一个数据库表。当多个事务操作同一行记录时，没获得锁的事务必须等持有锁的事务释放才能操作行数据。行级锁的优点能支持较高的并发。缺点是资源占用较高，且会出现死锁。

关于行级锁和表级锁更详细的描述请参考[internal-locking](https://dev.mysql.com/doc/refman/5.7/en/internal-locking.html)，碍于篇幅，本文不再赘述。

### 共享锁和排他锁(Shared and Exclusive Locks)

InnoDB引擎的锁分为两类，分别是共享锁和排他锁(或者称为"读锁"和"写锁")。这些概念在很多领域都出现过，比如Java中的`ReadWriteLock`。

* 共享锁(shared lock) 允许多个事务同时持有同一个资源的锁，常用`S`表示。

  ```sql
  #mysql 8.0之前的版本通过 lock in share mode给数据行添加share lock
  select * from user where id = 1 lock in share mode;
  
  #mysql 8.0以后的版本通过for share给数据行添加share lock
  select * from user where id = 1 for share
  ```

* 排他锁(exclusive lock)只允许一个事务持有某个资源的锁，常用`X`表示。

  ```sql
  # 通过for update可以给数据行加exclusive lock
  select * from user where id = 1 for update;
  
  # 通过update或delete同样也可以
  update user set age = 16 where id = 1;
  ```

举个例子，假如事务T1持有了某一行(r)的共享锁(S)。当事务T2也想获得该行的锁，分为如下两种情况:

* 如果T2申请的是行r的共享锁(S)，会被立即允许，此时T1和T2同时持有行r的共享锁。
* 如果T2申请的是排他锁(X)，那么必须等T1释放才能成功获取。

 反过来说，假如T1持有行`R`的排他锁，那不管T2申请的是共享锁还是排他锁，都必须等待T1释放才能成功。

总的来说，Mysql中的锁有很多种，不过我们需要重点关注的就上面两点，即锁的作用域和锁的类型。如上所述，**锁可以作用于行，也能作用于表，但不管他们的作用域是什么，锁的类型只有两种，即"共享"和"排他"。**


## InnoDB Locking

InnoDB引擎是Mysql非常重要的一部分，Mysql团队为它开发了很多种类型的锁，下面将逐一介绍。

### Intention Locks

Intention Locks是Innodb引擎非常重要的锁，它是一种特殊的表级锁，可以让行级锁和表级锁共存。虽然是表级锁，但它是作用于行的，分为两种类型的锁，分别是intention share lock(IS)和intention exclusive lock(IX)。

* intention shared lock (IS) 表示某个事务想要对某一行添加一个shared lock
* intention exclusive lock(IX) 表示某个事务想要对某一行添加一个exclusive lock

intention lock之间相互兼容，假设T1给user表加上了锁，T2依然可以进入，它们之间遵循下面协议

 * 如果某个事务想对某一行数据加IS锁，那它必须先取得对表的IS或IX锁
 * 如果某个事务想对某一行数据加IX锁，那它必须先取得对表的IX锁

Intention lock和其他表级锁之间的兼容情况如下

|      | `X`      | `IX`       | `S`        | `IS`       |
| :--- | :------- | :--------- | :--------- | :--------- |
| `X`  | Conflict | Conflict   | Conflict   | Conflict   |
| `IX` | Conflict | Compatible | Conflict   | Compatible |
| `S`  | Conflict | Conflict   | Compatible | Compatible |
| `IS` | Conflict | Compatible | Compatible | Compatible |

### Record Locks

Record Lock是作用于记录的**索引**，可以锁定单条或多条记录，比如下面SQL语句:

```sql
# 锁定id=1这条记录
select * from user where id = 1 for update;
```

上面的sql给id为1的行加了IX锁。其他事务要对这行数据进行修改(update,insert,delete)都必须等待当前事务释放锁(提交或回滚事务)。

需要注意的是，Record Lock仅仅是作用于索引，如果表中没有定义索引，InnoDB会给聚簇索引(默认生成)加锁。我们可以通过命令查看innodb的状态

```sql
show engine innodb status;
#---TRANSACTION 4193876, ACTIVE 7 sec
#2 lock struct(s), heap size 1136, 1 row lock(s) //1行数据被锁定
#MySQL thread id 4, OS thread handle 140345170896640, query id 221 172.17.0.1 root starting
```

### Gap Locks

#### 什么是间隙

间隙就是是指索引两两之间的一个左开右开区间，在user表中，存在一下间隙。

> (-∞,18), (18,20), (20,22), (22,26), (26,30), (30,+∞)

#### 间隙锁的行为

Record lock是作用于索引，而Gap locks是作用于索引之间的间隙。比如下面的sql语句就会给(22,26)之间的索引间隙加锁。

```sql
select * from user where age between 22 and 26 for update;
```

上面的语句执行过后，其他事务就无法往(22,26)之间的间隙插入数据。这样做的目的是为了防止出现[幻读](https://dev.mysql.com/doc/refman/8.0/en/innodb-next-key-locking.html)。假如没有Gap locks，下面sql会发生不同的行为

| Transaction 1                                              | Transaction 2                                      |
| ---------------------------------------------------------- | -------------------------------------------------- |
| select * from user where age between 22 and 26 for update; |                                                    |
|                                                            | Insert into user (name,age) values ('bigbyto',23); |
| select * from user where age between 22 and 26;            |                                                    |

上面的sql可能会出现两种情况

* 有Gap locks

  T1的第二次查询依然是查询出两个结果，即王五和赵六。 T2将会Block，直到T1事务结束。通过下面sql可以看到Gap lock阻止了T2插入内容。

  ```sql
  SELECT * FROM INFORMATION_SCHEMA.INNODB_LOCKS;
  ```

  ![~~replace/assets/images/innodb-locks/gaplock.jpg](https://bigbyto.gitee.io/assets/images/innodb-locks/gaplock.jpg)

* 没有Gap locks

  T2将会插入成功，数据库多了一条bigbyto,age为25的数据; T1第二次查询将会出现3条数据(幻读)。

Gap locks的目的就是为了防止其他事务往索引的间隙插入数据，以此来避免出现幻读。在Mysql的`REPEATABLE-READ`隔离级别下，Gap locks默认启用。禁用方式很简单，把隔离级别设置为`READ_COMMITTED`即可。

#### 锁降级

在`REPEATABLE-READ`隔离级别下，当查询一条记录时，根据实际情况，mysql会对记录加不同的锁。比如下面的sql: 

```sql
select * from user where id = 3 for update;
```

上面sql中，会给id=3的行加Record lock。

当where字段满足唯一索引，主键其中之一时，mysql会使用Record lock给记录加锁。因为数据库约束数据唯一，不会出现幻读。如果字段是普通索引，情况会发生变化

```sql
select * from user where age = 22 for update;
```

上面的sql会使用Gap lock，(18,22)之间的间隙会被锁定，其他事务无法往这个区间插入数据。

### Next-Key Locks

Next-Key Locks实际上就是Gap lock和Record Lock的组合。Gap lock中的索引间隙是一个左开右开的区间，在next-key lock中，变成左开右闭，比如:

> (-∞,18], (18,20], (20,22], (22,26], (26,30], (30,+∞)

Next-Key Locks会给索引和索引之间的间隙加锁。因为用到了Gap lock，这种锁自然而然也是只有在`REPEATABLE-READ`的隔离级别下才能用。

### Insert Intention Locks

为了提升插入性能而设计的一种特殊类型Gap lock，多个事务可以往同一个间隙插入数据，比如下面的sql可以同时往(20,22]这个间隙插入数据。

| Transaction 1                                      | Transaction 2                                     |
| -------------------------------------------------- | ------------------------------------------------- |
| begin;                                             |                                                   |
| insert into user (name,age) values ('bigbyto',21); | begin;                                            |
|                                                    | insert into user (name,age) values ('bigcat',21); |

如何证明Insert Intention Locks是一种Gap locks呢，尝试执行下面的sql

| Transaction 1                                | Transaction 2                                    |
| -------------------------------------------- | ------------------------------------------------ |
| Begin;                                       | Begin;                                           |
| select * from user where age = 22 for update |                                                  |
|                                              | inset into user (name, age) values ('tiger',22); |

因为T1锁定了(20,22]的间隙，T2将会阻塞，等待T1释放Gap lock。

```sql
select * from information_schema.INNODB_LOCKS
```

![~~replace/assets/images/innodb-locks/insert-intention-lock.jpg](https://bigbyto.gitee.io/assets/images/innodb-locks/insert-intention-lock.jpg)

上图可以看出两种类型都是X,GAP，即可证明插入时也是Gap lock。这里我们可以看出Insert Intention Locks之间互相兼容，不会发生互斥。不过会和其他的间隙锁发生互斥，当我们往表中插入数据，过程如下: 

1. 查找插入的索引之间的间隙是否已经被加锁
2. 如果没有被其他事务加入间隙锁，插入数据到数据库
3. 如果区间已经被加了间隙锁，等待其他事务释放锁再插入

上面的限制归根究底还是为了避免出现幻读。因为如果要插入的间隙区间不存在Gap lock，说明没有事务锁定了间隙，自然不会出现幻读。

### AUTO-INC Locks

AUTO-INC Locks是一种表级锁，发生在自增主键时，当主键设置为`auto_increment`时，往表中插入数据需要先获得AUTO-INC Locks以安全的增加id的值。

虽然它是表级锁，不过它获得了索引自增的最大值后，会马上释放锁，并不需要等待事务结束，因此它的插入性能会得到很大的提升。 不过尽管如此，再并发插入较高的情况，还是会一定程度的影响插入性能。



## 参考资料

* [innodb locking](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking.html)
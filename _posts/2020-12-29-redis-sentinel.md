---
title: '深入浅出Redis Sentinel'
key: redis-sentinel
permalink: redis-sentinel.html
tags: Redis
---

Sentinel是Redis官方提供的高可用方案，传统的master slave(现在叫repliacation)模式中，当master故障时，需要手动修改配置文件指定新的master，Sentinel解决了这个问题，可以不需人工干预自动切换新的master。

sentinel节点是一个独立的进程，它不仅监测master节点，同时也会监测slave、sentinel节点的状态。

### Sentinel介绍

#### 架构

```shell
       +----+
       | M1 |
       | S1 |
       +----+
          |
+----+    |    +----+
| R2 |----+----| R3 |
| S2 |         | S3 |
+----+         +----+

Configuration: quorum = 2
```
<!--more-->
#### 术语

**S_DOWN(主观下线)**   
如果某个sentinel节点发现master、replica、sentinel节点超过一定的时间不可达(不应答ping)，sentinel会主观认为这些节点已经下线，这个称为sdown(Subjectively Down)。

**O_DOWN(客观下线)**   
当某个sentinel把master节点标为S_DOWN后，sentinel节点会询问其他sentinel节点该master节点的状态，如果达到`quorum`个节点认为master不可达，此时master状态会被标志为O_DOWN(Objectively Down)。

**Failover**   
failover中文意思叫"故障切换"。当sentinels发现master节点不可达，会从replicas中选出一个节点作为新的master，这个过程就称为failover。



### 搭建Sentinel

假设我们现在拥有3台redis服务器，分别是192.168.11.170、192.168.11.171、192.168.11.172。现在各自修改它们的配置文件。

#### 配置master-replica(master-slave)

因为Sentinel是基于master-replicas(就之前的master-slave)之上构建的，因此需要给这3个节点选定一个master，这里假设192.168.11.170是master，另外两台作为replica(slave)，需要有以下配置。

```shell
#redis.conf

#在redis 5.0之前的版本，这个叫 slaveof，因为种族问题政治正确，被迫改成了replicaof
# slaveof 192.168.11.170 6378

#redis 5.0以上版本改为replicaof
replicaof 192.168.11.170 6378
```

下面是一些公共的配置，其他的请根据自己需要进行配置。

```shell
#redis.conf
protected-mode yes
pidfile "/var/run/redis_6379.pid"
logfile "/var/log/redis/redis-6379.log"
#replication需要用到
masterauth "123456"
requirepass 123456
appendonly yes
```

分别启动3台服务器，然后登录到192.168.11.170，查看replication信息。

```shell
$ redis-cli -h 192.168.11.170 -p 6379
$ info Replication
# output

# Replication
role:master
connected_slaves:2
slave0:ip=192.168.11.171,port=6379,state=online,offset=32173152,lag=0
slave1:ip=192.168.11.172,port=6379,state=online,offset=32173009,lag=0
master_replid:6871b5aeb05d3f3d2708db605b567a8b9915f66e
master_replid2:2d4bf5a3701bc4d72e3081b388c07f368ee7e834
master_repl_offset:32173152
second_repl_offset:73595
repl_backlog_active:1
repl_backlog_size:1048576
repl_backlog_first_byte_offset:31124577
repl_backlog_histlen:1048576
```



#### 配置sentinel

sentinel主要是用于监控master节点，sentinel 节点之间会相互通信，共享redis节点的信息。在redis的源码目录，可以找到一个sentinel.conf的文件，下面截取部分内容。

```shell
# sentinel.conf
bind 192.168.11.170
port 16380
daemonize yes
pidfile "/var/run/redis-sentinel-16380.pid"
logfile "/var/log/redis/sentinel-16380.log"
dir "/tmp"

sentinel deny-scripts-reconfig yes
# sentinel monitor <master-name> <ip> <redis-port> <quorum>
#
# Tells Sentinel to monitor this master, and to consider it in O_DOWN
# (Objectively Down) state only if at least <quorum> sentinels agree.
#
# Note that whatever is the O_DOWN quorum, a Sentinel will require to
# be elected by the majority of the known Sentinels in order to
# start a failover, so no failover can be performed in minority.
sentinel monitor mymaster 192.168.11.170 6379 2
# sentinel down-after-milliseconds <master-name> <milliseconds>
#
# Number of milliseconds the master (or any attached replica or sentinel) should
# be unreachable (as in, not acceptable reply to PING, continuously, for the
# specified period) in order to consider it in S_DOWN state (Subjectively
# Down).
#
# Default is 30 seconds.
sentinel down-after-milliseconds mymaster 10000
#
# Set the password to use to authenticate with the master and replicas.
# Useful if there is a password set in the Redis instances to monitor.
#
# Note that the master password is also used for replicas, so it is not
# possible to set a different password in masters and replicas instances
# if you want to be able to monitor these instances with Sentinel.
#
# However you can have Redis instances without the authentication enabled
# mixed with Redis instances requiring the authentication (as long as the
# password set is the same for all the instances requiring the password) as
# the AUTH command will have no effect in Redis instances with authentication
# switched off.
#
# Example:
#
# sentinel auth-pass mymaster MySUPER--secret-0123passw0rd
sentinel auth-pass mymaster 123456
```

上面是sentinel必须的配置，一个sentinel可以监控一个或多个master。上面的配置监控了一个名字为mymaster的master。mymaster可以随便定义，但多个节点必须保持一致。另外两个sentinel一样的配置方法。

**sentinel monitor [master-name] [ip ] [redis-port] [quorum]**   
这行配置的意思是让sentinel监控某个master，如果`quorum`个sentinel节点同意该master不可达(不回复ping)，那么认为该master O_DOWN，准备启动failover。

注意上面的注释，`quorum`是一个很微妙的词，假如我们按照下面的配置

```shell
sentinel monitor mymaster 192.168.11.170 6378 1
```

quorum设置为1，表达的是，当有一个sentinel发现master处于S_DOWN状态，那么就直接认为master进入O_DOWN(因为quorum为1)。

但是请注意注释中还有一段描述   
> a Sentinel will require to be elected by the majority of the known Sentinels in order to start a failover

虽然它某个sentinel决定要让master进入O_DOWN状态，不过想要启动failover，必须要得到大多数(majority) sentinel节点的批准，选举出一个sentinel来执行failover。   
因此，上面quorum的配置，仅用于决定判断master odown所需的其他节点同意的数量，failover必须经由majority节点选出一个sentinel执行。

**sentinel down-after-milliseconds mymaster 10000**

上面配置表达的意思是如果超过10s得不到某个节点的应答，就认为该节点已经下线(sdown)。   
sentinel会不断向master、replica(slave)、sentinel节点发送心跳(ping)

##### 启动命令

```shell
# 启动命令
sentinel /etc/redis/sentinel/sentinel-16380.conf
```

当所有服务器配置好后，sentinel就会成功启动。sentinel会自动修改redis.conf和sentinel.conf，因此可能我们会看到一些自动生成的信息，比如: 

```shell
sentinel known-replica mymaster 192.168.11.171 6379
sentinel known-replica mymaster 192.168.11.172 6379
sentinel known-sentinel mymaster 192.168.11.171 16380 aebd7888fa0c428d2eff0a19d184419cb3869197
sentinel known-sentinel mymaster 192.168.11.172 16380 69ecdb52087ca0ac8bd844023678e00455e13457
```
同时我们再观察sentinel节点的log，可以看到sentinel会自动同步slave和其他sentinel节点的信息。

```shell
77195:X 23 Nov 2020 20:40:15.180 # +monitor master mymaster 192.168.11.170 6379 quorum 2
77195:X 23 Nov 2020 20:40:15.181 * +slave slave 192.168.11.171:6379 192.168.11.171 6379 @ mymaster 192.168.11.170 6379
77195:X 23 Nov 2020 20:40:15.181 * +slave slave 192.168.11.172:6379 192.168.11.172 6379 @ mymaster 192.168.11.170 6379
77195:X 23 Nov 2020 20:41:04.885 * +sentinel sentinel 69ecdb52087ca0ac8bd844023678e00455e13457 192.168.11.171 16380 @ mymaster 192.168.11.170 6379
77195:X 23 Nov 2020 20:41:28.973 * +sentinel sentinel aebd7888fa0c428d2eff0a19d184419cb3869197 192.168.11.172 16380 @ mymaster 192.168.11.170 6379
```



#### 测试failover

上面已经配置好了所有的redis和sentinel，现在可以使用redis提供的命令来测试failover，官方提供了下面的命令

```shell
redis-cli -h 192.168.11.170 -p 6379 DEBUG sleep 30
```

上面命令会让节点在30秒内进入不可达的状态，30秒后自动恢复。当上面的命令执行后，sentinel将会执行下面的动作。

1. sentinel发现master不可达，发送+sdown事件
2. 询问其他sentinel节点master的状态，如果节点达到quorum同意master不可达，那master会变为+odown
3. 所有sentinel节点会选举出一个sentinel执行failover
4. 开始执行failover

查看log

```shell
77195:X 23 Nov 2020 20:46:23.326 # +sdown master mymaster 192.168.11.170 6379
77195:X 23 Nov 2020 20:46:23.417 # +odown master mymaster 192.168.11.170 6379 #quorum 2/2
77195:X 23 Nov 2020 20:46:23.417 # +new-epoch 1
77195:X 23 Nov 2020 20:46:23.418 # +try-failover master mymaster 192.168.11.170 6379
77195:X 23 Nov 2020 20:46:23.420 # +vote-for-leader e0acb411797e6e8e6c81b62c2de9f9e1bc89d9fc 1
77195:X 23 Nov 2020 20:46:23.424 # aebd7888fa0c428d2eff0a19d184419cb3869197 voted for e0acb411797e6e8e6c81b62c2de9f9e1bc89d9fc 1
77195:X 23 Nov 2020 20:46:23.424 # 69ecdb52087ca0ac8bd844023678e00455e13457 voted for e0acb411797e6e8e6c81b62c2de9f9e1bc89d9fc 1
77195:X 23 Nov 2020 20:46:23.491 # +elected-leader master mymaster 192.168.11.170 6379
77195:X 23 Nov 2020 20:46:23.491 # +failover-state-select-slave master mymaster 192.168.11.170 6379
77195:X 23 Nov 2020 20:46:23.552 # +selected-slave slave 192.168.11.171:6379 192.168.11.171:6379 @ mymaster 192.168.11.170 6379

77195:X 23 Nov 2020 20:46:23.552 * +failover-state-send-slaveof-noone slave 192.168.11.171:6379 192.168.11.171 6379 @ mymaster 192.168.11.170 6379

77195:X 23 Nov 2020 20:46:23.644 * +failover-state-wait-promotion slave 192.168.11.171:6379 192.168.11.171:6379 @ mymaster 192.168.11.170 6379
77195:X 23 Nov 2020 20:46:23.785 # +promoted-slave slave 192.168.11.171:6379 192.168.11.171:6379 @ mymaster 192.168.11.170 6379
77195:X 23 Nov 2020 20:46:23.785 # +failover-state-reconf-slaves master mymaster 192.168.11.170 6379
77195:X 23 Nov 2020 20:46:23.875 * +slave-reconf-sent slave 192.168.11.172:6379 192.168.11.172 6379 @ mymaster 192.168.11.170 6379
77195:X 23 Nov 2020 20:46:24.503 # -odown master mymaster 192.168.11.170 6379
77195:X 23 Nov 2020 20:46:24.811 * +slave-reconf-inprog slave 192.168.11.172:6379 192.168.11.172 6379 @ mymaster 192.168.11.170 6379
77195:X 23 Nov 2020 20:46:24.811 * +slave-reconf-done slave 192.168.11.172:6379 192.168.11.172 6379 @ mymaster 192.168.11.170 6379
77195:X 23 Nov 2020 20:46:24.870 # +failover-end master mymaster 192.168.11.170 6379
77195:X 23 Nov 2020 20:46:24.870 # +switch-master mymaster 192.168.11.170 6379 192.168.11.171 6379
77195:X 23 Nov 2020 20:46:24.870 * +slave slave 192.168.11.172:6379 192.168.11.172 6379 @ mymaster 192.168.11.171 6379
77195:X 23 Nov 2020 20:46:24.870 * +slave slave 192.168.11.170:6379 192.168.11.170 6379 @ mymaster 192.168.11.171 6379

```

从上面sentinel的日志可以看到failover的完整过程，最终我们的老master恢复是，变成了192.168.11.171:6379的slave节点。



### Sentinel的合适节点数量

合适的节点数量能提升系统的健壮性，通常建议用3台服务器搭建哨兵模式。当然5台服务器会让系统的容错变得更高，只是都用到5台了，不在乎多加一台，直接搭建Cluster是一个更好的选择。

#### 2台服务器(强烈不推荐)

```shell
+----+         +----+
| M1 |---------| R1 |
| S1 |         | S2 |
+----+         +----+

Configuration: quorum = 1
```

上面的情况分2中情况讨论

1. M1挂掉，S1幸存

   这种情况发生时，S2把M1设为O_DOWN，且请求执行failover。因为S1幸存，2票通过，于是R1升级为新的Master。

2. M1挂掉，S1也挂掉

   因为请求failover时，无法得到majority的同意，因此无法执行。整个系统直接变为不可用状态。

实际上，上面第二种情况是最容易发生(网络问题)。所以2个节点搭建Sentinel用处不大。

#### 3台服务器(较好的数量)

```shell
       +----+
       | M1 |
       | S1 |
       +----+
          |
+----+    |    +----+
| R2 |----+----| R3 |
| S2 |         | S3 |
+----+         +----+

Configuration: quorum = 2
```

当节点数量为3台是，系统会变得健壮一些，只要majority节点不出故障，系统都是可用的。



### 一致性问题

#### 数据丢失

Redis无法保证数据强一致性，因为replication过程是异步的。当客户端成功写入master时，master down掉，此时sentinel会从slave中选出一个当新的master，原来写入的数据就丢失了。

#### split brain(脑裂)问题

脑裂是指一个集群中出现了多个master节点。相对于上面的数据丢失，脑裂是更严重的问题，通常这种情况发生在网络分区场景。

```
            +-------------+
            | Sentinel 1  |----- Client A
            | Redis 1 (M) |
            +-------------+
                    |
                    |
+-------------+     |          +------------+
| Sentinel 2  |-----+-- // ----| Sentinel 3 |----- Client B
| Redis 2 (S) |                | Redis 3 (M)|
+-------------+                +------------+
```

在上面的例子中，原本master是Redis3这个节点。在某个时刻发生了网络分区，把Sentinel 3和Sentinel 1和2隔离了。此时Sentinel 1和2启动了failover，把Redis 1提升为新的Master(quorum和majority都符合条件)。

这时，集群中就出现了2个Master，这是非常致命的。如上图所示，Client B还是继续和老的Master通信，它的写入请求依然写入到老的Master上，此时一旦网路分区问题愈合，Sentinel 3发现集群中有了新的Master，会让当前的Master切换为slave，那么在发生网络分区期间写入的数据将全部丢失。

如何避免呢？很遗憾，没法避免。只能让Redis3节点停止写入来缓解这个问题，如下参数:

```shell
# It is possible for a master to stop accepting writes if there are less than
# N replicas connected, having a lag less or equal than M seconds.
#
# The N replicas need to be in "online" state.
#
# The lag in seconds, that must be <= the specified value, is calculated from
# the last ping received from the replica, that is usually sent every second.
#
# This option does not GUARANTEE that N replicas will accept the write, but
# will limit the window of exposure for lost writes in case not enough replicas
# are available, to the specified number of seconds.
#
# For example to require at least 3 replicas with a lag <= 10 seconds use:
#
# min-replicas-to-write 3
# min-replicas-max-lag 10
#
# Setting one or the other to 0 disables the feature.
#
# By default min-replicas-to-write is set to 0 (feature disabled) and
# min-replicas-max-lag is set to 10.
min-replicas-to-write 1
min-replicas-max-lag 10
```

**注意注意注意,上面是redis 5.0以上的配置，5.0以下请参考自己的redis.conf文件**

上面2个参数中表达的意思是，当master少于1个(min-replicas-to-write指定的值)replicas时，或者max-lag大于10s时(min-replicas-max-lag指定的值)，这个master将会停止接受client的写入请求，来缓解数据丢失问题。因此，在redis中脑裂问题只能缓解，不能根本解决数据丢失问题。

注: replicas通常会每秒向master发送ping



### Sentinel API

注意: 这些api需要登录到sentinel节点才能使用。eg:

```shell
redis-cli -h 192.168.11.170 -p 16380
```

**SENTINEL FAILOVER `<master name>`** 

如果指定的master不可达，就强制执行failover，而不用经过其他sentinel节点的同意。需要注意这是很危险的操作，尤其是在只剩下2个节点的情况下，可能会脑裂为2个master，后续也无法进入故障恢复。

**SENTINEL GET-MASTER-ADDR-BY-NAME `<master name>`**

通过master_name获取master的地址信息，比如sentinel get-master-addr-by-name mymaster返回的结果如下

```shell
1) "192.168.11.170"
2) "6379"
```

我们的application client(比如spring)就是通过这种方式获取从sentinel节点中获取master节点信息。

**SENTINEL REPLICAS `<master name>`** (`>= 5.0`) Show a list of replicas for this master, and their state.

显示制定master节点下的replicas节点和状态。

更多的API请参考redis官网[sentinel commands](https://redis.io/topics/sentinel#sentinel-commands)



### Sentinel自动发现机制(auto discovery)

sentinel节点之间一直保持着互相通信的状态，这样做的目的一是为了监测对方是否处于可用状态; 二是节点之间需要交换彼此的信息(master slave等)。

就如同上面展示sentinel的log，我们不需要在每个sentinel节点配置其他sentinel的信息，他们会自动同步。sentinel通过redis的Pub/Sub功能来实现自动发现机制。

* 每个sentinel节点，每隔2秒会像它监控的master、replica节点的`__sentinel__:hello`channel发送自己的信息。这些信息包括自己的ip，端口，以及自己监测的master信息。
* 每个sentinel节点都会订阅`__sentinel__:hello`这个channel，查找一些未知的sentinel节点。如果发现了新的，就把这个新的节点写入到配置中。
* 每个sentinel发送的hello信息都包含了完整的配置信息，如果某个节点的配置信息比接收到的信息更老，那它会自动更新为新的信息。

我们可以在任意一redis节点订阅`__sentinel__:hello`这个channel来查看hello message。

```shell
redis-cli -h 192.168.11.170 -p 6379
SUBSCRIBE __sentinel__:hello

#output

Reading messages... (press Ctrl-C to quit)
1) "subscribe"
2) "__sentinel__:hello"
3) (integer) 1
1) "message"
2) "__sentinel__:hello"
3) "192.168.11.172,16380,aebd7888fa0c428d2eff0a19d184419cb3869197,1,mymaster,192.168.11.171,6379,1"
1) "message"
2) "__sentinel__:hello"
3) "192.168.11.172,16380,aebd7888fa0c428d2eff0a19d184419cb3869197,1,mymaster,192.168.11.171,6379,1"
1) "message"
2) "__sentinel__:hello"
3) "192.168.11.170,16380,e0acb411797e6e8e6c81b62c2de9f9e1bc89d9fc,1,mymaster,192.168.11.171,6379,1"
1) "message"
2) "__sentinel__:hello"
#.......
```



### Sentinel 的缺点

Sentinel方案虽然实现了failover，但依然无法解决下面的一些问题

* 负载均衡

  当节点的存储量很大，且访问量很庞大，Sentinel无法做到数据和访问量的负载均衡

* 容错率

  上面提到过3台服务器搭建sentinel是比较适合的数量，因为服务器数量继续增加，虽然能提高系统可靠性，不过却可以选择另一种更为强大的方案，即cluster。因此sentinel是种高不成低不就的方案。

  

当数据量和访问量都巨大时，可以尝试Redis官方的Cluster方案。往后有时间，会补上cluster方案的文章。


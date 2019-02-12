---
title: 谈谈王者荣耀的elo匹配系统
key: honour-of-kings-elo-rating-system
permalink: honour-of-kings-elo-rating-system.html
tags: elo 匹配算法
---
elo原本是一套用于国际象棋的评分系统。在游戏领域，普遍用于竞技游戏的实时匹配算法。如dota、lol、王者荣耀等。

### elo算法

![elo_ea_impl](https://wikimedia.org/api/rest_v1/media/math/render/svg/51346e1c65f857c0025647173ae48ddac904adcb)


![elo_eb_impl](https://wikimedia.org/api/rest_v1/media/math/render/svg/4b340e7d15e61ee7d90f428dcf7f4b3c049d89ff)

上面是对弈双方胜率的计算公示，其中

RA = A玩家的积分 (在竞技游戏中，这通常对玩家不可见)  
RB = B玩家的积分 (同上)

当一场游戏结束后，最多会出现三种情况。胜（1分）、平（0.5分），负（0分）。我们把胜、平、负用S表示。  
RA'和RB’分别表示A、B玩家比赛结束新的积分。
<!--more-->

* A胜  
  RA' =  RA + K(SA - EA)  
  RB' = RB - K(SA - EA)

* B胜  
  RB' = RB + K(SB - EB)  
  RA' = RA - K(SB - EB)  

上面的K是一个常量，它是的大小反映了比赛的重要性。**K**值较大一般用于比较普通的比赛，**K**值越小用于大师赛。  
在王者荣耀中，个人猜测在不同段位，K值可能是不一样的。比如钻石段位**K**值可能比荣耀王者大很多。**K**值越小就说明需要更高的胜率才能提高积分。  
上面说的可能有点抽象，下面带入把实际的例子代入上面的公式展示给大家看一下。

> 假如A和B的积分(隐藏分)分别为1500 和 1600，那么他们的胜率估算如下

![elo_ea](/assets/images/elo/elo_ea.gif)  
![elo_eb](/assets/images/elo/elo_eb.gif)

A和B进行了一场排位比赛，假设A赢了，此时A和B的积分变化如下(假如**K为32**):  
**RA' = 1500 + 32(1 - 0.36) = 1520.48**  
**RB' = 1600 - 20.48 = 1579.52**  

假设是B玩家赢了，B的积分变化如下  
**RB' = RB + 32(1 - 0.64) = 1611.52**  
**RA' = 1500 - 11.52 = 1488.48**  

从上面运算结果可以看到，A玩家赢了会加很多分，输了减的分比较低。因为B玩家的积分比A要高100，A能赢B说明A的实力可能和B一致，B的积分可能是虚高。假如A和B的实力一致，经过大量的比赛，他们的积分就会趋向一致，反之两者积分会不断拉大。

### 5v5如何计算积分

个人猜测5v5是取五位玩家的平均分作为匹配规则，比赛结束后根据玩家的局内表现(是否MVP、金牌、银牌)加权分配积分。其实这点王者荣耀的策划也提到过，局内表现会影响elo值。

**参考资料**   
http://www.woshipm.com/pd/935349.html   
https://blog.csdn.net/qq100440110/article/details/70240824
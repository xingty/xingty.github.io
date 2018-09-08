---
title: 导入OSM(openstreetmap)数据到Mysql
key: importing-osm-into-mysql
permalink: importing-osm-into-mysql.html
tags: gis
---

Mysql5.7后对GIS添加了很多支持，如innodb和geohash等等特性。最近想测试一下Mysql内部函数计算距离的性能，偶然发现了[OpenStreetMap](https://www.openstreetmap.org/)这个网站。你可以OpenStreetMap下载到全球的地理信息位置，下载的格式为OSM。

找了一些资料很多都是导入postgresql，折腾了一下午，终于成功导入mysql了。下面是流程

<!--more-->

## Osmosis

下载的OSM本身就是XML格式的数据，不过通常来说OSM都非常庞大，我下载了中国的解压出来有9+GB，要处理这么大的文件很麻烦，还要缕清各种关系。Osmosis是官网提供的一个工具，用于操作OSM文件。具体介绍和下载地址[戳我](https://wiki.openstreetmap.org/wiki/Osmosis)

如果你用的是Mac系统，也可以直接通过homebrew安装

``` shell
brew install osmosis
```

## 导入数据表

[点我下载数据库](/assets/files/osm.sql)导进你自己的数据库，过程我简单用命令描述了:)

```shell
mysql -u root -p
use osm;
source /tmp/osm.sql;
exit;
```

如无意外成功创建数据表，接下来就可以用osmosis导入啦，执行下面命令

```shell
osmosis --read-xml enableDateParsing=no file="YOUR_OSM_IMPORT_FILE" --buffer --write-apidb dbType="mysql" host="YOUR_HOSTNAME" database="YOUR_DATABASE_NAME" user="YOUR_USERNAME" password="YOUR_PASSWORD" validateSchemaVersion=no
```

请耐心等待，我导入9G的数据到虚拟机的Mysql，用了2个小时。血淋淋的教训，最好是导到本机的Mysql。

## 最后

给大家看看在34w条数据查询距离的耗时

```sql
SELECT node_id
	, floor(st_distance_sphere(geomfromtext('point(114.1811521 22.3460512)'), gis)) AS distance
FROM current_nodes;
```

```shell
# result
340589 rows in set, 1 warning (0.67 sec)
```

再加上排序

```sql
SELECT node_id
	, floor(st_distance_sphere(geomfromtext('point(114.1811521 22.3460512)'), gis)) AS distance
FROM current_nodes
ORDER BY distance;
```

```shell
# result
340589 rows in set, 1 warning (1.59 sec)
```

加了排序差不多慢了1s呢，这是个很恐怖的数字啊。

最后试一下网上很常见的一段计算代码，这个是没有使用Mysql的gis，看看性能如何

```sql
DELIMITER  $$ 
CREATE FUNCTION `GETDISTANCE`(lng1 double(12,8), lat1 double(12, 8), lng2 double(12,8), lat2 double(12,8)) RETURNS double
BEGIN
DECLARE dist DOUBLE;
SET dist = round(6378.138*2*asin(sqrt(pow(sin((lat1*pi()/180-lat2*pi()/180)/2),2)+cos(lat1*pi()/180)*cos(lat2*pi()/180)* pow(sin((lng1*pi()/180-lng2*pi()/180)/2),2)))*1000);
RETURN dist;
END $$
```

```sql
SELECT node_id
	, GETDISTANCE(cn.longitude, cn.latitude, 114.1811521, 22.3460512) AS distance
FROM current_nodes cn
ORDER BY distance;
```

```shell
# result
340589 rows in set (4.99 sec)
```
可以看到，性能差太多了。所以在涉及到距离计算式，Mysql5.7以后可以用内部函数计算，再加上一些查询优化，相信能把查询时间减少到毫秒级别。


## 参考资料

https://forum.openstreetmap.org/viewtopic.php?id=9870   
https://wiki.openstreetmap.org/wiki/Osmosis
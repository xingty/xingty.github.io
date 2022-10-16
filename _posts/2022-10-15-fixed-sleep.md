---
title: '解决黑苹果Monterey蓝牙睡眠后不工作问题'
key: fixed-sleep
permalink: fixed-sleep.html
tags: hackintosh
---

自Monterey(macOS 12.x)以来，博通BCM94360的网卡蓝牙模块可能会出现问题，具体表现为睡眠唤醒后，蓝牙会出现睡死的情况，即需要进入系统把蓝牙关了重新打开才能正常工作。

苹果切换到Apple silicon后，貌似Opencore现在对Hackintosh也没那么上心了，蓝牙问题已经挺久。现在曲线救国的办法是在睡眠之前把蓝牙关闭，睡醒后再打开，这样会省事很多。我们当然不会手动去做这个事，mac下刚好有个app叫sleepwatcher，可以监控睡眠和唤醒。

#### 准备工作

1. 下载sleepwatcher

   推荐官网直接下载，地址: https://www.bernhard-baehr.de/。(地址可能需要翻墙才能访问)

2. 安装blueutil

   blueutil是一个蓝牙工具，可以通过命令打开和关闭蓝牙，推荐使用homebrew下载

   ```shell
   brew install blueutil
   ```

#### 安装sleepwatcher

首先通过终端进入sleepwatcher的文件夹，以我的为例，版本为`sleepwatcher_2.2.1`

```shell
cd sleepwatcher_2.2.1
sudo cp ./sleepwatcher /usr/local/sbin
sudo cp ./sleepwatcher.8 /usr/local/share/man/man8

#创建数据文件夹，这个可以自定义，如果选择不同的路径，下面的路径也必须跟着修改
mkdir ~/.sleep
```
<!--more-->

紧接着创建2个脚本，一个用于启动蓝牙，一个用于关闭，分别把这两个文件放到`~/.sleep/`   
下面是rc.sleep文件，用于睡眠时关闭蓝牙

```shell
#!/bin/bash
# rc.sleep
# Stop Bluetooth Module on Mac OS X
#
# Requires Blueutil to be installed: http://brewformulas.org/blueutil

BT="/usr/local/bin/blueutil"

log() {
	# logger -p notice -t bt_restarter "$@"
	echo "$@" >> ~/.sleep/sleepwatcher.log
}

err() {
	echo "$@" >&2
	echo "$@" >> ~/.sleep/sleepwatcher.log
	# logger -p error -t bt_restarter "$@"
}

log ""
log "sleep at $(date +"%Y-%m-%dT%H:%M:%S")"
if [ -f "$BT" ]; then
	if [[ $("$BT" -p) == 0 ]]; then
		log "Bluetooth is off, nothing to do."
	else
		log "Bluetooth on, stopping ..."
		($("$BT" -p 0) &> /dev/null && echo "Bluetooth Module stopped") || (err "Couldn't stop Bluetooth Module" && exit 1) 
		log "Successfully stoped Bluetooth" && exit 0
	fi
else
	err "Couldn't find blueutil, please install http://brewformulas.org/blueutil" && exit 1
fi
```

下面是rc.wakeup，用户唤醒时打开蓝牙

```shell
#!/bin/bash
# rc.wakeup
# Restart Bluetooth Module on Mac OS X
#
# Requires Blueutil to be installed: http://brewformulas.org/blueutil

BT="/usr/local/bin/blueutil"

log() {
	# logger -p notice -t bt_restarter "$@"
	echo "$@" >> ~/.sleep/sleepwatcher.log
}

err() {
	echo "$@" >&2
	echo "$@" >> ~/.sleep/sleepwatcher.log
	# logger -p error -t bt_restarter "$@"
}

log "wakeup at $(date +"%Y-%m-%dT%H:%M:%S")"
if [ -f "$BT" ]; then
	if [[ $("$BT" -p) == 0 ]]; then
		log "Bluetooth is off, Starting Bluetooth..."
		($("$BT" -p 1) &> /dev/null && echo "Bluetooth Module started") || (err "Couldn't start Bluetooth Module" && exit 1) 
	else
		log "Bluetooth on, restarting ..."
		($("$BT" -p 0) &> /dev/null && echo "Bluetooth Module stopped") || (err "Couldn't stop Bluetooth Module" && exit 1)
		($("$BT" -p 1) &> /dev/null && echo "Bluetooth Module started") || (err "Couldn't start Bluetooth Module" && exit 1) 
		log "Successfully restarted Bluetooth" && exit 0
	fi
else
	err "Couldn't find blueutil, please install http://brewformulas.org/blueutil" && exit 1
fi
```

下一步是给这两个文件添加上可执行权限

```shell
cd ~/.sleep
chmod u+x rc.sleep rc.wakeup
```

成功后，创建文件` ~/Library/LaunchAgents/de.bernhard-baehr.sleepwatcher.plist`，粘贴下面内容

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>de.bernhard-baehr.sleepwatcher</string>
	<key>ProgramArguments</key>
	<array>
		<string>/usr/local/sbin/sleepwatcher</string>
		<string>-V</string>
		<string>-s ~/.sleep/rc.sleep</string>
		<string>-w ~/.sleep/rc.wakeup</string>
	</array>
	<key>RunAtLoad</key>
	<true/>
	<key>KeepAlive</key>
	<true/>
</dict>
</plist>
```

最后一步，执行命令

```shell
launchctl load de.bernhard-baehr.sleepwatcher.plist
```

执行完后，可能会弹窗请求授权，这时正常通过即可，这时你可以直接直接选择睡眠和唤醒，查看效果。

你可以通过执行命令`cat ~/.sleep/sleepwatcher.log`查看睡眠和唤醒时启动和关闭蓝牙的日志。

### 总结

sleepwatcher是个很有意思的工具，监控电脑睡眠和唤醒有些场景可能会很有用，比如这次恰好可以解决蓝牙睡眠问题。还有就是之前我的黑苹果睡眠偶尔会异常唤醒，自从关掉蓝牙后睡眠再也没遇到过异常唤醒的情况。
---
title: Ueditor修改源码增加前端直传oss功能
key: ueditor-add-oss-upload-feature
permalink: ueditor-add-oss-upload-feature.html
tags: 富文本编辑器
---

本文主要的目的是为了让ueditor拥有前端直接oss上传图片的能力，不需要经过后端中转，减轻后端服务器的压力。同时添加springboot的支持。

注: 为了代码统一性和兼容性，本文所有编码方式均采用ES5。如果你觉得这没必要，可以使用ES6，甚至ES7的语法。

**准备工作**

1. ueditor source code

2. 阿里云oss服务

3. 一丢丢Node.js和grunt的知识

<!--more-->

## 修改Ueditor源码
### ueditor.config.js

这个文件会被原封不动打包且放到window中，我们需要往里面加一些oss的信息。

```javascript
window.UEDITOR_CONFIG = {
    ...
    //此处修改为获取json配置信息的网址(jsp改为springboot,稍后讲springboot的配置)
    serverUrl: URL + "config"
    oss: {
      //获取oss签名的url
      url: "http://localhost:8107/app/oss-signature",
      //图片上传的路径
      path: "/images/cms/"
    }
}
```

### _src/editor.js

#### 增加oss上传

打开_src/editor.js,添加下面代码

```javascript
UE.ossService = new OSSService();

function OSSService() {
	this.ossSign = undefined;
	this.getOSSSign = function(callback) {
		var sign = this.ossSign;
		var now = parseInt(new Date().getTime() / 1000);
		if (sign && now - sign.expired <= 1800) {
				callback(sign.data);
				return;
		}

		var self = this;
		//从服务器获取oss info
		function fetchOSS() {
				const url = window.UEDITOR_CONFIG.oss.url;
				var request = new XMLHttpRequest();
				request.onload = function(e) {
					var res = JSON.parse(request.responseText);
					if (!res || res.code != 0 || !res.data) {
							alert('获取签名失败');
					}
					
					//回传oss sign
					callback(res.data);
					//缓存签名
					self.ossSign = {
							expired: parseInt(new Date().getTime() / 1000),
							data: res.data
					}
				}
				request.open('GET',url);
				request.send();
		}

		fetchOSS();
	}

	this.uploadToOSS = function(sign,file,uploadCallback) {
		function getOssFileName(file) {
				var timestamp = new Date().getTime();
				var random = parseInt(Math.random() * 1000000);
            
				return timestamp + '_' + random + "." + file.ext;
		} 

		var form = new FormData();
		var path = window.UEDITOR_CONFIG.oss.path || '';
		var key = path + "/" + getOssFileName(file);
		// 添加签名信息
		form.append('OSSAccessKeyId', sign['accessKeyId']);
		form.append('policy', sign['policy']);
		form.append('Signature', sign['signature']);
		form.append('key', key);
		// 添加文件
		form.append('file', file);
		
		var req = new XMLHttpRequest();
		req.onload = function(e) {
			var data = {
					link: sign['baseUrl'] + '/' + key,
					name: file.name
			}
			uploadCallback(data);
		}
		req.open('POST',sign['baseUrl']);
		req.send(form);
	}	
}
```

### _src/plugins/simpleupload.js

#### 修改单图上传

打开_src/plugins/simpleupload.js，定位到113行左右，注释下面这段

```javascript
//domUtils.on(iframe, 'load', callback);
//form.action = utils.formatUrl(imageActionUrl + (imageActionUrl.indexOf('?') == -1 ? '?':'&') + params);
//form.submit();
//替换为下面这段
var myService = UE.ossService;
var myFile = input['files'][0];
myService.getOSSSign(function(sign) {
    myService.uploadToOSS(sign,myFile, function(data) {
        loader = me.document.getElementById(loadingId);
        loader.setAttribute('src', data.link);
        loader.setAttribute('_src', data.link);
        loader.setAttribute('title', data.name);
        loader.setAttribute('alt', data.name);
        loader.removeAttribute('id');
        domUtils.removeClasses(loader, 'loadingclass');
    });
});
```

同时，也可以把callback删了，当然留着也无妨，就是一些无用的代码而已。

### _src/plugins/autoupload.js

#### 拖拽上传

打开_src/plugins/autoupload.js，定位到打开88行

```javascript
/* 创建Ajax并提交 */
var xhr = new XMLHttpRequest(),
    fd = new FormData(),
    params = utils.serializeParam(me.queryCommandValue('serverparam')) || '',
    url = utils.formatUrl(actionUrl + (actionUrl.indexOf('?') == -1 ? '?':'&') + params);
```

删除这一整段XMLHttpRequest，添加下面oss上传

```javascript
var myService = UE.ossService;
myService.getOSSSign(function(sign) {
    myService.uploadToOSS(sign,file, function(data) {
        successHandler({
            "state": "SUCCESS",
            "url": data.link,
            "title": file.name,
            "original": file.name,
            "type": fileext,
            "size": file['size']
        });
    });
});
```

### dialogs/image/image.js

#### 多图上传

打开dialogs/image/image.js，定位到大概744行

```javascript
$upload.on('click', function () {
    if ($(this).hasClass('disabled')) {
        return false;
    }

    if (state === 'ready') {
        uploader.upload();
    } else if (state === 'paused') {
        uploader.upload();
    } else if (state === 'uploading') {
        uploader.stop();
    }
});
```

把上面代码改为下面oss上传

```javascript
$upload.on('click', function () {
    if ($(this).hasClass('disabled')) {
        return false;
    }

    var start = function() {
        if (state === 'ready') {
            uploader.upload();
        } else if (state === 'paused') {
            uploader.upload();
        } else if (state === 'uploading') {
            uploader.stop();
        }
    }

    var myService = UE.ossService;
    myService.getOSSSign(function(sign) {
        uploader['options']['server'] = sign['baseUrl'];
        start();
    });
});
```

#### uploadBeforeSend

定位到大约704行，找到下面代码

```javascript
uploader.on('uploadBeforeSend', function (file, data, header) {
    //这里可以通过data对象添加POST参数
    header['X_Requested_With'] = 'XMLHttpRequest';
});
```

改为下面的代码

```javascript
uploader.on('uploadBeforeSend', function (file, data, header) {
                //这里可以通过data对象添加POST参数
    header['X_Requested_With'] = 'XMLHttpRequest';
    var myService = UE.ossService;
    myService.getOSSSign(function(sign) {
        var object_name = "images/" + new Date().getTime() + "_" + parseInt(Math.random() * 100000) + "." + file.file.ext;
        data = $.extend(data, {
            'OSSAccessKeyId': sign['accessKeyId'],
            'policy': sign['policy'],
            'Signature': sign['signature'],
            'key': object_name
        });
        file.file.link = sign['baseUrl'] + '/' + object_name;
    })
});
```

#### startUpload

定位到693行代码，删掉下面几行

```javascript
var params = utils.serializeParam(editor.queryCommandValue('serverparam')) || '',
    url = utils.formatUrl(actionUrl + (actionUrl.indexOf('?') == -1 ? '?':'&') + 'encode=utf-8&' + params);
uploader.option('server', url);
setState('uploading', files);
```

替换为

```javascript
var myService = UE.ossService;
myService.getOSSSign(function(sign) {
    uploader.option('server', sign['baseUrl']);
    setState('uploading', files);
});
```

#### uploadSuccess

找到上传成功代码

```javascript
uploader.on('uploadSuccess', function (file, ret) {
    var $file = $('#' + file.id);
    try {
        var responseText = (ret._raw || ret),
            json = utils.str2json(responseText);
        if (json.state == 'SUCCESS') {
            _this.imageList.push(json);
            $file.append('<span class="success"></span>');
        } else {
            $file.find('.error').text(json.state).show();
        }
    } catch (e) {
        $file.find('.error').text(lang.errorServerUpload).show();
    }
});
```

修改为下面的的代码

```javascript
uploader.on('uploadSuccess', function (file, ret) {
    var $file = $('#' + file.id);
    try {
        var responseText = ret._raw;
        if (responseText === '') {
            let res = {
                "state": "SUCCESS",
                "url": file.link,
                "title": file.name,
                "original": file.name,
                "type": file.ext,
                "size": file.size
            }
            _this.imageList.push(res);
            $file.append('<span class="success"></span>');
        } else {
            //todo
        }
    } catch (e) {
        $file.find('.error').text(lang.errorServerUpload).show();
    }
});
```

最后，找到

```javascript
fileVal: editor.getOpt('imageFieldName'),
//替换为
fileVal: 'file'
```



## 打包代码

打包代码很简单，[官网文档](http://fex.baidu.com/ueditor/#dev-bale_width_grunt)也有了一些简单的说明，这里不再赘述。不过提醒一下大家几个值得注意的地方，node版本最好不要过高，我使用node v8打包就报错。可以切换为node v4。推荐使用nvm管理node版本。

> grunt --encode=utf8 --server=jsp

打包后，dist目录就是需要部署的代码。

## 修改jsp为SpringBoot

ueditor提供了jsp的方案，我们可以照葫芦画瓢，更改为spring即可。首先复制源码包jsp目录下src的代码到我们的项目，同时把jsp下的config.json复制到resources/ueditor目录。

config.json由百度的ConfigManager读取，需要修改一下新的路径。找到ConfigManager，修改

```java
//String configContent = this.readFile( this.getConfigPath() );
InputStream is = this.getClass().getClassLoader().getResourceAsStream("ueditor/config.json");
```

添加下面项目依赖

```xml
<dependency>
    <groupId>org.json</groupId>
    <artifactId>json</artifactId>
    <version>20180813</version>
</dependency>

<dependency>
    <groupId>commons-fileupload</groupId>
    <artifactId>commons-fileupload</artifactId>
    <version>1.3.2</version>
</dependency>

<dependency>
    <groupId>commons-codec</groupId>
    <artifactId>commons-codec</artifactId>
    <version>1.9</version>
</dependency>
```

新建一个Controller，添加如下配置

```java
@Controller
public class UEditorController {
	//注意,mapping必须和config.js中的server保持一致
    @GetMapping(value = "/ueditor/config")
    @ResponseBody
    public String config(HttpServletRequest request) {
        String rootPath = request.getSession().getServletContext().getRealPath("/");
        return new ActionEnter(request, rootPath).exec();
    }
}
```

这样springboot即可支持ueditor。



## 动静分离

tomact处理并发的能力远不如nginx。ueditor属于静态资源，应该部署到nginx。部署的过程这里就省略了，以后有空再补上。



参考资料:

https://blog.csdn.net/u013684276/article/details/80143343

http://fex.baidu.com/ueditor/
---
title: 用JS解决Github Pages图片加载慢的问题
key: solve-the-problem-of-images-loading-too-slowly
permalink: solve-the-problem-of-images-loading-too-slowly.html
tags: javascript
---
GitHub Pages的服务器不在国内，也没有CDN，因此在国内的访问速度本身就不快，如果文章还包含了自己上传到github pages的图片，那加载速度会更惨不忍睹。

对于图片加载慢的问题，唯一的解决办法就是不要把图片上传到github pages，另外寻找图床把图片地址引用到文章中。不过图床有个很大的问题就是稳定性，一旦第三方服务取消支持外链(比如微博2019年启用防盗链，大量图片无法显示)，文章将会出现一大堆无法显示的图。

因此最好的办法还是有双管齐下，一份放在图床，另外一份上传到自己的gihub pages 仓库，当图床不可用时，自动替换为我们备份的地址(慢一点总比显示不了强)。

要实现这功能其实并不难，我们都是知道dom的img标签有个onerror事件，当图片加载出错，就会回调这个function。基于这一点，只需要给我们文章的图片都加上onerror事件即可。思路如下:
<!--more-->
1. 利用img的alt属性

   我们都在使用markdown编写文章，由jekyll渲染为html。markdown插入图片的格式有个描述，会渲染为img的alt标签。

   ```javascript
   //markdown格式: ![alt描述](图片地址)
   ```

2. 获取文章所有符合我们期望的img标签(根据img alt属性的内容)
3. 为所有符合期望的img标签添加onerror事件，当加载图片失败时，把alt属性的内容作为新的src赋值给img标签

```javascript
function onReady(callback) {
  let readyState = document.readyState;
  if (readyState === 'interactive' || readyState === 'complete') {
    callback();
    return;
  }

  window.addEventListener("DOMContentLoaded",callback);
}

function findImages() {
  let contents = document.getElementsByClassName('article__content');
  if (!contents || contents.length <= 0) { return; }
  contents = Array.from(contents).forEach(articleContent => {
    let images = articleContent.getElementsByTagName('img');
    if (images && images.length && images.length <= 0) {
      return;
    }

    images = Array.from(images).filter(img => isValidImage(img));
    images.forEach(img => registerEvent(img));
    })
}

function isValidImage(img) {
  let alt = img.alt;
  return alt.startsWith('~replace~') 
        || alt.startsWith('/assets/images/') 
        || alt.startsWith(window.location.origin + '/assets/images/');
}

function registerEvent(imgTag) {
  imgTag.onerror = event => {
    let imgTag = event.target;
    let imgsrc = getImageSrc(imgTag.alt);
    imgTag.src = imgsrc;
  };
}

function getImageSrc(alt) {
  if (alt.startsWith('~replace~')) {
    let src = alt.replace('~replace~','');
    return src.startsWith('http') ? src : window.location.origin + src
  } else if (alt.startsWith('/assets/images/')) {
    return window.location.origin + alt;
  }

  return alt;
}

(function() {
  onReady(findImages);
})();
```

上面是我为自己博客写的js代码，使用步骤很简单。

1. 把js文件放到你博客的includes文件夹
2. 在home或article等模板中引入该js文件
3. 修改css属性`.article__content`为你自己博客内容等class属性，缩小查找范围

完成上面步骤后，在编写文章时，只要markdown符合下面结构，都会自动添加事件。

```javascript
//![~replace~/assets/images/xxx.jpg](http://xx.com/1.jpg)
// 只要alt中含有~replace~都会被添加事件，如果是相对路径，会自动拼写域名

//![/assets/images/](http://xx.com/1.jpg)
// 以/assets/images/开头的资源，会自动拼写域名。这个主要是为了兼容我自己的博客之前的数据

//![http://yourblogdomain/assets/images/](http://xx.com/1.jpg)
//http://yourblogdomain/assets/images/ 以这种方式开始的也会自动添加事件
```

当然了你也可以自己修改js代码达到你所期望的效果，自由发挥啦～
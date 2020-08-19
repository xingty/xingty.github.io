function onReady(callback) {
  let readyState = document.readyState;
  if (readyState === 'interactive' || readyState === 'complete') {
    callback();
    return;
  }

  window.addEventListener("DOMContentLoaded",callback);
}

function findImages() {
  let articleContent = document.querySelector('.article__content');
  if (!articleContent) { return; }

  let images = articleContent.getElementsByTagName('img');
  if (images && images.length && images.length <= 0) {
    return;
  }

  images = Array.from(images).filter(img => isValidImage(img));
  images.forEach(img => registerEvent(img));
}

function isValidImage(img) {
  let alt = img.alt;
  return alt.startsWith('~replace~') 
        || alt.startsWith('/assets/images/') 
        || alt.startsWith(window.location.origin + '/assets/images/');
}

function registerEvent(imgTag) {
  imgTag.onerror = onImageLoadErr;
}

function onImageLoadErr(event) {
  let imgTag = event.target;
  let imgsrc = getImageSrc(imgTag.alt);
  imgTag.src = imgsrc;
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
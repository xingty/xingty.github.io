---
title: 'EIP55-以太坊账户地址校验算法'
key: eth-eip55
permalink: eth-eip55.html
tags: blockchain
---

以太坊账户地址是一个40字符的hex string，细心的朋友可能会发现账户地址有些字母包含了大写字母和小写字母，但实际交易时，用小些地址也可以正常执行操作。

查了一下资料，发现原来包含大写字母的是经过了校验和(checksum)的地址

> - `0x7cb57b5a97eabe94205c07890be4c1ad31e486a8`
> - `0x7cB57B5A97eAbe94205C07890BE4c1aD31E486A8`

上面两个地址的区别是，前者不包含校验和(checksum)，后者是包含校验和的地址。这个校验和有什么作用呢？因为以太坊地址本身不包含校验信息，一旦用户输入错误，没有一种机制校验，该交易将会永远丢失。

为了解决上面的问题，2016年有人在github提了一个Improvement Proposal《[Yet another cool checksum address encoding]()》，用一种向后兼容的校验和算法对账户地址进行checksum。这种算法得满足下面条件:

* 向下兼容
* 保持账户地址的长度和信息都不发生变化
* 足够低的碰撞概率

上面提到的proposal提出了一种算法来解决这个问题，该算法原文描述如下:

> In English, convert the address to hex, but if the ith digit is a letter (ie. it's one of `abcdef`) print it in uppercase if the ith bit of the hash of the address (in binary form) is 1 otherwise print it in lowercase.

上面描述的意思需要结合代码看才更加清晰，我用自己的语言描述如下:

先把账户地址经过digist再转为hex string，然后遍历用户原本的地址，如果hex string和原地址对应位置的字符是一个字母时，把原地址的字符转为大写字符，否则是一个小些字符。

该算法最终被采纳为以太坊的标准，EIP-55。EIP-55的实现原理实际上非常简单，代码甚至都不到10行，非常简洁。下面是EIP55的JS实现，感受一下极致简洁的代码带来的美感。

```javascript
const createKeccakHash = require('keccak')

function toChecksumAddress (address) {
  address = address.toLowerCase().replace('0x', '')
  var hash = createKeccakHash('keccak256').update(address).digest('hex')
  var ret = '0x'

  for (var i = 0; i < address.length; i++) {
    if (parseInt(hash[i], 16) > 7) {
      ret += address[i].toUpperCase()
    } else {
      ret += address[i]
    }
  }

  return ret
}
```

参考资料:

[Vitalik Buterin](mailto:vitalik.buterin@ethereum.org), [Alex Van de Sande](mailto:avsa@ethereum.org), "EIP-55: Mixed-case checksum address encoding," *Ethereum Improvement Proposals*, no. 55, January 2016. [Online serial]. Available: https://eips.ethereum.org/EIPS/eip-55.   
[Ethereum Address Has Uppercase and Lowercase Letters](https://support.mycrypto.com/general-knowledge/ethereum-blockchain/ethereum-address-has-uppercase-and-lowercase-letters/)
---
title: 从生物学角度看面向对象编程的多态
key: in-biology-polymorphism
permalink: in-biology-polymorphism.html
tags: Java OOP
---

我们都知道面向对象编程是尽量模拟现实世界对象之间的关系，"多态"是OOP中非常重要的一个概念，它是指一个对象的多种形态。不过这个概念不是很好理解，或者说我们有时候理解的不是很透彻。最近刚好有空翻了一下Wikipedia，发现从生物学角度更好理解多态。

```java
//已知Tiger是Cat的派生类,有没有想过,为什么这样就称为多态?
Cat cat = new Tiger();
```
<!--more-->
"多态"英文名叫Polymorphism，这个单词并非计算机领域独有，早在生物学就存在。Wikipedia对它的解释为

> In biology and zoology, polymorphism[1] is the occurrence of two or more clearly different morphs or forms, also referred to as alternative phenotypes, in the population of a species. To be classified as such, morphs must occupy the same habitat at the same time and belong to a panmictic population (one with random mating).[2]
>
> Put simply, polymorphism is when there are two or more possibilities of a trait on a gene. For example, there is more than one possible trait in terms of a jaguar's skin colouring; they can be light morph or dark morph . Due to having more than one possible variation for this gene, it is termed 'polymorphism'. However, if the jaguar has only one possible trait for that gene, it would be termed "monomorphic". For example, if there was only one possible skin colour that a jaguar could have, it would be termed monomorphic.

简单来说，生物学上的多态是指一个基因中可能存在两种或多种的性状，称为"多态"。比如美洲豹的皮肤颜色，它可能存在深色皮肤或浅色皮肤，因为该基因存在多个可能的变异(variation)，这种称为多态(polymorphism)。反过来，如果美洲豹的基因只有一种可能的性状(trait)，这种就称为单态(monomorphic)，这是和多态相对的概念。

理解了生物学中的多态，我们就很轻易理解Cat cat = new Tiger()为什么能称为多态。它只是OOP对现实世界的一种模拟。


Ref: [Polymorphism (biology)](https://en.wikipedia.org/wiki/Polymorphism_(biology))


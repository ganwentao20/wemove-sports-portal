'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

const heroSlides = [
  {
    title: '让学习\n变成一种游戏',
    summary: '通过自由拼接的轨道与隧道，在玩乐中探索结构、重力、速度与空间路径的乐趣。',
    image: '/products/hero-cover.png',
    imageAlt: 'WEMOVE 轨道积木封面',
    primaryHref: '/products',
    primaryLabel: '探索产品系列',
    secondaryHref: '#showcase',
    secondaryLabel: '体验动态选品',
  },
  {
    title: '把 STEM\n带进真实课堂',
    summary: '用木质积木、轨道实验和搭建任务，让孩子在动手中理解结构、路径和基础物理。',
    image: '/products/stem-hero.png',
    imageAlt: 'WEMOVE STEM 教育场景',
    primaryHref: '/stem-education',
    primaryLabel: '查看 STEM 教育',
    secondaryHref: '/play',
    secondaryLabel: '浏览内容列表',
  },
  {
    title: '从家庭场景\n到定制服务',
    summary: '保留家具定制、中试打样与项目服务入口，后续接入咨询、预约和资料接口。',
    image: '/products/furniture-bed.png',
    imageAlt: 'WEMOVE 家具定制场景',
    primaryHref: '/custom-furniture',
    primaryLabel: '查看家具定制',
    secondaryHref: '/pilot-production',
    secondaryLabel: '了解中试打样',
  },
];

export function HomeHeroCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = heroSlides[activeIndex];

  const changeSlide = (nextIndex: number) => {
    setActiveIndex((nextIndex + heroSlides.length) % heroSlides.length);
  };

  return (
    <section className="hero hero-carousel" aria-label="首页主视觉轮播">
      <div className="hero-copy">
        <h1>
          {activeSlide.title.split('\n').map((line) => (
            <span key={line}>{line}</span>
          ))}
        </h1>
        <p>{activeSlide.summary}</p>
        <div>
          <Link href={activeSlide.primaryHref}>{activeSlide.primaryLabel}</Link>
          <Link href={activeSlide.secondaryHref}>{activeSlide.secondaryLabel}</Link>
        </div>
        <div className="hero-controls" aria-label="切换首页轮播">
          <button type="button" onClick={() => changeSlide(activeIndex - 1)} aria-label="上一张">
            ←
          </button>
          <div>
            {heroSlides.map((slide, index) => (
              <button
                key={slide.title}
                type="button"
                className={activeIndex === index ? 'active' : ''}
                onClick={() => changeSlide(index)}
                aria-label={`切换到第 ${index + 1} 张：${slide.primaryLabel}`}
                aria-current={activeIndex === index ? 'true' : undefined}
              />
            ))}
          </div>
          <button type="button" onClick={() => changeSlide(activeIndex + 1)} aria-label="下一张">
            →
          </button>
        </div>
      </div>
      <Image src={activeSlide.image} alt={activeSlide.imageAlt} width={1140} height={760} priority />
    </section>
  );
}

'use client';

import Image from 'next/image';
import { useState } from 'react';

type GalleryItem = {
  src: string;
  label: string;
  alt: string;
};

export function ProductMediaGallery({ items }: { items: GalleryItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeItem = items[activeIndex] ?? items[0];

  return (
    <section className="pdp-gallery" aria-label="产品图片">
      <div className="pdp-main-media">
        <Image src={activeItem.src} alt={activeItem.alt} width={880} height={660} priority />
        <span>{activeItem.label}</span>
      </div>
      <div className="pdp-thumbs" role="list" aria-label="切换产品图片">
        {items.map((item, index) => (
          <button
            key={`${item.src}-${item.label}`}
            type="button"
            className={index === activeIndex ? 'active' : ''}
            onClick={() => setActiveIndex(index)}
            aria-label={`查看${item.label}`}
          >
            <Image src={item.src} alt="" width={160} height={110} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

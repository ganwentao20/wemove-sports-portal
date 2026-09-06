import Link from 'next/link';
import type { SiteSection } from '../lib/site-sections';

export function SectionLanding({ section }: { section: SiteSection }) {
  return (
    <main className="section-landing">
      <p className="eyebrow">{section.eyebrow}</p>
      <h1>{section.title}</h1>
      <p>{section.summary}</p>
      <div className="section-cards">
        {section.bullets.map((bullet) => (
          <article key={bullet}>
            <span>待接入</span>
            <h2>{bullet}</h2>
            <p>这里先保留页面结构和接口挂载点，后续拿到素材或后端接口后可以替换为真实内容。</p>
          </article>
        ))}
      </div>
      <Link className="primary-link" href="/products">{section.ctaLabel}</Link>
    </main>
  );
}

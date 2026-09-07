import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '内容列表' };

const articles = [
  {
    href: '/craft-dream',
    title: '匠心筑梦',
    label: '品牌故事',
    image: '/products/craft-classroom-group.png',
    summary: '用原网站活动素材展示课堂实践、品牌故事与项目精神，后续可接 CMS 内容接口。',
  },
  {
    href: '/craft-dream',
    title: '玩转 π 实践，乐享数学美',
    label: '活动纪实',
    image: '/products/craft-math-event.png',
    summary: '保留数学文化活动现场素材，用于内容列表展示与品牌背书。',
  },
  {
    href: '/craft-dream',
    title: '浙江学习平台报道',
    label: '媒体报道',
    image: '/products/craft-news-article.png',
    summary: '展示公开报道素材，后续由内容运营后台维护标题、封面、正文与来源。',
  },
];

export default function PlayPage() {
  return (
    <main className="content-page">
      <h1>内容列表</h1>
      <p>文章、玩法、家庭活动与品牌故事的前台展示入口。当前先放入匠心筑梦素材，后续接 CMS 接口。</p>
      <div className="learn-list">
        {articles.map((article) => (
          <article key={article.title}>
            <Image src={article.image} alt={article.title} width={900} height={620} />
            <div>
              <span>{article.label}</span>
              <h2>{article.title}</h2>
              <p>{article.summary}</p>
              <Link href={article.href}>查看详情</Link>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

import type { Metadata } from 'next';

export const metadata: Metadata = { title: '支持中心' };

export default function SupportPage() {
  return (
    <div className="content-page"><h1>支持中心</h1><p>常见问题、资料下载与联系入口。</p><div className="faq"><details><summary>如何选择适合的套装？</summary><p>可以从孩子年龄、搭建经验和使用场景开始筛选，也可在产品详情中比较。</p></details><details><summary>是否支持资料下载？</summary><p>说明书与证书将在 CMS 媒体接口接入后由下载中心统一提供。</p></details><details><summary>如何获得更多帮助？</summary><p>请通过联系我们页面提交咨询。</p></details></div>
    </div>
  );
}

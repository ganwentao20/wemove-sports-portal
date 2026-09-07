import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '下载中心' };

export default function DownloadsPage() {
  return (
    <main className="content-page">
      <h1>下载中心</h1>
      <p>电子说明书、搭建说明、工艺选材、搭建示例、在线搭建、游戏题卡、积木型号图等资料统一入口。</p>
      <div className="learn-list">
        <article>
          <Image src="/products/manual-guide-cover.png" alt="电子说明书目录" width={900} height={900} />
          <div>
            <span>电子说明书</span>
            <h2>标准款 50 轨道积木说明书</h2>
            <p>当前展示说明书素材与目录结构，真实 PDF、在线说明和下载权限等待后续资料接口接入。</p>
            <Link href="/contact">申请获取资料</Link>
          </div>
        </article>
      </div>
    </main>
  );
}

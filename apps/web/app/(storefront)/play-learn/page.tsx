import type { Metadata } from 'next';

export const metadata: Metadata = { title: '玩法灵感' };

export default function PlayLearnPage() {
  return (
    <div className="content-page"><h1>探索发现</h1><p>从搭建、观察到试错，让每一次游戏成为一次主动探索。</p><div className="learn-list"><article><img src="/products/cugolino.jpg" alt="轨道积木搭建" /><div><h2>搭建体验</h2><p>从低层开始，确认每处轨道连接平整，再逐层向上扩展。</p></div></article><article><img src="/products/turntable.png" alt="转盘套装" /><div><h2>STEM 观察任务</h2><p>只改变一个条件，比较坡度、高度和轨道长度对弹珠速度的影响。</p></div></article></div>
    </div>
  );
}

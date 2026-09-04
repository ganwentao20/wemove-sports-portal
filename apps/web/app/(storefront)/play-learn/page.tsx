import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Play & Learn' };

/** 玩法与活动内容（CMS 文章/视频列表，组员 A 渲染 + 组员 D 后台发布） */
export default function PlayLearnPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Play &amp; Learn</h1>
      <p className="mt-2 max-w-2xl text-neutral-600">
        Activity guides, skill-building tips and events around our active play products.
      </p>
      <div className="mt-8 rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400">
        Content list placeholder — driven by CMS posts (member D publishes, member A renders)
      </div>
    </div>
  );
}

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Compare Products' };

/**
 * 产品横向对比：最多 4 款（组员 A）。
 * 交互：?ids=slugA,slugB… 查询态 + 对比表（响应式：移动端横向溢出禁止 → 纵向堆叠卡片模式）
 */
export default function ComparePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Compare</h1>
      <p className="mt-2 text-neutral-600">Compare up to 4 products side by side.</p>
      <div className="mt-8 rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400">
        Pick products from PDP “Add to compare” — up to 4 (member A)
      </div>
    </div>
  );
}

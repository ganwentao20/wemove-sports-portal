import { StorefrontChrome } from './storefront-chrome';

/**
 * 全站 Header（骨架版，组员 A 负责响应式细化）：
 * - 移动端必须为抽屉/折叠导航，严禁横向溢出（硬指标）；
 * - 语言/货币切换占位、公告条占位。
 */
export function SiteHeader() {
  return <StorefrontChrome />;
}

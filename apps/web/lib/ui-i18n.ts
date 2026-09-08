import { adminMessages } from "./ui-admin";
import { accountMessages } from "./ui-account";
import { publicMessages } from "./ui-public";

export type UiValues = Record<string, string | number>;
const commonMessages: Record<string, string> = {
  "Forgot password": "找回密码",
  "Learn more": "了解更多",
  Remove: "移除",
  "Social profiles": "社交媒体账号",
  "Public footer links, in display order. Use the complete HTTPS profile URL.":
    "按展示顺序设置页脚公开链接，请填写完整的 HTTPS 主页地址。",
  "Profile label": "账号名称",
  "HTTPS URL": "HTTPS 地址",
  "Move social profile {number} up": "上移第 {number} 个社交账号",
  "Add social profile": "添加社交账号",
  "The resource is no longer available to this account.":
    "当前账户已无法访问此资料。",
  MANUAL: "说明书",
  CERTIFICATE: "证书",
  CATALOG: "产品目录",
  IMAGE: "图片",
  VIDEO: "视频",
  OTHER: "其他",
  SPECIFICATION: "规格说明",
  Language: "语言",
  English: "English",
  Chinese: "中文",
  "Skip to content": "跳转至主要内容",
  "Back to home": "返回首页",
  "Something went wrong": "页面加载出现问题",
  "Try again": "重试",
  "Page not found": "找不到页面",
  Home: "首页",
  Back: "返回",
  "This page could not be loaded": "无法加载此页面",
  "Please try again. If the problem continues, contact support and include the reference below.":
    "请重试。如果问题持续，请联系支持团队并提供下方参考编号。",
  Reference: "参考编号",
  "Contact support": "联系支持团队",
  "This page may have moved or is no longer published.":
    "此页面可能已移至其他位置或已停止发布。",
  "Browse products": "浏览商品",
  "Search the site": "站内搜索",
  "Loading…": "正在加载…",
  "Loading...": "正在加载…",
  Save: "保存",
  Cancel: "取消",
  Close: "关闭",
  Delete: "删除",
  Edit: "编辑",
  Create: "创建",
  Search: "搜索",
  Submit: "提交",
  Refresh: "刷新",
  Yes: "是",
  No: "否",
  None: "无",
  All: "全部",
  Enabled: "已启用",
  Disabled: "已停用",
  Active: "启用中",
  ACTIVE: "已启用",
  INACTIVE: "已停用",
  PENDING: "待处理",
  SUSPENDED: "已停用",
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
  APPROVED: "已批准",
  REJECTED: "已拒绝",
  CANCELLED: "已取消",
  CANCELED: "已取消",
  COMPLETED: "已完成",
  SUBMITTED: "已提交",
  PROCESSING: "处理中",
  SHIPPED: "已发货",
  CONFIRMED: "已确认",
  PAID: "已付款",
  UNPAID: "未付款",
  FAILED: "失败",
  SUCCESS: "成功",
  PENDING_PAYMENT: "待付款",
  OWNER: "企业管理员",
  BUYER: "采购员",
  VIEWER: "仅查看",
  SUPER_ADMIN: "超级管理员",
  CUSTOMER: "客户",
  DEALER: "经销商",
  "invalid email or password":
    "邮箱或密码不正确，请确认登录入口与账户类型一致。",
  "Failed to fetch": "无法连接服务，请稍后重试。",
  "NetworkError when attempting to fetch resource.":
    "无法连接服务，请稍后重试。",
  "Unable to complete this action. Please try again.":
    "暂时无法完成此操作，请稍后重试。",
};
const chineseMessages = Object.fromEntries(
  [commonMessages, publicMessages, adminMessages, accountMessages].flatMap(
    (messages) =>
      Object.entries(messages).map(([key, value]) => [
        key.trim(),
        value.trim(),
      ]),
  ),
);

export function translateUi(
  locale: string,
  text: string,
  values: UiValues = {},
): string {
  let translated = text;
  if (locale.toLowerCase().startsWith("zh")) {
    const key = text.trim();
    const match = Object.hasOwn(chineseMessages, key)
      ? chineseMessages[key]
      : undefined;
    if (match !== undefined) translated = text.replace(key, () => match);
  }
  return translated.replace(/\{(\w+)\}/g, (token, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : token,
  );
}

export function uiError(
  locale: string,
  error: unknown,
  fallback = "Unable to complete this action. Please try again.",
): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (!message) return translateUi(locale, fallback);
  const translated = translateUi(locale, message);
  return locale.startsWith("zh") &&
    translated === message &&
    /[a-z]{3}/i.test(message) &&
    !/[\u3400-\u9fff]/.test(message)
    ? translateUi(locale, fallback)
    : translated;
}

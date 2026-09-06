export type SiteSection = {
  href: string;
  label: string;
  eyebrow: string;
  title: string;
  summary: string;
  bullets: string[];
  ctaLabel: string;
};

export const siteSections: SiteSection[] = [
  {
    href: '/',
    label: '首页',
    eyebrow: 'WEMOVE SPORTS',
    title: '让学习变成一种游戏',
    summary: '用木质轨道、空间搭建与真实动手过程，把结构、物理和创造力带进家庭与课堂。',
    bullets: ['品牌首页', '主视觉与公告', '快速进入产品与账户流程'],
    ctaLabel: '回到首页',
  },
  {
    href: '/products',
    label: '玩具品类',
    eyebrow: 'Product Line',
    title: '玩具品类',
    summary: '当前已完成轨道积木类产品的列表、筛选、详情、收藏、比较、购物车与地址簿演示流程。',
    bullets: ['产品卡片与详情页', '收藏/比较/加入购物车', '后续接成员 C 库存、订单与价格接口'],
    ctaLabel: '浏览玩具品类',
  },
  {
    href: '/custom-furniture',
    label: '家具定制',
    eyebrow: 'Custom Furniture',
    title: '家具定制',
    summary: '按原网站栏目保留家具定制入口，后续可接入案例图库、需求表单、报价与预约沟通接口。',
    bullets: ['案例展示位', '定制需求表单', '报价/预约接口预留'],
    ctaLabel: '查看预留页面',
  },
  {
    href: '/pilot-production',
    label: '中试打样',
    eyebrow: 'Pilot Production',
    title: '中试打样',
    summary: '面向产品验证与小批量试制的服务栏目，页面结构已预留流程介绍与咨询入口。',
    bullets: ['打样流程', '材料与工艺说明', '咨询接口预留'],
    ctaLabel: '查看打样流程',
  },
  {
    href: '/stem-education',
    label: 'STEM教育',
    eyebrow: 'STEM Education',
    title: 'STEM教育',
    summary: '面向课程、教具与课堂活动的栏目，后续可接入课程包、教案下载和报名信息。',
    bullets: ['课程包展示', '课堂活动说明', '报名/资料接口预留'],
    ctaLabel: '查看课程方向',
  },
  {
    href: '/research',
    label: '科研研发',
    eyebrow: 'R&D',
    title: '科研研发',
    summary: '展示研发能力、合作方向与实验项目，保留后续接入案例、资料和合作咨询的位置。',
    bullets: ['研发能力展示', '合作案例', '资料下载接口预留'],
    ctaLabel: '查看研发方向',
  },
  {
    href: '/charity',
    label: '公益项目',
    eyebrow: 'Charity',
    title: '公益项目',
    summary: '保留公益项目栏目，用于展示活动、项目进展与报名参与方式。',
    bullets: ['公益活动列表', '项目进展', '报名接口预留'],
    ctaLabel: '查看公益项目',
  },
  {
    href: '/craft-dream',
    label: '匠心筑梦',
    eyebrow: 'Craft Story',
    title: '匠心筑梦',
    summary: '用于承接品牌故事、工艺细节和制造理念，让网站不只停留在商品陈列。',
    bullets: ['品牌故事', '工艺展示', '媒体素材预留'],
    ctaLabel: '了解品牌故事',
  },
  {
    href: '/manuals',
    label: '电子说明书',
    eyebrow: 'Manuals',
    title: '电子说明书',
    summary: '为产品说明书、安装视频、玩法指南和下载资料预留统一入口。',
    bullets: ['说明书列表', '玩法视频', '下载接口预留'],
    ctaLabel: '查看说明书',
  },
];

export const getSiteSection = (href: string) => siteSections.find((section) => section.href === href);

export type PilotSample = {
  slug: string;
  title: string;
  image: string;
  summary: string;
};

export const pilotSamples: PilotSample[] = [
  {
    slug: 'joint-sample',
    title: '结构连接样品',
    image: '/products/pilot-joint.png',
    summary: '用于验证积木结构、家具连接和承重节点，提前观察拼接稳定性与细节质感。',
  },
  {
    slug: 'surface-sample',
    title: '桌面与材质样品',
    image: '/products/pilot-surface.png',
    summary: '展示木材纹理、表面触感和日常使用场景，适合打样阶段确认视觉与手感。',
  },
  {
    slug: 'edge-sample',
    title: '边角工艺样品',
    image: '/products/pilot-edge.png',
    summary: '聚焦圆角、倒角、边缘处理和木材拼接，降低量产前的安全与工艺风险。',
  },
];

export const pilotReasons = [
  { title: '创意快速落地', description: '积木结构、家具造型，带图带样即可快速出样。' },
  { title: '效果提前验证', description: '先看样品再量产，尺寸、工艺、质感一目了然。' },
  { title: '降低量产风险', description: '小批量试错，避免大规模生产问题。' },
  { title: '专属定制支持', description: '结构优化、材质调整、细节打磨一站式完成。' },
];

export const pilotServices = [
  { title: '来样打样', description: '客户提供实物样品，精淮复刻与优化。' },
  { title: '来图打样', description: '提供设计图/效果图，按要求制作实物样品。' },
  { title: '结构测试打样', description: '积木拼装结构、家具承重稳定性专业测试。' },
  { title: '小批量中试', description: '样品确认后，支持小批量试产验证。' },
];

export const pilotAudiences = [
  '积木品牌/设计师：新品开发、结构验证',
  '家具设计师/工作室：新款打样、效果确认',
  '电商卖家：新品首样、实拍样品制作',
  '企业/机构：定制礼品、展示样品、项目试样',
];

export const pilotProcess = [
  '咨询沟通 → 提供图纸/样品/需求',
  '方案确认 → 材质、工艺、尺寸、工期',
  '开始打样 → 专业设备 + 精细制作',
  '样品验收 → 实拍/寄样确认',
  '量产对接 → 满意后启动大货生产',
];

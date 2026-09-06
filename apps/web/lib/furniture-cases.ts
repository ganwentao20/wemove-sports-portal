export type FurnitureCase = {
  slug: string;
  title: string;
  image: string;
  scene: string;
  material: string;
  summary: string;
  tags: string[];
};

export const furnitureCases: FurnitureCase[] = [
  {
    slug: 'solid-wood-bed',
    title: '实木卧室床架定制',
    image: '/products/furniture-bed.png',
    scene: '卧室空间',
    material: '天然实木',
    summary: '保留原网站家具定制素材，用于展示床架、木材、结构与家庭空间适配方向；具体尺寸、价格和工期由咨询接口返回。',
    tags: ['床架', '卧室', '实木'],
  },
  {
    slug: 'long-dining-table',
    title: '长桌 / 工作桌定制',
    image: '/products/furniture-table.png',
    scene: '餐厅与工作区',
    material: '实木板材',
    summary: '适合承接餐桌、工作桌和亲子活动桌需求，后续接入尺寸选择、需求提交与报价确认接口。',
    tags: ['桌类', '餐厅', '工作区'],
  },
  {
    slug: 'kids-play-bed',
    title: '儿童活动床组合',
    image: '/products/furniture-kids-bed.png',
    scene: '儿童房',
    material: '实木结构',
    summary: '结合床架、秋千与活动空间，展示儿童家具定制的结构安全与场景设计；制作周期以后端确认为准。',
    tags: ['儿童房', '活动床', '安全结构'],
  },
  {
    slug: 'bedside-storage',
    title: '床边收纳与边几',
    image: '/products/furniture-side-table.png',
    scene: '床边收纳',
    material: '实木框架',
    summary: '用于展示小型家具、床边收纳与空间补充件，后续可接入案例详情、咨询记录与人工确认结果。',
    tags: ['边几', '收纳', '小型家具'],
  },
];

export type Product = {
  slug: string;
  name: string;
  category: string;
  categoryLabel: string;
  age: string;
  scene: string;
  image: string;
  description: string;
  material: string;
  weight: string;
  size: string;
  price: string;
  status: string;
  pieces: string;
  tags: string[];
};

export type ProductCategory = {
  slug: string;
  label: string;
  description: string;
  status: 'ready' | 'pending-assets';
};

export const productCategories: ProductCategory[] = [
  {
    slug: 'toy-category',
    label: '玩具品类',
    description: '木质轨道积木、转盘、蛇形轨道等已完成可演示购物流程。',
    status: 'ready',
  },
  {
    slug: 'furniture-custom',
    label: '家具定制',
    description: '保留原网站栏目入口，后续接入定制案例、报价与预约接口。',
    status: 'pending-assets',
  },
  {
    slug: 'pilot-production',
    label: '中试打样',
    description: '保留原网站栏目入口，后续接入打样服务、流程说明与咨询接口。',
    status: 'pending-assets',
  },
  {
    slug: 'stem-education',
    label: 'STEM教育',
    description: '保留原网站栏目入口，后续接入课程包、教案与活动报名接口。',
    status: 'pending-assets',
  },
  {
    slug: 'research-development',
    label: '科研研发',
    description: '保留原网站栏目入口，后续接入研发能力、合作案例与资料下载。',
    status: 'pending-assets',
  },
  {
    slug: 'charity',
    label: '公益项目',
    description: '保留原网站栏目入口，后续接入公益活动、项目介绍与报名信息。',
    status: 'pending-assets',
  },
  {
    slug: 'craft-dream',
    label: '匠心筑梦',
    description: '保留原网站栏目入口，后续接入品牌故事、工艺展示与媒体素材。',
    status: 'pending-assets',
  },
  {
    slug: 'manuals',
    label: '电子说明书',
    description: '保留原网站栏目入口，后续接入产品说明书、视频教程与下载接口。',
    status: 'pending-assets',
  },
];

export const products: Product[] = [
  {
    slug: 'standard-50',
    name: '标准款 50 轨道积木',
    category: 'toy-category',
    categoryLabel: '玩具品类',
    age: '3 岁及以上',
    scene: '亲子共玩',
    image: '/products/standard-50.jpg',
    description: '用天然木材模块搭建可自由延展的弹珠轨道，适合第一次接触 WEMOVE 的家庭。',
    material: '天然榉木',
    weight: '约 3.2 kg',
    size: '32 x 24 x 12 cm',
    price: '￥399',
    status: '现货展示',
    pieces: '50 件',
    tags: ['3 岁及以上', '亲子共玩', '天然木材'],
  },
  {
    slug: 'cugolino',
    name: 'Cugolino 轨道积木',
    category: 'toy-category',
    categoryLabel: '玩具品类',
    age: '4 岁及以上',
    scene: '搭建探索',
    image: '/products/cugolino.jpg',
    description: '通过搭建、调整和试错观察弹珠运动，适合进阶结构探索和课堂活动。',
    material: '天然榉木',
    weight: '约 4.1 kg',
    size: '36 x 28 x 14 cm',
    price: '￥499',
    status: '新品展示',
    pieces: '72 件',
    tags: ['4 岁及以上', '搭建探索', '天然木材'],
  },
  {
    slug: 'turntable',
    name: '大小转盘轨道积木',
    category: 'toy-category',
    categoryLabel: '玩具品类',
    age: '4 岁及以上',
    scene: '空间思维',
    image: '/products/turntable.jpg',
    description: '用转盘、坡度和轨道组合创造不同路径，训练孩子对方向与节奏的判断。',
    material: '天然榉木',
    weight: '约 3.8 kg',
    size: '35 x 26 x 13 cm',
    price: '￥459',
    status: '现货展示',
    pieces: '64 件',
    tags: ['4 岁及以上', '空间思维', '天然木材'],
  },
  {
    slug: 'pendulum',
    name: '大摆锤轨道积木',
    category: 'toy-category',
    categoryLabel: '玩具品类',
    age: '5 岁及以上',
    scene: '动力实验',
    image: '/products/pendulum.png',
    description: '通过摆锤结构观察重力、惯性与路径衔接，让孩子在反复调试中理解机械运动。',
    material: '天然榉木',
    weight: '约 4.5 kg',
    size: '42 x 30 x 18 cm',
    price: '￥529',
    status: '现货展示',
    pieces: '78 件',
    tags: ['5 岁及以上', '动力实验', '天然木材'],
  },
  {
    slug: 'elevator',
    name: '电梯轨道积木',
    category: 'toy-category',
    categoryLabel: '玩具品类',
    age: '5 岁及以上',
    scene: '机械传动',
    image: '/products/elevator.png',
    description: '用升降结构把弹珠送回高处，串联轨道循环，适合展示齿轮、升降与传动概念。',
    material: '天然榉木 / 安全涂装件',
    weight: '约 3.6 kg',
    size: '38 x 24 x 16 cm',
    price: '￥489',
    status: '现货展示',
    pieces: '58 件',
    tags: ['5 岁及以上', '机械传动', 'STEM 教具'],
  },
  {
    slug: 'gauss-cannon',
    name: '电磁炮轨道积木',
    category: 'toy-category',
    categoryLabel: '玩具品类',
    age: '6 岁及以上',
    scene: '科学实验',
    image: '/products/gauss-cannon.png',
    description: '结合磁力与轨道碰撞实验，演示能量传递与速度变化，适合作为高阶科学探索模块。',
    material: '天然榉木 / 磁性钢珠',
    weight: '约 2.4 kg',
    size: '26 x 16 x 10 cm',
    price: '￥359',
    status: '演示展示',
    pieces: '24 件',
    tags: ['6 岁及以上', '科学实验', 'STEM 教具'],
  },
  {
    slug: 'snake',
    name: '蛇形套装',
    category: 'toy-category',
    categoryLabel: '玩具品类',
    age: '3 岁及以上',
    scene: '亲子共玩',
    image: '/products/snake.png',
    description: '蛇形轨道带来连续转弯和速度变化，适合家庭合作搭建和自由创作。',
    material: '天然榉木',
    weight: '约 2.9 kg',
    size: '30 x 22 x 11 cm',
    price: '￥329',
    status: '现货展示',
    pieces: '42 件',
    tags: ['3 岁及以上', '亲子共玩', '天然木材'],
  },
];

export const productBySlug = (slug: string) => products.find((product) => product.slug === slug);

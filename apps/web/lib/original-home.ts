export type OriginalHomeFeature = {
  id: string;
  title: string;
  text: string;
  image: string;
  alt: string;
  href?: string;
  label?: string;
  tone: "white" | "green";
  imageSide: "left" | "right";
};

export const ORIGINAL_HOME_FEATURES: OriginalHomeFeature[] = [
  {
    id: "wemove-set",
    title: "WEMOVE套装",
    text: "探索完整的 WEMOVE 系列，领略其丰富的形态与多彩的世界。",
    image: "/original-site/home-stem.png",
    alt: "WEMOVE STANDARD 50 实木滚珠轨道积木套装",
    href: "/workshop",
    label: "即刻探索",
    tone: "white",
    imageSide: "left",
  },
  {
    id: "stem",
    title: "STEM教育",
    text: "把知识藏进滚珠轨道的游戏里。孩子在动手搭建、调整路径的过程中，自然理解物理规律与工程思维，在一次次试错里收获解决问题的能力与创造的自信。",
    image: "/original-site/home-furniture.jpg",
    alt: "WEMOVE 木制滚珠轨道与彩色滚珠",
    href: "/stem",
    label: "即刻探索",
    tone: "green",
    imageSide: "right",
  },
  {
    id: "furniture",
    title: "原木家具",
    text: "以天然木色为底色，把模块化创意揉进日常场景。每一件家具都能自由拼接、灵活适配，在实用与美学的平衡里，为生活空间注入灵动和温度。",
    image: "/original-site/home-prototyping.png",
    alt: "WEMOVE 原木家具",
    href: "/furniture",
    label: "即刻探索",
    tone: "white",
    imageSide: "left",
  },
  {
    id: "prototyping",
    title: "WEMOVE中试",
    text: "WEMOVE中试平台，是你创意落地的专业打板伙伴。你只需提供样式与构想，我们便为你完成从原型到成品的工艺打磨、样品打板与稳定性验证，让设计平稳过渡到规模化生产。",
    image: "/original-site/home-research.png",
    alt: "WEMOVE 原木中试打样场景",
    href: "/woodlab",
    label: "即刻探索",
    tone: "green",
    imageSide: "right",
  },
  {
    id: "research",
    title: "WEMOVE科研",
    text: "作为步入学术课堂的理想起点，科研论文能让你轻松开启知识沉淀与传播乐趣。你可以用严谨逻辑、创新观点和实证分析，在学术交流中传递研究价值与思想力量。",
    image: "/original-site/home-learning.png",
    alt: "WEMOVE 木制机械研究装置",
    href: "/library",
    label: "即刻探索",
    tone: "white",
    imageSide: "left",
  },
  {
    id: "learning",
    title: "WEMOVE 让学习变成一种游戏",
    text: "一块块原木积木既是轨道，也是孩子理解重力、速度与结构的入口。自由组合、反复验证，让好奇心在真实的滚动中不断发生。",
    image: "/original-site/home-wemove-set.png",
    alt: "WEMOVE 原木积木搭建场景",
    tone: "green",
    imageSide: "right",
  },
  {
    id: "digital",
    title: "获得灵感，加入WEMOVE数字模拟",
    text: "在数字世界里复刻真实轨道的每一次滚动，让复杂规律在可视化推演中一目了然。",
    image: "/original-site/home-digital.jpg",
    alt: "WEMOVE 数字模拟灵感场景",
    href: "https://waymove.net/",
    label: "即刻探索",
    tone: "white",
    imageSide: "left",
  },
];

export const ORIGINAL_HOME_FEATURES_EN: OriginalHomeFeature[] = [
  {
    id: "wemove-set",
    title: "WEMOVE Sets",
    text: "Explore the complete WEMOVE range and discover a world of wooden forms, motion and colour.",
    image: "/original-site/home-stem.png",
    alt: "WEMOVE STANDARD 50 wooden marble run set",
    href: "/workshop",
    label: "Explore now",
    tone: "white",
    imageSide: "left",
  },
  {
    id: "stem",
    title: "STEM Learning",
    text: "Children build and adjust marble paths to explore gravity, speed and structure through hands-on play.",
    image: "/original-site/home-furniture.jpg",
    alt: "WEMOVE wooden marble run with coloured marbles",
    href: "/stem",
    label: "Explore now",
    tone: "green",
    imageSide: "right",
  },
  {
    id: "furniture",
    title: "Wooden Furniture",
    text: "Natural materials and modular ideas come together in adaptable furniture made for everyday spaces.",
    image: "/original-site/home-prototyping.png",
    alt: "WEMOVE wooden furniture",
    href: "/furniture",
    label: "Explore now",
    tone: "white",
    imageSide: "left",
  },
  {
    id: "prototyping",
    title: "WEMOVE Prototyping",
    text: "We help turn an idea into a stable sample through process review, model making and product validation.",
    image: "/original-site/home-research.png",
    alt: "WEMOVE wooden product prototyping",
    href: "/woodlab",
    label: "Explore now",
    tone: "green",
    imageSide: "right",
  },
  {
    id: "research",
    title: "WEMOVE Research",
    text: "Research content connects wooden mechanisms, playful learning and practical experimentation.",
    image: "/original-site/home-learning.png",
    alt: "WEMOVE wooden mechanical research model",
    href: "/library",
    label: "Explore now",
    tone: "white",
    imageSide: "left",
  },
  {
    id: "learning",
    title: "WEMOVE Makes Learning Playful",
    text: "Every wooden block can become part of a track and a practical way to understand motion, speed and structure.",
    image: "/original-site/home-wemove-set.png",
    alt: "Building with WEMOVE wooden blocks",
    tone: "green",
    imageSide: "right",
  },
  {
    id: "digital",
    title: "Find Inspiration in WEMOVE Digital Simulation",
    text: "Recreate a real track in a digital space and make each movement easier to observe and test.",
    image: "/original-site/home-digital.jpg",
    alt: "WEMOVE digital simulation concept",
    href: "https://waymove.net/",
    label: "Explore now",
    tone: "white",
    imageSide: "left",
  },
];

const stringValue = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export function homeFeaturesFromCms(
  sections: unknown,
  locale = "zh",
): OriginalHomeFeature[] {
  const defaultFeatures = locale.startsWith("zh")
    ? ORIGINAL_HOME_FEATURES
    : ORIGINAL_HOME_FEATURES_EN;
  if (!Array.isArray(sections)) return defaultFeatures;
  const defaults = new Map(
    defaultFeatures.map((feature) => [feature.id, feature]),
  );
  const features: OriginalHomeFeature[] = [];
  const seen = new Set<string>();
  for (const item of sections) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.type !== "original-feature") continue;
    const props = (row.props && typeof row.props === "object"
      ? row.props
      : row) as Record<string, unknown>;
    const id = stringValue(props.id);
    const fallback = id ? defaults.get(id) : undefined;
    if (!id || !fallback || seen.has(id)) continue;
    const override: Partial<OriginalHomeFeature> = {
      title: stringValue(props.title),
      text: stringValue(props.text),
      image: stringValue(props.image),
      alt: stringValue(props.alt),
      href: stringValue(props.href),
      label: stringValue(props.label),
      tone:
        props.tone === "green" || props.tone === "white"
          ? props.tone
          : undefined,
      imageSide:
        props.imageSide === "right" || props.imageSide === "left"
          ? props.imageSide
          : undefined,
    };
    features.push({
      ...fallback,
      ...Object.fromEntries(
        Object.entries(override).filter(([, value]) => value !== undefined),
      ),
    });
    seen.add(id);
  }
  return features;
}

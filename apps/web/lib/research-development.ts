import { apiGet } from './api';

export type ResearchHighlight = {
  title: string;
  description: string;
};

export type ResearchResource = {
  title: string;
  description: string;
  status: string;
};

export type ResearchPageData = {
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    image: string;
  };
  intro: string;
  highlights: ResearchHighlight[];
  resources: ResearchResource[];
  process: string[];
};

export const researchFallback: ResearchPageData = {
  hero: {
    eyebrow: 'Research',
    title: '科研成果',
    subtitle: '学术交流中传递研究价值与思想力量',
    image: '/products/research-hero.png',
  },
  intro:
    '围绕具身智能、木制轨道系统与空间思维训练，WEMOVE 持续沉淀科研成果与知识产权，已形成若干篇高水平论文、申请多项专利，并建设自有积木数据集、独立开发虚拟仿真搭建训练平台，逐步构建面向模型训练、算法评测与开放 Benchmark 的科研基础设施。',
  highlights: [
    { title: '具身智能研究', description: '以真实积木搭建、滚珠路径和任务反馈为基础，探索可观察、可评测的具身智能训练场景。' },
    { title: '轨道系统与空间思维', description: '通过木制轨道组合训练空间推理、结构判断与问题解决能力，形成可复用的实验任务。' },
    { title: '数据集与仿真平台', description: '沉淀积木搭建数据，预留虚拟仿真训练平台与算法评测接口，方便后续科研资料接入。' },
  ],
  resources: [
    { title: '高水平论文', description: '展示论文摘要、发表状态与关联实验成果。', status: '资料接口预留' },
    { title: '专利与知识产权', description: '承接专利申请信息、授权状态与成果说明。', status: '资料接口预留' },
    { title: '开放 Benchmark', description: '后续可接入数据集说明、评测任务和下载入口。', status: '下载接口预留' },
  ],
  process: ['查看科研方向', '提交合作咨询', '接口返回资料清单', '确认交流或下载权限'],
};

export async function getResearchPageData() {
  try {
    return await apiGet<ResearchPageData>('/cms/pages/research', { cache: 'force-cache', next: { revalidate: 60 } });
  } catch {
    return researchFallback;
  }
}

import { apiGet } from './api';

export type CharityActivity = {
  slug: string;
  title: string;
  image: string;
  summary: string;
};

export type CharityPageData = {
  hero: {
    eyebrow: string;
    title: string;
    summary: string;
    image: string;
  };
  activities: CharityActivity[];
  goals: { title: string; description: string }[];
  progress: { title: string; description: string }[];
  process: string[];
};

export const charityFallback: CharityPageData = {
  hero: {
    eyebrow: 'Charity',
    title: '公益项目',
    summary: '把木质轨道积木、空间搭建和科学启蒙课程带进校园与公益课堂，让更多孩子在动手体验中接触工程思维与创造力训练。',
    image: '/products/charity-workshop.png',
  },
  activities: [
    { slug: 'hands-on', title: '动手搭建课堂', image: '/products/charity-hands-on.png', summary: '孩子在真实积木拼搭中理解路径、结构和协作，形成可观察的学习过程。' },
    { slug: 'workshop', title: '公益体验活动', image: '/products/charity-workshop.png', summary: '教师带领学生完成轨道搭建任务，适合校园公开课、社群活动和公益体验日。' },
    { slug: 'classroom', title: '校园课程支持', image: '/products/charity-classroom.png', summary: '为班级课程提供教具、活动说明和课堂组织支持，后续可接入报名与项目进展。' },
    { slug: 'campus', title: '研学与团队挑战', image: '/products/charity-campus.png', summary: '面向中高年级学生开展结构挑战和团队协作任务，增强空间思维与问题解决能力。' },
    { slug: 'remote-class', title: '远程公益课堂', image: '/products/charity-remote-class.png', summary: '结合线上讲解与线下材料包，让偏远地区或合作学校也能参与课程。' },
    { slug: 'lab', title: '科学实验展示', image: '/products/charity-lab.png', summary: '以物理现象、结构测试和作品展示为核心，帮助学生把抽象知识变成可操作经验。' },
  ],
  goals: [
    { title: '降低体验门槛', description: '通过公益课程和材料支持，让更多学校、社区和家庭接触高质量动手学习资源。' },
    { title: '支持科学启蒙', description: '围绕重力、路径、结构和协作任务，帮助孩子建立基础工程与空间思维。' },
    { title: '沉淀活动资料', description: '预留活动记录、项目进展和报名接口，方便后续汇总公益成果。' },
  ],
  progress: [
    { title: '活动展示', description: '展示课堂、校园、研学和远程课程等公益项目现场素材。' },
    { title: '项目进展', description: '后续接入 CMS 后可更新参与学校、课程批次和活动反馈。' },
    { title: '报名参与', description: '预留学校/机构报名入口，提交后进入真实公益项目沟通流程。' },
  ],
  process: ['查看公益项目', '提交学校或机构信息', '确认课程资源与时间', '开展活动并记录反馈'],
};

export async function getCharityPageData() {
  try {
    return await apiGet<CharityPageData>('/cms/pages/charity', { cache: 'force-cache', next: { revalidate: 60 } });
  } catch {
    return charityFallback;
  }
}

import Image from 'next/image';
import { StemInquiryForm } from '../../../components/stem-inquiry-form';
import { stemModules, stemProcess, stemScenes } from '../../../lib/stem-education';

export default function StemEducationPage() {
  return <main className="stem-page">
    <section className="stem-hero"><div><p className="eyebrow">STEM EDUCATION</p><h1>把知识藏进<br />滚珠轨道的游戏里</h1><p>从真实搭建出发，在滚动、碰撞与一次次试错中，理解物理规律、工程结构与解决问题的方法。</p><a className="stem-hero-link" href="#modules">探索课程模块 ↓</a></div><Image src="/products/stem-hero.png" alt="WEMOVE STEM轨道搭建" width={1920} height={1280} priority /></section>
    <section id="modules" className="stem-modules"><div className="stem-section-heading"><p className="eyebrow">LEARN BY BUILDING</p><h2>从搭建到理解</h2><p>WEMOVE 将实体积木、开放式任务和可观察的物理现象结合，让学习从手上开始。</p></div><div className="stem-module-grid">{stemModules.map((module, index) => <article key={module.title}><Image src={module.image} alt={module.title} width={900} height={600} /><div><span>0{index + 1}</span><h3>{module.title}</h3><p>{module.summary}</p><strong>{module.points}</strong></div></article>)}</div></section>
    <section className="stem-flow"><div><p className="eyebrow">A COMPLETE LEARNING LOOP</p><h2>让每一次试错<br />都成为下一次发现</h2><p>孩子不是照着答案完成，而是在问题、实验和反馈之间建立自己的判断。</p></div><ol>{stemProcess.map((item, index) => <li key={item}><span>0{index + 1}</span><strong>{item}</strong></li>)}</ol></section>
    <section className="stem-scenes"><div><h2>适合不同学习场景</h2><p>可根据年龄、人数和空间，组合成家庭玩法、课程单元或主题活动。</p></div><div className="stem-scene-list">{stemScenes.map((scene) => <span key={scene}>{scene}</span>)}</div></section>
    <section className="stem-inquiry"><div><p className="eyebrow">COURSE INQUIRY</p><h2>一起设计一堂<br />真正动手的课</h2><p>先提交你的场景和想法，课程顾问会根据实际需求提供主题建议、材料组合和活动方案。</p></div><StemInquiryForm /></section>
  </main>;
}

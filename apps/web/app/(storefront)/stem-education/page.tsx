import Image from 'next/image';
import { StemInquiryForm } from '../../../components/stem-inquiry-form';
import { stemModules, stemProcess, stemScenes } from '../../../lib/stem-education';

export default function StemEducationPage() {
  return (
    <main className="stem-page">
      <section className="stem-hero">
        <div>
          <p className="eyebrow">STEM Education</p>
          <h1>STEM教育</h1>
          <p>以滚珠轨道和木质积木为载体，把物理规律、工程结构和空间思维放进可搭建、可观察、可调试的学习任务里。</p>
        </div>
        <Image src="/products/stem-hero.png" alt="WEMOVE STEM轨道搭建" width={1920} height={1280} priority />
      </section>

      <section className="stem-card-grid" aria-label="STEM教育素材">
        {stemModules.map((module) => (
          <article key={module.title}>
            <Image src={module.image} alt={module.title} width={720} height={520} />
            <div>
              <span>{module.points}</span>
              <h2>{module.title}</h2>
              <p>{module.summary}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="stem-info">
        <div>
          <h2>学习目标</h2>
          {stemModules.map((module, index) => (
            <article key={module.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{module.title}</h3>
              <p>{module.summary}</p>
            </article>
          ))}
        </div>
        <div>
          <h2>适合场景</h2>
          <ul>
            {stemScenes.map((scene) => (
              <li key={scene}>{scene}</li>
            ))}
          </ul>
          <h2>课程流程</h2>
          {stemProcess.map((item) => (
            <article key={item}>
              <h3>{item}</h3>
              <p>围绕真实搭建任务进行观察、记录和调整，让学习结果能被看见。</p>
            </article>
          ))}
        </div>
      </section>

      <section className="stem-process">
        <h2>接口接入预留流程</h2>
        <ol>
          <li>选择学习场景 → 填写年龄、人数和课程需求</li>
          <li>提交课程咨询 → 后续接口返回主题建议与材料组合</li>
          <li>确认课程方案 → 再进入预约、排期或购买流程</li>
        </ol>
        <p>价格、课时、排期等购买决策信息以后续接口或人工确认为准，静态页面不直接写死。</p>
      </section>

      <section className="stem-inquiry">
        <div>
          <p className="eyebrow">Course Inquiry</p>
          <h2>预约STEM课程咨询</h2>
          <p>这里先完成前端咨询环节：用户能填写场景和需求。后续接口接入后，提交结果会进入真实预约/课程购买流程。</p>
        </div>
        <StemInquiryForm />
      </section>
    </main>
  );
}

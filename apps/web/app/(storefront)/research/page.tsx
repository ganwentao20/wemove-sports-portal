import Image from 'next/image';
import { ResearchInquiryForm } from '../../../components/research-inquiry-form';
import { getResearchPageData } from '../../../lib/research-development';

export const revalidate = 60;

export default async function ResearchPage() {
  const research = await getResearchPageData();

  return (
    <main className="research-page">
      <section className="research-hero">
        <div>
          <p className="eyebrow">{research.hero.eyebrow}</p>
          <h1>{research.hero.title}</h1>
          <p>{research.hero.subtitle}。{research.intro}</p>
        </div>
        <Image src={research.hero.image} alt="WEMOVE 科研成果展示" width={1600} height={1200} priority />
      </section>

      <section className="research-info">
        <div>
          <h2>研究方向</h2>
          {research.highlights.map((item, index) => (
            <article key={item.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
        <div>
          <h2>成果资料</h2>
          {research.resources.map((item) => (
            <article key={item.title}>
              <span>{item.status}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="research-process">
        <h2>接口接入预留流程</h2>
        <ol>
          {research.process.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <p>科研成果页面已预留 CMS 内容接口、资料下载接口与合作咨询接口，后续汇总时可直接替换为真实数据源。</p>
      </section>

      <section className="research-inquiry">
        <div>
          <p className="eyebrow">Collaboration</p>
          <h2>科研合作咨询</h2>
          <p>用于收集机构、团队或教师对论文成果、专利、数据集和仿真平台的合作需求。</p>
        </div>
        <ResearchInquiryForm />
      </section>
    </main>
  );
}

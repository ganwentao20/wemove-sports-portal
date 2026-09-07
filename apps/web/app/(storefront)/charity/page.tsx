import Image from 'next/image';
import { CharityParticipationForm } from '../../../components/charity-participation-form';
import { getCharityPageData } from '../../../lib/charity-projects';

export const revalidate = 60;

export default async function CharityPage() {
  const charity = await getCharityPageData();

  return (
    <main className="charity-page">
      <section className="charity-hero">
        <div>
          <p className="eyebrow">{charity.hero.eyebrow}</p>
          <h1>{charity.hero.title}</h1>
          <p>{charity.hero.summary}</p>
        </div>
        <Image src={charity.hero.image} alt="WEMOVE 公益项目课堂" width={1600} height={1200} priority />
      </section>

      <section className="charity-card-grid" aria-label="公益项目素材">
        {charity.activities.map((activity) => (
          <article key={activity.slug}>
            <Image src={activity.image} alt={activity.title} width={720} height={520} />
            <div>
              <h2>{activity.title}</h2>
              <p>{activity.summary}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="charity-info">
        <div>
          <h2>项目目标</h2>
          {charity.goals.map((item, index) => (
            <article key={item.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
        <div>
          <h2>项目进展</h2>
          {charity.progress.map((item) => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="charity-process">
        <h2>接口接入预留流程</h2>
        <ol>
          {charity.process.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <p>公益项目页面已预留 CMS 内容接口、项目进展接口与报名参与接口，后续汇总时可直接替换为真实数据源。</p>
      </section>

      <section className="charity-participation">
        <div>
          <p className="eyebrow">Participation</p>
          <h2>公益项目参与</h2>
          <p>用于收集学校、机构、企业或志愿者的公益课程合作需求，后续接口接入后进入真实报名与项目跟进流程。</p>
        </div>
        <CharityParticipationForm />
      </section>
    </main>
  );
}

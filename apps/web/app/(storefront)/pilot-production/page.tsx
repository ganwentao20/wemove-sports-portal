import Image from 'next/image';
import { PilotReservationForm } from '../../../components/pilot-reservation-form';
import { pilotAudiences, pilotProcess, pilotReasons, pilotSamples, pilotServices } from '../../../lib/pilot-production';

export default function PilotProductionPage() {
  return (
    <main className="pilot-page">
      <section className="pilot-hero">
        <div>
          <p className="eyebrow">Pilot Production</p>
          <h1>中试打样</h1>
          <p>用样品先验证结构、尺寸、工艺与质感，再进入小批量或正式生产，减少盲目量产风险。</p>
        </div>
        <Image src="/products/pilot-hero.png" alt="中试打样木质样品展示" width={1800} height={620} priority={false} />
      </section>

      <section className="pilot-card-grid" aria-label="中试打样素材">
        {pilotSamples.map((sample) => (
          <article key={sample.slug}>
            <Image src={sample.image} alt={sample.title} width={720} height={520} />
            <div>
              <h2>{sample.title}</h2>
              <p>{sample.summary}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="pilot-info">
        <div>
          <h2>为什么选择我们中试打样？</h2>
          {pilotReasons.map((item, index) => (
            <article key={item.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
        <div>
          <h2>我们提供的中试打样服务</h2>
          {pilotServices.map((item) => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
          <h2>适合人群</h2>
          <ul>
            {pilotAudiences.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="pilot-process">
        <h2>打样流程</h2>
        <ol>
          {pilotProcess.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <p>流程展示来自原网站说明素材；价格、工期和可排产时间以后续接口或人工确认为准。</p>
      </section>

      <section className="pilot-reserve">
        <div>
          <p className="eyebrow">Reservation</p>
          <h2>预定中试打样服务</h2>
          <p>这里先完成前端预定购买环节：用户能选择服务、填写需求并提交。后续接口接入后，提交结果会进入真实预约/订单流程。</p>
        </div>
        <PilotReservationForm />
      </section>
    </main>
  );
}

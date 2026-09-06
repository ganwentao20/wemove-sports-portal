import Image from 'next/image';
import Link from 'next/link';
import { furnitureCases } from '../../../lib/furniture-cases';

export default function CustomFurniturePage() {
  return (
    <main className="furniture-page">
      <section className="furniture-hero">
        <div>
          <p className="eyebrow">Custom Furniture</p>
          <h1>家具定制</h1>
          <p>
            这里已接入原网站家具定制素材。当前先展示案例、材质和场景说明，
            后续成员接口完成后可替换为真实案例列表、需求提交、预约咨询和报价确认。
          </p>
          <Link className="primary-link" href="/contact">预约定制咨询</Link>
        </div>
        <Image src={furnitureCases[0].image} alt={furnitureCases[0].title} width={900} height={900} priority={false} />
      </section>

      <section className="furniture-cases" aria-label="家具定制案例">
        {furnitureCases.map((item) => (
          <article key={item.slug}>
            <Image src={item.image} alt={item.title} width={640} height={520} />
            <div>
              <span>{item.scene}</span>
              <h2>{item.title}</h2>
              <p>{item.summary}</p>
              <dl>
                <div><dt>材质</dt><dd>{item.material}</dd></div>
                <div><dt>标签</dt><dd>{item.tags.join(' / ')}</dd></div>
              </dl>
            </div>
          </article>
        ))}
      </section>

      <section className="furniture-flow">
        <h2>接口接入预留流程</h2>
        <div>
          <article><span>01</span><strong>提交需求</strong><p>收集空间、用途、尺寸意向和联系方式，后续对接定制咨询接口。</p></article>
          <article><span>02</span><strong>等待确认</strong><p>价格、制作工期、材料方案等购买决策信息，由接口或人工咨询结果返回。</p></article>
          <article><span>03</span><strong>预约沟通</strong><p>保存沟通记录并进入订单或项目跟进流程，不在静态页面编写具体报价。</p></article>
        </div>
      </section>
    </main>
  );
}

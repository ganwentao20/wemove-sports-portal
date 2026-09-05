import type { Metadata } from 'next';
import { ContactForm } from '../../../components/contact-form';

export const metadata: Metadata = { title: '联系我们' };

export default function ContactPage() {
  return (
    <div className="content-page narrow">
      <h1>联系我们</h1>
      <p>产品咨询、售后支持和合作申请可以先通过前端表单收集。接口接入后会改为提交到后端服务。</p>
      <ContactForm />
    </div>
  );
}

'use client';

import { useState } from 'react';
import { submitResearchInquiry } from '../lib/storefront-api';

const TOPICS = ['科研合作', '论文/专利交流', '数据集与 Benchmark', '仿真平台咨询'];

export function ResearchInquiryForm() {
  const [message, setMessage] = useState('');

  return (
    <form
      className="research-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        await submitResearchInquiry({
          organization: String(form.get('organization') ?? ''),
          contact: String(form.get('contact') ?? ''),
          topic: String(form.get('topic') ?? ''),
          message: String(form.get('message') ?? ''),
        });
        setMessage('已记录科研合作咨询。后续接口接入后会进入真实资料申请或合作沟通流程。');
      }}
    >
      <label>
        合作方向
        <select name="topic">
          {TOPICS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label>
        单位/团队
        <input name="organization" placeholder="请输入学校、机构或团队名称" required />
      </label>
      <label>
        联系方式
        <input name="contact" placeholder="手机号或邮箱" required />
      </label>
      <label>
        需求说明
        <textarea name="message" placeholder="例如：希望了解论文成果、数据集、仿真平台或联合研究方向" required />
      </label>
      <button type="submit">提交合作咨询</button>
      {message ? <p className="form-success">{message}</p> : null}
      <small>论文、专利、数据集与下载权限以后续资料接口或人工确认为准。</small>
    </form>
  );
}

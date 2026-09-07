'use client';

import { useState } from 'react';
import { submitCharityParticipation } from '../lib/storefront-api';

const ROLES = ['学校/机构报名', '公益课堂合作', '企业资源支持', '志愿者参与'];

export function CharityParticipationForm() {
  const [message, setMessage] = useState('');

  return (
    <form
      className="charity-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        await submitCharityParticipation({
          organization: String(form.get('organization') ?? ''),
          role: String(form.get('role') ?? ''),
          contact: String(form.get('contact') ?? ''),
          need: String(form.get('need') ?? ''),
        });
        setMessage('已记录公益参与需求。后续接口接入后会进入真实项目报名或合作沟通流程。');
      }}
    >
      <label>
        参与方式
        <select name="role">
          {ROLES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label>
        学校/机构/团队
        <input name="organization" placeholder="请输入学校、机构或团队名称" required />
      </label>
      <label>
        联系方式
        <input name="contact" placeholder="手机号或邮箱" required />
      </label>
      <label>
        项目需求
        <textarea name="need" placeholder="例如：希望申请公益课堂、捐赠教具、开展校园活动等" required />
      </label>
      <button type="submit">提交参与需求</button>
      {message ? <p className="form-success">{message}</p> : null}
      <small>公益名额、课程安排和物料支持以后续接口或人工确认为准。</small>
    </form>
  );
}

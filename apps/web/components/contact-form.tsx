'use client';

import { useState } from 'react';

export function ContactForm() {
  const [sent, setSent] = useState(false);

  return (
    <form
      className="customer-form"
      onSubmit={(event) => {
        event.preventDefault();
        setSent(true);
      }}
    >
      <label>
        姓名
        <input required name="name" placeholder="请输入姓名" />
      </label>
      <label>
        邮箱
        <input required type="email" name="email" placeholder="name@example.com" />
      </label>
      <label>
        咨询内容
        <textarea required name="message" placeholder="请填写产品、订单或合作咨询" />
      </label>
      <button type="submit">提交咨询</button>
      {sent ? <p className="form-success">已保存为前端演示提交，后续可接入成员 B/C 的客服接口。</p> : null}
    </form>
  );
}

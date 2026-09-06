'use client';
import { useState } from 'react';
export function StemInquiryForm() {
  const [message, setMessage] = useState('');
  return <form className="stem-form" onSubmit={(event) => { event.preventDefault(); setMessage('已记录课程咨询，后续接口接入后会进入正式课程预约流程。'); }}>
    <label>使用场景<select name="scene"><option>家庭亲子探索</option><option>学校 / 社团课程</option><option>研学或品牌活动</option></select></label>
    <label>年龄段<input name="age" placeholder="例如：5-8岁" required /></label><label>联系人<input name="name" placeholder="请输入姓名" required /></label><label>联系方式<input name="contact" placeholder="手机号或邮箱" required /></label>
    <label>课程需求<textarea name="description" placeholder="例如：班级人数、期望主题、活动时间等" required /></label><button type="submit">提交课程咨询</button>{message ? <p className="form-success">{message}</p> : null}<small>课程价格、课时与排期以后续课程接口或人工确认结果为准。</small>
  </form>;
}

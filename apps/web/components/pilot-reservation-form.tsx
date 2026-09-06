'use client';

import { useState } from 'react';

const SAMPLE_TYPES = ['来样打样', '来图打样', '结构测试打样', '小批量中试'];

export function PilotReservationForm() {
  const [message, setMessage] = useState('');

  return (
    <form
      className="pilot-form"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage('已记录预定需求。正式上线后这里会提交到中试打样预约接口，由成员接口返回确认结果。');
      }}
    >
      <label>
        打样类型
        <select name="type">
          {SAMPLE_TYPES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label>
        联系人
        <input name="name" placeholder="请输入姓名" required />
      </label>
      <label>
        联系方式
        <input name="contact" placeholder="手机号或邮箱" required />
      </label>
      <label>
        需求说明
        <textarea name="description" placeholder="例如：已有图纸、需要验证结构、预计小批量数量等" required />
      </label>
      <button type="submit">提交预定需求</button>
      {message ? <p className="form-success">{message}</p> : null}
      <small>价格、制作工期、材料方案和排期不在静态页展示，等待后续接口或人工确认。</small>
    </form>
  );
}

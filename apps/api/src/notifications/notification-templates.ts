export type TemplateBody = { subject: string; text: string; html?: string };
export type NotificationTemplate = {
  kind: string;
  locales: Record<string, TemplateBody>;
};
export type TemplateVariables = Record<string, string | number | boolean>;

export class NotificationTemplateError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const placeholders = /{{\s*([a-zA-Z][a-zA-Z0-9_]{0,63})\s*}}/g;
export function templateVariables(body: TemplateBody) {
  const keys = new Set<string>();
  for (const value of [body.subject, body.text, body.html ?? '']) {
    for (const match of value.matchAll(placeholders)) keys.add(match[1]);
    if (
      value.replace(placeholders, '').includes('{{') ||
      value.replace(placeholders, '').includes('}}')
    )
      throw new NotificationTemplateError('TEMPLATE_INVALID_PLACEHOLDER');
  }
  return [...keys];
}
function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );
}
export function renderTemplate(
  template: TemplateBody,
  variables: TemplateVariables,
): TemplateBody {
  for (const key of templateVariables(template)) {
    if (
      !Object.hasOwn(variables, key) ||
      variables[key] === undefined ||
      variables[key] === null ||
      String(variables[key]).trim() === ''
    )
      throw new NotificationTemplateError(`TEMPLATE_MISSING_VARIABLE:${key}`);
  }
  const render = (value: string, html = false) =>
    value.replace(placeholders, (_match, key: string) =>
      html ? escapeHtml(String(variables[key])) : String(variables[key]),
    );
  const subject = render(template.subject);
  if (/[\r\n]/.test(subject))
    throw new NotificationTemplateError('TEMPLATE_INVALID_SUBJECT');
  return {
    subject,
    text: render(template.text),
    ...(template.html ? { html: render(template.html, true) } : {}),
  };
}

const events: Array<[string, string]> = [
  ['notification.default', 'WEMOVE 业务通知'],
  ['account.welcome', '欢迎加入 WEMOVE'],
  ['account.password-changed', '您的密码已修改'],
  ['account.disabled', '您的账号已停用'],
  ['account.deletion.requested', '已收到账号删除申请'],
  ['account.privacy.resolved', '您的隐私申请有新进展'],
  ['security.new_device', '您的账号出现新设备登录'],
  ['dealer.application.confirmation', '已收到您的经销商申请'],
  ['dealer.application.claim', '认领您的经销商申请'],
  ['dealer.application.resubmit', '您的补充材料已提交'],
  ['dealer.application.review', '您的经销商申请审核有新进展'],
  ['dealer.team.invitation', '您收到企业团队邀请'],
  ['dealer.team.disabled', '您的企业成员权限已停用'],
  ['dealer.rfq.submitted', '已收到您的报价请求'],
  ['dealer.rfq.quoted', '您的企业报价已准备好'],
  ['dealer.rfq.expiring', '您的企业报价即将到期'],
  ['dealer.rfq.accepted', '您已接受企业报价'],
  ['dealer.rfq.rejected', '您的企业报价已拒绝'],
  ['dealer.rfq.sales', '有新的企业报价请求'],
  ['dealer.order.confirmed', '您的企业采购单已确认'],
  ['dealer.order.manual-create', '平台已为您的企业建立采购单'],
  ['dealer.order.processing', '您的企业采购单正在处理'],
  ['dealer.order.completed', '您的企业采购单已完成'],
  ['dealer.order.adjusted', '您的企业采购单信息已调整'],
  ['dealer.order.payment', '您的企业采购单付款状态已更新'],
  ['dealer.order.shipment', '您的企业采购单已发货'],
  ['dealer.order.cancelled', '您的企业采购单已取消'],
  ['dealer.order.return-requested', '已收到您的企业退货申请'],
  ['dealer.order.return-approved', '您的企业退货申请已批准'],
  ['dealer.order.return-rejected', '您的企业退货申请未通过'],
  ['dealer.order.return-tracking', '您的企业退货物流已更新'],
  ['dealer.order.return-withdrawn', '您的企业退货申请已撤回'],
  ['dealer.order.return-received', '您的企业退货已验收'],
  ['dealer.order.refund-requested', '已收到您的企业退款申请'],
  ['dealer.order.refund-reviewed', '您的企业退款申请已审核'],
  ['dealer.order.refund-withdrawn', '您的企业退款申请已撤回'],
  ['dealer.order.refund', '您的企业退款已确认完成'],
  ['order.checkout', '您的订单已创建'],
  ['order.manual.create', '您的订单已创建'],
  ['order.payment.update', '您的订单付款状态已更新'],
  ['order.shipment.create', '您的订单发货状态已更新'],
  ['order.refund.create', '您的订单退款已处理'],
  ['order.return.update', '您的售后申请已更新'],
  ['order.exchange.shipment', '您的换货商品已发出'],
  ['order.status.update', '您的订单状态已更新'],
  ['order.cancelled', '您的订单已取消'],
  ['order.expired', '您的订单已超时关闭'],
  ['order.refund.update', '您的订单退款状态已更新'],
  ['contact.received', '已收到您的 WEMOVE 咨询'],
  ['contact.reply', '您的 WEMOVE 咨询有新回复'],
  ['contact.status', '您的 WEMOVE 咨询状态已更新'],
  ['newsletter.confirm', '请确认您的 WEMOVE 邮件订阅'],
  ['newsletter.unsubscribed', '您已取消 WEMOVE 营销邮件订阅'],
];
export const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplate[] =
  events.map(([kind, title]) => ({
    kind,
    locales: {
      en: { subject: '{{subject}}', text: '{{text}}' },
      zh: {
        subject: title,
        text: `${title}。\n\n{{text}}\n\n您可以在 WEMOVE 网站中查看详情。`,
      },
    },
  }));
DEFAULT_NOTIFICATION_TEMPLATES.push(
  {
    kind: 'account.verify',
    locales: {
      en: {
        subject: 'Verify your WEMOVE email',
        text: 'Please verify your email within 24 hours: {{link}}\nIf you did not register, ignore this message.',
      },
      zh: {
        subject: '验证您的 WEMOVE 邮箱',
        text: '请在 24 小时内打开以下链接验证您的邮箱：\n{{link}}\n如果您没有注册账号，请忽略本邮件。',
      },
    },
  },
  {
    kind: 'account.password-reset',
    locales: {
      en: {
        subject: 'Reset your WEMOVE password',
        text: 'Set a new password within one hour: {{link}}\nIf you did not request a reset, ignore this message.',
      },
      zh: {
        subject: '重置您的 WEMOVE 密码',
        text: '请在一小时内打开以下链接设置新密码：\n{{link}}\n如果您没有申请重置密码，请忽略本邮件。',
      },
    },
  },
  ...(['dealer', 'support', 'orders'] as const).map((group) => ({
    kind: `internal.${group}`,
    locales: {
      en: {
        subject: 'WEMOVE internal notification: {{eventKind}}',
        text: 'A business event requires attention.\nEvent: {{eventKind}}\nNotification reference: {{reference}}\nOpen the management console: {{link}}',
      },
      zh: {
        subject: 'WEMOVE 内部业务通知：{{eventKind}}',
        text: '请查看新的业务事件。\n事件：{{eventKind}}\n通知编号：{{reference}}\n管理后台：{{link}}',
      },
    },
  })),
);

export function mergedTemplates(custom: NotificationTemplate[]) {
  const result = new Map(
    DEFAULT_NOTIFICATION_TEMPLATES.map((template) => [
      template.kind,
      structuredClone(template),
    ]),
  );
  for (const template of custom)
    result.set(template.kind, {
      kind: template.kind,
      locales: { ...result.get(template.kind)?.locales, ...template.locales },
    });
  return [...result.values()].sort((a, b) => a.kind.localeCompare(b.kind));
}

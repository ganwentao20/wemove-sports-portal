export const DEALER_TERMS_VERSION = 'dealer-terms-2026-09';
export const DEALER_TERMS = {
  version: DEALER_TERMS_VERSION,
  title: 'WEMOVE Dealer Portal Terms',
  sections: [
    {
      title: 'Your company account',
      text: 'Use the portal only for the approved company shown below and within the permissions assigned to you. Keep company, contact and delivery information accurate. Each person must use their own verified account; protect passwords and authenticator codes and report suspected unauthorized access.',
    },
    {
      title: 'Authorized catalog and confidential information',
      text: 'Dealer prices, quotations, inventory information and private downloads are provided for your company’s procurement and authorized sales activity. Do not share another company’s information, disclose private prices or redistribute restricted files outside the approved business purpose.',
    },
    {
      title: 'Quotes and purchase orders',
      text: 'Check the market, currency, quantities, minimum order requirements, delivery addresses and payment terms before submitting. A submitted purchase order is subject to the confirmation shown in the portal. The accepted quotation and order records identify agreed prices and terms; changes require a recorded request or confirmation.',
    },
    {
      title: 'Payments, delivery and after-sales requests',
      text: 'Use the payment instructions and deadlines on the confirmed order. Delivery estimates and stock availability may change before confirmation. Report discrepancies and request cancellations, returns or refunds through the order or company support channel, including the relevant quantities and evidence. Approved outcomes are recorded against the order.',
    },
    {
      title: 'Personal data and records',
      text: 'Company contacts, addresses, consent records and procurement records are used to provide account access, order processing and support as described in the privacy policy. Transactional account and order messages continue when marketing emails are disabled. Account closure or deletion requests are reviewed alongside outstanding orders and required record retention.',
    },
    {
      title: 'Authority and updates',
      text: 'By accepting, you confirm that you are authorized to access this company’s dealer account and that you have read this version of the portal terms. Your company, user account, version, acceptance time and request IP are recorded. A new version requires another explicit acceptance before dealer services resume.',
    },
  ],
};
export function acceptedDealerTerms(member: {
  termsVersion: string | null;
  termsAcceptedAt: Date | null;
}) {
  return (
    member.termsVersion === DEALER_TERMS_VERSION &&
    member.termsAcceptedAt !== null
  );
}

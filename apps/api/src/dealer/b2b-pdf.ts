import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderShipment,
} from '@prisma/client';

type DocumentOrder = PurchaseOrder & {
  items: PurchaseOrderItem[];
  shipments: PurchaseOrderShipment[];
};
export async function purchaseOrderPdf(
  order: DocumentOrder,
  kind: string,
): Promise<Buffer> {
  const pdf = new PDFDocument({ margin: 42, size: 'A4', bufferPages: true });
  pdf.font(
    process.env.B2B_PDF_FONT ??
      fileURLToPath(
        new URL(
          '../../assets/fonts/NotoSansCJKsc-Regular.otf',
          import.meta.url,
        ),
      ),
  );
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
  });
  const width = pdf.page.width - 84,
    bottom = pdf.page.height - 70;
  const price = (cents: number) =>
    order.currency + ' ' + (cents / 100).toFixed(2);
  const heading = () => {
    pdf
      .fillColor('#172b3a')
      .fontSize(18)
      .text('WEMOVE SPORTS', 42, 36, { width });
    pdf
      .fontSize(10)
      .fillColor('#476376')
      .text(
        kind.toUpperCase().replaceAll('-', ' ') + ' · ' + order.orderNo,
        42,
        65,
        { width },
      );
    pdf
      .moveTo(42, 89)
      .lineTo(pdf.page.width - 42, 89)
      .strokeColor('#cbd5df')
      .stroke();
    pdf.y = 103;
    pdf.fillColor('#172b3a').fontSize(9.5);
  };
  const ensure = (height: number) => {
    if (pdf.y + height > bottom) {
      pdf.addPage();
      heading();
    }
  };
  const line = (label: string, value: string) => {
    const text = label + ': ' + value;
    ensure(pdf.heightOfString(text, { width }) + 5);
    pdf.text(text, { width }).moveDown(0.2);
  };
  heading();
  line('Company', order.companyName);
  line('Customer PO', order.customerPoNumber ?? '-');
  line('Status', order.status);
  line('Market', order.market);
  line(
    'Payment',
    order.paymentMethod +
      ' / ' +
      order.paymentTerms +
      ' / ' +
      order.paymentStatus,
  );
  line('Created', order.createdAt.toISOString());
  const address = (value: unknown) =>
    Object.values((value ?? {}) as object)
      .filter(Boolean)
      .join(', ');
  line('Ship to', address(order.shippingAddress));
  line('Bill to', address(order.billingAddress));
  pdf.moveDown(0.5);
  for (const item of order.items) {
    const title =
      item.sku +
      ' - ' +
      item.productName +
      (item.variantName ? ' / ' + item.variantName : '');
    const detail =
      'Quantity ' +
      item.quantity +
      '; shipped ' +
      item.shippedQuantity +
      (kind === 'packing-list'
        ? ''
        : '; ' +
          price(item.unitPriceCents) +
          ' each; line total ' +
          price(item.lineCents));
    ensure(
      pdf.heightOfString(title, { width }) +
        pdf.heightOfString(detail, { width }) +
        15,
    );
    pdf
      .text(title, { width })
      .fillColor('#475569')
      .text(detail, { width })
      .fillColor('#172b3a')
      .moveDown(0.65);
  }
  if (kind !== 'packing-list') {
    ensure(110);
    pdf
      .moveTo(42, pdf.y)
      .lineTo(pdf.page.width - 42, pdf.y)
      .strokeColor('#cbd5df')
      .stroke();
    pdf.moveDown(0.5);
    line('Subtotal', price(order.subtotalCents));
    line(
      'Discount',
      price(
        order.subtotalCents +
          order.taxCents +
          order.shippingCents -
          order.totalCents,
      ),
    );
    line('Tax', price(order.taxCents));
    line('Shipping', price(order.shippingCents));
    pdf.fontSize(12);
    line('Total', price(order.totalCents));
    pdf.fontSize(9.5);
  }
  for (const shipment of order.shipments)
    line(
      'Shipment',
      shipment.carrier +
        ' ' +
        shipment.trackingNumber +
        ' - ' +
        shipment.shippedAt.toISOString(),
    );
  const pages = pdf.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    pdf.switchToPage(pages.start + i);
    pdf
      .fontSize(8)
      .fillColor('#64748b')
      .text(
        order.orderNo + ' · ' + (i + 1) + ' / ' + pages.count,
        42,
        pdf.page.height - 56,
        { width, lineBreak: false, align: 'right' },
      );
  }
  pdf.end();
  return result;
}

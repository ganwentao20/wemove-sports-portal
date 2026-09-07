import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import type { CommerceService } from './commerce.service.js';
type DocumentData = Awaited<ReturnType<CommerceService['document']>>;
export function orderPdf(data: DocumentData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
        size: 'A4',
        margin: 48,
        bufferPages: true,
        info: { Title: data.number, Author: 'WEMOVE SPORTS' },
      }),
      chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      doc.font(
        process.env.PDF_FONT_PATH ??
          fileURLToPath(
            new URL(
              '../../assets/fonts/NotoSansCJKsc-Regular.otf',
              import.meta.url,
            ),
          ),
      );
      const { order } = data,
        money = (cents: number) =>
          new Intl.NumberFormat('en', {
            style: 'currency',
            currency: order.currency,
          }).format(cents / 100);
      const title =
        data.kind === 'packing-list'
          ? 'Packing list'
          : data.kind === 'receipt'
            ? 'Payment receipt'
            : 'Order invoice';
      doc.fillColor('#18323e').fontSize(11).text('WEMOVE SPORTS').moveDown(1);
      doc
        .fontSize(25)
        .text(title)
        .fontSize(10)
        .fillColor('#405364')
        .text(data.number)
        .text(
          `Issued: ${new Date(data.issuedAt).toISOString().slice(0, 10)}   |   Market: ${order.market}`,
        )
        .moveDown(1.5);
      const address = (name: string, value: unknown) => {
        doc
          .fillColor('#18323e')
          .fontSize(11)
          .text(name)
          .fillColor('#405364')
          .fontSize(10);
        const a = (value ?? {}) as Record<string, unknown>;
        for (const key of [
          'recipient',
          'company',
          'line1',
          'line2',
          'city',
          'state',
          'postalCode',
          'country',
          'phone',
        ])
          if (a[key]) doc.text(String(a[key]), { width: 450 });
        doc.moveDown();
      };
      address('Ship to', order.shippingAddress);
      if (data.kind !== 'packing-list')
        address('Bill to', order.billingAddress);
      const header = () => {
        const y = doc.y;
        doc.rect(48, y, 499, 25).fill('#edf2f5');
        doc
          .fillColor('#18323e')
          .fontSize(9)
          .text('Product / SKU', 58, y + 7, { width: 275 });
        doc.text('Qty', 338, y + 7, { width: 40, align: 'right' });
        if (data.kind !== 'packing-list') {
          doc.text('Unit', 388, y + 7, { width: 60, align: 'right' });
          doc.text('Amount', 458, y + 7, { width: 80, align: 'right' });
        }
        doc.y = y + 34;
      };
      header();
      for (const item of order.items) {
        const name = `${item.productName}${item.variantName ? ` - ${item.variantName}` : ''}\n${item.sku}`;
        doc.fontSize(10);
        const height = Math.max(
          42,
          doc.heightOfString(name, { width: 270 }) + 14,
        );
        if (doc.y + height > 738) {
          doc.addPage();
          header();
        }
        const y = doc.y;
        doc.fillColor('#18323e').text(name, 58, y, { width: 270 });
        doc.text(String(item.quantity), 338, y, { width: 40, align: 'right' });
        if (data.kind !== 'packing-list') {
          doc.text(money(item.unitPriceCents), 385, y, {
            width: 65,
            align: 'right',
          });
          doc.text(money(item.lineCents), 452, y, {
            width: 86,
            align: 'right',
          });
        }
        doc
          .moveTo(48, y + height)
          .lineTo(547, y + height)
          .lineWidth(0.5)
          .strokeColor('#dbe3e8')
          .stroke();
        doc.y = y + height + 10;
      }
      if (doc.y > 585) doc.addPage();
      doc.moveDown();
      if (data.kind !== 'packing-list') {
        for (const [label, value] of [
          ['Subtotal', order.subtotalCents],
          ['Discount', -order.discountCents],
          ['Shipping', order.shippingCents],
          ['Tax', order.taxCents],
          ['Total', order.totalCents],
        ] as const) {
          const y = doc.y;
          doc
            .fillColor('#18323e')
            .fontSize(label === 'Total' ? 14 : 10)
            .text(label, 310, y, { width: 110 });
          doc.text(money(value), 425, y, { width: 112, align: 'right' });
          doc.y = y + (label === 'Total' ? 28 : 21);
        }
        doc
          .fontSize(10)
          .text(`Payment status: ${order.paymentStatus}`, 48, doc.y + 10);
      }
      doc
        .moveDown()
        .fontSize(8)
        .fillColor('#405364')
        .text(data.notice, 48, doc.y, { width: 480 });
      const range = doc.bufferedPageRange();
      for (let page = range.start; page < range.start + range.count; page++) {
        doc.switchToPage(page);
        doc
          .fontSize(8)
          .fillColor('#60717c')
          .text(`${page + 1} / ${range.count}`, 48, 770, {
            width: 499,
            align: 'right',
            lineBreak: false,
          });
      }
      doc.end();
    } catch (error) {
      doc.end();
      reject(error);
    }
  });
}

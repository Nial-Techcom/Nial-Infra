import PDFDocument from 'pdfkit';
import type { Writable } from 'node:stream';
import { buildCablingMatrix, type Alert, type Client, type Device, type Link } from '@nial-infra/shared';

/** Streams a landscape A4 PDF: summary, alerts and the full cabling matrix. */
export function writeCablingPdf(out: Writable, client: Client, devices: Device[], links: Link[], alerts: Alert[]) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, info: { Title: `Nial-Infra - ${client.name}`, Producer: 'Nial-Infra' } });
  doc.pipe(out);

  doc.fontSize(20).text(`Nial-Infra - ${client.name}`);
  doc.fontSize(10).fillColor('#555').text(`${new Date().toISOString().slice(0, 10)}  |  ${devices.length} devices  |  ${links.length} links  |  ${alerts.length} alerts`).fillColor('#000').moveDown();

  if (alerts.length) {
    doc.fontSize(13).text('Alerts').moveDown(0.3).fontSize(9);
    for (const a of alerts.slice(0, 60)) doc.text(`[${a.type.toUpperCase()}] ${a.message}`);
    doc.moveDown();
  }

  doc.fontSize(13).text('Cabling matrix').moveDown(0.3);
  const rows = buildCablingMatrix(devices, links);
  const widths = [115, 75, 115, 75, 55, 50, 55, 55, 105];
  const drawRow = (r: unknown[], bold: boolean) => {
    if (doc.y > doc.page.height - 60) doc.addPage();
    const y = doc.y;
    let x = doc.page.margins.left;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
    r.forEach((c, i) => {
      doc.text(String(c ?? ''), x, y, { width: widths[i]! - 4, height: 11, ellipsis: true, lineBreak: false });
      x += widths[i]!;
    });
    doc.y = y + 12;
    doc.x = doc.page.margins.left;
  };
  rows.forEach((r, i) => drawRow(r, i === 0));
  doc.end();
}

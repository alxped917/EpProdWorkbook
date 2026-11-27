import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import bwipjs from "bwip-js";

export type PickPdfLine = {
  label: string;
  product: string;
  lbs: string;
  boxes: string;
  stock: string;
};

export type PickPdfData = {
  company: string;
  jobNumber: string;
  address: string;
  warehouse: string;
  schedule: string;
  flake: string;
  size: string;
  sqft: string;
  lines: PickPdfLine[];
};

const ink = rgb(0.12, 0.1, 0.08);
const muted = rgb(0.4, 0.36, 0.3);
const accent = rgb(0.7, 0.33, 0.05);

function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max) {
      if (current) lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export async function buildPickSheetPdf(data: PickPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([612, 792]);
  let y = 750;
  const draw = (text: string, x: number, size: number, useBold = false, color = ink) => {
    if (y < 64) {
      page = doc.addPage([612, 792]);
      y = 750;
    }
    page.drawText(text, { x, y, size, font: useBold ? bold : font, color });
    y -= size + 6;
  };
  page.drawRectangle({ x: 0, y: 760, width: 612, height: 32, color: accent });
  page.drawText(data.company, { x: 36, y: 772, size: 12, font: bold, color: rgb(1, 1, 1) });
  y = 730;
  draw(`Pick sheet ${data.jobNumber}`, 36, 18, true);
  for (const line of [
    data.address,
    `Warehouse: ${data.warehouse}`,
    `Install date: ${data.schedule}`,
    `Floor: ${data.sqft}    Flake: ${data.flake}    Size: ${data.size}`,
  ]) {
    for (const part of wrap(line, 90)) draw(part, 36, 11, false, muted);
  }
  y -= 8;
  draw("Component", 36, 11, true);
  y += 17;
  page.drawText("Product", { x: 160, y, size: 11, font: bold, color: ink });
  page.drawText("Pounds", { x: 340, y, size: 11, font: bold, color: ink });
  page.drawText("Boxes", { x: 410, y, size: 11, font: bold, color: ink });
  page.drawText("Stock", { x: 480, y, size: 11, font: bold, color: ink });
  y -= 8;
  page.drawLine({ start: { x: 36, y }, end: { x: 576, y }, thickness: 0.5, color: muted });
  y -= 16;
  for (const line of data.lines) {
    if (y < 64) {
      page = doc.addPage([612, 792]);
      y = 750;
    }
    page.drawText(line.label.slice(0, 22), { x: 36, y, size: 10, font, color: ink });
    page.drawText(line.product.slice(0, 28), { x: 160, y, size: 10, font, color: ink });
    page.drawText(line.lbs, { x: 340, y, size: 10, font, color: ink });
    page.drawText(line.boxes.slice(0, 14), { x: 410, y, size: 10, font, color: ink });
    page.drawText(line.stock.slice(0, 18), { x: 480, y, size: 10, font, color: line.stock === "In stock" ? ink : accent });
    y -= 16;
  }
  y -= 12;
  draw("Mender is weigh-only and is not calculated on this sheet.", 36, 9, false, muted);
  draw(`Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, 36, 9, false, muted);
  return doc.save();
}

export async function buildLabelsPdf(
  labels: { barcode: string; title: string; detail: string }[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const columns = 2;
  const labelW = 260;
  const labelH = 150;
  labels.forEach((label, index) => {
    const slot = index % 8;
    if (slot === 0) doc.addPage([612, 792]);
    const page = doc.getPages().at(-1)!;
    const col = slot % columns;
    const row = Math.floor(slot / columns);
    const x = 36 + col * (labelW + 16);
    const y = 792 - 36 - (row + 1) * labelH;
    page.drawRectangle({ x, y, width: labelW, height: labelH - 12, borderColor: muted, borderWidth: 0.6 });
  });
  for (let index = 0; index < labels.length; index++) {
    const label = labels[index];
    const page = doc.getPages()[Math.floor(index / 8)];
    const slot = index % 8;
    const col = slot % columns;
    const row = Math.floor(slot / columns);
    const x = 36 + col * (labelW + 16);
    const top = 792 - 36 - row * labelH;
    const png = await bwipjs.toBuffer({
      bcid: "code128",
      text: label.barcode,
      scale: 2,
      height: 12,
      includetext: false,
    });
    const image = await doc.embedPng(png);
    page.drawImage(image, { x: x + 16, y: top - 78, width: 220, height: 48 });
    page.drawText(label.barcode, { x: x + 16, y: top - 96, size: 11, font: bold, color: ink });
    page.drawText(label.title.slice(0, 32), { x: x + 16, y: top - 114, size: 10, font, color: ink });
    page.drawText(label.detail.slice(0, 40), { x: x + 16, y: top - 128, size: 9, font, color: muted });
  }
  if (labels.length === 0) {
    const page = doc.addPage([612, 792]);
    page.drawText("No labels selected.", { x: 36, y: 740, size: 14, font });
  }
  return doc.save();
}

const BARCODE = /^IS-[A-Z0-9]{8}-[A-Z0-9]{4}$/;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function isValidBarcode(value: string): boolean {
  return BARCODE.test(value.trim().toUpperCase());
}

export function normalizeBarcode(value: string): string {
  return value.trim().toUpperCase();
}

export function generateBarcode(random: () => number = Math.random): string {
  const chunk = (length: number) =>
    Array.from({ length }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join("");
  return `IS-${chunk(8)}-${chunk(4)}`;
}

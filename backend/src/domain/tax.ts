import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ReceiptFields { receiptId: string; communeId: string; amountFcfa: number; paidAt: string }

export function computeTdl(quantityKg: number, fcfaPer100Kg: number): number {
  if (quantityKg < 0 || fcfaPer100Kg < 0) throw new Error('Quantité et barème ne peuvent pas être négatifs');
  return Math.ceil((quantityKg * fcfaPer100Kg) / 100);
}

const payload = (r: ReceiptFields) => `${r.receiptId}|${r.communeId}|${r.amountFcfa}|${r.paidAt}`;

export function signReceipt(r: ReceiptFields, secret: string): string {
  return createHmac('sha256', secret).update(payload(r)).digest('hex');
}

export function verifyReceipt(r: ReceiptFields, signature: string, secret: string): boolean {
  const expected = Buffer.from(signReceipt(r, secret), 'hex');
  const given = Buffer.from(signature, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

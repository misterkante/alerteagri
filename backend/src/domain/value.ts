export function protectedValueFcfa(areaHa: number, yieldKgPerHa: number, pricePerKg: number): number {
  return Math.round(Math.max(areaHa, 0) * yieldKgPerHa * pricePerKg);
}

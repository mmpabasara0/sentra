export function formatLkr(value: number | string) {
  return new Intl.NumberFormat("en-LK", {
    currency: "LKR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(Number(value));
}

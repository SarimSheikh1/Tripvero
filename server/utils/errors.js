export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const assert = (condition, message, status = 400) => {
  if (!condition) throw new AppError(status, message);
};
export const id = (value) => String(value?._id ?? value);
export const cents = (amount) => {
  const value = Math.round(Number(amount) * 100);
  assert(
    Number.isSafeInteger(value) && value >= 0 && value <= 1e12,
    "Invalid amount",
  );
  return value;
};
export const cash = (value) => value / 100;
export const currencyScale = (code) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: code,
  }).resolvedOptions().maximumFractionDigits;

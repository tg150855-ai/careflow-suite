export const inr = (n: number | string | null | undefined) => {
  void 0;
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(v);
};

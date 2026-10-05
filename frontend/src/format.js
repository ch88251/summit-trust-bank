const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const formatMoney = (n) => usd.format(n ?? 0);

export const formatSignedMoney = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + usd.format(Math.abs(n));

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export const maskAccount = (number) => `••••${number.slice(-4)}`;

export const accountLabel = (a) => `${a.nickname} (${maskAccount(a.account_number)})`;

export const titleCase = (s) => s.charAt(0) + s.slice(1).toLowerCase();

export const initials = (name) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

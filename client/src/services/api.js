import axios from "axios";
import toast from "react-hot-toast";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  headers: { "X-Tripvero-Request": "1" },
});
api.interceptors.response.use(
  (r) => r,
  (e) => {
    e.userMessage =
      e.response?.data?.message ||
      (e.code === "ERR_NETWORK"
        ? "Connection lost. Check that the server is running."
        : "Something went wrong. Please try again.");
    return Promise.reject(e);
  },
);
export const notifyError = (e) => toast.error(e.userMessage || e.message);
export const uid = (v) => String(v?._id ?? v ?? "");
export const money = (amount, currency = "PKR") =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount || 0);
export const date = (v) =>
  v
    ? new Date(v).toLocaleDateString("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
export const iso = (v) =>
  v
    ? new Date(v).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
export const categories = [
  "Accommodation",
  "Food",
  "Transport",
  "Fuel",
  "Shopping",
  "Entertainment",
  "Tickets",
  "Activities",
  "Visa",
  "Flights",
  "Medical",
  "Emergency",
  "Other",
];
export const currencies = ["PKR", "USD", "AED", "SAR", "EUR", "GBP"];
export const cover =
  "https://images.unsplash.com/photo-1569173112611-52a7cd38bea9?auto=format&fit=crop&w=1400&q=80";
export function csvDownload(filename, rows) {
  if (!rows.length) return toast.error("No records to export");
  const keys = [...new Set(rows.flatMap(Object.keys))];
  const safe = (v) => {
    let text = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const blob = new Blob(
    [
      "\uFEFF" +
        [
          keys.map(safe).join(","),
          ...rows.map((row) => keys.map((k) => safe(row[k])).join(",")),
        ].join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

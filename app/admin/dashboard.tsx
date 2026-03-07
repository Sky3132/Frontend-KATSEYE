"use client";

import { useMemo, useState } from "react";
import ThemeToggle from "../components/theme-toggle";

type StockItem = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  status: "In Stock" | "Low Stock" | "Out of Stock";
};

type OrderItem = {
  id: string;
  customer: string;
  total: string;
  status: "Paid" | "Pending" | "Shipped";
};

const stockItems: StockItem[] = [
  { id: "stk-1", name: "Eclipse Logo Tee", sku: "SKU-TEE-001", stock: 120, status: "In Stock" },
  { id: "stk-2", name: 'Nova "Galaxy" Hoodie', sku: "SKU-HOD-014", stock: 23, status: "Low Stock" },
  { id: "stk-3", name: "Starlight Signature Cap", sku: "SKU-CAP-004", stock: 0, status: "Out of Stock" },
  { id: "stk-4", name: "Moonrise Zip Jacket", sku: "SKU-JKT-010", stock: 65, status: "In Stock" },
  { id: "stk-5", name: "Comet Runner Sneakers", sku: "SKU-SNK-031", stock: 14, status: "Low Stock" },
];

const orders: OrderItem[] = [
  { id: "#ORD-10021", customer: "Lora Herman", total: "$142.97", status: "Paid" },
  { id: "#ORD-10022", customer: "Joann Littel", total: "$84.99", status: "Pending" },
  { id: "#ORD-10023", customer: "Roberta Mertz", total: "$229.00", status: "Shipped" },
  { id: "#ORD-10024", customer: "Sherry Jenkins", total: "$58.49", status: "Paid" },
];

const topItems = [
  { name: "Nova Hoodie", sold: 412, revenue: "$35,019" },
  { name: "Comet Sneakers", sold: 355, revenue: "$38,695" },
  { name: "Eclipse Tee", sold: 289, revenue: "$8,378" },
  { name: "Moonrise Jacket", sold: 240, revenue: "$22,680" },
];

const monthlySales = [42, 56, 49, 61, 72, 68, 74, 63, 58, 66, 78, 82];

function statusPill(status: StockItem["status"] | OrderItem["status"]) {
  if (status === "In Stock" || status === "Paid") return "bg-emerald-100 text-emerald-700";
  if (status === "Low Stock" || status === "Pending") return "bg-amber-100 text-amber-700";
  if (status === "Shipped") return "bg-blue-100 text-blue-700";
  return "bg-rose-100 text-rose-700";
}

const computeStockStatus = (qty: number): StockItem["status"] => {
  if (qty <= 0) return "Out of Stock";
  if (qty < 25) return "Low Stock";
  return "In Stock";
};

export default function AdminDashboard() {
  const [stocks, setStocks] = useState<StockItem[]>(stockItems);
  const [orderData, setOrderData] = useState<OrderItem[]>(orders);
  const [lastSaved, setLastSaved] = useState("Not saved yet");

  const totalStock = useMemo(() => stocks.reduce((sum, item) => sum + item.stock, 0), [stocks]);
  const lowStockCount = useMemo(
    () => stocks.filter((item) => item.status === "Low Stock" || item.status === "Out of Stock").length,
    [stocks]
  );

  const totalOrders = useMemo(() => orderData.length, [orderData]);
  const paidOrders = useMemo(() => orderData.filter((item) => item.status === "Paid").length, [orderData]);

  const updateStockQty = (id: string, nextQty: number) => {
    setStocks((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              stock: Math.max(0, nextQty),
              status: computeStockStatus(Math.max(0, nextQty)),
            }
          : item
      )
    );
  };

  const adjustStock = (id: string, diff: number) => {
    const target = stocks.find((item) => item.id === id);
    if (!target) return;
    updateStockQty(id, target.stock + diff);
  };

  const setOrderStatus = (id: string, status: OrderItem["status"]) => {
    setOrderData((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  };

  const saveChanges = () => {
    const now = new Date();
    setLastSaved(now.toLocaleTimeString());
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#edf1ff,#f6f8fc_48%,#f3f6fb)] text-[#141414] transition-colors dark:bg-[radial-gradient(circle_at_top,#1a1708,#0a0a09_45%,#070707)] dark:text-[#f1d04b]">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[#4f5ae0] dark:text-[#b59b39]">Admin Dashboard</p>
            <h1 className="text-4xl font-semibold tracking-tight">Katseye Insights</h1>
            <p className="mt-1 text-xs text-neutral-500 dark:text-[#c7ba81]">Last save: {lastSaved}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle className="dark:border-[#d9b92f] dark:bg-[#080808]" />
            <button className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium dark:border-[#2f2a16] dark:bg-[#090909]">
              Export Report
            </button>
            <button
              type="button"
              className="rounded-xl bg-[#272b74] px-4 py-2 text-sm font-medium text-white dark:bg-[#f1d04b] dark:text-[#090909]"
              onClick={saveChanges}
            >
              Save Changes
            </button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
            <p className="text-xs text-neutral-500">Current Stocks</p>
            <p className="mt-2 text-4xl font-semibold">{totalStock}</p>
            <p className="mt-1 text-xs text-emerald-600">{lowStockCount} items need restock</p>
          </article>
          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
            <p className="text-xs text-neutral-500">Total Sales</p>
            <p className="mt-2 text-4xl font-semibold">$132,480</p>
            <p className="mt-1 text-xs text-emerald-600">+8.4% this month</p>
          </article>
          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
            <p className="text-xs text-neutral-500">Orders</p>
            <p className="mt-2 text-4xl font-semibold">{totalOrders}</p>
            <p className="mt-1 text-xs text-emerald-600">{paidOrders} paid orders</p>
          </article>
          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
            <p className="text-xs text-neutral-500">Reports Generated</p>
            <p className="mt-2 text-4xl font-semibold">97</p>
            <p className="mt-1 text-xs text-neutral-500">Last 30 days</p>
          </article>
          <article className="rounded-2xl bg-[linear-gradient(135deg,#4a4bb6,#3a8bd8)] p-4 text-white shadow-sm dark:bg-[linear-gradient(135deg,#d9b92f,#f1d04b)] dark:text-[#090909]">
            <p className="text-xs text-white/80">Most Sold Item</p>
            <p className="mt-2 text-2xl font-semibold">Nova Hoodie</p>
            <p className="mt-1 text-xs text-white/80">412 units sold</p>
          </article>
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Current Stocks</h2>
              <span className="text-xs text-neutral-500">Warehouse A</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                    <th className="pb-2">Product</th>
                    <th className="pb-2">SKU</th>
                    <th className="pb-2">Stock Qty</th>
                    <th className="pb-2">Adjust</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((item) => (
                    <tr key={item.id} className="border-b border-neutral-100">
                      <td className="py-3 font-medium">{item.name}</td>
                      <td className="py-3 text-neutral-500">{item.sku}</td>
                      <td className="py-3">
                        <input
                          type="number"
                          min={0}
                          value={item.stock}
                          onChange={(event) => updateStockQty(item.id, Number(event.target.value || 0))}
                          className="h-9 w-20 rounded-lg border border-neutral-300 px-2 dark:border-[#d9b92f] dark:bg-[#080808]"
                        />
                      </td>
                      <td className="py-3">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-[#2f2a16]"
                            onClick={() => adjustStock(item.id, -1)}
                          >
                            -1
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-[#2f2a16]"
                            onClick={() => adjustStock(item.id, 5)}
                          >
                            +5
                          </button>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusPill(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Sales Report</h2>
              <span className="text-xs text-neutral-500">Jan - Dec</span>
            </div>
            <div className="flex h-56 items-end gap-2 rounded-xl bg-[#f8f9fe] p-3 dark:bg-[#11110f]">
              {monthlySales.map((value, index) => (
                <div key={index} className="flex-1 rounded-t-md bg-[#6f83e9]" style={{ height: `${value * 2}px` }} />
              ))}
            </div>
            <p className="mt-3 text-xs text-neutral-500">Static monthly sales preview</p>
          </article>
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-2">
          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
            <h2 className="mb-3 text-xl font-semibold">Recent Orders</h2>
            <div className="space-y-2">
              {orderData.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 px-3 py-2 dark:border-[#2f2a16] dark:bg-[#11110f]"
                >
                  <div>
                    <p className="text-sm font-medium">{order.id}</p>
                    <p className="text-xs text-neutral-500">{order.customer}</p>
                  </div>
                  <p className="text-sm font-semibold">{order.total}</p>
                  <select
                    value={order.status}
                    onChange={(event) => setOrderStatus(order.id, event.target.value as OrderItem["status"])}
                    className="rounded-lg border border-neutral-300 px-2 py-1 text-xs dark:border-[#2f2a16] dark:bg-[#080808]"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Shipped">Shipped</option>
                  </select>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
            <h2 className="mb-3 text-xl font-semibold">Most Sale Items</h2>
            <div className="space-y-3">
              {topItems.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between rounded-xl bg-[#f6f7fc] px-3 py-2 dark:bg-[#11110f]">
                  <div className="flex items-center gap-3">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[#4a4bb6] text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-neutral-500">{item.sold} sold</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold">{item.revenue}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

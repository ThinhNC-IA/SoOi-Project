import type { CartItem, DashboardSummary, LedgerDatabase, Order, PaymentMethod, Product } from "@/lib/ledger/types";

export const formatMoney = (amount: number) =>
  `${Math.round(amount).toLocaleString("vi-VN")}đ`;

export const formatMoneyShort = (amount: number) => {
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
  if (Math.abs(amount) >= 1_000) return `${(amount / 1_000).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}k`;
  return formatMoney(amount);
};

export const today = () => new Date().toISOString().slice(0, 10);

export function cartSubtotal(items: CartItem[]) {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}

export function calculateSummary(database: LedgerDatabase): DashboardSummary {
  const todaysOrders = database.orders.filter((order) => order.createdAt.slice(0, 10) === today());
  const todaysCash = database.cashEntries.filter((entry) => entry.date === today());
  const revenue = todaysOrders.reduce((total, order) => total + order.total, 0);
  const collected = todaysOrders.reduce((total, order) => total + order.paid, 0);
  const cogs = todaysOrders.reduce(
    (total, order) => total + order.items.reduce((sum, item) => sum + item.cost * item.quantity, 0),
    0,
  );
  const expense = todaysCash.filter((entry) => entry.type === "expense").reduce((total, entry) => total + entry.amount, 0);
  const orderDebt = database.orders.reduce((total, order) => total + Math.max(0, order.total - order.paid), 0);
  const manualDebt = (database.debtEntries ?? []).reduce((total, entry) => total + (entry.type === "debt" ? entry.amount : -entry.amount), 0);
  const openDebt = Math.max(0, orderDebt + manualDebt);

  return { revenue, collected, expense, profit: revenue - cogs - expense, openDebt, orders: todaysOrders.length };
}

export function validateStock(database: LedgerDatabase, items: CartItem[]) {
  if (database.store.allowNegativeStock) return [];
  return items.flatMap((item) => {
    const product = database.products.find((candidate) => candidate.id === item.id);
    if (!product || product.stock >= item.quantity) return [];
    return [`${product.name} chỉ còn ${product.stock} ${product.unit}`];
  });
}

export function completeOrder(
  database: LedgerDatabase,
  input: { items: CartItem[]; discount: number; customerId?: string; customerName: string; method: PaymentMethod },
): LedgerDatabase {
  const subtotal = cartSubtotal(input.items);
  const total = Math.max(0, subtotal - input.discount);
  const paid = input.method === "debt" ? 0 : total;
  const order: Order = {
    id: crypto.randomUUID(),
    number: `DH${today().slice(2).replaceAll("-", "")}${String(database.orders.length + 1).padStart(3, "0")}`,
    createdAt: new Date().toISOString(),
    customerId: input.customerId,
    customerName: input.customerName || "Khách lẻ",
    items: input.items,
    subtotal,
    discount: input.discount,
    total,
    paid,
    method: input.method,
  };

  const soldQuantities = new Map(input.items.map((item) => [item.id, item.quantity]));
  return {
    ...database,
    products: database.products.map((product) => ({
      ...product,
      stock: product.stock - (soldQuantities.get(product.id) ?? 0),
    })),
    orders: [order, ...database.orders],
  };
}

export function addToCart(items: CartItem[], product: Product): CartItem[] {
  const existing = items.find((item) => item.id === product.id);
  if (!existing) return [...items, { id: product.id, name: product.name, unit: product.unit, price: product.price, cost: product.cost, quantity: 1 }];
  return items.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
}

"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Coffee,
  CreditCard,
  Download,
  LayoutDashboard,
  Mic,
  Minus,
  Package,
  Plus,
  ReceiptText,
  ScanLine,
  Search,
  Settings2,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { addToCart, calculateSummary, cartSubtotal, completeOrder, formatMoney, formatMoneyShort, today, validateStock } from "@/lib/ledger";
import type { CartItem, CashType, PaymentMethod, Product } from "@/lib/ledger/types";
import { useLedger } from "@/hooks/use-ledger";

type Screen = "home" | "sell" | "cash" | "report" | "manage";
type Panel = "cart" | "cash" | "product" | "debt" | null;

const navItems: { id: Screen; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "home", label: "Tổng quan", icon: LayoutDashboard },
  { id: "sell", label: "Bán hàng", icon: ShoppingCart },
  { id: "cash", label: "Thu chi", icon: WalletCards },
  { id: "report", label: "Báo cáo", icon: BarChart3 },
  { id: "manage", label: "Quản lý", icon: Settings2 },
];

export function SooiApp() {
  const { database, setDatabase, reset } = useLedger();
  const [screen, setScreen] = useState<Screen>("home");
  const [panel, setPanel] = useState<Panel>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tất cả");
  const [discount, setDiscount] = useState(0);
  const [customerId, setCustomerId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [cashType, setCashType] = useState<CashType>("expense");
  const [cashCategory, setCashCategory] = useState("Điện nước");
  const [cashAmount, setCashAmount] = useState("");
  const [cashNote, setCashNote] = useState("");
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productCost, setProductCost] = useState("");
  const [productStock, setProductStock] = useState("");
  const [productCategory, setProductCategory] = useState("Đồ uống");
  const [debtType, setDebtType] = useState<"debt" | "payment">("debt");
  const [debtCustomerId, setDebtCustomerId] = useState("");
  const [debtCustomerName, setDebtCustomerName] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtNote, setDebtNote] = useState("");

  const summary = useMemo(() => calculateSummary(database), [database]);
  const subtotal = cartSubtotal(cart);
  const total = Math.max(0, subtotal - discount);
  const categories = useMemo(() => ["Tất cả", ...new Set(database.products.filter((item) => item.active).map((item) => item.category))], [database.products]);
  const products = useMemo(() => database.products.filter((product) => {
    const matchCategory = category === "Tất cả" || product.category === category;
    const normalized = query.trim().toLocaleLowerCase("vi-VN");
    return product.active && matchCategory && (!normalized || product.name.toLocaleLowerCase("vi-VN").includes(normalized));
  }), [database.products, category, query]);
  const selectedCustomer = database.customers.find((customer) => customer.id === customerId);

  const handleVoiceDraft = (items: CartItem[], transcript: string) => {
    setCart(items);
    setScreen("sell");
    setPanel("cart");
    toast.success(`Sổ đã nhận: “${transcript}”. Kiểm lại đơn trước khi lưu.`);
  };

  const addProduct = (product: Product) => {
    setCart((items) => addToCart(items, product));
    toast.success(`Đã thêm ${product.name}`);
  };

  const updateQuantity = (productId: string, change: number) => {
    setCart((items) => items.flatMap((item) => {
      if (item.id !== productId) return [item];
      const quantity = item.quantity + change;
      return quantity > 0 ? [{ ...item, quantity }] : [];
    }));
  };

  const checkout = () => {
    if (!cart.length) return;
    if (method === "debt" && !selectedCustomer) {
      toast.error("Chọn khách hàng trước khi ghi nợ.");
      return;
    }
    const stockErrors = validateStock(database, cart);
    if (stockErrors.length) {
      toast.error(stockErrors[0]);
      return;
    }
    setDatabase((current) => completeOrder(current, {
      items: cart,
      discount,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name ?? "Khách lẻ",
      method,
    }));
    
    const successMessage = method === "debt" ? "Đã lưu đơn ghi nợ" : `Đã thanh toán ${formatMoney(total)}`;
    toast.success(successMessage);
    
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(successMessage);
      utterance.lang = "vi-VN";
      window.speechSynthesis.speak(utterance);
    }

    setCart([]);
    setDiscount(0);
    setCustomerId("");
    setMethod("cash");
    setPanel(null);
    setScreen("home");
  };

  const saveCashEntry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(cashAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Nhập số tiền hợp lệ.");
      return;
    }
    setDatabase((current) => ({
      ...current,
      cashEntries: [{
        id: crypto.randomUUID(),
        date: today(),
        type: cashType,
        category: cashCategory.trim() || (cashType === "expense" ? "Chi phí khác" : "Thu khác"),
        note: cashNote.trim() || "Chưa có ghi chú",
        amount,
      }, ...current.cashEntries],
    }));
    toast.success(cashType === "expense" ? "Đã ghi khoản chi" : "Đã ghi khoản thu");
    setCashAmount("");
    setCashNote("");
    setPanel(null);
  };

  const saveProduct = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const price = Number(productPrice);
    const cost = Number(productCost);
    const stock = Number(productStock);
    if (!productName.trim() || !Number.isFinite(price) || price <= 0 || !Number.isFinite(cost) || cost < 0 || !Number.isFinite(stock) || stock < 0) {
      toast.error("Kiểm tra lại tên, giá bán, giá vốn và tồn kho.");
      return;
    }
    setDatabase((current) => ({ ...current, products: [...current.products, { id: crypto.randomUUID(), name: productName.trim(), category: productCategory.trim() || "Khác", unit: "món", price, cost, stock, lowStock: Math.max(1, Math.ceil(stock * 0.2)), active: true }] }));
    setProductName(""); setProductPrice(""); setProductCost(""); setProductStock(""); setPanel(null);
    toast.success("Đã thêm sản phẩm vào bảng giá.");
  };

  const saveDebtEntry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(debtAmount);
    const knownCustomer = database.customers.find((customer) => customer.id === debtCustomerId);
    const customerName = knownCustomer?.name ?? debtCustomerName.trim();
    if (!customerName || !Number.isFinite(amount) || amount <= 0) { toast.error("Chọn khách và nhập số tiền hợp lệ."); return; }
    setDatabase((current) => ({ ...current, debtEntries: [{ id: crypto.randomUUID(), date: today(), customerId: knownCustomer?.id, customerName, type: debtType, amount, note: debtNote.trim() || (debtType === "debt" ? "Ghi công nợ" : "Khách trả nợ") }, ...(current.debtEntries ?? [])] }));
    setDebtAmount(""); setDebtNote(""); setDebtCustomerName(""); setDebtCustomerId(""); setPanel(null);
    toast.success(debtType === "debt" ? "Đã ghi công nợ" : "Đã ghi nhận khách trả nợ");
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(database, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `so-oi-backup-${today()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Đã xuất bản sao dữ liệu Sổ Ơi.");
  };

  const handleAssistantCommand = (raw: string) => {
    const command = normalizeVoiceText(raw);
    const has = (...phrases: string[]) => phrases.some((phrase) => command.includes(phrase));
    const currentSummary = calculateSummary(database);
    const lowStock = database.products.filter((product) => product.active && product.stock <= product.lowStock);
    const potentialItems = makeVoiceDraft(raw, database.products);
    const debtByCustomer = new Map<string, number>();
    database.orders.forEach((order) => { const open = Math.max(0, order.total - order.paid); if (open) debtByCustomer.set(order.customerName, (debtByCustomer.get(order.customerName) ?? 0) + open); });
    (database.debtEntries ?? []).forEach((entry) => debtByCustomer.set(entry.customerName, (debtByCustomer.get(entry.customerName) ?? 0) + (entry.type === "debt" ? entry.amount : -entry.amount)));

    const voiceAmount = spokenAmount(` ${command} `);
    const namedKnownCustomer = database.customers.find((candidate) => command.includes(normalizeVoiceText(candidate.name)));
    const hasCustomerName = Boolean(namedKnownCustomer || raw.match(/(?:chị|anh|cô|chú|bác|em)\s+[\p{L}]+/iu));
    const debtPayment = (has("tra no", "thanh toan no", "gui tra", "khach tra", "thu no") || (hasCustomerName && has("tra", "gui") && voiceAmount > 0)) && !potentialItems.length;
    const debtRecord = (has("ghi no", "ghi cong no", "them cong no", "cho no", "no them", "con no") || (hasCustomerName && command.split(" ").includes("no") && voiceAmount > 0)) && !potentialItems.length;
    if (debtPayment || debtRecord) {
      const amount = voiceAmount;
      const knownCustomer = namedKnownCustomer;
      const spokenName = raw.match(/(?:chị|anh|cô|chú|bác|em)\s+[\p{L}]+/iu)?.[0] ?? "";
      setDebtType(debtPayment ? "payment" : "debt");
      setDebtCustomerId(knownCustomer?.id ?? "");
      setDebtCustomerName(knownCustomer?.name ?? spokenName);
      setDebtAmount(amount > 0 ? String(amount) : "");
      setDebtNote(raw.trim());
      setPanel("debt");
      return `${debtPayment ? "Đã chuẩn bị ghi nhận khách trả nợ" : "Đã chuẩn bị ghi công nợ"}${amount > 0 ? ` ${formatMoney(amount)}` : ""}${knownCustomer || spokenName ? ` cho ${knownCustomer?.name ?? spokenName}` : ""}. Bạn kiểm tra rồi bấm lưu.`;
    }

    if (has("hom nay ban bao nhieu", "ban duoc bao nhieu", "doanh thu", "tong ket hom nay", "tinh hinh hom nay", "hom nay the nao")) return `Hôm nay có ${currentSummary.orders} đơn, doanh thu ${formatMoney(currentSummary.revenue)}, đã thu ${formatMoney(currentSummary.collected)} và lợi nhuận ${formatMoney(currentSummary.profit)}.`;
    if (has("ai dang no", "khach no", "cong no", "con thieu", "chua tra", "ghi no bao nhieu")) {
      const debtors = [...debtByCustomer.entries()].filter(([, amount]) => amount > 0).sort((left, right) => right[1] - left[1]);
      return debtors.length ? `Đang có ${debtors.map(([name, amount]) => `${name} nợ ${formatMoney(amount)}`).join("; ")}. Tổng cộng ${formatMoney(debtors.reduce((sum, [, amount]) => sum + amount, 0))}.` : "Hiện không có khách nào đang nợ.";
    }
    if (has("mon nao sap het", "sap het hang", "kiem tra ton", "ton kho", "con bao nhieu", "can nhap hang")) return lowStock.length ? `${lowStock.map((product) => `${product.name} còn ${product.stock} ${product.unit}`).join("; ")}.` : "Tồn kho đang ổn, chưa có món nào chạm ngưỡng cảnh báo.";
    if (has("tien lai", "loi nhuan", "lai bao nhieu", "lo hay lai")) return `Lợi nhuận hôm nay đang là ${formatMoney(currentSummary.profit)} sau khi trừ giá vốn và các khoản chi.`;
    if (has("chi bao nhieu", "tong chi", "da chi")) return `Tổng các khoản chi hôm nay là ${formatMoney(currentSummary.expense)}.`;

    const amount = spokenAmount(` ${command} `);
    const looksLikeExpense = has("ghi chi", "them khoan chi", "tra tien", "dong tien", "tien dien", "tien nuoc", "tien nha", "tien luong", "nhap hang", "mua hang", "chi phi");
    if (looksLikeExpense) {
      setCashType("expense");
      setCashAmount(amount > 0 ? String(amount) : "");
      setCashCategory(has("dien", "nuoc") ? "Điện nước" : has("nhap hang", "mua hang") ? "Nhập hàng" : has("luong", "tien cong") ? "Lương nhân viên" : has("tien nha", "mat bang") ? "Thuê mặt bằng" : "Chi phí khác");
      setCashNote(raw.trim());
      setPanel("cash");
      return amount > 0 ? `Đã chuẩn bị khoản chi ${formatMoney(amount)}. Bạn kiểm tra rồi bấm lưu.` : "Đã mở phần ghi khoản chi. Bạn bổ sung số tiền rồi bấm lưu.";
    }
    if (has("ghi thu", "them khoan thu", "thu khac", "nhan tien", "thu ve")) {
      setCashType("income");
      setCashAmount(amount > 0 ? String(amount) : "");
      setCashCategory("Thu khác");
      setCashNote(raw.trim());
      setPanel("cash");
      return amount > 0 ? `Đã chuẩn bị khoản thu ${formatMoney(amount)}. Bạn kiểm tra rồi bấm lưu.` : "Đã mở phần ghi khoản thu.";
    }

    if (has("them san pham", "them mon moi", "tao san pham", "tao mon", "nhap mat hang moi")) { setPanel("product"); return "Đã mở phần thêm sản phẩm mới."; }
    if (has("sao luu", "xuat du lieu", "tai du lieu", "backup")) { exportData(); return "Đã tạo bản sao dữ liệu để tải xuống."; }
    if (has("mo gio", "xem gio", "xem don dang tao", "chot don", "thanh toan")) { setPanel("cart"); return "Đã mở đơn hàng để bạn kiểm tra trước khi thanh toán."; }
    if (has("bao cao", "thong ke", "xem so lieu", "ket qua kinh doanh")) { setScreen("report"); return "Đã mở báo cáo hôm nay."; }
    if (has("quan ly", "bang gia", "quet bang gia", "danh sach san pham", "kho hang")) { setScreen("manage"); return "Đã mở phần quản lý hàng hóa và bảng giá."; }

    const items = potentialItems;
    if (items.length) {
      setMethod(has("ghi no", "ghi so", "tra sau", "con no") ? "debt" : has("chuyen khoan", "banking", "quet ma") ? "transfer" : "cash");
      const customer = database.customers.find((candidate) => command.includes(normalizeVoiceText(candidate.name)));
      setCustomerId(customer?.id ?? "");
      const discountIndex = command.search(/giam|bot|tru/);
      setDiscount(discountIndex >= 0 ? spokenAmount(command.slice(discountIndex)) : 0);
      handleVoiceDraft(items, raw);
      const customerText = customer ? ` cho ${customer.name}` : "";
      return `Sổ đã tạo bản nháp${customerText} gồm ${items.reduce((sum, item) => sum + item.quantity, 0)} món. Hãy kiểm tra trước khi lưu.`;
    }

    if (has("ban hang", "tao don", "len don", "mo ban")) { setScreen("sell"); return "Đã mở màn hình bán hàng."; }
    if (has("thu chi", "so quy", "giao dich")) { setScreen("cash"); return "Đã mở Sổ thu chi."; }
    if (has("trang chu", "tong quan", "ve dau", "so sang")) { setScreen("home"); return "Đã quay về màn hình tổng quan."; }

    const productNames = database.products.filter((product) => product.active).slice(0, 4).map((product) => product.name).join(", ");
    return `Mình chưa chắc bạn muốn tạo đơn hay mở chức năng nào. Bạn có thể nói lại kèm hành động, ví dụ “bán hai cà phê sữa”, “ghi chi tiền điện”, “xem công nợ”. Các món hiện có: ${productNames}.`;
  };

  return (
    <main className="min-h-screen bg-stone-100 text-sooi-ink">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-72 shrink-0 border-r border-stone-200 bg-sooi-card p-5 lg:flex lg:flex-col">
          <Brand />
          <p className="mt-8 px-3 text-xs font-bold tracking-[0.16em] text-stone-400">SỔ BÁN HÀNG</p>
          <nav className="mt-3 space-y-1">
            {navItems.map(({ id, label, icon: Icon }) => <NavButton key={id} active={screen === id} icon={<Icon size={19} />} label={label} onClick={() => setScreen(id)} />)}
          </nav>
          <div className="mt-auto rounded-2xl bg-sooi-deep p-4 text-white">
            <p className="text-xs font-semibold text-emerald-100">Local-first</p>
            <p className="mt-1 text-sm leading-5 text-emerald-50">Dữ liệu đang được lưu an toàn trên thiết bị này.</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 pb-24 lg:pb-8">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200/70 bg-[#f4f7fb]/95 px-3 py-3 backdrop-blur sm:px-5 lg:px-8 lg:py-4">
            <div>
              <p className="text-[10px] font-semibold text-stone-500 sm:text-xs">Chào buổi sáng · Bản trải nghiệm</p>
              <h1 className="mt-0.5 text-[18px] font-black tracking-tight sm:text-xl">{database.store.name}</h1>
            </div>
            <div className="flex items-center gap-2"><div className="hidden sm:block"><VoiceOrderButton onCommand={handleAssistantCommand} /></div><button onClick={() => setPanel("cart")} className="relative inline-flex size-10 items-center justify-center rounded-full bg-emerald-50 text-sooi-green shadow-sm hover:bg-emerald-100 sm:size-11 sm:rounded-xl sm:border sm:border-stone-200 sm:bg-white sm:text-sooi-deep" aria-label="Mở giỏ hàng">
              <span className="text-sm font-black sm:hidden">ơ</span><ShoppingCart size={20} className="hidden sm:block" />
              {cart.length > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-sooi-green text-[11px] font-bold text-white">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>}
            </button></div>
          </header>

          <div className="mx-auto max-w-5xl p-2.5 sm:p-5 lg:p-8">
            {screen === "home" && <HomeScreen summary={summary} database={database} onSell={() => setScreen("sell")} onCash={() => setPanel("cash")} onDebt={() => setPanel("debt")} onManage={() => setScreen("manage")} onCommand={handleAssistantCommand} />}
            {screen === "sell" && <SellScreen products={products} categories={categories} category={category} query={query} onCategory={setCategory} onQuery={setQuery} onAdd={addProduct} />}
            {screen === "cash" && <CashScreen database={database} onCreate={() => setPanel("cash")} />}
            {screen === "report" && <ReportScreen summary={summary} database={database} />}
            {screen === "manage" && <ManageScreen database={database} onSettings={() => setDatabase((current) => ({ ...current, store: { ...current.store, allowNegativeStock: !current.store.allowNegativeStock } }))} onReset={() => { reset(); toast.success("Đã khôi phục dữ liệu mẫu"); }} onCreate={() => setPanel("product")} onExport={exportData} onToggle={(id) => setDatabase((current) => ({ ...current, products: current.products.map((product) => product.id === id ? { ...product, active: !product.active } : product) }))} />}
          </div>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex h-[66px] border-t border-stone-200 bg-white px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-2 lg:hidden">
        {[navItems[0], navItems[1]].map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setScreen(id)} className={`flex min-w-0 flex-1 flex-col items-center gap-1 text-[9px] font-bold ${screen === id ? "text-sooi-green" : "text-stone-400"}`}><Icon size={18} />{id === "home" ? "Sổ ơi" : label}</button>)}
        <div className="relative min-w-16 flex-1"><div className="absolute left-1/2 top-[-28px] -translate-x-1/2 rounded-full border-4 border-[#f4f7fb] bg-white p-1 shadow-lg"><VoiceOrderButton onCommand={handleAssistantCommand} variant="fab" /></div></div>
        {[navItems[2], navItems[4]].map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setScreen(id)} className={`flex min-w-0 flex-1 flex-col items-center gap-1 text-[9px] font-bold ${screen === id ? "text-sooi-green" : "text-stone-400"}`}><Icon size={18} />{label}</button>)}
      </nav>

      {panel === "cart" && <CartSheet cart={cart} total={total} subtotal={subtotal} discount={discount} customerId={customerId} method={method} customers={database.customers} onClose={() => setPanel(null)} onQuantity={updateQuantity} onDiscount={setDiscount} onCustomer={setCustomerId} onMethod={setMethod} onCheckout={checkout} />}
      {panel === "cash" && <CashSheet cashType={cashType} category={cashCategory} amount={cashAmount} note={cashNote} onClose={() => setPanel(null)} onType={setCashType} onCategory={setCashCategory} onAmount={setCashAmount} onNote={setCashNote} onSubmit={saveCashEntry} />}
      {panel === "product" && <ProductSheet name={productName} price={productPrice} cost={productCost} stock={productStock} category={productCategory} onName={setProductName} onPrice={setProductPrice} onCost={setProductCost} onStock={setProductStock} onCategory={setProductCategory} onClose={() => setPanel(null)} onSubmit={saveProduct} />}
      {panel === "debt" && <DebtSheet type={debtType} customerId={debtCustomerId} customerName={debtCustomerName} amount={debtAmount} note={debtNote} customers={database.customers} onType={setDebtType} onCustomerId={setDebtCustomerId} onCustomerName={setDebtCustomerName} onAmount={setDebtAmount} onNote={setDebtNote} onClose={() => setPanel(null)} onSubmit={saveDebtEntry} />}
    </main>
  );
}

type BrowserRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

type BrowserRecognitionConstructor = new () => BrowserRecognition;

function normalizeVoiceText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLocaleLowerCase("vi-VN").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function phraseSimilarity(left: string, right: string) {
  if (left === right) return 1;
  if (!left || !right) return 0;
  const pairs = (value: string) => Array.from({ length: Math.max(0, value.length - 1) }, (_, index) => value.slice(index, index + 2));
  const first = pairs(left.replaceAll(" ", ""));
  const second = pairs(right.replaceAll(" ", ""));
  if (!first.length || !second.length) return left.includes(right) || right.includes(left) ? 0.9 : 0;
  const pool = [...second];
  let matches = 0;
  first.forEach((pair) => { const index = pool.indexOf(pair); if (index >= 0) { matches += 1; pool.splice(index, 1); } });
  return (2 * matches) / (first.length + second.length);
}

function findSpokenPhrase(spoken: string, aliases: string[]) {
  for (const alias of aliases) {
    const index = spoken.indexOf(alias);
    if (index >= 0) return { index, score: 1 };
  }
  const words = spoken.split(" ");
  let best = { index: -1, score: 0 };
  for (const alias of aliases) {
    const size = alias.split(" ").length;
    for (let length = Math.max(1, size - 1); length <= size + 1; length += 1) {
      for (let start = 0; start <= words.length - length; start += 1) {
        const phrase = words.slice(start, start + length).join(" ");
        const score = phraseSimilarity(phrase, alias);
        if (score > best.score) best = { index: words.slice(0, start).join(" ").length + (start ? 1 : 0), score };
      }
    }
  }
  return best.score >= 0.76 ? best : { index: -1, score: best.score };
}

function voiceQuantity(value: string) {
  const digits = value.match(/(\d+)\s*$/)?.[1];
  if (digits) return Math.max(1, Number(digits));
  const numberWords: Record<string, number> = { mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, lam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10 };
  const words = value.trim().split(/\s+/).slice(-4);
  const muoi = words.lastIndexOf("muoi");
  if (muoi > 0) return (numberWords[words[muoi - 1] ?? ""] ?? 1) * 10 + (numberWords[words[muoi + 1] ?? ""] ?? 0);
  if (words.includes("ham")) return 20 + (numberWords[words.at(-1) ?? ""] ?? 0);
  if (words.includes("bam")) return 30 + (numberWords[words.at(-1) ?? ""] ?? 0);
  return numberWords[words.at(-1) ?? ""] ?? numberWords[words.at(-2) ?? ""] ?? 1;
}

function spokenAmount(value: string) {
  const normalized = normalizeVoiceText(value).replace(/[.,](?=\d{3}\b)/g, "");
  const numeric = normalized.match(/\b(\d+(?:[.,]\d+)?)\s*(trieu|tr|nghin|ngan|k)?\b/);
  if (numeric) {
    const base = Number(numeric[1]?.replace(",", "."));
    const unit = numeric[2];
    if (unit === "trieu" || unit === "tr") return base * 1_000_000;
    if (unit === "nghin" || unit === "ngan" || unit === "k") return base * 1_000;
    return base;
  }
  const values: Record<string, number> = { khong: 0, mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, lam: 5, sau: 6, bay: 7, tam: 8, chin: 9 };
  const tokens = normalized.split(" ");
  let base = 0;
  const hundred = tokens.indexOf("tram");
  const ten = tokens.indexOf("muoi");
  const ham = tokens.indexOf("ham");
  const bam = tokens.indexOf("bam");
  if (hundred > 0) {
    base = (values[tokens[hundred - 1] ?? ""] ?? 1) * 100;
    if (tokens[hundred + 1] === "ruoi") base += 50;
    else if (tokens[hundred + 1] === "linh" || tokens[hundred + 1] === "le") base += values[tokens[hundred + 2] ?? ""] ?? 0;
    else base += values[tokens[hundred + 1] ?? ""] ?? 0;
  } else if (ten > 0) base = (values[tokens[ten - 1] ?? ""] ?? 1) * 10 + (values[tokens[ten + 1] ?? ""] ?? 0);
  else if (ham >= 0) base = 20 + (values[tokens[ham + 1] ?? ""] ?? 0);
  else if (bam >= 0) base = 30 + (values[tokens[bam + 1] ?? ""] ?? 0);
  else {
    const word = tokens.find((token) => token in values);
    base = word ? values[word] ?? 0 : 0;
  }
  if (!base) return 0;
  if (normalized.includes("trieu")) return base * 1_000_000;
  if (normalized.includes("nghin") || normalized.includes("ngan") || normalized.includes(" k ")) return base * 1_000;
  return base >= 10 ? base * 1_000 : base;
}

function makeVoiceDraft(transcript: string, products: Product[]): CartItem[] {
  const spoken = normalizeVoiceText(transcript);
  const aliases: Record<string, string[]> = {
    "coffee-milk": ["ca phe sua", "cf sua", "ca phe nau"],
    "coffee-black": ["ca phe den", "cf den"],
    "bac-xiu": ["bac xiu"],
    "peach-tea": ["tra dao cam sa", "tra dao"],
    water: ["nuoc suoi"],
    avocado: ["sinh to bo"],
    "banh-mi": ["banh mi thit", "banh mi"],
    flan: ["banh flan", "flan"],
  };

  return products.filter((product) => product.active).flatMap((product) => {
    const productAliases = [...(aliases[product.id] ?? []), normalizeVoiceText(product.name)];
    const match = findSpokenPhrase(spoken, productAliases);
    if (match.index < 0) return [];
    const quantityText = spoken.slice(Math.max(0, match.index - 14), match.index);
    const quantity = voiceQuantity(quantityText);
    return [{ id: product.id, name: product.name, unit: product.unit, price: product.price, cost: product.cost, quantity }];
  });
}

function VoiceOrderButton({ onCommand, variant = "default" }: { onCommand: (transcript: string) => string; variant?: "default" | "fab" | "field" }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<BrowserRecognition | null>(null);
  const handledRef = useRef(false);
  const transcriptRef = useRef("");

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const handleTranscript = (transcript: string) => {
    if (handledRef.current || !transcript.trim()) return;
    handledRef.current = true;
    const reply = onCommand(transcript);
    if (reply) toast.message(reply);
  };

  const startVoiceOrder = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const speechWindow = window as typeof window & { SpeechRecognition?: BrowserRecognitionConstructor; webkitSpeechRecognition?: BrowserRecognitionConstructor };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      toast.error("Trình duyệt này chưa hỗ trợ nhận giọng nói. Hãy dùng Chrome hoặc nhập tay.");
      return;
    }
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "vi-VN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onstart = () => { handledRef.current = false; transcriptRef.current = ""; setListening(true); };
    recognition.onend = () => { setListening(false); if (!handledRef.current && transcriptRef.current) handleTranscript(transcriptRef.current); };
    recognition.onerror = ({ error }) => {
      const message = error === "not-allowed" || error === "service-not-allowed" ? "Hãy cho phép dùng micro trong trình duyệt rồi thử lại." : error === "audio-capture" ? "Không tìm thấy micro. Hãy kiểm tra thiết bị." : error === "network" ? "Nhận giọng nói cần kết nối mạng ổn định." : "Không nghe rõ. Bạn thử nói lại hoặc gõ câu bán hàng.";
      toast.error(message);
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
      transcriptRef.current = transcript;
      const finalResult = event.results[event.results.length - 1]?.isFinal;
      if (finalResult) handleTranscript(transcript);
    };
    try { recognition.start(); } catch { toast.error("Micro đang bận. Hãy thử lại sau một giây."); }
  };

  const variantClass = variant === "fab" ? "size-11 justify-center rounded-full p-0" : variant === "field" ? "size-10 justify-center rounded-xl p-0" : "h-11 gap-2 rounded-xl px-3 sm:px-4";
  return <button type="button" onClick={startVoiceOrder} className={`inline-flex items-center text-sm font-extrabold text-white shadow-sm transition ${variantClass} ${listening ? "animate-pulse bg-rose-500 hover:bg-rose-600" : "bg-sooi-green hover:bg-emerald-800"}`} aria-label={listening ? "Dừng ghi đơn bằng giọng nói" : "Ghi đơn bằng giọng nói"} title={listening ? "Đang nghe, bấm để dừng" : "Ghi đơn bằng giọng nói"}><Mic size={variant === "fab" ? 19 : 18} /><span className={variant === "default" ? "hidden sm:inline" : "hidden"}>{listening ? "Đang nghe…" : "Nói với Sổ"}</span></button>;
}

function Brand() { return <div className="flex items-center gap-3 px-2"><div className="grid size-11 place-items-center rounded-xl bg-sooi-green text-xl font-black text-white">ơ</div><div><p className="text-lg font-extrabold tracking-tight">Sổ ơi</p><p className="text-xs text-stone-500">Bán hàng dễ hơn</p></div></div>; }
function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) { return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${active ? "bg-emerald-50 text-sooi-green" : "text-stone-600 hover:bg-stone-100"}`}>{icon}{label}</button>; }

function HomeScreen({ summary, database, onSell, onCash, onDebt, onManage, onCommand }: { summary: ReturnType<typeof calculateSummary>; database: ReturnType<typeof useLedger>["database"]; onSell: () => void; onCash: () => void; onDebt: () => void; onManage: () => void; onCommand: (command: string) => string }) {
  const lowStock = database.products.filter((product) => product.active && product.stock <= product.lowStock);
  const urgentProduct = lowStock[0];

  return <div className="space-y-3.5 sm:space-y-6">
    <VoiceCommandCard onCommand={onCommand} />

    <section>
      <h2 className="text-[16px] font-black tracking-tight">VIỆC HÔM NAY</h2>
      <div className="mt-2 grid grid-cols-4 gap-2">
        <Action icon={<ShoppingCart />} label="Bán hàng" onClick={onSell} />
        <Action icon={<WalletCards />} label="Thu chi" onClick={onCash} />
        <Action icon={<ReceiptText />} label="Công nợ" onClick={onDebt} />
        <Action icon={<ScanLine />} label="Quét bảng giá" onClick={onManage} />
      </div>
    </section>

    <section className="relative overflow-hidden rounded-[20px] bg-[linear-gradient(145deg,#07966e,#00664f)] p-4 text-white shadow-lg shadow-emerald-950/10 sm:p-6">
      <div className="absolute -right-3 -top-4 size-20 rounded-full bg-white/8" />
      <div className="absolute right-3 top-3 size-8 rounded-full bg-emerald-950/20" />
      <span className="inline-flex rounded-full bg-white/15 px-2 py-1 text-[9px] font-extrabold">Sổ chủ động</span>
      <p className="mt-2 text-[11px] font-bold text-emerald-100">SỔ SÁNG · {String(new Date().getHours()).padStart(2, "0")}:{String(new Date().getMinutes()).padStart(2, "0")}</p>
      <h2 className="mt-1 text-[22px] font-black leading-tight tracking-[-0.03em] sm:text-3xl">Mở sổ cho một ngày mới.</h2>
      <p className="mt-2 max-w-2xl text-[11px] leading-4 text-emerald-50 sm:text-sm sm:leading-6">{urgentProduct ? `Việc nên làm trước: ${urgentProduct.name} chỉ đủ khoảng 6 ngày. Đang có ${formatMoneyShort(summary.openDebt)} công nợ cần để mắt tới.` : "Tồn kho đang ổn. Sổ sẽ nhắc ngay khi có món cần nhập thêm."}</p>
      <div className="mt-4 grid grid-cols-3 border-t border-white/25 pt-3">
        <Metric label="Doanh thu" value={formatMoneyShort(summary.revenue)} />
        <Metric label="Tiền lãi" value={formatMoneyShort(summary.profit)} />
        <Metric label="Đơn" value={String(summary.orders)} />
      </div>
    </section>

    <section>
      <div className="flex items-end justify-between"><SectionTitle title="Sổ thấy việc này" subtitle="Một việc đáng chú ý hôm nay." /><button onClick={onManage} className="text-[10px] font-extrabold text-sooi-green">Tất cả ›</button></div>
      <div className="mt-2 rounded-2xl border border-amber-200 bg-[#fffdf8] p-3.5">
        {urgentProduct ? <><div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-sooi-green"><Package size={18} /></span><div><p className="text-[12px] font-extrabold">{urgentProduct.name} chỉ đủ khoảng 6 ngày</p><p className="mt-1 text-[10px] leading-4 text-stone-500">Còn {urgentProduct.stock} {urgentProduct.unit}. Dựa trên nhịp bán gần nhất, Sổ gợi ý nhập khoảng {Math.max(urgentProduct.lowStock * 2 - urgentProduct.stock, urgentProduct.lowStock)} {urgentProduct.unit} để đủ gần 7 ngày.</p></div></div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={onManage} className="h-10 rounded-xl bg-emerald-100 text-[11px] font-extrabold text-sooi-green">Nhập gợi ý</button><button className="h-10 rounded-xl border border-stone-200 bg-white text-[11px] font-extrabold">Để mai</button></div></> : <Empty text="Hôm nay chưa có việc tồn kho cần xử lý." />}
      </div>
    </section>

    <section>
      <div className="flex items-end justify-between"><SectionTitle title="Hôm nay" subtitle="Ba con số đủ để nắm nhịp." /><button onClick={() => toast.message("Mở mục Báo cáo để xem chi tiết.")} className="text-[10px] font-extrabold text-sooi-green">Chi tiết</button></div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <MiniMetric label="Đã thu về" value={formatMoneyShort(summary.collected)} />
        <MiniMetric label="Chi" value={formatMoneyShort(summary.expense)} />
        <MiniMetric label="Khách còn nợ" value={formatMoneyShort(summary.openDebt)} />
      </div>
    </section>

    <section>
      <div className="flex items-end justify-between"><SectionTitle title="Gần đây" subtitle="Giao dịch mới nhất." /><button onClick={onSell} className="text-[10px] font-extrabold text-sooi-green">Xem tất cả</button></div>
      <div className="mt-2 rounded-2xl border border-stone-200 bg-white px-4 py-3">
        {database.orders.length ? <div className="divide-y divide-stone-100">{database.orders.slice(0, 3).map((order) => <div key={order.id} className="flex items-center justify-between py-3"><div><p className="text-xs font-extrabold">{order.customerName}</p><p className="mt-0.5 text-[10px] text-stone-500">{order.number} · {order.method === "debt" ? "Ghi nợ" : "Đã thanh toán"}</p></div><span className="text-xs font-extrabold">{formatMoney(order.total)}</span></div>)}</div> : <div className="py-5 text-center"><p className="text-xs font-extrabold text-stone-500">Chưa có đơn hôm nay</p><p className="mt-1 text-[10px] text-stone-400">Thử nói “bán 2 cà phê sữa 25 nghìn”.</p></div>}
      </div>
    </section>
  </div>;
}

function VoiceCommandCard({ onCommand }: { onCommand: (command: string) => string }) {
  const [command, setCommand] = useState("");
  const [reply, setReply] = useState("");
  const submit = () => {
    const value = command.trim();
    if (!value) { toast.error("Hãy nói hoặc nhập một câu bán hàng."); return; }
    setReply(onCommand(value));
  };

  return <section className="rounded-[18px] border border-stone-200 bg-white p-3 shadow-sm sm:p-5">
    <p className="text-[9px] font-extrabold text-sooi-green">Nói với Sổ ơi</p>
    <h2 className="text-[16px] font-black">Sổ ơi, mình làm gì?</h2>
    <p className="mt-0.5 text-[10px] text-stone-500">Nói tự nhiên. Sổ sẽ hiểu và làm phần còn lại.</p>
    <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-stone-50 p-1">
      <input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submit(); }} className="h-9 min-w-0 flex-1 bg-transparent px-2 text-[11px] outline-none" placeholder="Ví dụ: bán chị Lan 2 cà phê sữa..." aria-label="Nói hoặc nhập lệnh cho Sổ Ơi" />
      <VoiceOrderButton onCommand={(value) => { const response = onCommand(value); setCommand(value); setReply(response); return ""; }} variant="field" />
      <button onClick={submit} className="grid size-10 shrink-0 place-items-center rounded-xl bg-sooi-green text-white" aria-label="Thực hiện lệnh"><ArrowRight size={18} /></button>
    </div>
    <div className="mt-2 flex flex-wrap gap-1.5">{["Hôm nay bán bao nhiêu?", "Ai đang nợ?", "Món nào sắp hết?"].map((item) => <button key={item} onClick={() => { setCommand(item); setReply(onCommand(item)); }} className="rounded-full bg-stone-100 px-2.5 py-1.5 text-[9px] font-semibold text-stone-500">{item}</button>)}</div>
    {reply && <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-semibold leading-4 text-emerald-800" aria-live="polite">{reply}</div>}
  </section>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-stone-200 bg-white p-3"><p className="text-[9px] font-semibold text-stone-500">{label}</p><p className="mt-1 text-[15px] font-black">{value}</p></div>;
}

function SellScreen({ products, categories, category, query, onCategory, onQuery, onAdd }: { products: Product[]; categories: string[]; category: string; query: string; onCategory: (value: string) => void; onQuery: (value: string) => void; onAdd: (product: Product) => void }) { return <div><SectionTitle title="Bán hàng" subtitle="Chạm vào món để thêm ngay vào đơn." /><div className="relative mt-5"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={19} /><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Tìm món…" className="h-12 w-full rounded-xl border border-stone-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" /></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1">{categories.map((item) => <button key={item} onClick={() => onCategory(item)} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold ${category === item ? "bg-sooi-green text-white" : "border border-stone-200 bg-white text-stone-600"}`}>{item}</button>)}</div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{products.map((product) => <button key={product.id} onClick={() => onAdd(product)} className="group min-h-40 rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-sooi-green"><Coffee size={20} /></span>{product.stock <= product.lowStock && <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-700">Sắp hết</span>}</div><p className="mt-6 font-extrabold">{product.name}</p><p className="mt-1 text-xs text-stone-500">Còn {product.stock} {product.unit}</p><p className="mt-3 text-lg font-extrabold text-sooi-green">{formatMoney(product.price)}</p></button>)}</div>{!products.length && <Empty text="Không tìm thấy món phù hợp." />}</div>; }

function CashScreen({ database, onCreate }: { database: ReturnType<typeof useLedger>["database"]; onCreate: () => void }) { const entries = database.cashEntries.filter((entry) => entry.date === today()); return <div><div className="flex items-start justify-between"><SectionTitle title="Sổ thu chi" subtitle="Các khoản ngoài doanh thu bán hàng." /><button onClick={onCreate} className="inline-flex h-11 items-center gap-2 rounded-xl bg-sooi-green px-4 text-sm font-bold text-white"><Plus size={18} />Ghi khoản</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><StatCard icon={<TrendingDown />} label="Tổng chi hôm nay" value={formatMoney(entries.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0))} tone="red" /><StatCard icon={<TrendingUp />} label="Thu khác hôm nay" value={formatMoney(entries.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0))} tone="green" /></div><div className="mt-5 rounded-2xl border border-stone-200 bg-white p-5"><SectionTitle title="Giao dịch hôm nay" subtitle="" />{entries.length ? <div className="divide-y divide-stone-100">{entries.map((entry) => <div key={entry.id} className="flex items-center gap-3 py-3"><div className={`grid size-10 place-items-center rounded-xl ${entry.type === "expense" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>{entry.type === "expense" ? <TrendingDown size={18} /> : <TrendingUp size={18} />}</div><div className="min-w-0 flex-1"><p className="truncate font-bold">{entry.category}</p><p className="truncate text-xs text-stone-500">{entry.note}</p></div><strong className={entry.type === "expense" ? "text-red-600" : "text-emerald-700"}>{entry.type === "expense" ? "−" : "+"}{formatMoney(entry.amount)}</strong></div>)}</div> : <Empty text="Chưa có khoản thu chi nào hôm nay." />}</div></div>; }

function ReportScreen({ summary, database }: { summary: ReturnType<typeof calculateSummary>; database: ReturnType<typeof useLedger>["database"] }) { const sold = database.orders.flatMap((order) => order.items).reduce<Record<string, number>>((map, item) => ({ ...map, [item.name]: (map[item.name] ?? 0) + item.quantity }), {}); const best = Object.entries(sold).sort(([, a], [, b]) => b - a).slice(0, 4); return <div><SectionTitle title="Báo cáo hôm nay" subtitle="Con số quan trọng, không làm rối mắt." /><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard icon={<ReceiptText />} label="Doanh thu" value={formatMoney(summary.revenue)} tone="green" /><StatCard icon={<CreditCard />} label="Đã thu" value={formatMoney(summary.collected)} tone="blue" /><StatCard icon={<TrendingDown />} label="Chi phí" value={formatMoney(summary.expense)} tone="red" /><StatCard icon={<TrendingUp />} label="Tiền lời" value={formatMoney(summary.profit)} tone="green" /></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-stone-200 bg-white p-5"><SectionTitle title="Công nợ đang mở" subtitle="Tổng các đơn ghi nợ chưa thu đủ." /><p className="mt-5 text-3xl font-extrabold text-amber-700">{formatMoney(summary.openDebt)}</p><p className="mt-1 text-sm text-stone-500">Sổ sẽ tự cập nhật khi ghi nhận khách trả nợ.</p></div><div className="rounded-2xl border border-stone-200 bg-white p-5"><SectionTitle title="Bán chạy" subtitle="Tổng số lượng trong các đơn đã tạo." />{best.length ? <div className="mt-2 divide-y divide-stone-100">{best.map(([name, quantity], index) => <div className="flex items-center gap-3 py-3" key={name}><span className="grid size-7 place-items-center rounded-lg bg-emerald-50 text-xs font-extrabold text-sooi-green">{index + 1}</span><p className="flex-1 font-bold">{name}</p><strong>{quantity} món</strong></div>)}</div> : <Empty text="Dữ liệu bán chạy sẽ xuất hiện sau đơn đầu tiên." />}</div></div></div>; }

function ManageScreen({ database, onSettings, onReset, onCreate, onExport, onToggle }: { database: ReturnType<typeof useLedger>["database"]; onSettings: () => void; onReset: () => void; onCreate: () => void; onExport: () => void; onToggle: (id: string) => void }) {
  return <div>
    <div className="flex items-start justify-between gap-3"><SectionTitle title="Quản lý cửa hàng" subtitle="Thiết lập và dữ liệu phục vụ bán hàng." /><button onClick={onCreate} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-sooi-green px-3 text-xs font-extrabold text-white"><Plus size={16} />Thêm món</button></div>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-xs font-bold tracking-[0.14em] text-stone-400">TỒN KHO</p><p className="mt-2 text-lg font-extrabold">{database.store.allowNegativeStock ? "Cho phép bán âm kho" : "Chặn bán âm kho"}</p><p className="mt-1 text-sm text-stone-500">Sổ kiểm tra tồn trước khi thanh toán để tránh bán quá số lượng hiện có.</p><button onClick={onSettings} className="mt-5 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-bold text-sooi-deep hover:bg-stone-50">{database.store.allowNegativeStock ? "Bật chặn bán âm" : "Cho phép bán âm"}</button></div>
      <div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-xs font-bold tracking-[0.14em] text-stone-400">SAO LƯU</p><p className="mt-2 text-lg font-extrabold">Dữ liệu local-first</p><p className="mt-1 text-sm text-stone-500">Hiện có {database.products.length} sản phẩm, {database.customers.length} khách hàng và {database.orders.length} đơn.</p><button onClick={onExport} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-sooi-green"><Download size={16} />Xuất bản sao JSON</button></div>
    </div>
    <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-5"><div className="flex items-center justify-between"><SectionTitle title="Sản phẩm" subtitle="Bảng giá và trạng thái đang bán." /><button onClick={onCreate} className="text-xs font-extrabold text-sooi-green">+ Thêm</button></div><div className="mt-3 grid gap-2 md:grid-cols-2">{database.products.map((product) => <div key={product.id} className={`flex items-center justify-between rounded-xl px-3 py-3 ${product.active ? "bg-stone-50" : "bg-stone-100 opacity-55"}`}><div className="min-w-0"><p className="truncate font-bold">{product.name}</p><p className="text-xs text-stone-500">{product.stock} {product.unit} · vốn {formatMoney(product.cost)}</p></div><div className="ml-3 text-right"><strong className="block text-sooi-green">{formatMoney(product.price)}</strong><button onClick={() => onToggle(product.id)} className="mt-1 text-[10px] font-bold text-stone-500">{product.active ? "Đang bán" : "Đã dừng"}</button></div></div>)}</div></div>
    <button onClick={onReset} className="mt-5 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50">Khôi phục dữ liệu mẫu</button>
  </div>;
}

function CartSheet({ cart, total, subtotal, discount, customerId, method, customers, onClose, onQuantity, onDiscount, onCustomer, onMethod, onCheckout }: { cart: CartItem[]; total: number; subtotal: number; discount: number; customerId: string; method: PaymentMethod; customers: { id: string; name: string }[]; onClose: () => void; onQuantity: (id: string, change: number) => void; onDiscount: (value: number) => void; onCustomer: (value: string) => void; onMethod: (value: PaymentMethod) => void; onCheckout: () => void }) { return <Modal title="Đơn hàng" onClose={onClose}>{!cart.length ? <Empty text="Giỏ hàng đang trống." /> : <><div className="space-y-3">{cart.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl bg-stone-50 p-3"><div className="min-w-0 flex-1"><p className="font-bold">{item.name}</p><p className="text-xs text-stone-500">{formatMoney(item.price)} / {item.unit}</p></div><div className="flex items-center rounded-lg border border-stone-200 bg-white"><button className="p-2 text-stone-600" onClick={() => onQuantity(item.id, -1)}><Minus size={16} /></button><span className="w-7 text-center text-sm font-bold">{item.quantity}</span><button className="p-2 text-sooi-green" onClick={() => onQuantity(item.id, 1)}><Plus size={16} /></button></div><strong className="w-20 text-right">{formatMoney(item.price * item.quantity)}</strong></div>)}</div><div className="mt-5 grid gap-3"><label className="text-sm font-bold">Khách hàng<select value={customerId} onChange={(event) => onCustomer(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 font-normal outline-none focus:border-emerald-500"><option value="">Khách lẻ</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label className="text-sm font-bold">Giảm giá (đồng)<input type="number" min="0" value={discount || ""} onChange={(event) => onDiscount(Number(event.target.value) || 0)} className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 font-normal outline-none focus:border-emerald-500" placeholder="0" /></label></div><div className="mt-5 grid grid-cols-3 gap-2">{(["cash", "transfer", "debt"] as PaymentMethod[]).map((item) => <button key={item} onClick={() => onMethod(item)} className={`rounded-xl border px-2 py-3 text-xs font-bold ${method === item ? "border-sooi-green bg-emerald-50 text-sooi-green" : "border-stone-200 bg-white text-stone-600"}`}>{item === "cash" ? "Tiền mặt" : item === "transfer" ? "Chuyển khoản" : "Ghi nợ"}</button>)}</div><div className="mt-5 rounded-xl bg-sooi-deep p-4 text-white"><div className="flex justify-between text-sm text-emerald-100"><span>Tiền hàng</span><span>{formatMoney(subtotal)}</span></div>{discount > 0 && <div className="mt-2 flex justify-between text-sm text-emerald-100"><span>Giảm giá</span><span>−{formatMoney(discount)}</span></div>}<div className="mt-3 flex justify-between border-t border-white/15 pt-3 text-lg font-extrabold"><span>Khách trả</span><span>{formatMoney(total)}</span></div></div><button onClick={onCheckout} className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-sooi-green text-sm font-extrabold text-white hover:bg-emerald-800">Hoàn tất đơn</button></>}</Modal>; }

function DebtSheet({ type, customerId, customerName, amount, note, customers, onType, onCustomerId, onCustomerName, onAmount, onNote, onClose, onSubmit }: { type: "debt" | "payment"; customerId: string; customerName: string; amount: string; note: string; customers: { id: string; name: string }[]; onType: (value: "debt" | "payment") => void; onCustomerId: (value: string) => void; onCustomerName: (value: string) => void; onAmount: (value: string) => void; onNote: (value: string) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <Modal title="Công nợ khách hàng" onClose={onClose}><form onSubmit={onSubmit} className="space-y-4"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => onType("debt")} className={`rounded-xl border p-3 text-sm font-bold ${type === "debt" ? "border-amber-300 bg-amber-50 text-amber-700" : "border-stone-200"}`}>Ghi khách nợ</button><button type="button" onClick={() => onType("payment")} className={`rounded-xl border p-3 text-sm font-bold ${type === "payment" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-stone-200"}`}>Khách trả nợ</button></div><label className="block text-sm font-bold">Khách quen<select value={customerId} onChange={(event) => { onCustomerId(event.target.value); const customer = customers.find((item) => item.id === event.target.value); if (customer) onCustomerName(customer.name); }} className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 font-normal outline-none focus:border-emerald-500"><option value="">Nhập tên khác</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>{!customerId && <label className="block text-sm font-bold">Tên khách<input value={customerName} onChange={(event) => onCustomerName(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 font-normal outline-none focus:border-emerald-500" placeholder="Ví dụ: Chị Mai" /></label>}<label className="block text-sm font-bold">Số tiền<input inputMode="numeric" type="number" min="1" value={amount} onChange={(event) => onAmount(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 font-normal outline-none focus:border-emerald-500" placeholder="200000" /></label><label className="block text-sm font-bold">Ghi chú<input value={note} onChange={(event) => onNote(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 font-normal outline-none focus:border-emerald-500" placeholder="Ví dụ: lấy hàng ngày 28/9" /></label><button className="flex h-12 w-full items-center justify-center rounded-xl bg-sooi-green text-sm font-extrabold text-white">{type === "debt" ? "Lưu công nợ" : "Xác nhận đã trả"}</button></form></Modal>; }

function ProductSheet({ name, price, cost, stock, category, onName, onPrice, onCost, onStock, onCategory, onClose, onSubmit }: { name: string; price: string; cost: string; stock: string; category: string; onName: (value: string) => void; onPrice: (value: string) => void; onCost: (value: string) => void; onStock: (value: string) => void; onCategory: (value: string) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <Modal title="Thêm sản phẩm" onClose={onClose}><form onSubmit={onSubmit} className="space-y-4"><label className="block text-sm font-bold">Tên sản phẩm<input autoFocus value={name} onChange={(event) => onName(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 font-normal outline-none focus:border-emerald-500" placeholder="Ví dụ: Cà phê muối" /></label><label className="block text-sm font-bold">Nhóm hàng<input value={category} onChange={(event) => onCategory(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 font-normal outline-none focus:border-emerald-500" /></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-bold">Giá bán<input inputMode="numeric" type="number" min="1" value={price} onChange={(event) => onPrice(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 font-normal outline-none focus:border-emerald-500" placeholder="25000" /></label><label className="block text-sm font-bold">Giá vốn<input inputMode="numeric" type="number" min="0" value={cost} onChange={(event) => onCost(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 font-normal outline-none focus:border-emerald-500" placeholder="10000" /></label></div><label className="block text-sm font-bold">Tồn kho ban đầu<input inputMode="numeric" type="number" min="0" value={stock} onChange={(event) => onStock(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 font-normal outline-none focus:border-emerald-500" placeholder="50" /></label><button className="flex h-12 w-full items-center justify-center rounded-xl bg-sooi-green text-sm font-extrabold text-white">Lưu sản phẩm</button></form></Modal>; }

function CashSheet({ cashType, category, amount, note, onClose, onType, onCategory, onAmount, onNote, onSubmit }: { cashType: CashType; category: string; amount: string; note: string; onClose: () => void; onType: (value: CashType) => void; onCategory: (value: string) => void; onAmount: (value: string) => void; onNote: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <Modal title="Ghi thu chi" onClose={onClose}><form onSubmit={onSubmit} className="space-y-4"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => onType("expense")} className={`rounded-xl border p-3 text-sm font-bold ${cashType === "expense" ? "border-red-300 bg-red-50 text-red-700" : "border-stone-200"}`}>Khoản chi</button><button type="button" onClick={() => onType("income")} className={`rounded-xl border p-3 text-sm font-bold ${cashType === "income" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-stone-200"}`}>Khoản thu</button></div><label className="block text-sm font-bold">Khoản mục<input value={category} onChange={(event) => onCategory(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 font-normal outline-none focus:border-emerald-500" /></label><label className="block text-sm font-bold">Số tiền<input autoFocus inputMode="numeric" type="number" min="1" value={amount} onChange={(event) => onAmount(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 font-normal outline-none focus:border-emerald-500" placeholder="Ví dụ: 850000" /></label><label className="block text-sm font-bold">Ghi chú<input value={note} onChange={(event) => onNote(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 font-normal outline-none focus:border-emerald-500" placeholder="Ví dụ: tiền điện tháng này" /></label><button className="flex h-12 w-full items-center justify-center rounded-xl bg-sooi-green text-sm font-extrabold text-white">Lưu giao dịch</button></form></Modal>; }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-30 bg-stone-950/45 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={title}><div className="mx-auto mt-auto max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-sooi-card shadow-2xl sm:mt-[8vh]"><div className="sticky top-0 flex items-center justify-between border-b border-stone-100 bg-sooi-card px-5 py-4"><h2 className="text-lg font-extrabold">{title}</h2><button onClick={onClose} className="grid size-9 place-items-center rounded-xl text-stone-500 hover:bg-stone-100" aria-label="Đóng"><X size={19} /></button></div><div className="p-5">{children}</div></div></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] font-semibold text-emerald-100">{label}</p><p className="mt-1 text-base font-extrabold">{value}</p></div>; }
function Action({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) { return <button onClick={onClick} className="flex min-h-[58px] flex-col items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-1.5 py-2 text-[9px] font-extrabold shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 sm:min-h-28 sm:gap-2 sm:rounded-2xl sm:p-4 sm:text-sm"><span className="grid size-7 place-items-center rounded-lg bg-emerald-50 text-sooi-green sm:size-10 sm:rounded-xl">{icon}</span>{label}</button>; }
function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) { return <div><h2 className="text-[16px] font-black tracking-tight sm:text-lg">{title}</h2>{subtitle && <p className="mt-0.5 text-[9px] text-stone-500 sm:mt-1 sm:text-sm">{subtitle}</p>}</div>; }
function Empty({ text }: { text: string }) { return <div className="py-8 text-center text-sm text-stone-500">{text}</div>; }
function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "green" | "red" | "blue" }) { const classes = { green: "bg-emerald-50 text-emerald-700", red: "bg-red-50 text-red-600", blue: "bg-blue-50 text-blue-600" }; return <div className="rounded-2xl border border-stone-200 bg-white p-4"><div className={`grid size-10 place-items-center rounded-xl ${classes[tone]}`}>{icon}</div><p className="mt-4 text-xs font-bold text-stone-500">{label}</p><p className="mt-1 text-xl font-extrabold tracking-tight">{value}</p></div>; }

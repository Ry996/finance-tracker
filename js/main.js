/* =========================
   Storage + Utilities
========================= */
const STORAGE_KEY = "finance_records_v1";
const CATEGORIES_KEY = "finance_categories_v1";

const DEFAULT_CATEGORIES = [
  { id: "salary", name: "Salary" },
  { id: "food", name: "Food" },
  { id: "transport", name: "Transport" },
  { id: "rent", name: "Rent" },
  { id: "study", name: "Study" },
  { id: "entertainment", name: "Entertainment" },
  { id: "other", name: "Other" },
];

function safeParseJSON(raw, fallback) {
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

function loadRecords() {
  return safeParseJSON(localStorage.getItem(STORAGE_KEY), []);
}
function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function loadCategories() {
  const saved = safeParseJSON(localStorage.getItem(CATEGORIES_KEY), null);
  if (Array.isArray(saved) && saved.length) return saved;
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES));
  return DEFAULT_CATEGORIES.slice();
}
function saveCategories(cats) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
}

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return `$${num.toFixed(2)}`;
}

function typeLabel(t) { return t === "income" ? "Income" : "Expense"; }

function calcBalance(records) {
  let balance = 0;
  for (const r of records) balance += (r.type === "income" ? r.amount : -r.amount);
  return balance;
}

function toISODate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isSameMonth(dateStr, year, monthIndex) {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T00:00:00");
  return d.getFullYear() === year && d.getMonth() === monthIndex;
}

function monthKeyFromISO(dateStr) {
  // YYYY-MM
  if (!dateStr || dateStr.length < 7) return "";
  return dateStr.slice(0, 7);
}

function getMonthOptionsFromRecords(records) {
  const set = new Set();
  for (const r of records) {
    const mk = monthKeyFromISO(r.date);
    if (mk) set.add(mk);
  }
  const arr = Array.from(set);
  arr.sort((a, b) => b.localeCompare(a));
  return arr;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function setActiveNav() {
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll("nav a").forEach(a => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (href === path) a.setAttribute("aria-current", "page");
  });
}

/* =========================
   Page: Add (add.html)
========================= */
function initAddPage() {
  const form = document.getElementById("record-form");
  if (!form) return;

  const categoryEl = document.getElementById("category");
  const amountEl = document.getElementById("amount");
  const dateEl = document.getElementById("date");
  const noteEl = document.getElementById("note");
  const previewText = document.getElementById("preview-text");
  const balanceText = document.getElementById("balance-text");
  const msgEl = document.getElementById("message");

  // Populate categories
  const cats = loadCategories();
  categoryEl.innerHTML = `<option value="">-- Select a category --</option>` +
    cats.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`).join("");

  if (!dateEl.value) dateEl.value = toISODate();

  function getType() {
    const checked = form.querySelector('input[name="type"]:checked');
    return checked ? checked.value : "expense";
  }

  function readDraft() {
    return {
      type: getType(),
      category: categoryEl.value.trim(),
      amount: Number(amountEl.value),
      date: dateEl.value,
      note: noteEl.value.trim(),
    };
  }

  function showMessage(text, isError = false) {
    msgEl.textContent = text;
    msgEl.className = "notice " + (isError ? "err" : "ok");
  }

  function categoryNameById(id) {
    const list = loadCategories();
    const found = list.find(c => c.id === id);
    return found ? found.name : (id || "—");
  }

  function updatePreview() {
    const records = loadRecords();
    const draft = readDraft();

    const typeText = typeLabel(draft.type);
    const categoryText = draft.category ? categoryNameById(draft.category) : "—";
    const amountText = Number.isFinite(draft.amount) ? formatMoney(draft.amount) : "—";
    const dateText = draft.date || "—";
    const noteText = draft.note || "—";

    previewText.textContent = `${typeText} | ${categoryText} | ${amountText} | ${dateText} | Note: ${noteText}`;

    const current = calcBalance(records);
    if (draft.category && Number.isFinite(draft.amount) && draft.amount > 0 && draft.date) {
      const estimated = draft.type === "income" ? current + draft.amount : current - draft.amount;
      balanceText.textContent = `Estimated balance after save: ${formatMoney(estimated)}`;
    } else {
      balanceText.textContent = `Estimated balance after save: ${formatMoney(current)} (fill required fields to estimate)`;
    }
  }

  form.addEventListener("input", updatePreview);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    showMessage("");

    const draft = readDraft();

    if (!draft.category) {
      showMessage("Please select a category.", true);
      categoryEl.focus();
      return;
    }
    if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
      showMessage("Amount must be a number greater than 0.", true);
      amountEl.focus();
      return;
    }
    if (!draft.date) {
      showMessage("Please choose a date.", true);
      dateEl.focus();
      return;
    }

    const record = {
      id: Date.now().toString(),
      type: draft.type,
      category: draft.category,
      amount: Number(draft.amount.toFixed(2)),
      date: draft.date,
      note: draft.note,
      createdAt: new Date().toISOString(),
    };

    const records = loadRecords();
    records.push(record);
    saveRecords(records);

    showMessage("Saved! Record added successfully.");

    // Reset
    amountEl.value = "";
    noteEl.value = "";
    categoryEl.value = "";
    form.querySelector('input[name="type"][value="expense"]').checked = true;
    dateEl.value = toISODate();

    updatePreview();
  });

  updatePreview();
}

/* =========================
   Page: Home (index.html)
========================= */
function initHomePage() {
  const incomeEl = document.getElementById("total-income");
  if (!incomeEl) return;

  const expenseEl = document.getElementById("total-expense");
  const balanceEl = document.getElementById("balance");
  const tbody = document.getElementById("recent-body");
  const msgEl = document.getElementById("home-message");

  const cats = loadCategories();
  const catMap = new Map(cats.map(c => [c.id, c.name]));

  function render() {
    const records = loadRecords();

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    let income = 0, expense = 0;
    for (const r of records) {
      if (!isSameMonth(r.date, y, m)) continue;
      if (r.type === "income") income += r.amount;
      else expense += r.amount;
    }

    incomeEl.textContent = formatMoney(income);
    expenseEl.textContent = formatMoney(expense);
    balanceEl.textContent = formatMoney(calcBalance(records));

    const sorted = [...records].sort((a, b) => Number(b.id) - Number(a.id));
    const recent = sorted.slice(0, 5);

    tbody.innerHTML = "";
    if (!recent.length) {
      tbody.innerHTML = `<tr><td colspan="6">No records yet. Go to Add page to create one.</td></tr>`;
      return;
    }

    for (const r of recent) {
      const catName = catMap.get(r.category) || r.category || "—";
      const note = r.note ? escapeHTML(r.note) : "—";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHTML(r.date || "—")}</td>
        <td>${escapeHTML(typeLabel(r.type))}</td>
        <td>${escapeHTML(catName)}</td>
        <td>${escapeHTML(formatMoney(r.amount))}</td>
        <td>${note}</td>
        <td><button class="danger" data-id="${escapeHTML(r.id)}">Delete</button></td>
      `;
      tbody.appendChild(tr);
    }
  }

  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    if (!id) return;
    if (!confirm("Delete this record?")) return;

    const updated = loadRecords().filter(r => r.id !== id);
    saveRecords(updated);

    msgEl.textContent = "Deleted.";
    msgEl.className = "notice ok";
    render();
  });

  render();
}

/* =========================
   Page: Records (records.html)
========================= */
function initRecordsPage() {
  const tbody = document.getElementById("records-body");
  if (!tbody) return;

  const monthEl = document.getElementById("filter-month");
  const typeEl = document.getElementById("filter-type");
  const catEl = document.getElementById("filter-category");
  const msgEl = document.getElementById("records-message");

  function fillFilters() {
    const records = loadRecords();
    const months = getMonthOptionsFromRecords(records);
    const cats = loadCategories();

    monthEl.innerHTML = `<option value="">All months</option>` +
      months.map(m => `<option value="${escapeHTML(m)}">${escapeHTML(m)}</option>`).join("");

    catEl.innerHTML = `<option value="">All categories</option>` +
      cats.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`).join("");
  }

  function categoryNameById(id) {
    const list = loadCategories();
    const found = list.find(c => c.id === id);
    return found ? found.name : (id || "—");
  }

  function getFiltered(records) {
    const mk = monthEl.value;
    const t = typeEl.value;
    const c = catEl.value;

    return records.filter(r => {
      if (mk && monthKeyFromISO(r.date) !== mk) return false;
      if (t && r.type !== t) return false;
      if (c && r.category !== c) return false;
      return true;
    });
  }

  function render() {
    const records = loadRecords().sort((a, b) => Number(b.id) - Number(a.id));
    const filtered = getFiltered(records);

    tbody.innerHTML = "";
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6">No records found for current filters.</td></tr>`;
      return;
    }

    for (const r of filtered) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHTML(r.date || "—")}</td>
        <td>${escapeHTML(typeLabel(r.type))}</td>
        <td>${escapeHTML(categoryNameById(r.category))}</td>
        <td>${escapeHTML(formatMoney(r.amount))}</td>
        <td>${r.note ? escapeHTML(r.note) : "—"}</td>
        <td><button class="danger" data-id="${escapeHTML(r.id)}">Delete</button></td>
      `;
      tbody.appendChild(tr);
    }
  }

  document.getElementById("filters")?.addEventListener("change", render);

  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    if (!id) return;
    if (!confirm("Delete this record?")) return;

    const updated = loadRecords().filter(r => r.id !== id);
    saveRecords(updated);

    msgEl.textContent = "Deleted.";
    msgEl.className = "notice ok";

    fillFilters();
    render();
  });

  fillFilters();
  render();
}

/* =========================
   Page: Categories (categories.html)
========================= */
function initCategoriesPage() {
  const listEl = document.getElementById("categories-list");
  if (!listEl) return;

  const form = document.getElementById("category-form");
  const input = document.getElementById("new-category");
  const msgEl = document.getElementById("categories-message");

  function slugify(name) {
    return name.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function show(text, isErr = false) {
    msgEl.textContent = text;
    msgEl.className = "notice " + (isErr ? "err" : "ok");
  }

  function render() {
    const cats = loadCategories();
    listEl.innerHTML = "";

    for (const c of cats) {
      const li = document.createElement("li");
      li.className = "card";
      li.innerHTML = `
        <div class="inline" style="justify-content: space-between;">
          <div>
            <strong>${escapeHTML(c.name)}</strong><br/>
            <small>ID: ${escapeHTML(c.id)}</small>
          </div>
          <button class="danger" data-id="${escapeHTML(c.id)}">Delete</button>
        </div>
      `;
      listEl.appendChild(li);
    }
  }

  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    if (!id) return;

    // prevent deleting if any record uses it (optional safety)
    const used = loadRecords().some(r => r.category === id);
    if (used) {
      show("Cannot delete: this category is used by existing records.", true);
      return;
    }

    if (!confirm("Delete this category?")) return;

    const updated = loadCategories().filter(c => c.id !== id);
    if (!updated.length) {
      show("You must keep at least one category.", true);
      return;
    }
    saveCategories(updated);
    show("Deleted.");
    render();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    show("");

    const name = input.value.trim();
    if (!name) {
      show("Category name cannot be empty.", true);
      input.focus();
      return;
    }

    const id = slugify(name);
    if (!id) {
      show("Category name is invalid.", true);
      input.focus();
      return;
    }

    const cats = loadCategories();
    if (cats.some(c => c.id === id || c.name.toLowerCase() === name.toLowerCase())) {
      show("Category already exists.", true);
      input.focus();
      return;
    }

    cats.push({ id, name });
    saveCategories(cats);

    input.value = "";
    show("Added!");
    render();
  });

  render();
}

/* =========================
   Page: Stats (stats.html) - Canvas
========================= */
function initStatsPage() {
  const canvas = document.getElementById("chart");
  if (!canvas) return;

  const monthEl = document.getElementById("stats-month");
  const modeEl = document.getElementById("stats-mode");
  const summaryEl = document.getElementById("stats-summary");

  const ctx = canvas.getContext("2d");

  function resizeCanvas() {
    // HiDPI-ish: set canvas size to match displayed width
    const displayWidth = Math.min(900, canvas.parentElement?.clientWidth || 900);
    const displayHeight = 360;
    canvas.width = Math.floor(displayWidth * 1.0);
    canvas.height = Math.floor(displayHeight * 1.0);
  }

  function fillMonthOptions() {
    const records = loadRecords();
    const months = getMonthOptionsFromRecords(records);

    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const opts = new Set(months);
    opts.add(current);

    const arr = Array.from(opts);
    arr.sort((a, b) => b.localeCompare(a));

    monthEl.innerHTML = arr.map(m => `<option value="${escapeHTML(m)}">${escapeHTML(m)}</option>`).join("");
    monthEl.value = current;
  }

  function getMonthRecords(monthKey) {
    return loadRecords().filter(r => monthKeyFromISO(r.date) === monthKey);
  }

  function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawAxes() {
    // Simple frame
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  }

  function drawBarChart(income, expense) {
    clear();
    drawAxes();

    const w = canvas.width;
    const h = canvas.height;
    const pad = 50;
    const baseY = h - pad;

    const maxVal = Math.max(income, expense, 1);
    const barMaxHeight = h - pad * 2;

    const barW = 120;
    const gap = 90;
    const startX = Math.max(pad, (w - (barW * 2 + gap)) / 2);

    function barHeight(v) {
      return (v / maxVal) * barMaxHeight;
    }

    // Income
    let bh = barHeight(income);
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(startX, baseY - bh, barW, bh);

    // Expense
    bh = barHeight(expense);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(startX + barW + gap, baseY - bh, barW, bh);

    // Labels
    ctx.fillStyle = "#111827";
    ctx.font = "14px Arial";
    ctx.fillText("Income", startX, baseY + 22);
    ctx.fillText("Expense", startX + barW + gap, baseY + 22);

    ctx.fillText(formatMoney(income), startX, baseY - barHeight(income) - 8);
    ctx.fillText(formatMoney(expense), startX + barW + gap, baseY - barHeight(expense) - 8);
  }

  function drawPieChartByCategory(records) {
    clear();
    drawAxes();

    const cats = loadCategories();
    const catMap = new Map(cats.map(c => [c.id, c.name]));

    // Sum expenses by category
    const sums = new Map();
    let total = 0;
    for (const r of records) {
      if (r.type !== "expense") continue;
      const key = r.category || "other";
      const v = Number(r.amount) || 0;
      total += v;
      sums.set(key, (sums.get(key) || 0) + v);
    }

    const entries = Array.from(sums.entries()).sort((a, b) => b[1] - a[1]);
    if (total <= 0 || entries.length === 0) {
      ctx.fillStyle = "#111827";
      ctx.font = "16px Arial";
      ctx.fillText("No expense data for pie chart.", 30, 60);
      return;
    }

    const cx = Math.floor(canvas.width * 0.32);
    const cy = Math.floor(canvas.height * 0.52);
    const r = Math.min(canvas.width, canvas.height) * 0.28;

    // Basic palette
    const palette = ["#2563eb","#ef4444","#22c55e","#f59e0b","#8b5cf6","#06b6d4","#64748b","#e11d48"];

    let angle = -Math.PI / 2;
    entries.forEach(([catId, val], i) => {
      const slice = (val / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = palette[i % palette.length];
      ctx.fill();
      angle += slice;
    });

    // Legend
    ctx.font = "13px Arial";
    ctx.fillStyle = "#111827";
    let x = Math.floor(canvas.width * 0.62);
    let y = 60;
    entries.slice(0, 8).forEach(([catId, val], i) => {
      ctx.fillStyle = palette[i % palette.length];
      ctx.fillRect(x, y - 10, 12, 12);
      ctx.fillStyle = "#111827";
      const name = catMap.get(catId) || catId;
      ctx.fillText(`${name}: ${formatMoney(val)}`, x + 18, y);
      y += 22;
    });

    ctx.fillStyle = "#111827";
    ctx.fillText(`Total expense: ${formatMoney(total)}`, x, y + 12);
  }

  function render() {
    resizeCanvas();

    const mk = monthEl.value;
    const mode = modeEl.value;
    const records = getMonthRecords(mk);

    let income = 0, expense = 0;
    for (const r of records) {
      if (r.type === "income") income += r.amount;
      else if (r.type === "expense") expense += r.amount;
    }

    const topExpenseCat = (() => {
      const sums = new Map();
      for (const r of records) {
        if (r.type !== "expense") continue;
        sums.set(r.category, (sums.get(r.category) || 0) + r.amount);
      }
      let best = null;
      for (const [k, v] of sums.entries()) {
        if (!best || v > best.v) best = { k, v };
      }
      if (!best) return "—";
      const cats = loadCategories();
      const found = cats.find(c => c.id === best.k);
      return found ? `${found.name} (${formatMoney(best.v)})` : `${best.k} (${formatMoney(best.v)})`;
    })();

    summaryEl.textContent = `Month ${mk} — Income: ${formatMoney(income)} | Expense: ${formatMoney(expense)} | Top expense: ${topExpenseCat}`;

    if (mode === "bar") drawBarChart(income, expense);
    else drawPieChartByCategory(records);
  }

  window.addEventListener("resize", () => render());

  fillMonthOptions();
  monthEl.addEventListener("change", render);
  modeEl.addEventListener("change", render);

  render();
}

/* =========================
   Boot
========================= */
document.addEventListener("DOMContentLoaded", () => {
  setActiveNav();
  // Ensure categories exist
  loadCategories();

  initAddPage();
  initHomePage();
  initRecordsPage();
  initCategoriesPage();
  initStatsPage();
});

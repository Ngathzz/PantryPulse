/* Safe DOM & Event Helpers */
const $ = (s) => document.querySelector(s);
const onClick = (id, fn) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", fn);
};
const onInput = (id, fn) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", fn);
};
const onChange = (id, fn) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", fn);
};

/* Safe Clipboard Copy (Works on HTTPS, localhost, HTTP, and file://) */
async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {}
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

/* 1. Embedded PWA Icon, Manifest & Offline Service Worker */
(function initPWA() {
  try {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="40" fill="#465945"/><rect x="44" y="38" width="104" height="116" rx="16" fill="#fcfbf8"/><rect x="64" y="26" width="64" height="18" rx="6" fill="#cbbba4"/><path d="M66 96h16l8-18 12 36 8-18h16" fill="none" stroke="#465945" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const iconUrl =
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    const iconEl = document.getElementById("app-icon");
    const manEl = document.getElementById("app-manifest");
    if (iconEl) iconEl.href = iconUrl;
    if (manEl) {
      const manifest = {
        name: "PantryPulse Kitchen Manager",
        short_name: "PantryPulse",
        start_url: "./index.html",
        display: "standalone",
        background_color: "#f4f3ef",
        theme_color: "#465945",
        icons: [{ src: iconUrl, sizes: "192x192", type: "image/svg+xml" }],
      };
      manEl.href = URL.createObjectURL(
        new Blob([JSON.stringify(manifest)], {
          type: "application/manifest+json",
        }),
      );
    }
    if (
      "serviceWorker" in navigator &&
      (location.protocol === "https:" ||
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1")
    ) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  } catch (e) {}
})();

/* 2. Storage Wrapper & Store Presets */
const mem = {};
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : (mem[k] ?? d);
    } catch (e) {
      return mem[k] ?? d;
    }
  },
  set(k, v) {
    mem[k] = v;
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  },
};
const STORES = {
  naivas: { name: "Naivas", url: "https://www.naivas.online/search?term={q}" },
  carrefour: {
    name: "Carrefour",
    url: "https://www.carrefour.ke/mafken/en/v4/search?keyword={q}",
  },
  jumia: { name: "Jumia", url: "https://www.jumia.co.ke/catalog/?q={q}" },
  amazon: { name: "Amazon", url: "https://www.amazon.com/s?k={q}" },
  walmart: { name: "Walmart", url: "https://www.walmart.com/search?q={q}" },
  instacart: {
    name: "Instacart",
    url: "https://www.instacart.com/store/s?k={q}",
  },
  gshop: {
    name: "Google",
    url: "https://www.google.com/search?tbm=shop&q={q}",
  },
};
const VALID_STORES = new Set([...Object.keys(STORES), "custom"]);
const VALID_CURRENCIES = new Set([
  "KSh",
  "USD",
  "EUR",
  "GBP",
  "UGX",
  "TZS",
  "NGN",
  "ZAR",
]);

/* 3. Data Sanitization, URL Safety & Schema Validation */
const roundQty = (n) => Math.round(Math.max(0, +n || 0) * 1000) / 1000;
const makeId = (existing = []) => {
  let id;
  do {
    id = "PP-" + Math.random().toString(36).slice(2, 7).toUpperCase();
  } while (existing.some((i) => i.id === id));
  return id;
};

function sanitizeUrl(raw) {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.href
      : "";
  } catch (e) {
    return "";
  }
}

function sanitizeExp(raw) {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return "";
  const y = +m[1],
    mo = +m[2],
    d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  )
    return "";
  return s;
}

function normalizeItem(raw, existing = []) {
  if (!raw || typeof raw !== "object") return null;
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 60) : "";
  if (!name) return null;
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : makeId(existing);
  return {
    id,
    name,
    zone: typeof raw.zone === "string" ? raw.zone.trim().slice(0, 32) : "",
    qty: roundQty(raw.qty),
    unit: typeof raw.unit === "string" ? raw.unit.trim().slice(0, 16) : "",
    min: roundQty(raw.min),
    step: Math.max(0.01, +raw.step || 1),
    price: Math.max(0, +raw.price || 0),
    exp: sanitizeExp(raw.exp),
    barcode:
      typeof raw.barcode === "string"
        ? raw.barcode.trim().toUpperCase().slice(0, 32)
        : "",
    url: sanitizeUrl(raw.url),
    ordered: Boolean(raw.ordered),
    updatedAt: Number(raw.updatedAt) || Date.now(),
  };
}

function normalizeItems(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const clean = normalizeItem(raw, out);
    if (clean && !out.some((x) => x.id === clean.id)) out.push(clean);
  }
  return out;
}

function normalizeDeletedMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const cutoff = Date.now() - 90 * 864e5;
  const out = {};
  for (const [id, ts] of Object.entries(raw)) {
    const numTs = Number(ts);
    if (
      typeof id === "string" &&
      id.trim() &&
      Number.isFinite(numTs) &&
      numTs > cutoff
    ) {
      out[id.trim()] = numTs;
    }
  }
  return out;
}

function normalizeRecipients(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(
      (r) =>
        r &&
        typeof r === "object" &&
        typeof r.name === "string" &&
        typeof r.contact === "string",
    )
    .map((r) => ({
      name: r.name.trim().slice(0, 40),
      contact: r.contact.trim().slice(0, 60),
    }))
    .filter((r) => r.name && r.contact);
}

function sanitizeCfg(rawCfg, baseCfg) {
  if (!rawCfg || typeof rawCfg !== "object") return baseCfg;
  const next = Object.assign({}, baseCfg);
  if (rawCfg.freq === "weekly" || rawCfg.freq === "monthly")
    next.freq = rawCfg.freq;
  if (Number.isFinite(Number(rawCfg.last)) && Number(rawCfg.last) > 0)
    next.last = Number(rawCfg.last);
  if (typeof rawCfg.store === "string" && VALID_STORES.has(rawCfg.store))
    next.store = rawCfg.store;
  if (typeof rawCfg.customUrl === "string")
    next.customUrl = sanitizeUrl(rawCfg.customUrl);
  if (
    typeof rawCfg.currency === "string" &&
    VALID_CURRENCIES.has(rawCfg.currency)
  )
    next.currency = rawCfg.currency;
  if (typeof rawCfg.sound === "boolean") next.sound = rawCfg.sound;
  if (Array.isArray(rawCfg.recipients)) {
    next.recipients = normalizeRecipients(rawCfg.recipients);
    next.recipientsUpdatedAt = Number(rawCfg.recipientsUpdatedAt) || Date.now();
  }
  if (typeof rawCfg.sbUrl === "string") next.sbUrl = sanitizeUrl(rawCfg.sbUrl);
  if (typeof rawCfg.sbKey === "string")
    next.sbKey = rawCfg.sbKey.trim().slice(0, 512);
  if (typeof rawCfg.sbRoom === "string")
    next.sbRoom = rawCfg.sbRoom.trim().slice(0, 64);
  if (typeof rawCfg.aiEndpoint === "string")
    next.aiEndpoint = sanitizeUrl(rawCfg.aiEndpoint);
  return next;
}

/* 4. Kitchen Manager State */
const defaultCfg = {
  freq: "weekly",
  last: Date.now(),
  store: "naivas",
  customUrl: "",
  currency: "KSh",
  recipients: [],
  recipientsUpdatedAt: 0,
  sound: true,
  sbUrl: "",
  sbKey: "",
  sbRoom: "",
  lastSyncAt: "",
  localUpdatedAt: 0,
  aiEndpoint: "",
};
const storedCfg = store.get("pp:cfg", {});
let cfg = sanitizeCfg(storedCfg, defaultCfg);
if (typeof storedCfg?.lastSyncAt === "string")
  cfg.lastSyncAt = storedCfg.lastSyncAt;
if (Number.isFinite(Number(storedCfg?.localUpdatedAt)))
  cfg.localUpdatedAt = Number(storedCfg.localUpdatedAt);

let deletedItems = normalizeDeletedMap(store.get("pp:deleted", {}));
let items = normalizeItems(store.get("pp:items", [])).filter(
  (i) => !(deletedItems[i.id] && deletedItems[i.id] >= (i.updatedAt || 0)),
);

let scanMode = "use",
  curId = null,
  editId = null,
  activeZone = "",
  extDetected = false,
  audioCtx = null;
let syncTimer = null,
  syncState = "idle",
  syncErrorMsg = "",
  syncBusy = false,
  syncQueued = false;
let lookupSeq = 0,
  lookupAbort = null;

/* 5. Inventory & Math Helpers */
const getStep = (i) => Math.max(0.01, +i.step || 1);
const low = (i) => i.qty <= i.min;
const unbought = (i) => low(i) && !i.ordered;
const orderQty = (i) => {
  const s = getStep(i),
    d = Math.max(s, i.min - i.qty + s);
  return roundQty(Math.ceil(d / s) * s);
};
const cartPacks = (i) => Math.max(1, Math.round(orderQty(i) / getStep(i)));
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const newId = () => makeId(items);
const nextDue = () => cfg.last + (cfg.freq === "weekly" ? 7 : 30) * 864e5;
const fmt = (t) =>
  new Date(t).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
const fmtMoney = (v) =>
  `${cfg.currency} ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const isEmail = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);
const formatKePhone = (p) => {
  const d = String(p).replace(/[^\d]/g, "");
  if (d.startsWith("0") && d.length === 10) return "254" + d.slice(1);
  if (d.startsWith("254") && d.length === 12) return d;
  return d;
};

function expiryStatus(exp) {
  const clean = sanitizeExp(exp);
  if (!clean) return null;
  const p = clean.split("-").map(Number);
  const days = Math.ceil(
    (new Date(p[0], p[1] - 1, p[2]).getTime() -
      new Date().setHours(0, 0, 0, 0)) /
      864e5,
  );
  if (days < 0) return { type: "exp", label: "Expired" };
  if (days <= 7)
    return {
      type: "soon",
      label: days === 0 ? "Expires today" : `Use soon (${days}d)`,
    };
  return null;
}

function updateSyncIndicator(statusText = "") {
  const badge = $("#syncBadge"),
    st = $("#syncStatus");
  if (!cfg.sbUrl || !cfg.sbKey || !cfg.sbRoom) {
    if (badge) {
      badge.textContent = "";
      badge.style.color = "";
    }
    if (st && statusText) st.textContent = statusText;
    return;
  }
  if (syncState === "error") {
    if (badge) {
      badge.textContent = "● Sync error";
      badge.style.color = "var(--exp)";
    }
    if (st) {
      st.textContent = statusText || `Sync failed: ${syncErrorMsg}`;
      st.style.color = "var(--exp)";
    }
  } else if (syncState === "syncing") {
    if (badge) {
      badge.textContent = "● Syncing…";
      badge.style.color = "var(--warn)";
    }
    if (st) {
      st.textContent = statusText || "Syncing with household room…";
      st.style.color = "";
    }
  } else {
    if (badge) {
      badge.textContent = "● Synced";
      badge.style.color = "var(--accent)";
    }
    if (st && statusText) {
      st.textContent = statusText;
      st.style.color = "var(--accent)";
    }
  }
}

function save(pushCloud = true) {
  if (pushCloud) cfg.localUpdatedAt = Date.now();
  deletedItems = normalizeDeletedMap(deletedItems);
  store.set("pp:items", items);
  store.set("pp:deleted", deletedItems);
  store.set("pp:cfg", cfg);
  if (pushCloud && cfg.sbUrl && cfg.sbKey && cfg.sbRoom) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      pushSync();
    }, 800);
  }
}

/* 6. Audio Chimes & Verified Extension Handshake */
function unlockAudio() {
  try {
    audioCtx =
      audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (e) {}
}
function chime(ok = true) {
  try {
    if (navigator.vibrate) navigator.vibrate(ok ? 60 : [80, 50, 80]);
    if (!cfg.sound) return;
    unlockAudio();
    if (!audioCtx) return;
    const now = audioCtx.currentTime,
      osc = audioCtx.createOscillator(),
      gain = audioCtx.createGain();
    osc.type = ok ? "sine" : "triangle";
    osc.frequency.setValueAtTime(ok ? 880 : 230, now);
    if (ok) osc.frequency.setValueAtTime(1174.66, now + 0.08);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (ok ? 0.2 : 0.28));
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + (ok ? 0.21 : 0.29));
  } catch (e) {}
}

(function initExtensionBridge() {
  const challenge =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);

  window.addEventListener("message", (e) => {
    if (
      e.source === window &&
      e.origin === window.location.origin &&
      e.data?.source === "PantryPulseExt" &&
      e.data?.action === "PONG" &&
      typeof e.data?.extensionId === "string" &&
      e.data.extensionId.length >= 16 &&
      e.data?.challenge === challenge
    ) {
      extDetected = true;
      render();
    }
  });
  window.postMessage(
    { source: "PantryPulse", action: "PING", challenge },
    window.location.origin || "*",
  );
})();

function shopUrl(item) {
  const safeDirect = sanitizeUrl(item.url);
  if (safeDirect) return safeDirect;
  const q = encodeURIComponent(item.name);
  const safeCustom = sanitizeUrl(cfg.customUrl);
  const tpl =
    cfg.store === "custom"
      ? safeCustom || STORES.gshop.url
      : STORES[cfg.store]?.url || STORES.gshop.url;
  const built = tpl.includes("{q}") ? tpl.replace(/\{q\}/g, q) : tpl + q;
  return sanitizeUrl(built) || STORES.gshop.url.replace("{q}", q);
}

function formattedList() {
  const toBuy = items.filter(unbought);
  if (!toBuy.length) return "";
  const groups = {};
  toBuy.forEach((i) => {
    const z = i.zone || "General";
    (groups[z] = groups[z] || []).push(i);
  });
  let lines = ["PantryPulse Restock List:"];
  Object.entries(groups).forEach(([z, list]) => {
    lines.push(`\n[${z}]`);
    list.forEach((i) => {
      const p = i.price > 0 ? ` · ~${fmtMoney(cartPacks(i) * i.price)}` : "";
      lines.push(
        `• ${i.name} — need ${orderQty(i)}${i.unit ? " " + i.unit : ""}${p}`,
      );
    });
  });
  return lines.join("\n");
}

/* 7. Main Render Loop */
function render() {
  const usedZones = [
    ...new Set(items.map((i) => i.zone).filter(Boolean)),
  ].sort();
  if (activeZone && !usedZones.includes(activeZone)) activeZone = "";
  if ($("#zFilter")) {
    $("#zFilter").innerHTML =
      '<option value="">All zones</option>' +
      usedZones
        .map((z) => `<option value="${esc(z)}">${esc(z)}</option>`)
        .join("");
    $("#zFilter").value = activeZone;
  }

  const q = ($("#q")?.value || "").toLowerCase();
  const filtered = items.filter(
    (i) =>
      (!activeZone || i.zone === activeZone) &&
      (i.name.toLowerCase().includes(q) ||
        (i.barcode || "").toLowerCase().includes(q) ||
        (i.zone || "").toLowerCase().includes(q)),
  );

  if ($("#list")) {
    $("#list").innerHTML = filtered.length
      ? filtered
          .map((i) => {
            const s = getStep(i),
              exp = expiryStatus(i.exp),
              tags = [];
            if (i.zone)
              tags.push(`<span class="tag zone">${esc(i.zone)}</span>`);
            if (low(i))
              tags.push(
                i.ordered
                  ? '<span class="tag ord">Ordered</span>'
                  : '<span class="tag">Low stock</span>',
              );
            if (exp)
              tags.push(
                `<span class="tag ${exp.type === "exp" ? "exp" : ""}">${esc(exp.label)}</span>`,
              );
            const meta = [
              i.id,
              i.barcode ? `EAN ${esc(i.barcode)}` : "",
              `Alert ≤ ${i.min}${i.unit ? " " + esc(i.unit) : ""}`,
              i.price > 0 ? fmtMoney(i.price) : "",
            ]
              .filter(Boolean)
              .join(" · ");
            return `<li class="card${low(i) ? " low" : ""}">
        <div class="info"><strong>${esc(i.name)}</strong><span class="mute">${meta}</span>${tags.length ? `<div class="tags">${tags.join("")}</div>` : ""}</div>
        <div class="qty">
          <button type="button" data-a="dec" data-id="${i.id}" aria-label="Decrease">−${s !== 1 ? s : ""}</button>
          <output>${i.qty}${i.unit ? '<small class="mute"> ' + esc(i.unit) + "</small>" : ""}</output>
          <button type="button" data-a="inc" data-id="${i.id}" aria-label="Increase">+${s !== 1 ? s : ""}</button>
        </div>
        <div class="acts">
          <button type="button" class="ghost" data-a="edit" data-id="${i.id}">Edit</button>
          <button type="button" class="ghost" data-a="qr" data-id="${i.id}">QR sticker</button>
          <button type="button" class="ghost" data-a="del" data-id="${i.id}">Delete</button>
        </div>
      </li>`;
          })
          .join("")
      : `<li class="empty">${items.length ? "No matching items." : 'No items yet. Add one above or <button type="button" class="ghost" id="demo">load sample items</button>'}</li>`;
  }

  if ($("#count"))
    $("#count").textContent = items.length ? `${items.length} items` : "";
  if ($("#soundToggle")) {
    $("#soundToggle").textContent = cfg.sound ? "Sound: On" : "Sound: Off";
    $("#soundToggle").setAttribute("aria-pressed", !!cfg.sound);
  }
  if ($("#autoOrder"))
    $("#autoOrder").textContent = extDetected
      ? "Auto-fill cart"
      : "Open store tabs";

  const need = items.filter(low),
    toBuy = items.filter(unbought);
  if ($("#rlistWrap")) {
    if (!need.length) {
      $("#rlistWrap").innerHTML =
        '<div class="empty">Everything is stocked up!</div>';
      if ($("#estTotal")) $("#estTotal").style.display = "none";
    } else {
      const groups = {};
      need.forEach((i) => {
        const z = i.zone || "General";
        (groups[z] = groups[z] || []).push(i);
      });
      $("#rlistWrap").innerHTML = Object.entries(groups)
        .map(([zoneName, gItems]) => {
          const sorted = [
            ...gItems.filter((i) => !i.ordered),
            ...gItems.filter((i) => i.ordered),
          ];
          const cards = sorted
            .map((i) => {
              const lineEst =
                i.price > 0 ? ` · ~${fmtMoney(cartPacks(i) * i.price)}` : "";
              return `<li class="card${i.ordered ? " ordered" : ""}">
            <div class="info"><strong>${esc(i.name)}</strong><span class="mute">${i.ordered ? "Ordered · dimmed until restocked" : "Buy " + orderQty(i) + (i.unit ? " " + esc(i.unit) : "") + lineEst}</span></div>
            <div class="shop-acts">
              <button type="button" class="ghost" data-ord="${i.id}" aria-pressed="${!!i.ordered}">${i.ordered ? "✓ Ordered" : "Dim"}</button>
              <a class="ghost" href="${esc(shopUrl(i))}" target="_blank" rel="noopener noreferrer">Shop ↗</a>
            </div>
          </li>`;
            })
            .join("");
          return `<h3>${esc(zoneName)}</h3><ul>${cards}</ul>`;
        })
        .join("");
      const priced = toBuy.filter((i) => i.price > 0),
        estSum = priced.reduce(
          (sum, i) => sum + cartPacks(i) * (+i.price || 0),
          0,
        );
      if ($("#estTotal")) {
        if (priced.length) {
          $("#estTotal").style.display = "flex";
          $("#estTotal").innerHTML =
            `<span>Estimated total (${priced.length}/${toBuy.length} priced)</span><strong>${fmtMoney(estSum)}</strong>`;
        } else $("#estTotal").style.display = "none";
      }
    }
  }

  if ($("#currency")) $("#currency").value = cfg.currency || "KSh";
  if ($("#store")) $("#store").value = cfg.store || "naivas";
  if ($("#customWrap"))
    $("#customWrap").style.display = cfg.store === "custom" ? "flex" : "none";
  if ($("#customUrl")) $("#customUrl").value = cfg.customUrl || "";
  if ($("#freq")) $("#freq").value = cfg.freq;
  if ($("#sbUrl")) $("#sbUrl").value = cfg.sbUrl || "";
  if ($("#sbKey")) $("#sbKey").value = cfg.sbKey || "";
  if ($("#sbRoom")) $("#sbRoom").value = cfg.sbRoom || "";
  updateSyncIndicator();
  if ($("#due"))
    $("#due").textContent =
      "Next review: " +
      fmt(nextDue()) +
      (Date.now() >= nextDue() ? " (due now)" : "");

  if ($("#recipList")) {
    $("#recipList").innerHTML = cfg.recipients
      .map((r, idx) => {
        const ph = !isEmail(r.contact) ? formatKePhone(r.contact) : "";
        const wa =
          ph.length >= 9
            ? `<button type="button" class="ghost" data-wa="${esc(ph)}" style="min-height:34px;padding:4px 10px">WhatsApp ↗</button>`
            : "";
        return `<div class="pill"><div><strong>${esc(r.name)}</strong> <span class="mute">· ${esc(r.contact)}</span></div><div class="row" style="gap:6px">${wa}<button type="button" class="ghost" data-rdel="${idx}" style="min-height:34px;padding:4px 10px">×</button></div></div>`;
      })
      .join("");
  }

  const expiringCount = items.filter((i) => expiryStatus(i.exp)).length,
    alerts = [];
  if (toBuy.length)
    alerts.push(
      `${toBuy.length} item${toBuy.length > 1 ? "s" : ""} low in stock`,
    );
  if (expiringCount) alerts.push(`${expiringCount} expiring soon`);
  const b = $("#banner");
  if (b) {
    if (alerts.length) {
      b.style.display = "block";
      b.textContent = alerts.join(" · ") + ".";
    } else b.style.display = "none";
  }
}

/* 8. Navigation, CRUD & QR Sticker Printing */
document.querySelectorAll("nav button").forEach((b) =>
  b.addEventListener("click", () => {
    document
      .querySelectorAll("nav button")
      .forEach((x) => x.setAttribute("aria-selected", x === b));
    document
      .querySelectorAll("section")
      .forEach((s) => s.classList.toggle("on", s.id === b.dataset.tab));
    if (b.dataset.tab !== "scan") stopCam();
  }),
);

onClick("add", () => {
  const nameEl = $("#name");
  const name = (nameEl?.value || "").trim();
  if (!name) return nameEl?.focus();
  const clean = normalizeItem(
    {
      id: newId(),
      name,
      unit: $("#unit")?.value,
      qty: $("#qty")?.value,
      min: $("#min")?.value,
      step: $("#step")?.value,
      zone: $("#zone")?.value,
      price: $("#price")?.value,
      exp: $("#exp")?.value,
      barcode: $("#barcode")?.value,
      ordered: false,
      updatedAt: Date.now(),
    },
    items,
  );
  if (clean) {
    delete deletedItems[clean.id];
    items.unshift(clean);
  }
  if (nameEl) nameEl.value = "";
  if ($("#unit")) $("#unit").value = "";
  if ($("#barcode")) $("#barcode").value = "";
  if ($("#exp")) $("#exp").value = "";
  if ($("#price")) $("#price").value = "";
  if ($("#step")) $("#step").value = "1";
  save();
  render();
});

onInput("q", render);
onChange("zFilter", (e) => {
  activeZone = e.target.value;
  render();
});
onClick("list", (e) => {
  if (e.target.id === "demo") {
    [
      {
        name: "Basmati Rice",
        qty: 2000,
        min: 1000,
        step: 500,
        unit: "g",
        zone: "Dry Pantry",
        price: 380,
      },
      {
        name: "Cooking Oil",
        qty: 1,
        min: 1,
        step: 1,
        unit: "L",
        zone: "Spices & Oils",
        price: 340,
      },
      {
        name: "Fresh Milk",
        qty: 1,
        min: 2,
        step: 1,
        unit: "packs",
        zone: "Fridge",
        price: 70,
        exp: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
      },
      {
        name: "Green Tea",
        qty: 1,
        min: 2,
        step: 1,
        unit: "boxes",
        zone: "Beverages",
        price: 220,
      },
    ].forEach((x) => {
      const c = normalizeItem(x, items);
      if (c) items.push(c);
    });
    save();
    return render();
  }
  const d = e.target.closest("[data-a]");
  if (!d) return;
  const it = items.find((i) => i.id === d.dataset.id);
  if (!it) return;
  const a = d.dataset.a,
    s = getStep(it);
  if (a === "inc") {
    it.qty = roundQty(it.qty + s);
    if (!low(it)) it.ordered = false;
    it.updatedAt = Date.now();
  }
  if (a === "dec") {
    it.qty = roundQty(it.qty - s);
    it.updatedAt = Date.now();
  }
  if (a === "del") {
    if (!confirm("Delete " + it.name + "?")) return;
    deletedItems[it.id] = Date.now();
    items = items.filter((i) => i !== it);
  }
  if (a === "qr") return showQR(it);
  if (a === "edit") {
    editId = it.id;
    $("#eName").value = it.name;
    $("#eUnit").value = it.unit || "";
    $("#eStep").value = getStep(it);
    $("#eMin").value = it.min;
    $("#ePrice").value = it.price || "";
    $("#eZone").value = it.zone || "";
    $("#eExp").value = it.exp || "";
    $("#eBarcode").value = it.barcode || "";
    $("#eUrl").value = it.url || "";
    return $("#editDlg")?.showModal();
  }
  save();
  render();
});

onClick("eCancel", () => $("#editDlg")?.close());
onClick("eSave", () => {
  const it = items.find((i) => i.id === editId);
  if (it) {
    const nm = $("#eName").value.trim();
    if (nm) it.name = nm;
    it.unit = $("#eUnit").value.trim();
    it.step = Math.max(0.01, +$("#eStep").value || 1);
    it.min = roundQty($("#eMin").value);
    it.price = Math.max(0, +$("#ePrice").value || 0);
    it.zone = $("#eZone").value.trim();
    it.exp = sanitizeExp($("#eExp").value);
    it.barcode = $("#eBarcode").value.trim().toUpperCase();
    const rawUrl = $("#eUrl").value.trim();
    const safeUrl = sanitizeUrl(rawUrl);
    if (rawUrl && !safeUrl) {
      alert(
        "Direct product URL must start with http:// or https://. Clearing unsafe URL.",
      );
    }
    it.url = safeUrl;
    if (!low(it)) it.ordered = false;
    it.updatedAt = Date.now();
    save();
    render();
  }
  $("#editDlg")?.close();
});

function makeQR(el, text, size) {
  if (!el) return;
  el.innerHTML = "";
  if (typeof window.QRCode === "function") {
    try {
      new window.QRCode(el, {
        text,
        width: size,
        height: size,
        correctLevel: window.QRCode.CorrectLevel.M,
      });
      return;
    } catch (e) {}
  }
  el.innerHTML = `<div style="border:2px solid var(--ink);padding:8px 12px;border-radius:8px;font-family:monospace;font-weight:700">${esc(text)}<div class="mute" style="font-family:system-ui;font-weight:400;font-size:11px">QR image offline — type code to scan</div></div>`;
}
function showQR(it) {
  curId = it.id;
  if ($("#dname")) $("#dname").textContent = it.name;
  if ($("#did")) $("#did").textContent = it.id;
  makeQR($("#big"), it.id, 200);
  $("#dlg")?.showModal();
}
onClick("dclose", () => $("#dlg")?.close());
onClick("dprint", () => {
  const it = items.find((i) => i.id === curId);
  $("#dlg")?.close();
  if (it) printLabels([it]);
});
onClick("printAll", () =>
  items.length ? printLabels(items) : alert("Add some items first."),
);
function printLabels(arr) {
  if (!$("#sheet")) return;
  $("#sheet").innerHTML = arr
    .map(
      (i) =>
        `<div class="lab"><div class="qr" data-t="${i.id}"></div><b>${esc(i.name)}</b><small>${i.id}</small></div>`,
    )
    .join("");
  $("#sheet")
    .querySelectorAll(".qr")
    .forEach((el) => makeQR(el, el.dataset.t, 110));
  setTimeout(() => window.print(), 200);
}

/* 9. Camera (HTTPS-checked) & Race-Safe Retail Barcode Lookup */
function setScanMode(m) {
  scanMode = m;
  $("#mUse")?.setAttribute("aria-pressed", m === "use");
  $("#mAdd")?.setAttribute("aria-pressed", m === "add");
}
onClick("mUse", () => setScanMode("use"));
onClick("mAdd", () => setScanMode("add"));
onClick("soundToggle", () => {
  cfg.sound = !cfg.sound;
  if (cfg.sound) chime(true);
  save(false);
  render();
});

async function lookupRetailBarcode(code) {
  const box = $("#unknownBox");
  if (!box) return;
  const reqId = ++lookupSeq;
  if (lookupAbort) {
    try {
      lookupAbort.abort();
    } catch (e) {}
  }
  lookupAbort =
    typeof AbortController !== "undefined" ? new AbortController() : null;

  box.style.display = "block";
  box.innerHTML = `<div class="mute">Unknown barcode <b>${esc(code)}</b> — checking Open Food Facts…</div>`;
  let guessedName = "";
  if (/^\d{8,14}$/.test(code)) {
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands`,
        lookupAbort ? { signal: lookupAbort.signal } : {},
      );
      const data = await res.json();
      if (reqId !== lookupSeq) return;
      if (data.status === 1 && data.product) {
        guessedName = [
          (data.product.brands || "").split(",")[0].trim(),
          (data.product.product_name || "").trim(),
        ]
          .filter(Boolean)
          .join(" ")
          .slice(0, 40);
      }
    } catch (e) {
      if (reqId !== lookupSeq) return;
    }
  }
  if (reqId !== lookupSeq) return;
  box.innerHTML = `<strong style="display:block;margin-bottom:6px">New Product (${esc(code)})</strong><div class="row"><input id="uName" value="${esc(guessedName)}" placeholder="Product name" maxlength="40" style="flex:2 1 150px"><input id="uZone" list="zones" placeholder="Zone (e.g. Fridge)" style="flex:1 1 110px"><input id="uQty" type="number" step="any" min="0" value="1" style="flex:0 0 68px"><button type="button" class="btn" id="uSave">Add</button></div>`;
  onClick("uSave", () => {
    const nm = ($("#uName")?.value || "").trim();
    if (!nm) return $("#uName")?.focus();
    const clean = normalizeItem(
      {
        id: newId(),
        name: nm,
        unit: "pcs",
        qty: $("#uQty")?.value,
        min: 1,
        step: 1,
        zone: $("#uZone")?.value,
        barcode: code,
      },
      items,
    );
    if (clean) items.unshift(clean);
    save();
    render();
    box.style.display = "none";
    if ($("#msg")) $("#msg").textContent = `Added ${nm} (${code}).`;
    chime(true);
  });
}

function handleScan(raw) {
  const c = String(raw).trim().toUpperCase();
  if (!c) return;
  const it =
    items.find((i) => i.id === c) ||
    items.find((i) => (i.barcode || "").toUpperCase() === c) ||
    items.find((i) => i.name.toUpperCase() === c);
  if (!it) {
    chime(false);
    if ($("#msg"))
      $("#msg").textContent = "No existing item for “" + raw + "”.";
    lookupRetailBarcode(c);
    return;
  }
  ++lookupSeq;
  if (lookupAbort) {
    try {
      lookupAbort.abort();
    } catch (e) {}
  }
  if ($("#unknownBox")) $("#unknownBox").style.display = "none";
  const s = getStep(it);
  it.qty = roundQty(it.qty + (scanMode === "use" ? -s : s));
  if (!low(it)) it.ordered = false;
  it.updatedAt = Date.now();
  save();
  render();
  chime(true);
  if ($("#msg"))
    $("#msg").textContent =
      `${it.name}: ${it.qty}${it.unit ? " " + it.unit : ""} left` +
      (low(it) ? " — time to restock." : ".");
}
onClick("go", () => {
  unlockAudio();
  handleScan($("#code")?.value || "");
  if ($("#code")) $("#code").value = "";
});
if ($("#code"))
  $("#code").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#go")?.click();
  });

let stream = null,
  timer = null,
  lastCode = "",
  lastAt = 0;
function onDetected(raw) {
  if (raw && (raw !== lastCode || Date.now() - lastAt > 2500)) {
    lastCode = raw;
    lastAt = Date.now();
    handleScan(raw);
  }
}
async function startCam() {
  unlockAudio();
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    if ($("#msg"))
      $("#msg").textContent =
        "Camera requires HTTPS or localhost (cannot run on plain HTTP or file://). Use a USB scanner or type the code above.";
    return;
  }
  const hasNative = "BarcodeDetector" in window;
  const hasJsQR = typeof window.jsQR === "function";
  if (!hasNative && !hasJsQR) {
    if ($("#msg"))
      $("#msg").textContent =
        "Browser QR scanner library is unavailable offline. Use a handheld scanner or type the code above.";
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    const v = $("#vid");
    if (!v) return;
    v.srcObject = stream;
    v.style.display = "block";
    await v.play();
    if ($("#cam")) $("#cam").textContent = "Stop camera";
    if (hasNative) {
      let formats = ["qr_code"];
      if (BarcodeDetector.getSupportedFormats) {
        const sup = await BarcodeDetector.getSupportedFormats();
        formats = [
          "qr_code",
          "ean_13",
          "ean_8",
          "upc_a",
          "upc_e",
          "code_128",
        ].filter((f) => sup.includes(f));
      }
      const det = new BarcodeDetector({ formats });
      timer = setInterval(async () => {
        try {
          const r = await det.detect(v);
          if (r[0]) onDetected(r[0].rawValue);
        } catch (e) {}
      }, 350);
    } else if (hasJsQR) {
      const canvas = document.createElement("canvas"),
        ctx = canvas.getContext("2d", { willReadFrequently: true });
      timer = setInterval(() => {
        if (v.readyState !== v.HAVE_ENOUGH_DATA) return;
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR(img.data, img.width, img.height, {
          inversionAttempts: "dontInvert",
        });
        if (code) onDetected(code.data);
      }, 350);
    }
  } catch (e) {
    if ($("#msg"))
      $("#msg").textContent =
        "Camera permission denied or unavailable. Use the code box above.";
    stopCam();
  }
}
function stopCam() {
  clearInterval(timer);
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  if ($("#vid")) $("#vid").style.display = "none";
  if ($("#cam")) $("#cam").textContent = "Start camera";
}
onClick("cam", () => (stream ? stopCam() : startCam()));

/* 10. Restock, Retailer Tabs Launcher, Sharing & Tombstone-Safe Supabase Sync */
onClick("rlistWrap", (e) => {
  const b = e.target.closest("[data-ord]");
  if (!b) return;
  const it = items.find((i) => i.id === b.dataset.ord);
  if (it) {
    it.ordered = !it.ordered;
    it.updatedAt = Date.now();
    save();
    render();
  }
});

onClick("autoOrder", () => {
  const toBuy = items.filter(unbought);
  if (!toBuy.length) return alert("No unbought low-stock items.");
  if (extDetected) {
    window.postMessage(
      {
        source: "PantryPulse",
        action: "PLACE_ORDER",
        store: cfg.store,
        items: toBuy.map((i) => ({
          name: i.name,
          orderQty: cartPacks(i),
          targetUrl: shopUrl(i),
        })),
      },
      window.location.origin || "*",
    );
    toBuy.forEach((i) => {
      i.ordered = true;
      i.updatedAt = Date.now();
    });
    save();
    render();
    if ($("#orderStatus"))
      $("#orderStatus").textContent =
        "Extension active: adding items to cart and dimming them…";
    return;
  }
  let opened = 0;
  toBuy.forEach((i) => {
    const win = window.open(shopUrl(i), "_blank");
    if (win) {
      try {
        win.opener = null;
      } catch (e) {}
      opened++;
      i.ordered = true;
      i.updatedAt = Date.now();
    }
  });
  save();
  render();
  if ($("#orderStatus")) {
    if (opened === toBuy.length) {
      $("#orderStatus").textContent =
        `Opened ${opened} store page(s) in new tabs. Add items to your retailer cart there—they are now dimmed on your list.`;
    } else if (opened > 0) {
      $("#orderStatus").textContent =
        `Opened ${opened} of ${toBuy.length} store tabs (browser blocked the rest—click “Shop ↗” on remaining items).`;
    } else {
      $("#orderStatus").textContent =
        "Pop-ups were blocked by your browser. Click “Shop ↗” on each item above to open its store page.";
    }
  }
});

onClick("restockAll", () => {
  const need = items.filter(low);
  if (!need.length) return alert("Nothing to restock.");
  if (!confirm(`Mark all ${need.length} item(s) as delivered and restocked?`))
    return;
  need.forEach((i) => {
    i.qty = roundQty(i.qty + orderQty(i));
    i.ordered = false;
    i.updatedAt = Date.now();
  });
  cfg.last = Date.now();
  save();
  render();
});
onClick("shareList", async () => {
  const text = formattedList();
  if (!text) return alert("No unbought items.");
  if (navigator.share) {
    try {
      await navigator.share({ title: "PantryPulse List", text });
      return;
    } catch (e) {}
  }
  const ok = await copyText(text);
  alert(ok ? "Shopping list copied!" : "Could not copy automatically.");
});
onClick("copyList", async () => {
  const text = formattedList();
  if (!text) return alert("No unbought items.");
  const ok = await copyText(text);
  $("#copyList").textContent = ok ? "Copied" : "Copy failed";
  setTimeout(() => ($("#copyList").textContent = "Copy list"), 1500);
});

onClick("addRecip", () => {
  const name = ($("#rName")?.value || "").trim(),
    contact = ($("#rContact")?.value || "").trim();
  if (!name || !contact) return alert("Enter name and phone/email.");
  cfg.recipients.push({
    name: name.slice(0, 40),
    contact: contact.slice(0, 60),
  });
  cfg.recipientsUpdatedAt = Date.now();
  if ($("#rName")) $("#rName").value = "";
  if ($("#rContact")) $("#rContact").value = "";
  save();
  render();
});
onClick("recipList", (e) => {
  const del = e.target.closest("[data-rdel]");
  if (del) {
    cfg.recipients.splice(+del.dataset.rdel, 1);
    cfg.recipientsUpdatedAt = Date.now();
    save();
    return render();
  }
  const wa = e.target.closest("[data-wa]");
  if (wa) {
    const t =
      formattedList() || "PantryPulse update: all low-stock items ordered!";
    window.open(
      `https://wa.me/${wa.dataset.wa}?text=${encodeURIComponent(t)}`,
      "_blank",
      "noopener",
    );
  }
});
onClick("emailAll", () => {
  const t = formattedList();
  if (!t) return alert("No unbought items.");
  const em = cfg.recipients
    .filter((r) => isEmail(r.contact))
    .map((r) => r.contact);
  if (!em.length) return alert("Add an email first.");
  window.location.href = `mailto:${em.join(",")}?subject=${encodeURIComponent("PantryPulse Shopping List")}&body=${encodeURIComponent(t)}`;
});
onClick("calReminder", () => {
  const rrule = cfg.freq === "weekly" ? "FREQ=WEEKLY" : "FREQ=MONTHLY",
    start =
      new Date(nextDue()).toISOString().replace(/[-:]/g, "").split(".")[0] +
      "Z";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "DTSTART:" + start,
    "DURATION:PT15M",
    "RRULE:" + rrule,
    "SUMMARY:PantryPulse Restock",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = `pantrypulse-${cfg.freq}.ics`;
  a.click();
});
onChange("currency", (e) => {
  if (VALID_CURRENCIES.has(e.target.value)) {
    cfg.currency = e.target.value;
    save();
    render();
  }
});
onChange("store", (e) => {
  if (VALID_STORES.has(e.target.value)) {
    cfg.store = e.target.value;
    save();
    render();
  }
});
onChange("customUrl", (e) => {
  const raw = e.target.value.trim();
  const safe = sanitizeUrl(raw);
  if (raw && !safe)
    alert("Custom store URL must start with http:// or https://.");
  cfg.customUrl = safe;
  e.target.value = safe;
  save();
  render();
});
onChange("freq", (e) => {
  if (e.target.value === "weekly" || e.target.value === "monthly") {
    cfg.freq = e.target.value;
    save();
    render();
  }
});
onClick("reviewed", () => {
  cfg.last = Date.now();
  save();
  render();
});
onClick("notif", async () => {
  if (!("Notification" in window))
    return alert("Notifications unsupported here.");
  const p = await Notification.requestPermission();
  if (p === "granted" && items.some(unbought))
    new Notification("PantryPulse", {
      body: `${items.filter(unbought).length} item(s) ready to restock.`,
    });
});
onClick("exportJson", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify({ items, deletedItems, cfg }, null, 2)], {
      type: "application/json",
    }),
  );
  a.download = "pantrypulse-kitchen-backup.json";
  a.click();
});
onClick("importBtn", () => $("#importFile")?.click());
onChange("importFile", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d || typeof d !== "object") throw new Error("Invalid root object");
    if (d.deletedItems && typeof d.deletedItems === "object") {
      deletedItems = normalizeDeletedMap(
        Object.assign({}, deletedItems, d.deletedItems),
      );
    }
    if (Array.isArray(d.items)) {
      items = normalizeItems(d.items).filter(
        (i) =>
          !(deletedItems[i.id] && deletedItems[i.id] >= (i.updatedAt || 0)),
      );
    }
    if (d.cfg && typeof d.cfg === "object") {
      cfg = sanitizeCfg(d.cfg, cfg);
    }
    save();
    render();
    alert("Backup restored.");
  } catch (err) {
    alert("Invalid or corrupted backup file.");
  }
  e.target.value = "";
});

function mergeRemoteState(remoteItemsList, remoteDeletedRaw) {
  const remoteDeleted = normalizeDeletedMap(remoteDeletedRaw);
  const allDeleted = Object.assign({}, deletedItems);
  for (const [id, ts] of Object.entries(remoteDeleted)) {
    if (!allDeleted[id] || ts > allDeleted[id]) allDeleted[id] = ts;
  }
  deletedItems = allDeleted;

  const cleanRemote = normalizeItems(remoteItemsList);
  const localMap = new Map(items.map((i) => [i.id, i]));
  const merged = [];

  for (const rem of cleanRemote) {
    const delTs = deletedItems[rem.id] || 0;
    const loc = localMap.get(rem.id);
    if (loc) localMap.delete(rem.id);
    const winner =
      loc && (loc.updatedAt || 0) > (rem.updatedAt || 0) ? loc : rem;
    if (delTs >= (winner.updatedAt || 0)) continue;
    merged.push(winner);
  }

  localMap.forEach((loc) => {
    const delTs = deletedItems[loc.id] || 0;
    if (delTs < (loc.updatedAt || 0)) merged.push(loc);
  });

  return merged;
}

async function pushSync() {
  if (!cfg.sbUrl || !cfg.sbKey || !cfg.sbRoom) return;
  if (syncBusy) {
    syncQueued = true;
    return;
  }
  syncBusy = true;
  const base = cfg.sbUrl.replace(/\/+$/, ""),
    now = new Date().toISOString();
  syncState = "syncing";
  updateSyncIndicator("Pushing updates to Supabase…");
  try {
    const res = await fetch(`${base}/rest/v1/pantry_rooms`, {
      method: "POST",
      headers: {
        apikey: cfg.sbKey,
        Authorization: `Bearer ${cfg.sbKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        room_id: cfg.sbRoom,
        payload: {
          items,
          deletedItems,
          recipients: cfg.recipients,
          recipientsUpdatedAt: cfg.recipientsUpdatedAt || 0,
          store: cfg.store,
          currency: cfg.currency,
        },
        updated_at: now,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cfg.lastSyncAt = now;
    store.set("pp:cfg", cfg);
    syncState = "synced";
    syncErrorMsg = "";
    updateSyncIndicator("Synced just now.");
  } catch (e) {
    syncState = "error";
    syncErrorMsg = e.message || "Network error";
    updateSyncIndicator(
      `Sync failed (${syncErrorMsg}). Check URL, key, or connection.`,
    );
  } finally {
    syncBusy = false;
    if (syncQueued) {
      syncQueued = false;
      pushSync();
    }
  }
}

async function pullSync(force = false) {
  if (!cfg.sbUrl || !cfg.sbKey || !cfg.sbRoom || syncBusy) return;
  syncBusy = true;
  const base = cfg.sbUrl.replace(/\/+$/, "");
  syncState = "syncing";
  updateSyncIndicator("Checking household room…");
  try {
    const res = await fetch(
      `${base}/rest/v1/pantry_rooms?room_id=eq.${encodeURIComponent(cfg.sbRoom)}&select=payload,updated_at`,
      {
        headers: { apikey: cfg.sbKey, Authorization: `Bearer ${cfg.sbKey}` },
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    syncState = "synced";
    syncErrorMsg = "";
    const row = Array.isArray(rows) ? rows[0] : null;
    if (row && row.payload && typeof row.payload === "object") {
      const remoteTs = Date.parse(row.updated_at) || 0;
      const lastTs = Date.parse(cfg.lastSyncAt) || 0;
      if (force || remoteTs > lastTs) {
        const p = row.payload;
        if (
          Array.isArray(p.items) ||
          (p.deletedItems && typeof p.deletedItems === "object")
        ) {
          items = mergeRemoteState(p.items || [], p.deletedItems || {});
        }
        const remoteRecipTs = Number(p.recipientsUpdatedAt) || 0;
        if (
          Array.isArray(p.recipients) &&
          remoteRecipTs >= (cfg.recipientsUpdatedAt || 0)
        ) {
          cfg.recipients = normalizeRecipients(p.recipients);
          cfg.recipientsUpdatedAt = remoteRecipTs;
        }
        if (typeof p.store === "string" && VALID_STORES.has(p.store))
          cfg.store = p.store;
        if (typeof p.currency === "string" && VALID_CURRENCIES.has(p.currency))
          cfg.currency = p.currency;
        cfg.lastSyncAt = row.updated_at || new Date().toISOString();
        save(false);
        render();
        updateSyncIndicator("Updated from household room.");
      } else {
        updateSyncIndicator("Up to date.");
      }
    } else if (force) {
      syncBusy = false;
      await pushSync();
      return;
    }
  } catch (e) {
    syncState = "error";
    syncErrorMsg = e.message || "Network error";
    updateSyncIndicator(
      `Sync failed (${syncErrorMsg}). Check URL, key, or connection.`,
    );
  } finally {
    syncBusy = false;
  }
}
onClick("saveSync", async () => {
  const rawSb = ($("#sbUrl")?.value || "").trim();
  const safeSb = sanitizeUrl(rawSb);
  if (rawSb && !safeSb)
    return alert("Supabase URL must start with http:// or https://.");
  cfg.sbUrl = safeSb;
  cfg.sbKey = ($("#sbKey")?.value || "").trim().slice(0, 512);
  cfg.sbRoom = ($("#sbRoom")?.value || "").trim().slice(0, 64);
  save(false);
  render();
  if (cfg.sbUrl && cfg.sbKey && cfg.sbRoom) await pullSync(true);
});
onClick("pullNow", () => pullSync(true));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") pullSync(false);
});

/* 11. Pantry Help Kitchen Manager AI Assistant */
(function initPantryHelp() {
  const dlg = $("#ph-drawer"),
    feed = $("#ph-feed");
  function addBubble(text, who) {
    if (!feed) return null;
    const d = document.createElement("div");
    d.className = "ph-msg " + who;
    d.textContent = text;
    feed.appendChild(d);
    feed.scrollTop = feed.scrollHeight;
    return d;
  }
  function guessZone(n) {
    n = n.toLowerCase();
    if (
      /milk|yogurt|cheese|butter|egg|cream|lettuce|spinach|tomato|fruit|meat|fish|chicken/.test(
        n,
      )
    )
      return "Fridge";
    if (/ice|frozen|peas|fries|nugget/.test(n)) return "Freezer";
    if (
      /oil|salt|pepper|spice|cumin|turmeric|curry|vinegar|sauce|ketchup|soy/.test(
        n,
      )
    )
      return "Spices & Oils";
    if (/tea|coffee|juice|soda|water|drink|cocoa/.test(n)) return "Beverages";
    if (/soap|detergent|tissue|bleach|sponge|foil|bag|clean/.test(n))
      return "Household & Cleaning";
    return "Dry Pantry";
  }
  function localAssistant(prompt) {
    const p = prompt.trim();
    if (/tutorial|how do i|how to|guide|help me use/i.test(p)) {
      if (/scan|qr|barcode|print/i.test(p))
        return `How to Scan & Print QR:\n1. Tap "QR sticker" on any item (or "Print QR labels") to print jar stickers.\n2. Open "Scan", pick Use (−step) or Restock (+step), and tap "Start camera" (requires HTTPS or localhost).\n3. Unknown retail barcodes automatically look up the product name.`;
      return `Kitchen Manager Guide:\n1. Pantry Tab: Add items with zones, step sizes, expiry dates & print QR stickers.\n2. Scan Tab: Scan QR stickers or retail barcodes.\n3. Restock & Sync Tab: Manage aisle lists, dim ordered items, and configure Supabase sync.`;
    }
    if (/^add\s+/i.test(p)) {
      const m = p
        .replace(/^add\s+/i, "")
        .match(
          /^(\d+(?:\.\d+)?)\s*(pcs|kg|g|l|ml|packs|cans|bottles|boxes)?\s+(.+)$/i,
        );
      const qty = m ? parseFloat(m[1]) : 1,
        unit = m && m[2] ? m[2] : "pcs",
        name = (m ? m[3] : p.replace(/^add\s+/i, "")).trim();
      if (name) {
        const ex = items.find(
          (i) => i.name.toLowerCase() === name.toLowerCase(),
        );
        if (ex) {
          ex.qty = roundQty(ex.qty + qty);
          if (!low(ex)) ex.ordered = false;
          ex.updatedAt = Date.now();
        } else {
          const clean = normalizeItem(
            {
              id: newId(),
              name: name[0].toUpperCase() + name.slice(1),
              unit,
              qty,
              min: 1,
              step: 1,
              zone: guessZone(name),
            },
            items,
          );
          if (clean) items.unshift(clean);
        }
        save();
        render();
        return `Added ${qty} ${unit} ${name} (${guessZone(name)}).`;
      }
    }
    if (/where|zone|stored|fridge|freezer|pantry/i.test(p)) {
      if (!items.length) return "Your pantry is empty.";
      const w = p
        .toLowerCase()
        .replace(/where|is|are|the|my|stored|located|\?/g, "")
        .trim();
      const hits =
        w.length >= 2
          ? items.filter((i) => i.name.toLowerCase().includes(w))
          : [];
      if (hits.length)
        return hits
          .map(
            (i) =>
              `• ${i.name} is in ${i.zone || "General"} (${i.qty} ${i.unit || "pcs"}).`,
          )
          .join("\n");
      return items
        .map(
          (i) =>
            `• ${i.name}: ${i.zone || "General"} (${i.qty} ${i.unit || "pcs"})`,
        )
        .join("\n");
    }
    const toBuy = items.filter(unbought),
      exp = items.filter((i) => expiryStatus(i.exp));
    return `Manager Audit: ${items.length} total items · ${toBuy.length} unbought low-stock · ${exp.length} expiring soon. Ask me "Where is [item]?", "How do I scan QR?", or "Add 2 kg Rice".`;
  }
  async function ask(prompt) {
    if (!prompt.trim()) return;
    addBubble(prompt, "me");
    if (cfg.aiEndpoint && !/^add\s+/i.test(prompt.trim())) {
      const w = addBubble("Thinking…", "ai");
      try {
        const res = await fetch(cfg.aiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "manager",
            device: "tablet",
            prompt,
            pantry: items,
            currency: cfg.currency,
          }),
        });
        const data = await res.json();
        if (w) w.textContent = data.reply || localAssistant(prompt);
        return;
      } catch (e) {
        if (w) w.textContent = localAssistant(prompt);
        return;
      }
    }
    addBubble(localAssistant(prompt), "ai");
  }
  if ($("#ph-chips"))
    $("#ph-chips").innerHTML = [
      "How do I use this app?",
      "Where are my items stored?",
      "How do I scan & print QR?",
      "Add 2 kg Rice",
    ]
      .map((p) => `<button type="button" class="ph-chip">${esc(p)}</button>`)
      .join("");
  onClick("ph-fab", () => {
    if ($("#ph-url")) $("#ph-url").value = cfg.aiEndpoint || "";
    if (feed && !feed.children.length)
      addBubble(
        "Hi! Ask me where items are stored, how to scan/print QR labels, or audit expiry dates.",
        "ai",
      );
    dlg?.showModal();
  });
  onClick("ph-close", () => dlg?.close());
  onClick("ph-gear", () => {
    const b = $("#ph-cfg");
    if (b) b.style.display = b.style.display === "block" ? "none" : "block";
  });
  onChange("ph-url", (e) => {
    const raw = e.target.value.trim();
    const safe = sanitizeUrl(raw);
    if (raw && !safe)
      alert("AI endpoint URL must start with http:// or https://.");
    cfg.aiEndpoint = safe;
    e.target.value = safe;
    save(false);
  });
  onClick("ph-chips", (e) => {
    const c = e.target.closest(".ph-chip");
    if (c) ask(c.textContent);
  });
  if ($("#ph-form"))
    $("#ph-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const i = $("#ph-input"),
        t = i?.value.trim();
      if (t) {
        i.value = "";
        ask(t);
      }
    });
})();

render();
pullSync(false);

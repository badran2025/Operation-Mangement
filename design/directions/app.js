// Shared preview logic for the 3 design directions (real data snapshot from the live database).
const DATA = {
  counts: { workers: 101, working: 98, off: 1, leave: 2, open: 62, late: 59, docs90: 3 },
  branches: [
    ["إشبيليا","Ishbiliya","Riyadh",3,0,2,2],["الحمراء","Al Hamra","Riyadh",5,0,7,7],["الرمال 2","Al Rimal 2","Riyadh",5,0,5,4],
    ["العارض","Al Arid","Riyadh",7,0,4,4],["العقيق","Al Aqiq","Riyadh",6,1,7,7],["النسيم","Al Naseem","Riyadh",2,0,5,5],
    ["اليرموك","Al Yarmouk","Riyadh",4,0,4,4],["الرمال 1","Al Rimal 1","Riyadh",5,0,2,2],["الورود","Al Wurood","Riyadh",8,0,5,4],
    ["الازدهار","Al Izdihar","Riyadh",7,0,7,6],["الخليج","Al Khaleej","Riyadh",3,0,0,0],["الوادي","Al Wadi","Riyadh",4,0,6,6],
    ["الخرج","Al Kharj","Riyadh",2,0,6,6],["النرجس","Al Narjis","Riyadh",4,0,0,0],
    ["المروة","Al Marwa","Jeddah",5,0,1,1],["الروضة","Al Rawdah","Jeddah",7,0,0,0],["الحمدانية","Al Hamdaniya","Jeddah",5,0,0,0],
    ["الراكة","Al Rakkah","Khobar",8,0,0,0],["الزهور","Zuhor","Khobar",4,0,1,1],["فرع 91","91 Branch","Khobar",6,0,0,0],["الأكاديمية","Academy","Khobar",1,0,0,0],
  ].map(([ar,en,city,w,off,open,late]) => ({ ar, en, city, w, off, open, late })),
  tickets: [
    { id: 103, b: ["الورود","Al Wurood"], c: ["تكييف","AC"], title: "تسريب مياه", status: "assigned", due: "2026-11-15T18:50:00Z", created: "2026-11-12T18:50:00Z", who: "مؤمن" },
    { id: 102, b: ["الازدهار","Al Izdihar"], c: ["عام","General"], title: "الاضاءه الخاصه بمكان ازاله البقع ضعيفه جدا", status: "assigned", due: "2026-11-15T14:16:00Z", created: "2026-11-12T14:16:00Z", who: "مؤمن" },
    { id: 99, b: ["الرمال 2","Al Rimal 2"], c: ["غسالة","Washing machine"], title: "إصلاح 4 غسالات – تغيير 3 ربل باب، موتور صرف، تنظيف 5 فلاتر", status: "in_progress", due: "2026-11-15T13:09:00Z", created: "2026-11-12T13:09:00Z", who: "مجيب" },
    { id: 95, b: ["العارض","Al Arid"], c: ["عام","General"], title: "لوحة الإعلانات الكهربائية لا تعمل بشكل صحيح", status: "in_progress", due: "2026-11-14T14:16:00Z", created: "2026-11-11T14:16:00Z", who: null },
    { id: 92, b: ["الورود","Al Wurood"], c: ["مكبس","Pressing machine"], title: "Steam press leaking water – drained but problem keeps returning", status: "in_progress", due: "2026-11-14T09:35:00Z", created: "2026-11-11T09:35:00Z", who: "محمد" },
    { id: 91, b: ["المروة","Al Marwa"], c: ["مكبس","Pressing machine"], title: "مشكلة في مكبس المروة", status: "waiting_parts", due: "2026-11-14T09:30:00Z", created: "2026-11-11T09:30:00Z", who: "مجيب" },
  ],
  docs: [
    { ar: "إقامة", en: "Iqama", name: "Md Arafat", days: 32 },
    { ar: "إقامة", en: "Iqama", name: "Nickson Ainamani", days: 50 },
    { ar: "إقامة", en: "Iqama", name: "Aiub Hosen Bhuiyan", days: 63 },
  ],
};
const NOW = new Date("2026-11-14T18:00:00Z"); // snapshot time, keeps screenshots stable

const T = {
  ar: {
    brand: "تشغيل كلين", overview: "نظرة عامة", branches: "الفروع", maintenance: "الصيانة", workers: "العمال", housing: "السكن", documents: "المستندات",
    search: "ابحث عن فرع أو عامل أو بلاغ…", today: "السبت 14 نوفمبر", hello: "مساء الخير يا أحمد",
    sub: "ده وضع التشغيل النهارده في 21 فرع",
    k_workers: "إجمالي العمال", k_working: "شغالين النهارده", k_open: "بلاغات مفتوحة", k_late: "متأخرة عن موعدها", k_docs: "مستندات تنتهي خلال 90 يوم",
    cities: { Riyadh: "الرياض", Jeddah: "جدة", Khobar: "الخبر" },
    col_branch: "الفرع", col_workers: "العمال", col_today: "اليوم", col_open: "بلاغات", col_late: "متأخرة",
    queue: "بلاغات تحتاج متابعة", viewAll: "كل البلاغات", docsTitle: "مستندات قربت تنتهي",
    days: (n) => `باقي ${n} يوم`, late: (h) => `متأخر ${h}`, left: (h) => `باقي ${h}`, hours: (n) => `${n} ساعة`, daysU: (n) => `${n} يوم`,
    nobody: "بدون فني", newTicket: "بلاغ جديد", off: (n) => `${n} إجازة`, working: (n) => `${n} شغالين`, allCities: "كل المدن",
    status: { new: "جديد", assigned: "متحوّل لفني", in_progress: "جاري التنفيذ", waiting_parts: "مستني قطع غيار" },
    lang: "English", theme: { light: "الوضع الداكن", dark: "الوضع الفاتح" }, workersShort: "عامل", comma: "، ", groupMeta: (b, w) => `${b} فروع، ${w} عامل`,
  },
  en: {
    brand: "Kleen Ops", overview: "Overview", branches: "Branches", maintenance: "Maintenance", workers: "Workers", housing: "Housing", documents: "Documents",
    search: "Search branches, workers, tickets…", today: "Sat, 14 Nov", hello: "Good evening, Ahmed",
    sub: "Here is how 21 branches are running today",
    k_workers: "Workers", k_working: "Working today", k_open: "Open tickets", k_late: "Past due", k_docs: "Documents expiring in 90 days",
    cities: { Riyadh: "Riyadh", Jeddah: "Jeddah", Khobar: "Khobar" },
    col_branch: "Branch", col_workers: "Workers", col_today: "Today", col_open: "Tickets", col_late: "Past due",
    queue: "Tickets that need attention", viewAll: "All tickets", docsTitle: "Documents expiring soon",
    days: (n) => `${n} days left`, late: (h) => `${h} late`, left: (h) => `${h} left`, hours: (n) => `${n}h`, daysU: (n) => `${n}d`,
    nobody: "Unassigned", newTicket: "New ticket", off: (n) => `${n} off`, working: (n) => `${n} working`, allCities: "All cities",
    status: { new: "New", assigned: "Assigned", in_progress: "In progress", waiting_parts: "Waiting for parts" },
    lang: "العربية", theme: { light: "Dark mode", dark: "Light mode" }, workersShort: "workers", comma: ", ", groupMeta: (b, w) => `${b} branches, ${w} workers`,
  },
};

const ICON = {
  overview: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM13 3v6h8V3zM3 21h8v-6H3z"/>',
  branches: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/>',
  maintenance: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  workers: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  housing: '<path d="M3 10l9-7 9 7v11H3zM9 21v-7h6v7"/>',
  documents: '<path d="M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
};
const icon = (n, cls = "") => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

const params = new URLSearchParams(location.search);
let lang = params.get("lang") || "ar";
let theme = params.get("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
const variant = document.body.dataset.variant;

function rel(iso, t) {
  const mins = Math.round((new Date(iso) - NOW) / 60000);
  const h = Math.abs(mins) / 60;
  const txt = h < 48 ? t.hours(Math.round(h)) : t.daysU(Math.round(h / 24));
  return { late: mins < 0, text: mins < 0 ? t.late(txt) : t.left(txt) };
}
const nf = (n) => new Intl.NumberFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US").format(n);

function shell(t, main) {
  const nav = ["overview", "branches", "maintenance", "workers", "housing", "documents"];
  return `
  <a class="skip" href="#main">${lang === "ar" ? "تخطي للمحتوى" : "Skip to content"}</a>
  <aside class="side" aria-label="${t.overview}">
    <div class="logo"><span class="mark">k</span><span class="logo-text">${t.brand}</span></div>
    <nav>${nav.map((n, i) => `<a href="#" class="nav ${i === 0 ? "is-active" : ""}" ${i === 0 ? 'aria-current="page"' : ""}>${icon(n)}<span>${t[n]}</span>${n === "maintenance" ? `<b class="nav-count">${nf(DATA.counts.late)}</b>` : ""}</a>`).join("")}</nav>
  </aside>
  <div class="frame">
    <header class="top">
      <label class="search">${icon("search")}<input type="search" placeholder="${t.search}" aria-label="${t.search}"></label>
      <div class="top-actions">
        <button class="btn-ghost" id="lang" type="button">${icon("globe")}<span>${t.lang}</span></button>
        <button class="btn-icon" id="theme" type="button" aria-label="${t.theme[theme]}">${icon(theme === "dark" ? "sun" : "moon")}</button>
        <span class="avatar" aria-hidden="true">${lang === "ar" ? "أ" : "A"}</span>
      </div>
    </header>
    <main id="main">${main}</main>
  </div>
  <nav class="bottom-nav" aria-label="${t.overview}">${["overview", "branches", "maintenance", "workers"].map((n, i) => `<a href="#" class="${i === 0 ? "is-active" : ""}">${icon(n)}<span>${t[n]}</span></a>`).join("")}</nav>`;
}

function kpis(t) {
  const c = DATA.counts;
  const items = [
    ["k_workers", c.workers], ["k_working", c.working], ["k_open", c.open], ["k_late", c.late, "late"], ["k_docs", c.docs90, "warn"],
  ];
  return `<section class="kpis" aria-label="KPIs">${items.map(([k, v, tone]) => `<div class="kpi ${tone ? "kpi-" + tone : ""}"><span class="kpi-label">${t[k]}</span><span class="kpi-value num">${nf(v)}</span></div>`).join("")}</section>`;
}

function branchesBlock(t) {
  const cities = ["Riyadh", "Jeddah", "Khobar"];
  const name = (b) => (lang === "ar" ? b.ar : b.en);
  if (variant === "ledger") {
    return `<section class="block"><div class="block-head"><h2>${t.branches}</h2></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>${t.col_branch}</th><th class="n">${t.col_workers}</th><th class="n">${t.col_today}</th><th class="n">${t.col_open}</th><th class="n">${t.col_late}</th></tr></thead>
      <tbody>${cities.map((c) => {
        const list = DATA.branches.filter((b) => b.city === c);
        return `<tr class="group"><th colspan="5">${t.cities[c]} <span>${t.groupMeta(nf(list.length), nf(list.reduce((s, b) => s + b.w, 0)))}</span></th></tr>` +
          list.map((b) => `<tr class="${b.late ? "has-late" : ""}"><td>${name(b)}</td><td class="n num">${nf(b.w)}</td><td class="n num">${nf(b.w - b.off)}</td><td class="n num">${b.open ? nf(b.open) : "–"}</td><td class="n num">${b.late ? `<span class="late-chip">${nf(b.late)}</span>` : "–"}</td></tr>`).join("");
      }).join("")}</tbody></table></div></section>`;
  }
  if (variant === "console") {
    const max = Math.max(...DATA.branches.map((b) => b.w));
    return `<section class="block"><div class="block-head"><h2>${t.branches}</h2><div class="seg" role="tablist">${[t.allCities, ...cities.map((c) => t.cities[c])].map((l, i) => `<button role="tab" aria-selected="${i === 0}">${l}</button>`).join("")}</div></div>
      <ul class="rows">${DATA.branches.slice(0, 12).map((b) => `<li class="row"><span class="row-name">${name(b)}<small>${t.cities[b.city]}</small></span>
        <span class="bar" aria-label="${nf(b.w - b.off)} / ${nf(b.w)}"><i style="inline-size:${((b.w - b.off) / max) * 100}%"></i></span>
        <span class="num row-w">${nf(b.w - b.off)}<small>/${nf(b.w)}</small></span>
        <span class="dot-count ${b.late ? "is-late" : ""}">${b.open ? nf(b.open) : "0"}</span></li>`).join("")}</ul></section>`;
  }
  // fold
  const c = "Riyadh", list = DATA.branches.filter((b) => b.city === c);
  return `<section class="block"><div class="block-head"><h2>${t.branches}</h2>
      <div class="seg" role="tablist">${cities.map((ci, i) => `<button role="tab" aria-selected="${i === 0}">${t.cities[ci]} <span class="num">${nf(DATA.branches.filter((b) => b.city === ci).length)}</span></button>`).join("")}</div></div>
    <div class="panel"><div class="panel-sum"><div><span class="big num">${nf(list.reduce((s, b) => s + b.w, 0))}</span><span>${t.workersShort}</span></div><div><span class="big num">${nf(list.reduce((s, b) => s + b.open, 0))}</span><span>${t.col_open}</span></div></div>
    <ul class="soft-rows">${list.slice(0, 8).map((b) => `<li><span class="sr-name">${name(b)}</span><span class="sr-meta">${t.working(nf(b.w - b.off))}</span>${b.late ? `<span class="pill pill-late">${nf(b.late)} ${t.col_late}</span>` : `<span class="pill pill-ok">${lang === "ar" ? "تمام" : "All clear"}</span>`}${icon("chevron", "flip")}</li>`).join("")}</ul></div></section>`;
}

function ticketsBlock(t) {
  const st = (s) => `<span class="status status-${s}">${t.status[s]}</span>`;
  const rows = DATA.tickets.map((k) => {
    const d = rel(k.due, t);
    const br = lang === "ar" ? k.b[0] : k.b[1], cat = lang === "ar" ? k.c[0] : k.c[1];
    if (variant === "ledger") return `<tr class="${d.late ? "has-late" : ""}"><td class="num muted">#${k.id}</td><td><span class="t-title" dir="auto">${k.title}</span><small>${br}${t.comma}${cat}</small></td><td>${st(k.status)}</td><td class="${d.late ? "due-late" : "muted"}">${d.text}</td></tr>`;
    if (variant === "console") return `<li class="inbox ${d.late ? "is-late" : ""}"><span class="dot status-${k.status}"></span><span class="ib-main"><span class="t-title" dir="auto">${k.title}</span><small><span class="num">#${k.id}</span>${t.comma}${br}${t.comma}${cat}</small></span><span class="ib-side ${d.late ? "due-late" : ""}">${d.text}</span></li>`;
    return `<li class="soft-ticket"><div class="st-top"><span class="t-title" dir="auto">${k.title}</span>${st(k.status)}</div><div class="st-meta"><span>${br}</span><span>${k.who ?? t.nobody}</span><span class="${d.late ? "due-late" : ""}">${d.text}</span></div></li>`;
  }).join("");
  const head = `<div class="block-head"><h2>${t.queue}</h2><a href="#" class="link">${t.viewAll}</a></div>`;
  if (variant === "ledger") return `<section class="block">${head}<div class="table-wrap"><table class="tbl tbl-tickets"><tbody>${rows}</tbody></table></div></section>`;
  return `<section class="block">${head}<ul class="${variant === "console" ? "inbox-list" : "soft-list"}">${rows}</ul></section>`;
}

function docsBlock(t) {
  return `<section class="block docs"><div class="block-head"><h2>${t.docsTitle}</h2></div><ul class="doc-list">${DATA.docs.map((d) => `<li><span dir="ltr" class="doc-name">${d.name}</span><span class="muted">${lang === "ar" ? d.ar : d.en}</span><span class="${d.days <= 45 ? "due-late" : "due-warn"}">${t.days(nf(d.days))}</span></li>`).join("")}</ul></section>`;
}

function render() {
  const t = T[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.dataset.theme = theme;
  const header = `<div class="page-head"><div><p class="date-chip">${t.today}</p><h1>${variant === "fold" ? t.hello : t.overview}</h1><p class="sub">${t.sub}</p></div>
    <button class="btn-primary" type="button">${icon("plus")}<span>${t.newTicket}</span></button></div>`;
  const main = `${header}${kpis(t)}<div class="grid">${branchesBlock(t)}<div class="col">${ticketsBlock(t)}${docsBlock(t)}</div></div>`;
  document.body.innerHTML = shell(t, main);
  document.getElementById("lang").onclick = () => { lang = lang === "ar" ? "en" : "ar"; sync(); };
  document.getElementById("theme").onclick = () => { theme = theme === "dark" ? "light" : "dark"; sync(); };
}
function sync() {
  const p = new URLSearchParams(location.search); p.set("lang", lang); p.set("theme", theme);
  history.replaceState(null, "", "?" + p.toString());
  render();
}
render();

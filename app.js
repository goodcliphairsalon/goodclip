// ─────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────
const CFG = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxXlb8DcV8BO_COFSWDQNPDglJOoArQdYi3qftAEklfmsYW48l1ccGNkJ6RCuoKTliL/exec",
  stylist:    "Hanh Dao",
  openDays:   [1, 2, 3, 4, 5, 6],   // Mon–Sat (0=Sun,1=Mon…6=Sat)
  openHour:   10,
  closeHour:  19,                    // 7 PM
  slotMin:    15,
};

// ─────────────────────────────────────────
//  SERVICES  (price shown to customer, dur used only for time-slot logic)
// ─────────────────────────────────────────
const SERVICES = {
  "✂️ Hair Services": [
    { id:"mens-cut",       name:"Men's Haircut",                      price:"$30+",     base:30,  dur:30  },
    { id:"mens-shampoo",   name:"Men's Shampoo Add-on",               price:"$5+",      base:5,   dur:15  },
    { id:"womens-cut",     name:"Women's Haircut",                    price:"$32+",     base:32,  dur:30  },
    { id:"womens-shampoo", name:"Women's Shampoo Add-on",             price:"$7+",      base:7,   dur:15  },
    { id:"blowdry",        name:"Shampoo + Simple Blow Dry",          price:"$20+",     base:20,  dur:30  },
    { id:"flatstyle",      name:"Shampoo + Straight Flat Iron Style", price:"$45+",     base:45,  dur:45  },
  ],
  "🎨 Hair Color & Perm": [
    { id:"root",           name:"Root Retouch",     price:"$90+",  base:90,  dur:60  },
    { id:"full-color",     name:"Full Hair Color",  price:"$120+", base:120, dur:60  },
    { id:"partial-foils",  name:"Partial Foils",    price:"$100+", base:100, dur:90  },
    { id:"full-foils",     name:"Full Foils",       price:"$150+", base:150, dur:90  },
    { id:"perm",           name:"Hair Perm",        price:"$90+",  base:90,  dur:60  },
  ],
  "👁️ Waxing Services": [
    { id:"eyebrow",  name:"Eyebrow Waxing", price:"$12+", base:12, dur:15 },
    { id:"lip",      name:"Lip Waxing",     price:"$12+", base:12, dur:15 },
    { id:"back-wax", name:"Back Waxing",    price:"$90+", base:90, dur:30 },
  ],
};

// ─────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────
let S = {
  selected:    new Set(),
  date:        null,
  time:        null,
  bookedSlots: [],
  customer:    {},
};

let calYear, calMonth;

// ─────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const now = new Date();
  calYear   = now.getFullYear();
  calMonth  = now.getMonth();
  buildServices();
  renderCalendar();
});

// ─────────────────────────────────────────
//  STEP 1 – Services
// ─────────────────────────────────────────
function buildServices() {
  const wrap = document.getElementById("services-container");
  wrap.innerHTML = "";

  for (const [cat, items] of Object.entries(SERVICES)) {
    const section = document.createElement("div");
    section.className = "service-category";
    section.innerHTML = `<div class="cat-title">${cat}</div>`;

    items.forEach(svc => {
      const el = document.createElement("div");
      el.className = "service-item";
      el.dataset.id = svc.id;
      el.innerHTML = `
        <div class="svc-check">✓</div>
        <div class="svc-info">
          <div class="svc-name">${svc.name}</div>
        </div>
        <div class="svc-price">${svc.price}</div>`;
      el.addEventListener("click", () => toggleSvc(svc.id, el));
      section.appendChild(el);
    });

    wrap.appendChild(section);
  }
}

function toggleSvc(id, el) {
  S.selected.has(id) ? S.selected.delete(id) : S.selected.add(id);
  el.classList.toggle("selected", S.selected.has(id));
  refreshSummary();
}

function refreshSummary() {
  const svcs = getSelected();
  const bar  = document.getElementById("service-summary");
  const btn  = document.getElementById("btn-step1");

  if (!svcs.length) {
    bar.classList.remove("visible");
    btn.disabled = true;
    return;
  }

  const total = svcs.reduce((t, s) => t + s.base, 0);
  bar.classList.add("visible");
  bar.innerHTML = `
    <span>${svcs.length} service${svcs.length > 1 ? "s" : ""}</span>
    <span class="sum-total">From $${total}+</span>`;
  btn.disabled = false;
}

// ─────────────────────────────────────────
//  STEP 2 – Calendar
// ─────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function renderCalendar() {
  document.getElementById("month-label").textContent = `${MONTHS[calMonth]} ${calYear}`;
  const cal = document.getElementById("calendar");
  cal.innerHTML = "";

  DAYS.forEach(d => {
    const h = document.createElement("div");
    h.className = "cal-hdr";
    h.textContent = d;
    cal.appendChild(h);
  });

  const today    = new Date(); today.setHours(0,0,0,0);
  const firstDow = new Date(calYear, calMonth, 1).getDay();
  const daysInMo = new Date(calYear, calMonth + 1, 0).getDate();

  for (let i = 0; i < firstDow; i++) {
    const e = document.createElement("div");
    e.className = "cal-day empty";
    cal.appendChild(e);
  }

  for (let d = 1; d <= daysInMo; d++) {
    const date = new Date(calYear, calMonth, d);
    const dow  = date.getDay();
    const past = date < today;
    const open = CFG.openDays.includes(dow);

    const isToday    = date.getTime() === today.getTime();
    const isSelected = S.date &&
      S.date.getFullYear() === calYear &&
      S.date.getMonth()    === calMonth &&
      S.date.getDate()     === d;

    const el = document.createElement("div");
    el.textContent = d;

    let cls = "cal-day";
    if      (isSelected)    cls += " selected";
    else if (past || !open) cls += past ? " past" : " closed";
    else                    cls += " available";
    if (isToday && !isSelected) cls += " today";

    el.className = cls;
    if (!past && open) el.addEventListener("click", () => pickDate(new Date(calYear, calMonth, d)));
    cal.appendChild(el);
  }
}

function pickDate(date) {
  S.date = date;
  S.time = null;
  document.getElementById("btn-step2").disabled = true;
  renderCalendar();
  fetchSlots(date);
}

async function fetchSlots(date) {
  const sec  = document.getElementById("time-slots-section");
  const wrap = document.getElementById("time-slots");
  sec.style.display = "block";
  wrap.innerHTML = `<div class="slots-loading">Loading times…</div>`;

  document.getElementById("selected-date-label").textContent =
    `— ${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;

  try {
    const r    = await fetch(`${CFG.SCRIPT_URL}?action=slots&date=${fmtDate(date)}`);
    const data = await r.json();
    S.bookedSlots = data.booked || [];
  } catch {
    S.bookedSlots = [];
  }

  buildSlots();
}

function buildSlots() {
  const wrap     = document.getElementById("time-slots");
  const totalDur = getTotalDur();
  const slots    = genSlots(totalDur);
  wrap.innerHTML = "";

  if (!slots.length) {
    wrap.innerHTML = `<p style="color:var(--text-light);font-size:.88rem">No available times.</p>`;
    return;
  }

  slots.forEach(({ label, val }) => {
    const el = document.createElement("div");
    el.className = "slot";
    el.textContent = label;

    if (S.bookedSlots.includes(val)) {
      el.classList.add("booked");
    } else {
      if (S.time === val) el.classList.add("selected");
      el.addEventListener("click", () => {
        S.time = val;
        buildSlots();
        document.getElementById("btn-step2").disabled = false;
      });
    }
    wrap.appendChild(el);
  });
}

function genSlots(totalDur) {
  const slots = [];
  const start = CFG.openHour * 60;
  const end   = CFG.closeHour * 60 - totalDur;

  for (let m = start; m <= end; m += CFG.slotMin) {
    const h   = Math.floor(m / 60);
    const min = m % 60;
    const per = h < 12 ? "AM" : "PM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    slots.push({
      label: `${h12}:${pad(min)} ${per}`,
      val:   `${pad(h)}:${pad(min)}`,
    });
  }
  return slots;
}

function prevMonth() {
  calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
  S.date = null; S.time = null;
  renderCalendar();
  document.getElementById("time-slots-section").style.display = "none";
  document.getElementById("btn-step2").disabled = true;
}

function nextMonth() {
  calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
  S.date = null; S.time = null;
  renderCalendar();
  document.getElementById("time-slots-section").style.display = "none";
  document.getElementById("btn-step2").disabled = true;
}

// ─────────────────────────────────────────
//  STEP 4 – Review
// ─────────────────────────────────────────
function renderReview() {
  const svcs     = getSelected();
  const totalDur = getTotalDur();
  const totalPx  = svcs.reduce((t, s) => t + s.base, 0);
  const endTime  = calcEnd(S.time, totalDur);

  document.getElementById("booking-summary").innerHTML = `
    ${row("Stylist",    CFG.stylist)}
    ${row("Date",       fmtDateLabel(S.date))}
    ${row("Time",       `${fmtTime(S.time)} – ${fmtTime(endTime)}`)}
    ${row("Services",   svcs.map(s => s.name).join("<br>"))}
    ${row("Est. Total", `From $${totalPx}+`, "total")}
    ${row("Name",       S.customer.name)}
    ${row("Phone",      S.customer.phone)}
    ${S.customer.email ? row("Email", S.customer.email) : ""}
    ${S.customer.notes ? row("Notes", S.customer.notes) : ""}`;
}

function row(lbl, val, cls = "") {
  return `<div class="sum-row ${cls}">
    <span class="sum-lbl">${lbl}</span>
    <span class="sum-val">${val}</span>
  </div>`;
}

// ─────────────────────────────────────────
//  NAVIGATION
// ─────────────────────────────────────────
function goToStep(n) {
  if (n === 3 && (!S.date || !S.time)) return;
  if (n === 4) {
    const name  = document.getElementById("inp-name").value.trim();
    const phone = document.getElementById("inp-phone").value.trim();
    if (!name || !phone) { alert("Please enter your name and phone number."); return; }
    S.customer = {
      name, phone,
      email: document.getElementById("inp-email").value.trim(),
      notes: document.getElementById("inp-notes").value.trim(),
    };
    renderReview();
  }

  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`panel-${n}`).classList.add("active");

  for (let i = 1; i <= 4; i++) {
    const s = document.getElementById(`step-${i}`);
    s.classList.remove("active","done");
    if (i < n) s.classList.add("done");
    if (i === n) s.classList.add("active");
  }
  for (let i = 1; i <= 3; i++) {
    document.getElementById(`line-${i}`).classList.toggle("done", i < n);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ─────────────────────────────────────────
//  SUBMIT
// ─────────────────────────────────────────
async function submitBooking() {
  const btn = document.getElementById("btn-confirm");
  btn.disabled = true;
  btn.textContent = "Submitting…";

  const svcs = getSelected();
  const params = new URLSearchParams({
    action:   "book",
    date:     fmtDate(S.date),
    time:     S.time,
    duration: String(getTotalDur()),
    services: svcs.map(s => s.name).join(", "),
    stylist:  CFG.stylist,
    name:     S.customer.name,
    phone:    S.customer.phone,
    email:    S.customer.email || "",
    notes:    S.customer.notes || "",
    total:    String(svcs.reduce((t, s) => t + s.base, 0)),
  });

  try {
    const r    = await fetch(CFG.SCRIPT_URL + "?" + params.toString());
    const data = await r.json();
    if (data.success) {
      showSuccess();
    } else {
      alert(data.message || "Time slot unavailable. Please choose another.");
      btn.disabled = false;
      btn.textContent = "✓ Confirm Booking";
    }
  } catch(e) {
    alert("Connection error. Please try again.");
    btn.disabled = false;
    btn.textContent = "✓ Confirm Booking";
  }
}

function showSuccess() {
  const svcs     = getSelected();
  const totalDur = getTotalDur();

  document.getElementById("success-details").innerHTML = `
    ${row("Stylist",  CFG.stylist)}
    ${row("Date",     fmtDateLabel(S.date))}
    ${row("Time",     `${fmtTime(S.time)} – ${fmtTime(calcEnd(S.time, totalDur))}`)}
    ${row("Services", svcs.map(s => s.name).join("<br>"))}
    ${row("Name",     S.customer.name)}
    ${row("Phone",    S.customer.phone)}
    ${S.customer.email ? row("Email", S.customer.email) : ""}`;

  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById("panel-success").classList.add("active");
  for (let i = 1; i <= 4; i++) {
    const s = document.getElementById(`step-${i}`);
    s.classList.remove("active"); s.classList.add("done");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  S = { selected: new Set(), date: null, time: null, bookedSlots: [], customer: {} };
  ["inp-name","inp-phone","inp-email","inp-notes"].forEach(id => {
    document.getElementById(id).value = "";
  });
  buildServices();
  document.getElementById("service-summary").classList.remove("visible");
  document.getElementById("btn-step1").disabled = true;
  document.getElementById("time-slots-section").style.display = "none";
  const now = new Date();
  calYear = now.getFullYear(); calMonth = now.getMonth();
  goToStep(1);
  renderCalendar();
}

// ─────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────
function getSelected() {
  return Object.values(SERVICES).flat().filter(s => S.selected.has(s.id));
}
function getTotalDur() {
  return getSelected().reduce((t, s) => t + s.dur, 0);
}
function pad(n) { return String(n).padStart(2, "0"); }
function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function fmtDateLabel(d) {
  const dow = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  return `${dow[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function fmtTime(val) {
  const [h, m] = val.split(":").map(Number);
  const per = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${pad(m)} ${per}`;
}
function calcEnd(startVal, dur) {
  const [h, m] = startVal.split(":").map(Number);
  const total  = h * 60 + m + dur;
  return `${pad(Math.floor(total/60))}:${pad(total%60)}`;
}
// ─────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────
const CFG = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxXlb8DcV8BO_COFSWDQNPDglJOoArQdYi3qftAEklfmsYW48l1ccGNkJ6RCuoKTliL/exec",
  stylist:    "Hanh Dao",
  openDays:   [1, 2, 3, 4, 5, 6],   // Mon–Sat (0=Sun,1=Mon…6=Sat)
  openHour:   10,
  closeHour:  19,                    // 7 PM
  slotMin:    15,
};

// ─────────────────────────────────────────
//  SERVICES  (price shown to customer, dur used only for time-slot logic)
// ─────────────────────────────────────────
const SERVICES = {
  "✂️ Hair Services": [
    { id:"mens-cut",       name:"Men's Haircut",                      price:"$30+",     base:30,  dur:30  },
    { id:"mens-shampoo",   name:"Men's Shampoo Add-on",               price:"$5+",      base:5,   dur:15  },
    { id:"womens-cut",     name:"Women's Haircut",                    price:"$32+",     base:32,  dur:30  },
    { id:"womens-shampoo", name:"Women's Shampoo Add-on",             price:"$7+",      base:7,   dur:15  },
    { id:"blowdry",        name:"Shampoo + Simple Blow Dry",          price:"$20+",     base:20,  dur:30  },
    { id:"flatstyle",      name:"Shampoo + Straight Flat Iron Style", price:"$45+",     base:45,  dur:45  },
  ],
  "🎨 Hair Color & Perm": [
    { id:"root",           name:"Root Retouch",     price:"$90+",  base:90,  dur:60  },
    { id:"full-color",     name:"Full Hair Color",  price:"$120+", base:120, dur:60  },
    { id:"partial-foils",  name:"Partial Foils",    price:"$100+", base:100, dur:90  },
    { id:"full-foils",     name:"Full Foils",       price:"$150+", base:150, dur:90  },
    { id:"perm",           name:"Hair Perm",        price:"$90+",  base:90,  dur:60  },
  ],
  "👁️ Waxing Services": [
    { id:"eyebrow",  name:"Eyebrow Waxing", price:"$12+", base:12, dur:15 },
    { id:"lip",      name:"Lip Waxing",     price:"$12+", base:12, dur:15 },
    { id:"back-wax", name:"Back Waxing",    price:"$90+", base:90, dur:30 },
  ],
};

// ─────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────
let S = {
  selected:    new Set(),
  date:        null,
  time:        null,
  bookedSlots: [],
  customer:    {},
};

let calYear, calMonth;

// ─────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const now = new Date();
  calYear   = now.getFullYear();
  calMonth  = now.getMonth();
  buildServices();
  renderCalendar();
});

// ─────────────────────────────────────────
//  STEP 1 – Services
// ─────────────────────────────────────────
function buildServices() {
  const wrap = document.getElementById("services-container");
  wrap.innerHTML = "";

  for (const [cat, items] of Object.entries(SERVICES)) {
    const section = document.createElement("div");
    section.className = "service-category";
    section.innerHTML = `<div class="cat-title">${cat}</div>`;

    items.forEach(svc => {
      const el = document.createElement("div");
      el.className = "service-item";
      el.dataset.id = svc.id;
      el.innerHTML = `
        <div class="svc-check">✓</div>
        <div class="svc-info">
          <div class="svc-name">${svc.name}</div>
        </div>
        <div class="svc-price">${svc.price}</div>`;
      el.addEventListener("click", () => toggleSvc(svc.id, el));
      section.appendChild(el);
    });

    wrap.appendChild(section);
  }
}

function toggleSvc(id, el) {
  S.selected.has(id) ? S.selected.delete(id) : S.selected.add(id);
  el.classList.toggle("selected", S.selected.has(id));
  refreshSummary();
}

function refreshSummary() {
  const svcs = getSelected();
  const bar  = document.getElementById("service-summary");
  const btn  = document.getElementById("btn-step1");

  if (!svcs.length) {
    bar.classList.remove("visible");
    btn.disabled = true;
    return;
  }

  const total = svcs.reduce((t, s) => t + s.base, 0);
  bar.classList.add("visible");
  bar.innerHTML = `
    <span>${svcs.length} service${svcs.length > 1 ? "s" : ""}</span>
    <span class="sum-total">From $${total}+</span>`;
  btn.disabled = false;
}

// ─────────────────────────────────────────
//  STEP 2 – Calendar
// ─────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function renderCalendar() {
  document.getElementById("month-label").textContent = `${MONTHS[calMonth]} ${calYear}`;
  const cal = document.getElementById("calendar");
  cal.innerHTML = "";

  DAYS.forEach(d => {
    const h = document.createElement("div");
    h.className = "cal-hdr";
    h.textContent = d;
    cal.appendChild(h);
  });

  const today    = new Date(); today.setHours(0,0,0,0);
  const firstDow = new Date(calYear, calMonth, 1).getDay();
  const daysInMo = new Date(calYear, calMonth + 1, 0).getDate();

  for (let i = 0; i < firstDow; i++) {
    const e = document.createElement("div");
    e.className = "cal-day empty";
    cal.appendChild(e);
  }

  for (let d = 1; d <= daysInMo; d++) {
    const date = new Date(calYear, calMonth, d);
    const dow  = date.getDay();
    const past = date < today;
    const open = CFG.openDays.includes(dow);

    const isToday    = date.getTime() === today.getTime();
    const isSelected = S.date &&
      S.date.getFullYear() === calYear &&
      S.date.getMonth()    === calMonth &&
      S.date.getDate()     === d;

    const el = document.createElement("div");
    el.textContent = d;

    let cls = "cal-day";
    if      (isSelected)    cls += " selected";
    else if (past || !open) cls += past ? " past" : " closed";
    else                    cls += " available";
    if (isToday && !isSelected) cls += " today";

    el.className = cls;
    if (!past && open) el.addEventListener("click", () => pickDate(new Date(calYear, calMonth, d)));
    cal.appendChild(el);
  }
}

function pickDate(date) {
  S.date = date;
  S.time = null;
  document.getElementById("btn-step2").disabled = true;
  renderCalendar();
  fetchSlots(date);
}

async function fetchSlots(date) {
  const sec  = document.getElementById("time-slots-section");
  const wrap = document.getElementById("time-slots");
  sec.style.display = "block";
  wrap.innerHTML = `<div class="slots-loading">Loading times…</div>`;

  document.getElementById("selected-date-label").textContent =
    `— ${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;

  try {
    const r    = await fetch(`${CFG.SCRIPT_URL}?action=slots&date=${fmtDate(date)}`);
    const data = await r.json();
    S.bookedSlots = data.booked || [];
  } catch {
    S.bookedSlots = [];
  }

  buildSlots();
}

function buildSlots() {
  const wrap     = document.getElementById("time-slots");
  const totalDur = getTotalDur();
  const slots    = genSlots(totalDur);
  wrap.innerHTML = "";

  if (!slots.length) {
    wrap.innerHTML = `<p style="color:var(--text-light);font-size:.88rem">No available times.</p>`;
    return;
  }

  slots.forEach(({ label, val }) => {
    const el = document.createElement("div");
    el.className = "slot";
    el.textContent = label;

    if (S.bookedSlots.includes(val)) {
      el.classList.add("booked");
    } else {
      if (S.time === val) el.classList.add("selected");
      el.addEventListener("click", () => {
        S.time = val;
        buildSlots();
        document.getElementById("btn-step2").disabled = false;
      });
    }
    wrap.appendChild(el);
  });
}

function genSlots(totalDur) {
  const slots = [];
  const start = CFG.openHour * 60;
  const end   = CFG.closeHour * 60 - totalDur;

  for (let m = start; m <= end; m += CFG.slotMin) {
    const h   = Math.floor(m / 60);
    const min = m % 60;
    const per = h < 12 ? "AM" : "PM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    slots.push({
      label: `${h12}:${pad(min)} ${per}`,
      val:   `${pad(h)}:${pad(min)}`,
    });
  }
  return slots;
}

function prevMonth() {
  calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
  S.date = null; S.time = null;
  renderCalendar();
  document.getElementById("time-slots-section").style.display = "none";
  document.getElementById("btn-step2").disabled = true;
}

function nextMonth() {
  calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
  S.date = null; S.time = null;
  renderCalendar();
  document.getElementById("time-slots-section").style.display = "none";
  document.getElementById("btn-step2").disabled = true;
}

// ─────────────────────────────────────────
//  STEP 4 – Review
// ─────────────────────────────────────────
function renderReview() {
  const svcs     = getSelected();
  const totalDur = getTotalDur();
  const totalPx  = svcs.reduce((t, s) => t + s.base, 0);
  const endTime  = calcEnd(S.time, totalDur);

  document.getElementById("booking-summary").innerHTML = `
    ${row("Stylist",    CFG.stylist)}
    ${row("Date",       fmtDateLabel(S.date))}
    ${row("Time",       `${fmtTime(S.time)} – ${fmtTime(endTime)}`)}
    ${row("Services",   svcs.map(s => s.name).join("<br>"))}
    ${row("Est. Total", `From $${totalPx}+`, "total")}
    ${row("Name",       S.customer.name)}
    ${row("Phone",      S.customer.phone)}
    ${S.customer.email ? row("Email", S.customer.email) : ""}
    ${S.customer.notes ? row("Notes", S.customer.notes) : ""}`;
}

function row(lbl, val, cls = "") {
  return `<div class="sum-row ${cls}">
    <span class="sum-lbl">${lbl}</span>
    <span class="sum-val">${val}</span>
  </div>`;
}

// ─────────────────────────────────────────
//  NAVIGATION
// ─────────────────────────────────────────
function goToStep(n) {
  if (n === 3 && (!S.date || !S.time)) return;
  if (n === 4) {
    const name  = document.getElementById("inp-name").value.trim();
    const phone = document.getElementById("inp-phone").value.trim();
    if (!name || !phone) { alert("Please enter your name and phone number."); return; }
    S.customer = {
      name, phone,
      email: document.getElementById("inp-email").value.trim(),
      notes: document.getElementById("inp-notes").value.trim(),
    };
    renderReview();
  }

  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`panel-${n}`).classList.add("active");

  for (let i = 1; i <= 4; i++) {
    const s = document.getElementById(`step-${i}`);
    s.classList.remove("active","done");
    if (i < n) s.classList.add("done");
    if (i === n) s.classList.add("active");
  }
  for (let i = 1; i <= 3; i++) {
    document.getElementById(`line-${i}`).classList.toggle("done", i < n);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ─────────────────────────────────────────
//  SUBMIT
// ─────────────────────────────────────────
async function submitBooking() {
  const btn = document.getElementById("btn-confirm");
  btn.disabled = true;
  btn.textContent = "Submitting…";

  const svcs = getSelected();
  const params = new URLSearchParams({
    action:   "book",
    date:     fmtDate(S.date),
    time:     S.time,
    duration: String(getTotalDur()),
    services: svcs.map(s => s.name).join(", "),
    stylist:  CFG.stylist,
    name:     S.customer.name,
    phone:    S.customer.phone,
    email:    S.customer.email || "",
    notes:    S.customer.notes || "",
    total:    String(svcs.reduce((t, s) => t + s.base, 0)),
  });

  try {
    const r    = await fetch(CFG.SCRIPT_URL + "?" + params.toString());
    const data = await r.json();
    if (data.success) {
      showSuccess();
    } else {
      alert(data.message || "Time slot unavailable. Please choose another.");
      btn.disabled = false;
      btn.textContent = "✓ Confirm Booking";
    }
  } catch(e) {
    alert("Connection error. Please try again.");
    btn.disabled = false;
    btn.textContent = "✓ Confirm Booking";
  }
}

function showSuccess() {
  const svcs     = getSelected();
  const totalDur = getTotalDur();

  document.getElementById("success-details").innerHTML = `
    ${row("Stylist",  CFG.stylist)}
    ${row("Date",     fmtDateLabel(S.date))}
    ${row("Time",     `${fmtTime(S.time)} – ${fmtTime(calcEnd(S.time, totalDur))}`)}
    ${row("Services", svcs.map(s => s.name).join("<br>"))}
    ${row("Name",     S.customer.name)}
    ${row("Phone",    S.customer.phone)}
    ${S.customer.email ? row("Email", S.customer.email) : ""}`;

  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById("panel-success").classList.add("active");
  for (let i = 1; i <= 4; i++) {
    const s = document.getElementById(`step-${i}`);
    s.classList.remove("active"); s.classList.add("done");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  S = { selected: new Set(), date: null, time: null, bookedSlots: [], customer: {} };
  ["inp-name","inp-phone","inp-email","inp-notes"].forEach(id => {
    document.getElementById(id).value = "";
  });
  buildServices();
  document.getElementById("service-summary").classList.remove("visible");
  document.getElementById("btn-step1").disabled = true;
  document.getElementById("time-slots-section").style.display = "none";
  const now = new Date();
  calYear = now.getFullYear(); calMonth = now.getMonth();
  goToStep(1);
  renderCalendar();
}

// ─────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────
function getSelected() {
  return Object.values(SERVICES).flat().filter(s => S.selected.has(s.id));
}
function getTotalDur() {
  return getSelected().reduce((t, s) => t + s.dur, 0);
}
function pad(n) { return String(n).padStart(2, "0"); }
function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function fmtDateLabel(d) {
  const dow = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  return `${dow[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function fmtTime(val) {
  const [h, m] = val.split(":").map(Number);
  const per = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${pad(m)} ${per}`;
}
function calcEnd(startVal, dur) {
  const [h, m] = startVal.split(":").map(Number);
  const total  = h * 60 + m + dur;
  return `${pad(Math.floor(total/60))}:${pad(total%60)}`;
}

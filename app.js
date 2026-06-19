// ─────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────
const CFG = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxXIb8DcV8BO_COFSWDQNPDglJOoArQdYi3qftAEkIfmsYW48l1ccGNkJ6RCuoKTliL/exec",
  stylist:    "Hanh Dao",
  openDays:   [1, 2, 3, 4, 5, 6],   // Mon–Sat (0=Sun,1=Mon…6=Sat)
  openHour:   10,
  closeHour:  19,                    // 7 PM
  slotMin:    15,
  // Schedule optimization:
  //   "regular"  – show all 15-min slots (may leave gaps)
  //   "reduce"   – hide slots that create small unusable gaps
  //   "eliminate"– only show slots at the edge of free blocks (fewest gaps)
  optimization: "reduce",

  // Online availability
  minBookAheadHours:  2,    // must book at least X hours before start (0 = immediately)
  maxBookAheadMonths: 3,    // can only book within X months from today
  cancelCutoffHours:  2,    // must cancel at least X hours before (0 = anytime)
};

// ─────────────────────────────────────────
//  SERVICES  (price shown to customer, dur used only for time-slot logic)
// ─────────────────────────────────────────
const SERVICES = {
  "✂️ Hair Services": [
    { id:"mens-cut",       name:"Men's Haircut",                      price:"$30+",     base:30,  dur:30  },
    { id:"mens-shampoo",   name:"Men's Shampoo Add-on",               price:"$5+",      base:5,   dur:15  },
    { id:"womens-cut",     name:"Women's Haircut",                    price:"$35+",     base:35,  dur:30  },
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
    { id:"back-wax", name:"Back Waxing",    price:"$110+", base:110, dur:30 },
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
let closedPeriods = [];  // [{start:"2026-07-04", end:"2026-07-04", reason:"...", reopen:"2026-07-05"}]

// ─────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const params     = new URLSearchParams(window.location.search);
  const cancelId   = params.get("cancel");
  const declineId  = params.get("decline");
  const rescheduleId = params.get("reschedule");
  const doneId     = params.get("done");

  if (cancelId || declineId || rescheduleId || doneId) {
    document.querySelector(".steps").style.display = "none";
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));

    if (doneId) {
      document.getElementById("panel-done").classList.add("active");
      document.getElementById("done-ref-display").textContent = "Booking ref: " + doneId;
      window._doneId = doneId;
    } else if (declineId) {
      document.getElementById("panel-decline").classList.add("active");
      document.getElementById("decline-ref-display").textContent = "Booking ref: " + declineId;
      window._declineId = declineId;
    } else if (rescheduleId) {
      document.getElementById("panel-reschedule").classList.add("active");
      window._rescheduleId = rescheduleId;
      loadReschedule(rescheduleId);
    } else {
      document.getElementById("panel-cancel").classList.add("active");
      document.getElementById("cancel-ref-display").textContent = "Booking ref: " + cancelId;
      window._cancelId = cancelId;
    }
    return;
  }

  const now = new Date();
  calYear   = now.getFullYear();
  calMonth  = now.getMonth();
  buildServices();
  loadClosedDates().then(() => renderCalendar());
  toggleCarrier(); // hiện carrier dropdown ngay vì email mặc định trống
});

async function loadClosedDates() {
  try {
    const res  = await fetch(`${CFG.SCRIPT_URL}?action=closedDates&_=${Date.now()}`);
    const data = await res.json();
    if (data.closed) closedPeriods = data.closed;
  } catch(e) {
    closedPeriods = [];
  }
}

// Banner luôn hiển thị trên lịch: liệt kê các đợt đóng cửa sắp tới / đang diễn ra
function renderClosedBanner() {
  const existing = document.getElementById("closed-banner");
  if (existing) existing.remove();
  if (!closedPeriods.length) return;

  const today = fmtDate(new Date());
  const upcoming = closedPeriods
    .filter(p => p.end >= today)
    .sort((a, b) => (a.start < b.start ? -1 : 1));
  if (!upcoming.length) return;

  const lines = upcoming.map(p => {
    const range = p.start === p.end
      ? `<strong>${fmtDateDisplayStr(p.start)}</strong>`
      : `<strong>${fmtDateDisplayStr(p.start)}</strong> – <strong>${fmtDateDisplayStr(p.end)}</strong>`;
    const reopen = p.reopen ? ` · Reopens <strong>${fmtDateDisplayStr(p.reopen)}</strong>` : "";
    const reason = p.reason ? `${p.reason} — ` : "";
    return `<div>🚫 ${reason}Closed ${range}${reopen}</div>`;
  }).join("");

  const banner = document.createElement("div");
  banner.id = "closed-banner";
  banner.className = "closed-banner";
  banner.innerHTML = lines;

  const dp = document.querySelector("#panel-2 .date-picker");
  if (dp) dp.parentNode.insertBefore(banner, dp);
}

function getClosedInfo(dateStr) {
  for (const p of closedPeriods) {
    if (dateStr >= p.start && dateStr <= p.end) return p;
  }
  return null;
}

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

  const today   = new Date(); today.setHours(0,0,0,0);
  const maxDate = new Date(today);
  maxDate.setMonth(maxDate.getMonth() + CFG.maxBookAheadMonths);

  const firstDow = new Date(calYear, calMonth, 1).getDay();
  const daysInMo = new Date(calYear, calMonth + 1, 0).getDate();

  for (let i = 0; i < firstDow; i++) {
    const e = document.createElement("div");
    e.className = "cal-day empty";
    cal.appendChild(e);
  }

  // Remove old closed notice
  const oldNotice = document.getElementById("closed-notice");
  if (oldNotice) oldNotice.remove();

  // Banner thông báo đợt đóng cửa (luôn hiển thị, không cần bấm)
  renderClosedBanner();

  for (let d = 1; d <= daysInMo; d++) {
    const date      = new Date(calYear, calMonth, d);
    const dow       = date.getDay();
    const past      = date < today;
    const tooFar    = date > maxDate;
    const open      = CFG.openDays.includes(dow);
    const dateStr   = fmtDate(date);
    const closedInfo = (!past && !tooFar) ? getClosedInfo(dateStr) : null;
    const isSalonClosed = !!closedInfo;
    const avail     = !past && !tooFar && open && !isSalonClosed;

    const isToday    = date.getTime() === today.getTime();
    const isSelected = S.date &&
      S.date.getFullYear() === calYear &&
      S.date.getMonth()    === calMonth &&
      S.date.getDate()     === d;

    const el = document.createElement("div");
    el.textContent = d;

    let cls = "cal-day";
    if      (isSelected)    cls += " selected";
    else if (past)          cls += " past";
    else if (isSalonClosed) cls += " salon-closed";
    else if (!open || tooFar) cls += " closed";
    else                    cls += " available";
    if (isToday && !isSelected) cls += " today";

    el.className = cls;
    if (avail) {
      el.addEventListener("click", () => pickDate(new Date(calYear, calMonth, d)));
    } else if (isSalonClosed) {
      el.title = closedInfo.reason || "Salon closed";
      el.addEventListener("click", () => showClosedNotice(closedInfo));
    }
    cal.appendChild(el);
  }
}

function showClosedNotice(info) {
  const old = document.getElementById("closed-notice");
  if (old) old.remove();

  const reopenText = info.reopen
    ? ` We reopen on <strong>${fmtDateDisplayStr(info.reopen)}</strong>.`
    : "";
  const rangeText = info.start === info.end
    ? `<strong>${fmtDateDisplayStr(info.start)}</strong>`
    : `<strong>${fmtDateDisplayStr(info.start)}</strong> – <strong>${fmtDateDisplayStr(info.end)}</strong>`;

  const notice = document.createElement("div");
  notice.id = "closed-notice";
  notice.innerHTML =
    `🚫 <strong>${info.reason || "Salon is closed"}</strong> on ${rangeText}.${reopenText}
     <br><span style="font-size:.8rem;color:#999">Please select another date.</span>`;
  document.getElementById("calendar").after(notice);
}

function fmtDateDisplayStr(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${m}/${d}/${y}`;
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
    if (data.closed) {
      wrap.innerHTML = `<div class="closed-notice-inline">🚫 <strong>${data.reason || "Salon is closed"}</strong>${data.reopen ? `. Reopens <strong>${fmtDateDisplayStr(data.reopen)}</strong>` : ""}.</div>`;
      return;
    }
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
    wrap.innerHTML = `<p style="color:var(--text-light);font-size:.88rem">No available times for this date.</p>`;
    return;
  }

  slots.forEach(({ label, val }) => {
    const el = document.createElement("div");
    el.className = "slot";
    el.textContent = label;
    if (S.time === val) el.classList.add("selected");
    el.addEventListener("click", () => {
      S.time = val;
      buildSlots();
      document.getElementById("btn-step2").disabled = false;
    });
    wrap.appendChild(el);
  });
}

function genSlots(totalDur) {
  const openMin   = CFG.openHour * 60;
  const closeMin  = CFG.closeHour * 60;
  const bookedSet = new Set(S.bookedSlots);
  const opt       = CFG.optimization || "reduce";

  // Earliest bookable minute today (enforces minBookAheadHours)
  let cutoffMin = 0;
  if (S.date) {
    const now = new Date();
    const selDate = new Date(S.date); selDate.setHours(0,0,0,0);
    const todayDate = new Date(); todayDate.setHours(0,0,0,0);
    if (selDate.getTime() === todayDate.getTime()) {
      cutoffMin = now.getHours() * 60 + now.getMinutes() + CFG.minBookAheadHours * 60;
    }
  }

  // True if service starting at startMin doesn't overlap any booked segment
  function fits(startMin) {
    if (startMin < cutoffMin) return false;
    if (startMin + totalDur > closeMin) return false;
    for (let m = startMin; m < startMin + totalDur; m += 15) {
      if (bookedSet.has(pad(Math.floor(m/60)) + ":" + pad(m%60))) return false;
    }
    return true;
  }

  // Contiguous free blocks (in minutes): [[blockStart, blockEnd], ...]
  function freeBlocks() {
    const blocks = [];
    let bs = null;
    for (let m = openMin; m < closeMin; m += 15) {
      const key  = pad(Math.floor(m/60)) + ":" + pad(m%60);
      const free = !bookedSet.has(key);
      if ( free && bs === null) bs = m;
      if (!free && bs !== null) { blocks.push([bs, m]); bs = null; }
    }
    if (bs !== null) blocks.push([bs, closeMin]);
    return blocks;
  }

  function makeSlot(m) {
    const h   = Math.floor(m / 60);
    const min = m % 60;
    const per = h < 12 ? "AM" : "PM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return { label: `${h12}:${pad(min)} ${per}`, val: `${pad(h)}:${pad(min)}` };
  }

  const result = [];
  const seen   = new Set();
  const add    = m => { if (!seen.has(m) && fits(m)) { result.push(makeSlot(m)); seen.add(m); } };

  if (opt === "regular") {
    for (let m = openMin; m <= closeMin - totalDur; m += CFG.slotMin) add(m);

  } else if (opt === "eliminate") {
    for (const [bs, be] of freeBlocks()) {
      if (be - bs < totalDur) continue;
      add(bs);
      add(be - totalDur);
    }
    result.sort((a, b) => a.val.localeCompare(b.val));

  } else {
    // "reduce" — skip slots that leave gaps smaller than minGap minutes
    const minGap = 30;
    for (const [bs, be] of freeBlocks()) {
      if (be - bs < totalDur) continue;
      for (let m = bs; m <= be - totalDur; m += CFG.slotMin) {
        const gapBefore = m - bs;
        const gapAfter  = be - (m + totalDur);
        if ((gapBefore === 0 || gapBefore >= minGap) &&
            (gapAfter  === 0 || gapAfter  >= minGap)) add(m);
      }
    }
    result.sort((a, b) => a.val.localeCompare(b.val));
  }

  return result;
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
    const name    = document.getElementById("inp-name").value.trim();
    const phone   = document.getElementById("inp-phone").value.trim();
    const email   = document.getElementById("inp-email").value.trim();
    const carrier = document.getElementById("inp-carrier").value.trim();
    if (!name || !phone) { alert("Please enter your name and phone number."); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("Please enter a valid email address (e.g. name@gmail.com), or leave it blank.");
      return;
    }
    S.customer = {
      name, phone, email, carrier,
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
    carrier:  S.customer.carrier || "",
    notes:    S.customer.notes || "",
    total:    String(svcs.reduce((t, s) => t + s.base, 0)),
  });

  const dateStr = fmtDate(S.date);
  const timeStr = S.time;

  const ctrl    = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r    = await fetch(CFG.SCRIPT_URL + "?" + params.toString(), { signal: ctrl.signal });
    clearTimeout(timeout);
    const data = await r.json();
    if (data.success) {
      showSuccess();
    } else {
      alert(data.message || "Time slot unavailable. Please choose another.");
      btn.disabled = false;
      btn.textContent = "✓ Confirm Booking";
    }
  } catch(e) {
    clearTimeout(timeout);
    // Apps Script fetch cross-origin đôi khi treo dù booking ĐÃ lưu server-side.
    // Tự xác minh: kiểm tra slot đã bị đặt chưa → nếu rồi thì coi như thành công.
    const saved = await verifyBooked(dateStr, timeStr);
    if (saved) {
      showSuccess();
      return;
    }
    alert(e.name === "AbortError"
      ? "Request timed out. Please check your connection and try again."
      : "Connection error. Please try again.");
    btn.disabled = false;
    btn.textContent = "✓ Confirm Booking";
  }
}

// Kiểm tra một slot (HH:mm) đã bị đặt trên server chưa — dùng để xác minh
// khi response booking không về tới trình duyệt (fetch treo/timeout).
async function verifyBooked(dateStr, timeStr) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(CFG.SCRIPT_URL + "?action=slots&date=" + dateStr + "&_=" + Date.now());
      const d = await r.json();
      if (Array.isArray(d.booked) && d.booked.includes(timeStr)) return true;
    } catch (_) { /* thử lại */ }
    await new Promise(res => setTimeout(res, 2000));
  }
  return false;
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

// ─────────────────────────────────────────
//  DONE (salon only — finished client early)
// ─────────────────────────────────────────
async function performDone() {
  const bookingId = window._doneId;
  const btn = document.getElementById("btn-do-done");
  btn.disabled = true;
  btn.textContent = "Processing…";

  try {
    const r    = await fetch(`${CFG.SCRIPT_URL}?action=done&bookingId=${encodeURIComponent(bookingId)}`);
    const data = await r.json();

    if (data.success) {
      const freedMsg = data.freedMinutes > 0
        ? `<strong>${data.freedMinutes} min</strong> freed up — now open for new bookings.`
        : `The appointment is marked complete.`;
      document.getElementById("panel-done").innerHTML = `
        <div class="success-icon" style="background:#2e7d32">✅</div>
        <h2 style="color:#2e7d32;text-align:center">Marked as Done</h2>
        <p style="text-align:center;color:var(--text-light);margin-bottom:8px">${freedMsg}</p>
        <p style="text-align:center;color:var(--text-light)">Ends at <strong>${data.newEnd || ""}</strong></p>`;
    } else {
      alert(data.message || "Unable to mark done. Please try again.");
      btn.disabled = false;
      btn.textContent = "✅ Yes, Done";
    }
  } catch (e) {
    alert("Connection error. Please try again.");
    btn.disabled = false;
    btn.textContent = "✅ Yes, Done";
  }
}

// ─────────────────────────────────────────
//  DECLINE (salon only — from email link)
// ─────────────────────────────────────────
async function performDecline() {
  const bookingId = window._declineId;
  const btn = document.getElementById("btn-do-decline");
  btn.disabled = true;
  btn.textContent = "Processing…";

  try {
    const r    = await fetch(`${CFG.SCRIPT_URL}?action=decline&bookingId=${encodeURIComponent(bookingId)}`);
    const data = await r.json();

    if (data.success) {
      document.getElementById("panel-decline").innerHTML = `
        <div class="success-icon">✓</div>
        <h2 style="color:#2e7d32;text-align:center">Booking Declined</h2>
        <p style="text-align:center;color:var(--text-light);margin-bottom:20px">
          The customer has been notified.<br>The time slot is now available for other bookings.
        </p>`;
    } else {
      alert(data.message || "Unable to decline. Please try again.");
      btn.disabled = false;
      btn.textContent = "✕ Yes, Decline";
    }
  } catch (e) {
    alert("Connection error. Please try again.");
    btn.disabled = false;
    btn.textContent = "✕ Yes, Decline";
  }
}

// ─────────────────────────────────────────
//  CANCEL (from email link)
// ─────────────────────────────────────────
async function performCancel() {
  const bookingId = window._cancelId;
  const btn = document.getElementById("btn-do-cancel");
  btn.disabled = true;
  btn.textContent = "Cancelling…";

  try {
    const r    = await fetch(`${CFG.SCRIPT_URL}?action=cancel&bookingId=${encodeURIComponent(bookingId)}`);
    const data = await r.json();

    if (data.success) {
      document.getElementById("panel-cancel").innerHTML = `
        <div class="success-icon">✓</div>
        <h2 style="color:#2e7d32;text-align:center">Appointment Cancelled</h2>
        <p style="text-align:center;color:var(--text-light);margin-bottom:20px">
          Your appointment has been cancelled. A confirmation email has been sent.
        </p>
        <button class="btn-primary" onclick="location.href=location.pathname">
          Book New Appointment
        </button>`;
    } else {
      alert(data.message || "Unable to cancel. Please call us.");
      btn.disabled = false;
      btn.textContent = "Yes, Cancel";
    }
  } catch (e) {
    alert("Connection error. Please try again.");
    btn.disabled = false;
    btn.textContent = "Yes, Cancel";
  }
}

// ─────────────────────────────────────────
//  RESCHEDULE (from email link)
// ─────────────────────────────────────────
let rCalYear, rCalMonth, rDate = null, rTime = null;

async function loadReschedule(bookingId) {
  const currentDiv = document.getElementById("reschedule-current");
  currentDiv.innerHTML = `<p style="text-align:center;color:var(--text-light);font-size:.9rem">Loading…</p>`;

  try {
    const r    = await fetch(`${CFG.SCRIPT_URL}?action=getBooking&bookingId=${encodeURIComponent(bookingId)}`);
    const data = await r.json();

    if (!data.success) {
      currentDiv.innerHTML = `<p style="text-align:center;color:#c62828">${data.message || "Booking not found."}</p>`;
      document.getElementById("reschedule-picker").style.display = "none";
      return;
    }

    if (data.status === "CANCELLED" || data.status === "DECLINED") {
      currentDiv.innerHTML = `<p style="text-align:center;color:#c62828">This booking has been ${data.status.toLowerCase()} and cannot be rescheduled.</p>`;
      document.getElementById("reschedule-picker").style.display = "none";
      return;
    }

    window._rescheduleBooking = data;

    currentDiv.innerHTML = `
      <p style="font-size:.78rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text-light);margin-bottom:10px">Current Appointment</p>
      ${row("Date",     data.date)}
      ${row("Time",     fmtTime(data.time))}
      ${row("Stylist",  data.stylist)}
      ${row("Services", data.services)}`;

    const now = new Date();
    rCalYear  = now.getFullYear();
    rCalMonth = now.getMonth();
    renderRCalendar();

  } catch(e) {
    currentDiv.innerHTML = `<p style="text-align:center;color:#c62828">Connection error. Please try again.</p>`;
  }
}

function renderRCalendar() {
  document.getElementById("r-month-label").textContent = `${MONTHS[rCalMonth]} ${rCalYear}`;
  const cal = document.getElementById("r-calendar");
  cal.innerHTML = "";

  DAYS.forEach(d => {
    const h = document.createElement("div");
    h.className = "cal-hdr";
    h.textContent = d;
    cal.appendChild(h);
  });

  const today   = new Date(); today.setHours(0,0,0,0);
  const maxDate = new Date(today);
  maxDate.setMonth(maxDate.getMonth() + CFG.maxBookAheadMonths);

  const firstDow = new Date(rCalYear, rCalMonth, 1).getDay();
  const daysInMo = new Date(rCalYear, rCalMonth + 1, 0).getDate();

  for (let i = 0; i < firstDow; i++) {
    const e = document.createElement("div");
    e.className = "cal-day empty";
    cal.appendChild(e);
  }

  for (let d = 1; d <= daysInMo; d++) {
    const date   = new Date(rCalYear, rCalMonth, d);
    const dow    = date.getDay();
    const past   = date < today;
    const tooFar = date > maxDate;
    const open   = CFG.openDays.includes(dow);
    const avail  = !past && !tooFar && open;

    const isToday    = date.getTime() === today.getTime();
    const isSelected = rDate &&
      rDate.getFullYear() === rCalYear &&
      rDate.getMonth()    === rCalMonth &&
      rDate.getDate()     === d;

    const el = document.createElement("div");
    el.textContent = d;

    let cls = "cal-day";
    if      (isSelected) cls += " selected";
    else if (past)       cls += " past";
    else if (!open || tooFar) cls += " closed";
    else                 cls += " available";
    if (isToday && !isSelected) cls += " today";

    el.className = cls;
    if (avail) el.addEventListener("click", () => rPickDate(new Date(rCalYear, rCalMonth, d)));
    cal.appendChild(el);
  }
}

function rPickDate(date) {
  rDate = date;
  rTime = null;
  document.getElementById("btn-do-reschedule").disabled = true;
  renderRCalendar();
  rFetchSlots(date);
}

async function rFetchSlots(date) {
  const sec  = document.getElementById("r-time-slots-section");
  const wrap = document.getElementById("r-time-slots");
  sec.style.display = "block";
  wrap.innerHTML = `<div class="slots-loading">Loading times…</div>`;

  document.getElementById("r-selected-date-label").textContent =
    `— ${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;

  try {
    const r    = await fetch(`${CFG.SCRIPT_URL}?action=slots&date=${fmtDate(date)}&excludeId=${encodeURIComponent(window._rescheduleId)}`);
    const data = await r.json();
    S.bookedSlots = data.booked || [];
  } catch {
    S.bookedSlots = [];
  }

  const bk       = window._rescheduleBooking;
  const totalDur = Number(bk.duration);
  const savedDate = S.date;
  S.date = date;

  const slots = genSlots(totalDur);
  wrap.innerHTML = "";

  if (!slots.length) {
    wrap.innerHTML = `<p style="color:var(--text-light);font-size:.88rem">No available times for this date.</p>`;
    S.date = savedDate;
    return;
  }

  slots.forEach(({ label, val }) => {
    const el = document.createElement("div");
    el.className = "slot";
    el.textContent = label;
    if (rTime === val) el.classList.add("selected");
    el.addEventListener("click", () => {
      rTime = val;
      // Update selection visually without re-fetching (avoids race condition)
      document.querySelectorAll("#r-time-slots .slot").forEach(s => s.classList.remove("selected"));
      el.classList.add("selected");
      document.getElementById("btn-do-reschedule").disabled = false;
    });
    wrap.appendChild(el);
  });

  S.date = savedDate;
}

function rPrevMonth() {
  rCalMonth--; if (rCalMonth < 0) { rCalMonth = 11; rCalYear--; }
  rDate = null; rTime = null;
  renderRCalendar();
  document.getElementById("r-time-slots-section").style.display = "none";
  document.getElementById("btn-do-reschedule").disabled = true;
}

function rNextMonth() {
  rCalMonth++; if (rCalMonth > 11) { rCalMonth = 0; rCalYear++; }
  rDate = null; rTime = null;
  renderRCalendar();
  document.getElementById("r-time-slots-section").style.display = "none";
  document.getElementById("btn-do-reschedule").disabled = true;
}

async function submitReschedule() {
  const btn = document.getElementById("btn-do-reschedule");
  btn.disabled = true;
  btn.textContent = "Rescheduling…";

  const params = new URLSearchParams({
    action:    "reschedule",
    bookingId: window._rescheduleId,
    date:      fmtDate(rDate),
    time:      rTime,
  });

  const ctrl    = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 60000);
  try {
    const r    = await fetch(`${CFG.SCRIPT_URL}?${params}`, { signal: ctrl.signal });
    clearTimeout(timeout);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error("Invalid response from server. Please redeploy Apps Script."); }

    if (data.success) {
      document.getElementById("panel-reschedule").innerHTML = `
        <div class="success-icon" style="background:#e65100;font-size:1.5rem">🔄</div>
        <h2 style="color:#e65100;text-align:center">Appointment Rescheduled!</h2>
        <p style="text-align:center;color:var(--text-light);margin:12px 0 24px">
          Your new appointment is confirmed for<br>
          <strong>${fmtDateLabel(rDate)}</strong> at <strong>${fmtTime(rTime)}</strong>.<br>
          A confirmation email has been sent.
        </p>
        <button class="btn-primary" onclick="location.href=location.pathname">
          Book Another Appointment
        </button>`;
    } else {
      alert(data.message || "Unable to reschedule. Please try again.");
      btn.disabled = false;
      btn.textContent = "🔄 Confirm Reschedule";
    }
  } catch(e) {
    clearTimeout(timeout);
    alert(e.name === "AbortError"
      ? "Request timed out. Please try again."
      : (e.message || "Connection error. Please try again."));
    btn.disabled = false;
    btn.textContent = "🔄 Confirm Reschedule";
  }
}

// ─────────────────────────────────────────
//  RESET
// ─────────────────────────────────────────
function resetForm() {
  S = { selected: new Set(), date: null, time: null, bookedSlots: [], customer: {} };
  ["inp-name","inp-phone","inp-email","inp-notes"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("inp-carrier").value = "";
  document.getElementById("carrier-group").style.display = "none";
  buildServices();
  document.getElementById("service-summary").classList.remove("visible");
  document.getElementById("btn-step1").disabled = true;
  document.getElementById("btn-step2").disabled = true;
  // Khôi phục nút Confirm (sau lần book trước nó bị để disabled + "Submitting…")
  const confirmBtn = document.getElementById("btn-confirm");
  confirmBtn.disabled = false;
  confirmBtn.textContent = "✓ Confirm Booking";
  document.getElementById("time-slots-section").style.display = "none";
  const now = new Date();
  calYear = now.getFullYear(); calMonth = now.getMonth();
  goToStep(1);
  renderCalendar();
}

function toggleCarrier() {
  const email = document.getElementById("inp-email").value.trim();
  document.getElementById("carrier-group").style.display = email ? "none" : "block";
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

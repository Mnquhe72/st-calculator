/**
 * Test harness for st-calculator/index.html
 *
 * Runs the page's real inline <script> against a minimal DOM stub so the
 * production path (init -> generate -> export) executes outside a browser.
 * Verifies travel-rule maths, dates, warnings, validation and the .xlsx bytes.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const PAGE = path.join(ROOT, "index.html");
// STC_OUT lets the workbook be written somewhere this process can write,
// which is useful when the project folder itself is read-only.
const OUT = process.env.STC_OUT || path.join(__dirname, "out");

const html = fs.readFileSync(PAGE, "utf8");

/* ------------------------------- DOM stub ------------------------------- */
const registry = {};

function makeEl(id) {
  return {
    id,
    tagName: "DIV",
    style: {},
    value: "",
    textContent: "",
    className: "",
    disabled: false,
    _html: "",
    _children: [],
    get innerHTML() { return this._html; },
    set innerHTML(v) {
      this._html = String(v);
      this._children = [];
      let m;
      // Materialise every field the markup declares, applying its declared
      // value the way a browser does when parsing the attributes.
      const reInput = /<(?:input|textarea)\b([^>]*)>/g;
      while ((m = reInput.exec(this._html))) {
        const attrs = m[1];
        const idMatch = /\bid="([A-Za-z0-9_]+)"/.exec(attrs);
        if (!idMatch) continue;
        const el = ensure(idMatch[1]);
        const valMatch = /\bvalue="([^"]*)"/.exec(attrs);
        if (valMatch) el.value = valMatch[1];
      }
      const reId = /\sid="([A-Za-z0-9_]+)"/g;
      while ((m = reId.exec(this._html))) ensure(m[1]);
      const reDay = /class="day-block"/g;
      while (reDay.exec(this._html)) this._children.push(makeEl(id + "_day"));
    },
    appendChild(c) { this._children.push(c); return c; },
    removeChild() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener(type, fn) {
      // A real element keeps every listener; several fields here have more than
      // one handler per event type, so all of them must run.
      this._ev = this._ev || {};
      (this._ev[type] = this._ev[type] || []).push(fn);
    },
    dispatch(type) {
      const list = (this._ev && this._ev[type]) || [];
      for (const f of list) f({ preventDefault() {}, key: "", target: this });
    },
    scrollIntoView() {},
    focus() {},
    cloneNode() { return this; },
    classList: { add() {}, remove() {} }
  };
}

function ensure(id) {
  if (!registry[id]) registry[id] = makeEl(id);
  return registry[id];
}

/* Pre-register every id the page declares, as a browser would. */
{
  let m;
  const re = /\sid="([A-Za-z0-9_]+)"/g;
  while ((m = re.exec(html))) ensure(m[1]);
}

/* Seed the shipped defaults from the HTML. */
const DEFAULTS = {
  programme: "SPRING CLASSES PROGRAMME – MIP 2026",
  schoolLoc: "UMTAPO HIGH SCHOOL",
  educator: "MADONDO N.E.",
  subject: "GEOGRAPHY",
  homeLoc: "4 SEAFORTH AVE, SALT ROCK BALLITO",
  startDate: "2026-09-28",
  numDays: "5",
  startOdo: "92451",
  distance: "45"
};
for (const k of Object.keys(DEFAULTS)) ensure(k).value = DEFAULTS[k];

const document = {
  readyState: "complete",
  body: Object.assign(makeEl("body"), { className: "" }),
  getElementById: (id) => registry[id] || null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: (tag) => { const e = makeEl("created_" + tag); e.tagName = tag.toUpperCase(); return e; },
  addEventListener() {}
};

let lastDownload = null;
const storage = {};
const context = {
  document,
  window: {
    print() { lastDownload = { kind: "print" }; },
    scrollTo() {},
    addEventListener() {}
  },
  localStorage: {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; }
  },
  Blob: class Blob {
    constructor(parts, opts) {
      this.parts = parts;
      this.type = (opts && opts.type) || "";
      this.buffer = Buffer.concat(parts.map((p) =>
        typeof p === "string" ? Buffer.from(p, "utf8") : Buffer.from(p.buffer || p)
      ));
      this.size = this.buffer.length;
    }
  },
  URL: {
    createObjectURL(blob) { lastDownload = { kind: "blob", blob }; return "blob:test"; },
    revokeObjectURL() {}
  },
  setTimeout, clearTimeout, console, TextEncoder,
  Uint8Array, Uint32Array, Math, Date, JSON, RegExp,
  Array, Object, String, Number, Boolean, isNaN, parseInt, parseFloat
};
context.window.document = document;
context.globalThis = context;
vm.createContext(context);

/* ---------------------------- run the page JS ---------------------------- */
const scriptMatch = /<script>\s*([\s\S]*?)\s*<\/script>/.exec(html);
if (!scriptMatch) throw new Error("no inline script found in page");
vm.runInContext(scriptMatch[1], context, { filename: "index.html:script" });

/* ------------------------------- assertions ------------------------------ */
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail ? " -> " + detail : "")); }
}
function eq(name, actual, expected) {
  check(name, actual === expected, "got " + JSON.stringify(actual) + ", expected " + JSON.stringify(expected));
}

const logHtml = () => registry["logBody"].innerHTML;
const alertHtml = () => registry["outputAlerts"].innerHTML;
const formAlertHtml = () => registry["formAlerts"].innerHTML;
const generate = () => registry["generateBtn"].dispatch("click");
const edit = () => registry["editBtn"].dispatch("click");
function setAllTimes(start, end, n) {
  for (let i = 1; i <= n; i++) {
    ensure("lessonStart_" + i).value = start;
    ensure("lessonEnd_" + i).value = end;
  }
}

console.log("\n== day inputs ==");
const dayHtml = registry["dailyTimesContainer"].innerHTML;
eq("5 day blocks rendered", (dayHtml.match(/class="day-block"/g) || []).length, 5);
check("day 1 shows 28-Sep-2026 Monday",
  dayHtml.includes("Day 1 &mdash; 28-Sep-2026") && dayHtml.includes("Monday"));

console.log("\n== defaults: 08:00-10:00, 45 km, 5 days ==");
setAllTimes("08:00", "10:00", 5);
generate();
eq("output visible", registry["outputContainer"].style.display, "block");
eq("form hidden", registry["formContainer"].style.display, "none");
eq("date range", registry["o_dates"].textContent, "28-Sep-2026 \u2013 02-Oct-2026");
eq("duration", registry["o_duration"].textContent, "5 days \u00D7 2 Hours (Total: 10 Hours)");
eq("total km", registry["o_total"].textContent, "450");
eq("10 trip rows", (logHtml().match(/<tr>/g) || []).length, 10);
check("leaves home 07:15 (45 before)", logHtml().includes("07:15"));
check("arrives school 07:45 (15 before)", logHtml().includes("07:45"));
check("leaves school 10:10 (10 after)", logHtml().includes("10:10"));
check("arrives home 10:30 (30 after)", logHtml().includes("10:30"));
check("first odometer start 92451", logHtml().includes("<td>92451</td>"));
check("last odometer end 92901", logHtml().includes("<td>92901</td>"));
eq("one 'all rules satisfied' notice", (alertHtml().match(/alert ok/g) || []).length, 1);

console.log("\n== warning: 60 km one-way = 120 km round trip ==");
ensure("distance").value = "60";
edit();
generate();
check("daily-limit warning", /exceeds the 100 km daily maximum/.test(alertHtml()));
check("programme-total warning", /exceeds the 500 km programme maximum/.test(alertHtml()));
eq("total km now 600", registry["o_total"].textContent, "600");
ensure("distance").value = "45";

console.log("\n== validation ==");
edit();
ensure("lessonStart_2").value = "";
generate();
check("blank time is rejected", /Day 2 .*valid lesson start and end time/.test(formAlertHtml()));
eq("form stays visible on error", registry["formContainer"].style.display, "block");
ensure("lessonStart_2").value = "08:00";

ensure("lessonEnd_3").value = "07:00";
generate();
check("end-before-start is rejected", /lesson end time must be after the start time/.test(formAlertHtml()));
ensure("lessonEnd_3").value = "10:00";

ensure("distance").value = "0";
generate();
check("zero distance is rejected", /distance must be greater than 0/.test(formAlertHtml()));

ensure("distance").value = "1e308";
generate();
check("absurd distance is rejected, not rendered as Infinity",
  /1000 km or less/.test(formAlertHtml()), formAlertHtml());
check("no Infinity leaked into the document",
  !/Infinity|NaN/.test(logHtml() + registry["o_total"].textContent));
ensure("distance").value = "45";

ensure("startOdo").value = "1e308";
generate();
check("absurd odometer is rejected", /speedometer reading must be/.test(formAlertHtml()), formAlertHtml());
ensure("startOdo").value = "92451";
generate();

ensure("distance").value = "1923.08";
generate();
check("distance above the 1000 km ceiling is rejected",
  /1000 km or less/.test(formAlertHtml()), formAlertHtml());
ensure("distance").value = "1000";
generate();
check("distance of exactly 1000 km is accepted",
  registry["outputContainer"].style.display === "block", formAlertHtml());
ensure("distance").value = "45";
generate();

console.log("\n== past-midnight handling ==");
edit();
setAllTimes("23:00", "23:50", 5);
generate();
check("late lesson generates", registry["outputContainer"].style.display === "block");
check("past-midnight warning", /runs past midnight/.test(alertHtml()));
check("'next day' badge shown", /pill bad/.test(logHtml()));
check("home arrival wraps to 00:20", logHtml().includes("00:20"));
setAllTimes("08:00", "10:00", 5);

console.log("\n== decimals in distance (the precision-lag trigger) ==");
// This is the exact sequence that once printed "46" km cells against a "455"
// total: a whole-number document, then Edit, then a fractional distance.
edit();
ensure("distance").value = "45.5";
generate();
eq("rows still even", (logHtml().match(/<tr>/g) || []).length, 10);
{
  const rows = [...logHtml().matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  const km = rows.map((r) => {
    const tds = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => x[1].replace(/<[^>]*>/g, ""));
    return tds[tds.length - 1];
  });
  check("km cells print 45.5, not a stale-precision 46",
    km.every((v) => Number(v) === 45.5), JSON.stringify(km.slice(0, 3)));
  const totalText = registry["o_total"].textContent;
  const dp = (totalText.split(".")[1] || "").length;
  eq("total equals the sum of those cells",
    Number(km.reduce((a, v) => a + Number(v), 0).toFixed(dp)),
    Number(Number(totalText).toFixed(dp)));
  // The rendered odometer step must equal the rendered distance.
  check("odometer step matches the printed distance",
    /<td>92451<\/td><td>92496\.50?<\/td><td>45\.50?<\/td>/.test(logHtml()),
    logHtml().slice(0, 260));
}
ensure("distance").value = "45";

console.log("\n== xlsx export ==");
edit();
// Optional scenario overrides so a workbook can be validated externally, e.g.
//   STC_DISTANCE=150.25 STC_DAYS=5 node tests/test_page.js
//   python tests/accept_xlsx.py tests/out/Travel_Log.xlsx 150.25 5 92451
if (process.env.STC_DISTANCE) {
  ensure("distance").value = process.env.STC_DISTANCE;
  ensure("distance").dispatch("input");
}
if (process.env.STC_DAYS) {
  ensure("numDays").value = process.env.STC_DAYS;
  ensure("numDays").dispatch("change");
  const n = parseInt(process.env.STC_DAYS, 10);
  for (let i = 1; i <= n; i++) setAllTimes("08:00", "10:00", n);
}
if (process.env.STC_ODO) {
  ensure("startOdo").value = process.env.STC_ODO;
  ensure("startOdo").dispatch("change");
}
generate();
registry["excelBtn"].dispatch("click");
check("blob download triggered", !!(lastDownload && lastDownload.kind === "blob"),
  lastDownload && lastDownload.kind);

const isDefaultScenario = !process.env.STC_DISTANCE && !process.env.STC_DAYS && !process.env.STC_ODO;
if (lastDownload && lastDownload.blob) {
  const buf = lastDownload.blob.buffer;
  const xlsxPath = path.join(OUT, "Travel_Log.xlsx");
  // Writing the workbook out is a convenience for the Python acceptance test;
  // where the folder is read-only the in-memory checks below still run.
  try {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(xlsxPath, buf);
    console.log("  info  wrote " + buf.length + " bytes -> " + xlsxPath);
  } catch (err) {
    console.log("  info  could not write " + xlsxPath + " (" + err.code + "); in-memory checks only");
  }

  check("mime type is xlsx", lastDownload.blob.type.includes("spreadsheetml"), lastDownload.blob.type);

  eq("zip local header", buf.readUInt32LE(0), 0x04034b50);

  const parts = new Map();
  let p = 0;
  while (p < buf.length - 4 && buf.readUInt32LE(p) === 0x04034b50) {
    const crc = buf.readUInt32LE(p + 14);
    const size = buf.readUInt32LE(p + 18);
    const nameLen = buf.readUInt16LE(p + 26);
    const extraLen = buf.readUInt16LE(p + 28);
    const name = buf.toString("utf8", p + 30, p + 30 + nameLen);
    const dataStart = p + 30 + nameLen + extraLen;
    parts.set(name, { data: buf.subarray(dataStart, dataStart + size), crc });
    p = dataStart + size;
  }
  console.log("  info  parts: " + [...parts.keys()].join(", "));

  eq("6 parts in package", parts.size, 6);
  for (const required of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml",
    "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"]) {
    check("part present: " + required, parts.has(required));
  }

  const table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (b) => {
    let c = 0xffffffff;
    for (let i = 0; i < b.length; i++) c = table[(c ^ b[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  for (const [name, part] of parts) eq("CRC ok: " + name, crc32(part.data), part.crc);

  const sheet = parts.get("xl/worksheets/sheet1.xml").data.toString("utf8");
  check("sheet declares namespace",
    sheet.includes('xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'));

  // The remaining assertions encode the default scenario (45 km x 5 days);
  // scenario runs are validated by tests/accept_xlsx.py instead.
  if (isDefaultScenario) {
  check("sheet has all 9 table headers",
    ["DATE", "REASON", "DEPARTURE FROM", "DEPARTURE TIME", "ARRIVAL AT", "ARRIVAL TIME",
      "SPEEDOMETER START", "SPEEDOMETER END", "KILOMETRES"].every((h) => sheet.includes(">" + h + "<")));
  check("sheet carries the real dates", sheet.includes("28-Sep-2026") && sheet.includes("02-Oct-2026"));
  check("sheet carries educator", sheet.includes("MADONDO N.E."));
  check("sheet has mergeCells", sheet.includes("<mergeCells"));
  check("sheet escaped ampersand", sheet.includes("TRAVEL &amp; ATTENDANCE LOG"));
  check("sheet closes correctly", sheet.trim().endsWith("</worksheet>"));

  // One row per trip: 10 trip rows, no embedded-newline cells.
  const dataRows = (sheet.match(/<row r="(1[5-9]|2[0-4])"/g) || []).length;
  eq("10 trip rows in sheet", dataRows, 10);
  check("no newline-joined cells left", !sheet.includes("\\n"));

  // Numeric typing: odometer columns G/H and distance column I must be numbers.
  const row15 = /<row r="15">([\s\S]*?)<\/row>/.exec(sheet)[1];
  const cells15 = {};
  let cm;
  const reCell = /<c r="([A-I]15)"[^>]*t="([a-zA-Z]+)"[^>]*>(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*)<\/t><\/is>|<f>([^<]*)<\/f><v>([^<]*)<\/v>)?<\/c>/g;
  while ((cm = reCell.exec(row15))) {
    cells15[cm[1]] = { type: cm[2], value: cm[3] !== undefined ? cm[3] : cm[4], formula: cm[5], cached: cm[6] };
  }
  eq("G15 typed numeric", cells15.G15 && cells15.G15.type, "n");
  eq("H15 typed numeric", cells15.H15 && cells15.H15.type, "n");
  eq("I15 typed numeric", cells15.I15 && cells15.I15.type, "n");
  eq("G15 value 92451", cells15.G15 && cells15.G15.value, "92451");
  check("I15 value 45 (no trailing .0)", cells15.I15 && cells15.I15.value === "45", cells15.I15 && cells15.I15.value);

  // Total row must be a live SUM over the trip rows with a cached value.
  check("total row uses SUM formula", /<f>SUM\(I15:I24\)<\/f>/.test(sheet), sheet.slice(sheet.indexOf("TOTAL KILOMETRES") - 200, sheet.indexOf("TOTAL KILOMETRES") + 400));
  check("total cached value 450", /<c r="I25"[^>]*><f>SUM\(I15:I24\)<\/f><v>450<\/v><\/c>/.test(sheet));
  check("autofilter over data range", sheet.includes('autoFilter ref="A14:I24"'));

  const workbook = parts.get("xl/workbook.xml").data.toString("utf8");
  check("workbook names sheet 'Travel Log'", workbook.includes('name="Travel Log"'));
  const styles = parts.get("xl/styles.xml").data.toString("utf8");
  check("styles declare 9 cellXfs", /<cellXfs count="9">/.test(styles));
  }
}

console.log("\n================ " + pass + " passed, " + fail + " failed " +
  (process.env.STC_SUMMARY_ONLY ? "(scenario summary)" : "") + " ================\n");
if (process.env.STC_SUMMARY_ONLY) process.exit(fail === 0 ? 0 : 1);

console.log("\n== regression: blank start date must not crash (was a TypeError) ==");
edit();
ensure("startDate").value = "";
let threw = null;
try { generate(); } catch (e) { threw = e; }
check("generate() does not throw", threw === null, threw && threw.message);
check("start-date error shown", /valid start date/.test(formAlertHtml()), formAlertHtml());
eq("form still visible", registry["formContainer"].style.display, "block");
ensure("startDate").value = "2026-09-28";

console.log("\n== regression: impossible calendar date is rejected ==");
edit();
ensure("startDate").value = "2026-02-31";
threw = null;
try { generate(); } catch (e) { threw = e; }
check("no crash on 2026-02-31", threw === null, threw && threw.message);
check("2026-02-31 rejected, not rolled over", /valid start date/.test(formAlertHtml()));
ensure("startDate").value = "2026-09-28";

console.log("\n== duration must follow the lesson times ==");
edit();
setAllTimes("08:00", "12:00", 5);
generate();
eq("4-hour lessons report 20 Hours", registry["o_duration"].textContent, "5 days \u00D7 4 Hours (Total: 20 Hours)");
setAllTimes("08:00", "10:00", 5);
generate();
eq("2-hour lessons report 10 Hours", registry["o_duration"].textContent, "5 days \u00D7 2 Hours (Total: 10 Hours)");

console.log("\n== day count is validated, not silently coerced ==");
edit();
ensure("numDays").value = "0";
generate();
check("0 days rejected", /between 1 and 31/.test(formAlertHtml()), formAlertHtml());
ensure("numDays").value = "999";
generate();
check("999 days rejected", /between 1 and 31/.test(formAlertHtml()));
ensure("numDays").value = "5";
setAllTimes("08:00", "10:00", 5);

console.log("\n== regression: early-morning wrap gets day context ==");
edit();
ensure("lessonStart_1").value = "00:10";
ensure("lessonEnd_1").value = "01:00";
generate();
check("previous-day warning raised", /begins on the previous day/.test(alertHtml()), alertHtml().slice(0, 200));
check("'previous day' pill shown", /previous day<\/span>/.test(logHtml()), logHtml().slice(0, 400));
setAllTimes("08:00", "10:00", 5);

console.log("\n== regression: only one error is reported for a blank date ==");
edit();
ensure("startDate").value = "";
generate();
const blankAlerts = (formAlertHtml().match(/class="alert err"/g) || []).length;
eq("exactly one alert for a blank date", blankAlerts, 1);
ensure("startDate").value = "2026-09-28";

console.log("\n== regression: non-integer day count is rejected, not truncated ==");
edit();
ensure("numDays").value = "2.5";
generate();
check("2.5 days rejected", /must be a whole number/.test(formAlertHtml()), formAlertHtml());
eq("no document generated", registry["formContainer"].style.display, "block");
ensure("numDays").value = "5";
setAllTimes("08:00", "10:00", 5);

console.log("\n== duration grammar and partial hours ==");
edit();
setAllTimes("08:00", "10:07", 5);   // 2 h 7 min per day, 10 h 35 min total
generate();
eq("partial hours reported exactly",
  registry["o_duration"].textContent, "5 days \u00D7 2 Hours 7 Mins (Total: 10 Hours 35 Mins)");
edit();
ensure("numDays").value = "1";
ensure("lessonStart_1").value = "08:00";
ensure("lessonEnd_1").value = "09:00";
generate();
eq("single hour is singular",
  registry["o_duration"].textContent, "1 day \u00D7 1 Hour (Total: 1 Hour)");
edit();
ensure("numDays").value = "5";
setAllTimes("08:00", "10:00", 5);

console.log("\n== decimal distances: every km cell and the total must agree ==");
const kmColumn = () => {
  // KILOMETRES is the last cell of each trip row.
  const rows = [...logHtml().matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  return rows.map((r) => {
    const tds = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => x[1].replace(/<[^>]*>/g, ""));
    return tds[tds.length - 1];
  });
};
for (const dist of ["45.55", "150.25", "45.005", "100.5", "0.12", "900.12"]) {
  edit();
  ensure("distance").value = dist;
  generate();
  // The document prints at two decimal places, so compare against that form.
  const expected = Number(Number(dist).toFixed(2));
  const col = kmColumn();
  eq("10 km cells rendered for " + dist, col.length, 10);
  check("every km cell prints the expected figure for " + dist,
    col.every((v) => Number(v) === expected), JSON.stringify(col.slice(0, 3)) + " expected " + expected);
  // The total must equal the sum of the cells, compared at the printed precision.
  const totalText = registry["o_total"].textContent;
  const dp = (totalText.split(".")[1] || "").length;
  const shown = Number(Number(totalText).toFixed(dp));
  const cellsSum = Number(col.reduce((a, v) => a + Number(v), 0).toFixed(dp));
  eq("total equals the sum of the km cells for " + dist, cellsSum, shown);
}
ensure("distance").value = "45";
console.log("\n== regression: exponent notation in the day count ==");
// Typing in the day field fires "change", which rebuilds the per-day inputs.
const setDays = (v) => {
  ensure("numDays").value = v;
  ensure("numDays").dispatch("change");   // rebuilds the per-day inputs
  const n = parseInt(v, 10) || 1;
  for (let i = 1; i <= n; i++) setAllTimes("08:00", "10:00", n);
};
edit();
setDays("1e1");                      // parseInt would read this as 1
generate();
check("1e1 is accepted as 10 days", registry["outputContainer"].style.display === "block", formAlertHtml());
eq("1e1 generates 10 days", registry["o_duration"].textContent, "10 days \u00D7 2 Hours (Total: 20 Hours)");
eq("1e1 renders 10 day blocks", (registry["dailyTimesContainer"].innerHTML.match(/class="day-block"/g) || []).length, 10);
edit();
setDays("3.1e1");                    // 31 days
generate();
eq("3.1e1 generates 31 days", registry["o_duration"].textContent, "31 days \u00D7 2 Hours (Total: 62 Hours)");
edit();
setDays("1e-1");                     // 0.1 -> rejected
generate();
check("1e-1 rejected", /whole number|between 1 and 31/.test(formAlertHtml()), formAlertHtml());
ensure("numDays").value = "5";
setAllTimes("08:00", "10:00", 5);

console.log("\n== regression: precision never flips inside one document ==");
edit();
ensure("startOdo").value = "99999.90";
ensure("distance").value = "0.12";
generate();
const odoCells = [...logHtml().matchAll(/<td>(99999\.[0-9]+|100000\.[0-9]+)<\/td>/g)].map((m) => m[1]);
const decimals = new Set(odoCells.map((v) => (v.split(".")[1] || "").length));
eq("one precision used for every odometer cell", decimals.size, 1);
check("that precision is 2 for a 0.12 km document", [...decimals][0] === 2, [...decimals].join(","));
ensure("startOdo").value = "92451";
ensure("distance").value = "45";

console.log("\n== print path ==");
edit();
generate();
check("document visible before print", registry["outputContainer"].style.display === "block");
lastDownload = null;
registry["printBtn"].dispatch("click");
check("print() invoked", !!(lastDownload && lastDownload.kind === "print"));

// After Edit the document is invalidated; printing must regenerate it rather
// than print an empty skeleton or a stale document.
edit();
eq("output hidden after Edit", registry["outputContainer"].style.display, "none");
lastDownload = null;
registry["printBtn"].dispatch("click");
check("print after Edit regenerates the document",
  registry["outputContainer"].style.display === "block");
check("print after Edit calls print()", !!(lastDownload && lastDownload.kind === "print"));

console.log("\n================ " + pass + " passed, " + fail + " failed ================\n");
process.exit(fail === 0 ? 0 : 1);

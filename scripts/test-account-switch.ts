// ─── QA 0.9.3 — عایق حساب‌ها: نشت نشان‌ها بین حساب‌ها ممنوع ──────────────────
// سناریو: حساب A با نشان‌های زیاد → تعویض به حساب B (بدون خروج/با خروج) →
// دادهٔ A باید پاک شود؛ حساب B از صفر شروع می‌کند. همان حساب → هیچ پاک‌سازی.
// اجرا: bun scripts/test-account-switch.ts (با shim سادهٔ localStorage)

type Rec = Record<string, string>;
const mem: Rec = {};
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => (k in mem ? mem[k] : null),
  setItem: (k: string, v: string) => { mem[k] = String(v); },
  removeItem: (k: string) => { delete mem[k]; },
  clear: () => { for (const k of Object.keys(mem)) delete mem[k]; },
};

let passed = 0, failed = 0;
function assert(cond: boolean, label: string, extra = "") {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.error(`  ✗ ${label} ${extra}`); }
}

const { useApp } = await import("../src/lib/store");
const { handleAccountSwitch, wipeLocalUserData, priorCloudUid } = await import("../src/lib/cloud-sync");

// ── حالت اولیهٔ حساب A: نشان، پیشرفت و یادداشت دارد
useApp.setState({
  marks: { "m-l1-1": [{ id: "mk1", secId: "s1", text: "متن نشان حساب قبلی", color: "yellow", createdAt: 1 }] },
  progress: { "m-l1-1": { status: "in-progress", sectionsSeen: 3, quizAttempts: [] } },
  notes: { "m-l1-1": [{ id: "n1", text: "یادداشت حساب قبلی", createdAt: 1 }] },
  hiddenBuiltins: [],
});
localStorage.setItem("lexa-law-marks", JSON.stringify({ "l-1": [{ id: "lm1", text: "نشان قانون", color: "blue" }] }));
localStorage.setItem("hoh_weak_topics", JSON.stringify(["حجر"]));

console.log("▌ ۱) ورود اولین حساب روی دستگاه — بدون تعویض، بدون پاک‌سازی");
const r1 = handleAccountSwitch("uid-A");
assert(r1 === false, "اولین ورود: تعویض حساب شمرده نشد");
assert(Object.keys(useApp.getState().marks).length === 1, "نشان‌های حساب A سر جای خودند");
assert(priorCloudUid() === "uid-A", "uid ثبت شد");

console.log("▌ ۲) تعویض به حساب B (حالا کاربر حساب تازه می‌سازد) — دادهٔ A باید پاک شود");
const r2 = handleAccountSwitch("uid-B");
assert(r2 === true, "تعویض حساب تشخیص داده شد");
assert(Object.keys(useApp.getState().marks).length === 0, "نشان‌های درس حساب A نشت نکرد", JSON.stringify(useApp.getState().marks));
assert(Object.keys(useApp.getState().progress).length === 0, "پیشرفت حساب A پاک شد");
assert(Object.keys(useApp.getState().notes).length === 0, "یادداشت‌های حساب A پاک شد");
assert(useApp.getState().examAttempts && Object.keys(useApp.getState().examAttempts).length === 0, "تاریخچهٔ آزمون پاک است");
assert(localStorage.getItem("lexa-law-marks") === null, "نشان‌های قانون پاک شد");
assert(localStorage.getItem("hoh_weak_topics") === null, "مباحث ضعیف پاک شد");
assert(priorCloudUid() === "uid-B", "uid جدید ثبت شد");

console.log("▌ ۳) بوت دوباره با همان حساب B — هیچ پاک‌سازی");
useApp.setState({ marks: { "m-l2-2": [{ id: "mk2", secId: "s2", text: "نشان حساب B", color: "green", createdAt: 2 }] } });
const r3 = handleAccountSwitch("uid-B");
assert(r3 === false, "همان حساب: بدون تعویض");
assert(Object.keys(useApp.getState().marks).length === 1 && useApp.getState().marks["m-l2-2"], "نشان‌های حساب B دست‌نخورده");

console.log("▌ ۴) خروج (wipe مستقیم) → حساب C — باز هم بدون نشت");
wipeLocalUserData();
assert(Object.keys(useApp.getState().marks).length === 0, "خروج: داده‌ها پاک شد");
handleAccountSwitch("uid-C");
assert(priorCloudUid() === "uid-C", "uid حساب C ثبت شد");

console.log("▌ ۵) سیاست کتابخانهٔ خالی حساب تازه — setHiddenBuiltins با همهٔ دوره‌های آماده");
const { builtinCourses } = await import("../src/lib/law/courses");
useApp.getState().setHiddenBuiltins(builtinCourses.map((c) => c.id));
assert(useApp.getState().hiddenBuiltins.length === builtinCourses.length, `همهٔ دوره‌های آماده (${builtinCourses.length}) از کتابخانهٔ من حذف شدند`);
const { mergeVisible } = await import("../src/lib/books");
const visible = mergeVisible({ customCourses: [], tBooks: [], hiddenBuiltins: useApp.getState().hiddenBuiltins });
assert(visible.length === 0, "لیست مطالعهٔ حساب تازه خالی است (انتخاب از کتابخانهٔ عمومی)");

console.log(`\nنتیجه: ${passed} سبز / ${failed} سرخ`);
if (failed > 0) process.exit(1);

/* تست پلی‌فیل‌های compat-script در محیط فقیر (شبیه‌سازی WebView قدیمی) */
globalThis.window = globalThis; // شبیه‌سازی مرورگر
const { compatScript } = require("/home/z/my-project/scripts/compat-script.cjs");

// شبیه‌سازی: حذف APIهای مدرن از globalThis قبل از اجرای پلی‌فیل
delete Object.hasOwn;
if (!Object.prototype.hasOwnProperty.call(Object, "fromEntries")) {} // node دارد؛ در تست زیر چک می‌کنیم
const nativeFromEntries = Object.fromEntries;
delete Object.fromEntries;
const nativeStructuredClone = globalThis.structuredClone;
delete globalThis.structuredClone;
const nativeFlat = Array.prototype.flat;
delete Array.prototype.flat;
const nativeAt = Array.prototype.at;
delete Array.prototype.at;
const nativeReplaceAll = String.prototype.replaceAll;
delete String.prototype.replaceAll;
const nativeAllSettled = Promise.allSettled;
delete Promise.allSettled;

// اجرای اسکریپت (همان‌طور که در WebView اجرا می‌شود)
eval(compatScript);

let ok = 0, bad = 0;
const t = (cond, name) => { if (cond) { ok++; console.log("  ✓", name); } else { bad++; console.error("  ✗", name); } };

t(Object.hasOwn({ a: 1 }, "a") === true, "Object.hasOwn polyfill");
t(Object.hasOwn({ a: 1 }, "b") === false, "Object.hasOwn false-case");
t(Object.fromEntries([["a", 1], ["b", 2]]).a === 1, "Object.fromEntries");
const sc = structuredClone({ d: new Date(2026, 0, 1), m: new Map([["k", 1]]), s: new Set([1, 2]), arr: [1, [2, [3]]], o: { x: { y: "z" } }, re: /ab+c/g });
t(sc.d instanceof Date && sc.d.getFullYear() === 2026, "structuredClone: Date");
t(sc.m instanceof Map && sc.m.get("k") === 1, "structuredClone: Map");
t(sc.s instanceof Set && sc.s.has(2), "structuredClone: Set");
t(sc.arr[1][1][0] === 3 && sc.arr !== sc.o, "structuredClone: nested arrays");
t(sc.re instanceof RegExp && sc.re.flags === "g", "structuredClone: RegExp");
const circ = {}; circ.self = circ;
t(typeof structuredClone(circ) === "object", "structuredClone: بدون کرش روی ورودی‌های معمول");
t([1, 2, 3].flat().length === 3, "Array.prototype.flat");
t([1, 2, 3].at(-1) === 3, "Array.prototype.at");
t("a-b-c".replaceAll("-", "+") === "a+b+c", "String.prototype.replaceAll");
t(typeof AbortSignal.timeout === "function", "AbortSignal.timeout polyfill");
(async () => {
  const sig = AbortSignal.timeout(30);
  await new Promise((r) => setTimeout(r, 60));
  t(sig.aborted === true, "AbortSignal.timeout واقعاً abort می‌کند");
  const res = await Promise.allSettled([Promise.resolve(1), Promise.reject(new Error("x"))]);
  t(res[0].status === "fulfilled" && res[1].status === "rejected", "Promise.allSettled");
  // بازگردانی اصل‌ها برای بقیهٔ تست‌ها
  Object.fromEntries = nativeFromEntries;
  globalThis.structuredClone = nativeStructuredClone;
  Array.prototype.flat = nativeFlat;
  Array.prototype.at = nativeAt;
  String.prototype.replaceAll = nativeReplaceAll;
  Promise.allSettled = nativeAllSettled;
  console.log(`\nنتیجه: ${ok} ✓ / ${bad} ✗`);
  process.exit(bad ? 1 : 0);
})();

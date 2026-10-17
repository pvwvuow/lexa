/* Lexa web: a static reader for GitHub Pages.
 * Sign-up and sign-in use the same Supabase project as the app (plain REST).
 * Content is read from files in this branch: course metadata, lesson texts and the law library. */
(function () {
  "use strict";

  var SB_URL = "https://tldjbpfcibangzmvzwfw.supabase.co";
  var SB_KEY = "sb_publishable_IaPGLBkmRkcsGlVE865PZw_krAWWmsz";
  var TOK_KEY = "lexa-sb-auth-v1";
  var META_URL = "src/lib/law/courses/generated-meta.ts";
  var TEXT_URL = function (id, v) { return "public/texts/" + encodeURIComponent(id) + ".json" + (v ? "?v=" + v : ""); };
  var LAWS_URL = "data/laws-full.json";

  var app = document.getElementById("app");
  var state = { tok: null, courses: null, laws: null, cache: {} };

  /* ── helpers ─────────────────────────────────────────── */
  var FA = "۰۱۲۳۴۵۶۷۸۹";
  function fa(n) { return String(n).replace(/[0-9]/g, function (d) { return FA[+d]; }); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function inline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }
  function paras(s) {
    if (!s) return "";
    return String(s).split(/\n{2,}/).map(function (p) {
      var lines = p.split("\n");
      if (lines.every(function (l) { return /^\s*([-•*]|[0-9۰-۹]+[.)-])\s+/.test(l); }))
        return "<ul>" + lines.map(function (l) { return "<li>" + inline(l.replace(/^\s*([-•*]|[0-9۰-۹]+[.)-])\s+/, "")) + "</li>"; }).join("") + "</ul>";
      return "<p>" + lines.map(inline).join("<br>") + "</p>";
    }).join("");
  }
  function norm(s) {
    return String(s || "").replace(/[ي]/g, "ی").replace(/[ك]/g, "ک").replace(/[\u064B-\u0652\u0670]/g, "")
      .replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); }).replace(/\u200c/g, " ").toLowerCase();
  }
  function toast(t) {
    var el = document.createElement("div"); el.className = "toast"; el.textContent = t;
    document.body.appendChild(el); setTimeout(function () { el.remove(); }, 2600);
  }
  function getJSON(url) {
    return fetch(url, { cache: "force-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  var spinner = '<div class="spinner" aria-label="در حال بارگیری"></div>';

  /* ── theme and reading size ──────────────────────────── */
  function applyPrefs() {
    var t = localStorage.getItem("lexa-web-theme") || "light";
    document.documentElement.setAttribute("data-theme", t);
    var s = +(localStorage.getItem("lexa-web-size") || 17);
    document.documentElement.style.setProperty("--read-size", s + "px");
  }
  applyPrefs();

  /* ── auth (Supabase REST, same project as the app) ───── */
  function loadTok() { try { state.tok = JSON.parse(localStorage.getItem(TOK_KEY) || "null"); } catch (e) { state.tok = null; } }
  function saveTok(t) { state.tok = t; if (t) localStorage.setItem(TOK_KEY, JSON.stringify(t)); else localStorage.removeItem(TOK_KEY); }
  function user() { return state.tok && state.tok.user; }
  loadTok();

  function sb(path, body, token, method) {
    var h = { apikey: SB_KEY, "Content-Type": "application/json" };
    h.Authorization = "Bearer " + (token || SB_KEY);
    return fetch(SB_URL + path, { method: method || "POST", headers: h, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); });
  }
  function errText(j, fallback) {
    var m = (j && (j.msg || j.error_description || j.message || j.error)) || fallback;
    var map = {
      "Invalid login credentials": "ایمیل یا رمز عبور درست نیست.",
      "User already registered": "با این ایمیل قبلاً ثبت‌نام شده؛ از «ورود» استفاده کنید.",
      "Email not confirmed": "ایمیل هنوز تأیید نشده؛ صندوق ایمیل (و پوشهٔ اسپم) را ببینید.",
      "Password should be at least 6 characters": "رمز عبور باید دست‌کم ۶ نویسه باشد."
    };
    for (var k in map) if (String(m).indexOf(k) === 0) return map[k];
    if (/rate limit/i.test(m)) return "تعداد درخواست‌ها زیاد شد؛ چند دقیقه بعد دوباره امتحان کنید.";
    return m;
  }
  function setSession(j) {
    saveTok({ access_token: j.access_token, refresh_token: j.refresh_token, user: { id: j.user.id, email: j.user.email || "", name: (j.user.user_metadata || {}).name || "" } });
  }
  function redirectTo() { return location.origin + location.pathname; }
  function signUp(name, email, pass) {
    return sb("/auth/v1/signup?redirect_to=" + encodeURIComponent(redirectTo()), { email: email, password: pass, data: { name: name } }).then(function (r) {
      if (!r.ok) return { err: errText(r.j, "ثبت‌نام انجام نشد.") };
      if (r.j.access_token) { setSession(r.j); return { ok: true }; }
      return { info: "ثبت‌نام انجام شد. لینک تأیید به ایمیل شما رفت؛ روی آن بزنید تا وارد شوید." };
    });
  }
  function signIn(email, pass) {
    return sb("/auth/v1/token?grant_type=password", { email: email, password: pass }).then(function (r) {
      if (!r.ok) return { err: errText(r.j, "ورود انجام نشد.") };
      setSession(r.j); return { ok: true };
    });
  }
  function recover(email) {
    return sb("/auth/v1/recover?redirect_to=" + encodeURIComponent(redirectTo()), { email: email }).then(function (r) {
      if (!r.ok) return { err: errText(r.j, "ارسال لینک انجام نشد.") };
      return { info: "اگر این ایمیل ثبت شده باشد، لینک تغییر رمز برایش فرستاده شد." };
    });
  }
  function refresh() {
    if (!state.tok || !state.tok.refresh_token) return Promise.resolve(false);
    return sb("/auth/v1/token?grant_type=refresh_token", { refresh_token: state.tok.refresh_token }).then(function (r) {
      if (r.ok) { setSession(r.j); return true; }
      if (r.status === 400 || r.status === 401) saveTok(null);
      return false;
    }).catch(function () { return false; });
  }
  function signOut() {
    var t = state.tok && state.tok.access_token;
    saveTok(null);
    if (t) sb("/auth/v1/logout", {}, t).catch(function () {});
    location.hash = "#/";
  }
  /* Links from confirmation and recovery emails come back as #access_token=...&type=... */
  function consumeAuthHash() {
    var h = location.hash.replace(/^#\/?/, "");
    if (h.indexOf("access_token=") < 0 && h.indexOf("error=") < 0) return Promise.resolve(null);
    var q = {}; h.split("&").forEach(function (kv) { var p = kv.split("="); q[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || "").replace(/\+/g, " ")); });
    history.replaceState(null, "", location.pathname + location.search);
    if (q.error) return Promise.resolve({ err: q.error_code === "otp_expired" ? "لینک ایمیل منقضی شده؛ دوباره درخواست بدهید." : (q.error_description || "لینک معتبر نیست.") });
    return fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + q.access_token } })
      .then(function (r) { return r.json(); })
      .then(function (u) {
        if (!u || !u.id) return { err: "ورود با لینک ایمیل انجام نشد." };
        setSession({ access_token: q.access_token, refresh_token: q.refresh_token, user: u });
        return { type: q.type || "signup" };
      }).catch(function () { return { err: "ورود با لینک ایمیل انجام نشد." }; });
  }

  /* ── progress (kept on this device, per account) ─────── */
  function pkey() { return "lexa-web-progress:" + ((user() && user().id) || "guest"); }
  function prog() { try { return JSON.parse(localStorage.getItem(pkey()) || "{}"); } catch (e) { return {}; } }
  function saveProg(p) { localStorage.setItem(pkey(), JSON.stringify(p)); }
  function markDone(id, score, total) {
    var p = prog(); p.done = p.done || {}; p.quiz = p.quiz || {};
    p.done[id] = Date.now(); if (total) p.quiz[id] = { s: score, t: total }; p.last = id; saveProg(p);
  }
  function setLast(id) { var p = prog(); p.last = id; saveProg(p); }

  /* ── content ─────────────────────────────────────────── */
  function loadCourses() {
    if (state.courses) return Promise.resolve(state.courses);
    return fetch(META_URL, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (t) {
      var mark = "builtinCourses: Course[] = ";
      var i = t.indexOf(mark); if (i < 0) throw new Error("meta");
      var body = t.slice(i + mark.length).trim().replace(/;\s*$/, "");
      state.courses = JSON.parse(body).map(function (c) {
        c.chapters = (c.chapters || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
        return c;
      });
      return state.courses;
    });
  }
  function lessonsOf(c) { var out = []; c.chapters.forEach(function (ch) { ch.lessons.forEach(function (l) { out.push({ l: l, ch: ch }); }); }); return out; }
  function readable(l) { return l.status !== "ai-pending"; }
  function findLesson(id) {
    for (var i = 0; i < state.courses.length; i++) {
      var c = state.courses[i], all = lessonsOf(c);
      for (var j = 0; j < all.length; j++) if (all[j].l.id === id) return { c: c, ch: all[j].ch, l: all[j].l, idx: j, all: all };
    }
    return null;
  }
  function loadLesson(l) {
    if (state.cache[l.id]) return Promise.resolve(state.cache[l.id]);
    return getJSON(TEXT_URL(l.id, l.v)).then(function (j) { state.cache[l.id] = j; return j; });
  }
  function loadLaws() {
    if (state.laws) return Promise.resolve(state.laws);
    return getJSON(LAWS_URL).then(function (j) { state.laws = j; return j; });
  }
  function lawName(key, law) {
    var k = key.toLowerCase();
    if (/dadresi|adm|procedure/.test(k) && /keif|kif|crim/.test(k)) return "قانون آیین دادرسی کیفری";
    if (/dadresi|adm|procedure/.test(k)) return "قانون آیین دادرسی مدنی";
    if (/mojazat|penal|islamic/.test(k)) return "قانون مجازات اسلامی";
    if (/tejarat|commerc/.test(k)) return "قانون تجارت";
    if (/asasi|const/.test(k)) return "قانون اساسی";
    if (/khanevade|family/.test(k)) return "قانون حمایت خانواده";
    if (/^kar|labor|labour/.test(k)) return "قانون کار";
    if (/madani|civil/.test(k)) return "قانون مدنی";
    return (law && (law.title || law.name)) || key;
  }
  function lawArticles(law) {
    var out = [];
    (law.books || []).forEach(function (b) { (b.chapters || []).forEach(function (ch) { (ch.articles || []).forEach(function (a) { out.push({ a: a, b: b.title, ch: ch.title }); }); }); });
    return out;
  }

  /* ── layout ──────────────────────────────────────────── */
  function topbar(active) {
    var u = user();
    var links = u
      ? '<a href="#/library" class="' + (active === "library" ? "on" : "") + '">کتابخانه</a>' +
        '<a href="#/laws" class="hide-m ' + (active === "laws" ? "on" : "") + '">متن قوانین</a>' +
        '<a href="#/me" class="' + (active === "me" ? "on" : "") + '">حساب من</a>'
      : '<a href="#/" class="hide-m ' + (active === "home" ? "on" : "") + '">خانه</a>' +
        '<a href="#/auth/in" class="' + (active === "auth" ? "on" : "") + '">ورود</a>' +
        '<a href="#/auth/up" class="btn gold sm" style="color:#fff">عضویت رایگان</a>';
    return '<header class="top"><div class="wrap">' +
      '<a class="brand" href="#/"><img src="site/logo.svg" alt=""><span>Lexa<small>کتابخانهٔ درس‌های حقوق</small></span></a>' +
      '<nav class="nav">' + links +
      '<button class="icon-btn" data-act="theme" title="حالت روشن/تیره" aria-label="حالت روشن/تیره">◐</button></nav></div></header>';
  }
  function footer() {
    return '<footer class="foot"><div class="wrap"><span>Lexa · گردآورنده: محمد قربانی</span>' +
      '<span>کانال تلگرام: <a class="ltr" href="https://t.me/fa_lexa" target="_blank" rel="noopener">@fa_lexa</a></span></div></footer>';
  }
  function render(html, active) { app.innerHTML = topbar(active) + html + footer(); window.scrollTo(0, 0); }

  /* ── pages ───────────────────────────────────────────── */
  function pageHome() {
    var stats = '<div class="stats"><div><b id="st-c">…</b><span>درس</span></div><div><b id="st-l">…</b><span>جلسهٔ آموزشی</span></div><div><b id="st-q">…</b><span>تست با پاسخ تشریحی</span></div></div>';
    render(
      '<section class="hero"><div class="wrap"><div>' +
      '<span class="eyebrow">آموزش مفهومی حقوق، رایگان</span>' +
      '<h1>حقوق را <em>بفهم</em>،<br>نه فقط حفظ کن.</h1>' +
      '<p class="lead">درس‌نامه‌های مرحله‌به‌مرحلهٔ مدنی، تجارت، جزا، آیین دادرسی و بین‌الملل؛ با متن مواد قانون، مثال حل‌شده، جدول مقایسه و تست پایان هر جلسه.</p>' +
      '<div class="cta"><a class="btn gold" href="#/auth/up">همین حالا عضو شو</a><a class="btn ghost" href="#/auth/in">قبلاً عضو شده‌ام</a></div>' +
      stats + '</div>' +
      '<div class="hero-card"><div class="row"><span>حقوق مدنی ۴ · جلسهٔ ۳</span><span>۶۴٪</span></div><div class="bar"><i></i></div>' +
      '<h4>ارکان مسئولیت مدنی</h4><p class="small muted" style="margin:6px 0 12px">ضرر، فعل زیانبار و رابطهٔ سببیت</p>' +
      '<div class="law">«هر کس بدون مجوز قانونی عمداً یا در نتیجهٔ بی‌احتیاطی ... به دیگری لطمه‌ای وارد نماید ... مسئول جبران خسارت ناشی از عمل خود می‌باشد.»<div class="small muted" style="margin-top:6px;font-family:Vazirmatn">ماده ۱ قانون مسئولیت مدنی</div></div></div>' +
      '</div></section>' +
      '<section class="sect"><div class="wrap"><h2>چرا Lexa؟</h2><p class="sub">ساخته‌شده برای دانشجو، داوطلب آزمون و هر کسی که می‌خواهد حقوق را درست بفهمد.</p><div class="grid g3">' +
      feature("📖", "توضیح کامل و مرحله‌ای", "هر مبحث از تعریف شروع می‌شود، به ماده می‌رسد و با مثال جا می‌افتد.") +
      feature("⚖️", "متن مواد کنار درس", "مستند قانونی هر نکته همان‌جا آمده؛ کتابخانهٔ کامل قوانین هم در دسترس است.") +
      feature("✅", "تست با پاسخ تشریحی", "پایان هر جلسه تست داری و دلیل درست یا غلط بودن هر گزینه را می‌بینی.") +
      feature("🧭", "پیشرفتت را ببین", "جلسه‌های خوانده‌شده علامت می‌خورند و از همان‌جا ادامه می‌دهی.") +
      feature("🌙", "خواندن راحت", "حالت تیره، بزرگ‌وکوچک کردن متن و نسخهٔ چاپی تمیز.") +
      feature("🆓", "همه‌چیز آزاد", "با عضویت رایگان، همهٔ درس‌ها و قوانین برایت باز است.") +
      '</div></div></section>' +
      '<section class="sect" style="padding-top:0"><div class="wrap"><h2>سه قدم تا شروع</h2><p class="sub">کمتر از یک دقیقه.</p><div class="grid g3 steps">' +
      '<div class="card"><h3 style="margin:0 0 6px">عضو شو</h3><p class="muted" style="margin:0">با ایمیل و یک رمز ساده ثبت‌نام کن.</p></div>' +
      '<div class="card"><h3 style="margin:0 0 6px">درس را انتخاب کن</h3><p class="muted" style="margin:0">از کتابخانه درس و جلسه‌ات را باز کن.</p></div>' +
      '<div class="card"><h3 style="margin:0 0 6px">بخوان و تست بزن</h3><p class="muted" style="margin:0">آخر هر جلسه خودت را محک بزن.</p></div>' +
      '</div></div></section>' +
      '<section class="sect" style="padding-top:0"><div class="wrap"><div class="band"><div><h3>جزوه‌های Lexa را هم داری؟</h3><p>جزوه‌های PDF هر درس در کانال تلگرام منتشر می‌شوند.</p></div>' +
      '<a class="btn gold" href="https://t.me/fa_lexa" target="_blank" rel="noopener">کانال <span class="ltr">@fa_lexa</span></a></div></div></section>',
      "home");
    loadCourses().then(function (cs) {
      var l = 0, q = 0;
      cs.forEach(function (c) { lessonsOf(c).forEach(function (x) { if (readable(x.l)) { l++; q += x.l.qCount || 0; } }); });
      set("st-c", fa(cs.length)); set("st-l", fa(l)); set("st-q", fa(q.toLocaleString("en-US")).replace(/,/g, "٬"));
    }).catch(function () {});
  }
  function set(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  function feature(ic, h, p) { return '<div class="card feature"><div class="ic">' + ic + '</div><h3>' + h + '</h3><p>' + p + '</p></div>'; }

  var pendingNotice = "";
  function pageAuth(mode, notice) {
    if (user() && mode !== "reset") { location.hash = "#/library"; return; }
    if (mode === "reset" && !user()) mode = "forgot";
    if (!{ up: 1, "in": 1, forgot: 1, reset: 1 }[mode]) mode = "in";
    if (pendingNotice) { notice = pendingNotice; pendingNotice = ""; }
    var titles = { up: "ساخت حساب", "in": "ورود به حساب", forgot: "بازیابی رمز", reset: "رمز تازه" };
    var tabs = (mode === "up" || mode === "in")
      ? '<div class="tabs"><button data-go="#/auth/up" class="' + (mode === "up" ? "on" : "") + '">عضویت</button><button data-go="#/auth/in" class="' + (mode === "in" ? "on" : "") + '">ورود</button></div>' : "";
    var fields = "";
    if (mode === "up") fields += field("name", "نام (اختیاری)", "text", "name");
    if (mode !== "reset") fields += field("email", "ایمیل", "email", "email");
    if (mode === "up" || mode === "in" || mode === "reset") fields += field("pass", mode === "reset" ? "رمز عبور تازه" : "رمز عبور", "password", mode === "in" ? "current-password" : "new-password");
    var btn = { up: "ساخت حساب رایگان", "in": "ورود", forgot: "فرستادن لینک", reset: "ذخیرهٔ رمز" }[mode];
    var extra = mode === "in" ? '<p class="small" style="margin-top:14px"><a href="#/auth/forgot">رمز را فراموش کرده‌ام</a></p>'
      : mode === "forgot" ? '<p class="small" style="margin-top:14px"><a href="#/auth/in">بازگشت به ورود</a></p>' : "";
    render('<section class="auth"><div class="side"><h2>به Lexa خوش آمدی</h2><p style="color:#cfdcd4">با یک حساب رایگان:</p><ul>' +
      '<li>همهٔ درس‌ها و جلسه‌ها باز است</li><li>متن کامل قوانین را می‌خوانی و جست‌وجو می‌کنی</li><li>تست هر جلسه با پاسخ تشریحی</li><li>پیشرفتت روی همین دستگاه ذخیره می‌شود</li></ul>' +
      '<p class="small" style="color:#a9bdb2;margin-top:24px">همین حساب در اپ Lexa هم کار می‌کند.</p></div>' +
      '<div class="form"><form class="box" id="authf" novalidate><h1 style="margin:0 0 18px;color:var(--jade);font-size:26px">' + titles[mode] + '</h1>' + tabs +
      '<div id="am">' + (notice ? notice : "") + '</div>' + fields +
      '<button class="btn primary" style="width:100%;justify-content:center" type="submit">' + btn + '</button>' + extra + '</form></div></section>', "auth");
    var f = document.getElementById("authf");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = function (n) { var el = f.elements[n]; return el ? el.value.trim() : ""; };
      var email = v("email"), pass = f.elements.pass ? f.elements.pass.value : "";
      var am = document.getElementById("am");
      if (mode !== "reset" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { am.innerHTML = msg("err", "ایمیل را درست وارد کنید."); return; }
      if ((mode === "up" || mode === "reset") && pass.length < 6) { am.innerHTML = msg("err", "رمز عبور باید دست‌کم ۶ نویسه باشد."); return; }
      var b = f.querySelector("button[type=submit]"); b.disabled = true; b.textContent = "لطفاً صبر کنید…";
      var p = mode === "up" ? signUp(v("name"), email, pass) : mode === "in" ? signIn(email, pass) : mode === "forgot" ? recover(email)
        : sb("/auth/v1/user", { password: pass }, state.tok && state.tok.access_token, "PUT").then(function (r) { return r.ok ? { ok: true, info: "رمز تازه ذخیره شد." } : { err: errText(r.j, "ذخیرهٔ رمز انجام نشد.") }; });
      p.then(function (r) {
        b.disabled = false; b.textContent = btn;
        if (r.err) am.innerHTML = msg("err", r.err);
        else if (r.info && !r.ok) am.innerHTML = msg("ok", r.info);
        else { if (r.info) toast(r.info); location.hash = "#/library"; }
      }).catch(function () { b.disabled = false; b.textContent = btn; am.innerHTML = msg("err", "اتصال برقرار نشد. اینترنت (یا فیلترشکن) را بررسی کنید و دوباره بزنید."); });
    });
  }
  function field(n, label, type, ac) { return '<label class="f"><span>' + label + '</span><input name="' + n + '" type="' + type + '" autocomplete="' + ac + '"' + (type === "email" || type === "password" ? ' dir="ltr"' : "") + ' required></label>'; }
  function msg(k, t) { return '<div class="msg ' + k + '">' + esc(t) + '</div>'; }

  function courseProgress(c, p) {
    var all = lessonsOf(c).filter(function (x) { return readable(x.l); });
    var d = all.filter(function (x) { return p.done && p.done[x.l.id]; }).length;
    return { d: d, n: all.length, pct: all.length ? Math.round(100 * d / all.length) : 0 };
  }
  function pageLibrary() {
    render('<div class="wrap"><div class="page-head"><h1>کتابخانه</h1><p class="muted" style="margin:4px 0 0" id="hi"></p></div><div id="lib">' + spinner + '</div></div>', "library");
    var u = user(); set("hi", "سلام" + (u.name ? " " + u.name : "") + "! هر درسی را خواستی باز کن، همه‌اش برایت آزاد است.");
    loadCourses().then(function (cs) {
      var p = prog(), cont = "";
      if (p.last) { var f = findLesson(p.last); if (f) cont = '<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:22px;flex-wrap:wrap"><div><div class="small muted">ادامهٔ مطالعه</div><b>' + esc(f.l.title) + '</b><div class="small muted">' + esc(f.c.title) + '</div></div><a class="btn primary sm" href="#/lesson/' + encodeURIComponent(f.l.id) + '">ادامه بده</a></div>'; }
      document.getElementById("lib").innerHTML = cont +
        '<div class="search"><input id="q" type="search" placeholder="جست‌وجو در عنوان درس‌ها و جلسه‌ها…" aria-label="جست‌وجو"></div><div id="res"></div>' +
        '<div class="grid g3" id="grid">' + cs.map(function (c) {
          var pr = courseProgress(c, p);
          return '<a class="card course" href="#/course/' + encodeURIComponent(c.id) + '"><div class="cv ' + esc(c.accent || "green") + '"><b>' + esc(c.title) + '</b><span>' + fa(pr.n) + ' جلسه</span></div>' +
            '<div class="bd"><p>' + esc(c.tagline || "") + '</p><div class="prog"><i style="width:' + pr.pct + '%"></i></div>' +
            '<div class="meta"><span>' + fa(c.chapters.length) + ' فصل</span><span>' + (pr.d ? fa(pr.d) + " از " + fa(pr.n) + " خوانده شده" : "شروع نشده") + '</span></div></div></a>';
        }).join("") + '</div>';
      var q = document.getElementById("q");
      q.addEventListener("input", function () {
        var t = norm(q.value.trim()), res = document.getElementById("res"), grid = document.getElementById("grid");
        if (t.length < 2) { res.innerHTML = ""; grid.style.display = ""; return; }
        var hits = [];
        cs.forEach(function (c) { lessonsOf(c).forEach(function (x) { if (readable(x.l) && norm(x.l.title + " " + x.ch.title + " " + c.title).indexOf(t) >= 0) hits.push({ c: c, x: x }); }); });
        grid.style.display = "none";
        res.innerHTML = '<div class="card" style="padding:0;overflow:hidden">' + (hits.length ? hits.slice(0, 60).map(function (h) {
          return '<a class="lesson-row" href="#/lesson/' + encodeURIComponent(h.x.l.id) + '"><span class="tick">📄</span><span class="t">' + esc(h.x.l.title) + '<div class="q">' + esc(h.c.title) + ' · ' + esc(h.x.ch.title) + '</div></span></a>';
        }).join("") : '<div class="empty">چیزی پیدا نشد.</div>') + '</div>';
      });
    }).catch(loadErr("lib"));
  }
  function loadErr(id) { return function () { var e = document.getElementById(id); if (e) e.innerHTML = '<div class="empty">بارگیری محتوا انجام نشد. صفحه را دوباره باز کنید.</div>'; }; }

  function pageCourse(id) {
    render('<div class="wrap" id="cw">' + spinner + '</div>', "library");
    loadCourses().then(function (cs) {
      var c = cs.filter(function (x) { return x.id === id; })[0];
      if (!c) { document.getElementById("cw").innerHTML = '<div class="empty">این درس پیدا نشد.</div>'; return; }
      var p = prog(), pr = courseProgress(c, p);
      var first = lessonsOf(c).filter(function (x) { return readable(x.l) && !(p.done && p.done[x.l.id]); })[0] || lessonsOf(c)[0];
      document.getElementById("cw").innerHTML = '<div class="page-head"><div class="crumbs"><a href="#/library">کتابخانه</a> / ' + esc(c.title) + '</div><h1>' + esc(c.title) + '</h1>' +
        '<p class="muted" style="margin:6px 0 14px">' + esc(c.tagline || "") + '</p>' +
        '<div class="card" style="margin-bottom:22px"><div class="prose" style="font-size:16px">' + paras(c.description || "") + '</div>' +
        (c.sourceLabel ? '<p class="small muted" style="margin:10px 0 0">منبع: ' + esc(c.sourceLabel) + '</p>' : "") +
        '<div style="display:flex;gap:12px;align-items:center;margin-top:14px;flex-wrap:wrap">' + (first ? '<a class="btn primary" href="#/lesson/' + encodeURIComponent(first.l.id) + '">' + (pr.d ? "ادامهٔ درس" : "شروع درس") + '</a>' : "") +
        '<span class="muted small">' + fa(pr.d) + ' از ' + fa(pr.n) + ' جلسه خوانده شده</span></div></div></div>' +
        c.chapters.map(function (ch, i) {
          var ls = ch.lessons, dn = ls.filter(function (l) { return p.done && p.done[l.id]; }).length;
          return '<details class="card chapter"' + (i < 2 ? " open" : "") + '><summary><span class="no">' + fa(i + 1) + '</span><span style="flex:1"><h3>' + esc(ch.title) + '</h3><span class="st">' + esc(ch.subtitle || "") + '</span></span><span class="pill">' + fa(dn) + '/' + fa(ls.length) + '</span></summary>' +
            ls.map(function (l) {
              var ok = readable(l), done = p.done && p.done[l.id];
              return ok ? '<a class="lesson-row' + (done ? " done" : "") + '" href="#/lesson/' + encodeURIComponent(l.id) + '"><span class="tick">' + (done ? "✓" : "") + '</span><span class="t">' + esc(l.title) + '</span><span class="q">' + (l.qCount ? fa(l.qCount) + " تست" : "") + (l.minutes ? " · " + fa(l.minutes) + " دقیقه" : "") + '</span></a>'
                : '<div class="lesson-row" style="opacity:.55"><span class="tick">…</span><span class="t">' + esc(l.title) + '</span><span class="q">به‌زودی</span></div>';
            }).join("") + '</details>';
        }).join("");
    }).catch(loadErr("cw"));
  }

  var TYPE = { intro: "هدف جلسه", concept: "تعریف و مفهوم", law: "مستند قانونی", notes: "نکات کلیدی", example: "مثال کاربردی", compare: "مقایسه", summary: "جمع‌بندی", question: "پرسش" };
  function sectionHtml(s, i) {
    var inner = "";
    if (s.body) inner += paras(s.body);
    if (s.bullets && s.bullets.length) inner += "<ul>" + s.bullets.map(function (b) { return "<li>" + inline(b) + "</li>"; }).join("") + "</ul>";
    if (s.law && s.law.length) inner += s.law.map(function (l) {
      return '<div class="lawc"><div class="h">ماده ' + esc(l.no) + " " + esc(l.source || "قانون مدنی") + '</div>' + paras(l.text) + '</div>';
    }).join("");
    if (s.table && s.table.headers) inner += '<div class="tbl"><table><thead><tr>' + s.table.headers.map(function (h) { return "<th>" + inline(h) + "</th>"; }).join("") + '</tr></thead><tbody>' +
      (s.table.rows || []).map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
    if (s.questionText) inner += '<p><strong>' + inline(s.questionText) + '</strong></p>' + (s.suggestedAnswer ? '<button class="btn ghost sm" data-act="reveal">نمایش پاسخ پیشنهادی</button><div class="reveal" hidden>' + paras(s.suggestedAnswer) + '</div>' : "");
    var boxed = { intro: 1, example: 1, summary: 1, notes: 1, question: 1 }[s.type];
    var title = s.title || TYPE[s.type] || "";
    return '<section class="blk" id="s' + i + '">' + (title ? "<h2>" + esc(title) + "</h2>" : "") +
      '<div class="prose' + (boxed ? " box " + s.type : "") + '">' + inner + "</div></section>";
  }
  function pageLesson(id) {
    render('<div class="wrap" id="lw">' + spinner + '</div>', "library");
    loadCourses().then(function () {
      var f = findLesson(id);
      if (!f) { document.getElementById("lw").innerHTML = '<div class="empty">این جلسه پیدا نشد.</div>'; return; }
      setLast(id);
      return loadLesson(f.l).then(function (d) {
        var secs = d.sections || [], quiz = d.quiz || [];
        var prev = f.all.slice(0, f.idx).reverse().filter(function (x) { return readable(x.l); })[0];
        var next = f.all.slice(f.idx + 1).filter(function (x) { return readable(x.l); })[0];
        document.title = f.l.title + " · Lexa";
        document.getElementById("lw").innerHTML = '<div class="reader"><aside class="card toc"><div class="lbl">در این جلسه</div>' +
          secs.map(function (s, i) { return '<a href="javascript:void 0" data-jump="s' + i + '">' + esc(s.title || TYPE[s.type] || "بخش") + '</a>'; }).join("") +
          (quiz.length ? '<a href="javascript:void 0" data-jump="quiz">تست جلسه (' + fa(quiz.length) + ')</a>' : "") + '</aside>' +
          '<article class="article"><div class="crumbs"><a href="#/library">کتابخانه</a> / <a href="#/course/' + encodeURIComponent(f.c.id) + '">' + esc(f.c.title) + '</a> / ' + esc(f.ch.title) + '</div>' +
          '<h1>' + esc(f.l.title) + '</h1><div class="small muted">جلسهٔ ' + fa(f.idx + 1) + ' از ' + fa(f.all.length) + '</div>' +
          '<div class="tools"><button class="btn ghost sm" data-act="font-" aria-label="کوچک کردن متن">A−</button><button class="btn ghost sm" data-act="font+" aria-label="بزرگ کردن متن">A+</button><button class="btn ghost sm" data-act="print">چاپ / PDF</button></div>' +
          secs.map(sectionHtml).join("") +
          (quiz.length ? '<section class="quiz blk" id="quiz"><h2>تست جلسه</h2><p class="muted small">گزینه را بزن تا درستی آن و توضیحش را ببینی.</p>' + quiz.map(function (q, qi) {
            return '<div class="card qcard" data-q="' + qi + '" data-ans="' + esc(q.answer) + '"><div class="qq">' + fa(qi + 1) + ". " + inline(q.q) + '</div>' +
              (q.options || []).map(function (o) { return '<button class="opt" data-opt="' + esc(o.key) + '">' + inline(o.text) + '</button>'; }).join("") +
              '<div class="expl" hidden>' + inline(q.explanation || "") + '</div></div>';
          }).join("") + '<p class="score" id="score"></p></section>' : "") +
          '<div class="pager">' + (prev ? '<a class="btn ghost" href="#/lesson/' + encodeURIComponent(prev.l.id) + '">→ جلسهٔ قبل</a>' : "<span></span>") +
          '<button class="btn gold" data-act="done" data-id="' + esc(id) + '" data-next="' + (next ? esc(next.l.id) : "") + '">' + (next ? "خواندم، جلسهٔ بعد ←" : "خواندم، پایان درس ✓") + '</button></div></article></div>';
        wireQuiz(id, quiz.length);
      });
    }).catch(loadErr("lw"));
  }
  function wireQuiz(id, total) {
    var right = 0, answered = 0;
    Array.prototype.forEach.call(document.querySelectorAll(".qcard"), function (card) {
      card.addEventListener("click", function (e) {
        var b = e.target.closest(".opt"); if (!b || card.dataset.done) return;
        card.dataset.done = 1; answered++;
        var ans = card.dataset.ans, ok = b.dataset.opt === ans; if (ok) right++;
        Array.prototype.forEach.call(card.querySelectorAll(".opt"), function (o) { o.disabled = true; if (o.dataset.opt === ans) o.classList.add("right"); });
        if (!ok) b.classList.add("wrong");
        card.querySelector(".expl").hidden = false;
        if (answered === total) {
          set("score", "نتیجه: " + fa(right) + " از " + fa(total) + (right === total ? " · عالی بود!" : right >= total / 2 ? " · خوب بود؛ توضیح غلط‌ها را مرور کن." : " · یک بار دیگر متن را مرور کن."));
          markDone(id, right, total);
        }
      });
    });
  }

  function pageLaws(key) {
    render('<div class="wrap" id="lv">' + spinner + '</div>', "laws");
    loadLaws().then(function (laws) {
      var keys = Object.keys(laws);
      if (!key) {
        document.getElementById("lv").innerHTML = '<div class="page-head"><h1>متن قوانین</h1><p class="muted" style="margin:4px 0 18px">متن کامل قوانین پایه؛ با جست‌وجوی شمارهٔ ماده یا هر کلمه.</p></div>' +
          '<div class="law-list">' + keys.map(function (k) {
            return '<a class="card law-tile" href="#/laws/' + encodeURIComponent(k) + '"><div class="ic">⚖️</div><b>' + esc(lawName(k, laws[k])) + '</b><span class="small muted">' + fa(lawArticles(laws[k]).length) + ' ماده</span></a>';
          }).join("") + '</div>';
        return;
      }
      var law = laws[key]; if (!law) { document.getElementById("lv").innerHTML = '<div class="empty">این قانون پیدا نشد.</div>'; return; }
      var arts = lawArticles(law), name = lawName(key, law), word = law.articleWord || "ماده";
      document.getElementById("lv").innerHTML = '<div class="page-head"><div class="crumbs"><a href="#/laws">متن قوانین</a> / ' + esc(name) + '</div><h1>' + esc(name) + '</h1>' +
        (law.metaLabel ? '<p class="small muted" style="margin:4px 0 0">' + esc(law.metaLabel) + (law.sourceUrl ? ' · <a href="' + esc(law.sourceUrl) + '" target="_blank" rel="noopener">منبع متن</a>' : "") + '</p>' : "") + '</div>' +
        '<div class="search"><input id="lq" type="search" placeholder="شمارهٔ ماده (مثلاً ۳۲۸) یا کلمه…" aria-label="جست‌وجو در قانون"></div>' +
        '<div class="card" style="padding:0;overflow:hidden" id="arts"></div>';
      var box = document.getElementById("arts"), lq = document.getElementById("lq");
      function show(list, t) {
        var shown = list.slice(0, 120);
        box.innerHTML = shown.length ? shown.map(function (x) {
          var txt = paras(x.a.text);
          if (t && !/^\d+$/.test(t)) txt = txt.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "g"), "<mark>$1</mark>");
          return '<div class="art"><div class="no">' + esc(word) + " " + esc(x.a.no) + '</div><div class="path">' + esc(x.b || "") + (x.ch && x.ch !== "متون" ? " · " + esc(x.ch) : "") + '</div><div class="prose" style="font-size:16px">' + txt + "</div></div>";
        }).join("") + (list.length > shown.length ? '<div class="empty small">' + fa(list.length - shown.length) + ' مادهٔ دیگر؛ جست‌وجو را دقیق‌تر کن.</div>' : "") : '<div class="empty">ماده‌ای پیدا نشد.</div>';
      }
      show(arts, "");
      lq.addEventListener("input", function () {
        var raw = lq.value.trim(), t = norm(raw).trim();
        if (!t) return show(arts, "");
        if (/^\d+$/.test(t)) return show(arts.filter(function (x) { return norm(x.a.no) === t || norm(x.a.no).indexOf(t + " ") === 0; }).concat(arts.filter(function (x) { return norm(x.a.no) !== t && norm(x.a.no).indexOf(t) === 0; })), t);
        if (t.length < 2) return;
        show(arts.filter(function (x) { return norm(x.a.text).indexOf(t) >= 0; }), raw);
      });
    }).catch(loadErr("lv"));
  }

  function pageMe() {
    var u = user(), p = prog();
    var done = Object.keys(p.done || {}).length, qs = p.quiz || {}, s = 0, t = 0;
    Object.keys(qs).forEach(function (k) { s += qs[k].s; t += qs[k].t; });
    render('<div class="wrap" style="max-width:720px"><div class="page-head"><h1>حساب من</h1></div>' +
      '<div class="card" style="margin-bottom:16px"><div class="small muted">ایمیل</div><b class="ltr">' + esc(u.email) + '</b>' + (u.name ? '<div class="small muted" style="margin-top:8px">نام</div><b>' + esc(u.name) + '</b>' : "") + '</div>' +
      '<div class="grid g2" style="margin-bottom:16px"><div class="card"><div class="small muted">جلسه‌های خوانده‌شده</div><b style="font-size:26px;color:var(--jade)">' + fa(done) + '</b></div>' +
      '<div class="card"><div class="small muted">درصد پاسخ درست تست‌ها</div><b style="font-size:26px;color:var(--jade)">' + (t ? fa(Math.round(100 * s / t)) + "٪" : "—") + '</b></div></div>' +
      '<div class="card"><p class="small muted" style="margin-top:0">پیشرفت مطالعه روی همین مرورگر ذخیره می‌شود. حساب شما در اپ Lexa هم قابل استفاده است.</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn ghost sm" href="#/auth/reset">تغییر رمز</a><button class="btn ghost sm" data-act="reset-prog">پاک کردن پیشرفت</button><button class="btn primary sm" data-act="logout">خروج از حساب</button></div></div></div>', "me");
  }

  /* ── router ──────────────────────────────────────────── */
  var PROTECTED = { library: 1, course: 1, lesson: 1, laws: 1, me: 1 };
  function route() {
    var parts = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
    var r = parts[0] || "";
    document.title = "Lexa · کتابخانهٔ درس‌های حقوق";
    if (PROTECTED[r] && !user()) { sessionStorage.setItem("lexa-after-login", location.hash); return pageAuth("in", msg("ok", "برای خواندن، اول وارد شو یا یک حساب رایگان بساز.")); }
    if (r === "auth") return pageAuth(parts[1] || "in");
    if (r === "library") return pageLibrary();
    if (r === "course") return pageCourse(parts[1]);
    if (r === "lesson") return pageLesson(parts[1]);
    if (r === "laws") return pageLaws(parts[1]);
    if (r === "me") return pageMe();
    if (user() && !r) return pageLibrary();
    return pageHome();
  }
  window.addEventListener("hashchange", function () {
    if (user() && /^#\/library$/.test(location.hash)) {
      var back = sessionStorage.getItem("lexa-after-login");
      if (back) { sessionStorage.removeItem("lexa-after-login"); if (back !== "#/library") { location.hash = back; return; } }
    }
    route();
  });

  document.addEventListener("click", function (e) {
    var go = e.target.closest("[data-go]"); if (go) { e.preventDefault(); location.hash = go.dataset.go; return; }
    var j = e.target.closest("[data-jump]"); if (j) { e.preventDefault(); var el = document.getElementById(j.dataset.jump); if (el) el.scrollIntoView({ behavior: "smooth" }); return; }
    var a = e.target.closest("[data-act]"); if (!a) return;
    var act = a.dataset.act;
    if (act === "theme") { var cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"; localStorage.setItem("lexa-web-theme", cur); applyPrefs(); }
    else if (act === "font+" || act === "font-") { var s = +(localStorage.getItem("lexa-web-size") || 17) + (act === "font+" ? 1 : -1); s = Math.max(14, Math.min(24, s)); localStorage.setItem("lexa-web-size", s); applyPrefs(); }
    else if (act === "print") window.print();
    else if (act === "reveal") { a.nextElementSibling.hidden = false; a.remove(); }
    else if (act === "logout") signOut();
    else if (act === "reset-prog") { if (confirm("پیشرفت مطالعه روی این مرورگر پاک شود؟")) { localStorage.removeItem(pkey()); pageMe(); } }
    else if (act === "done") {
      var p = prog(); if (!(p.done && p.done[a.dataset.id])) markDone(a.dataset.id);
      if (a.dataset.next) location.hash = "#/lesson/" + encodeURIComponent(a.dataset.next);
      else { var f = findLesson(a.dataset.id); toast("آفرین! این درس تمام شد."); location.hash = "#/course/" + encodeURIComponent(f ? f.c.id : ""); }
    }
  });

  /* ── boot ────────────────────────────────────────────── */
  consumeAuthHash().then(function (r) {
    if (r && r.err) { pendingNotice = msg("err", r.err); location.hash = "#/auth/in"; return; }
    if (r && r.type === "recovery") { location.hash = "#/auth/reset"; return; }
    if (r) { toast("ایمیل تأیید شد، خوش آمدی!"); location.hash = "#/library"; return; }
    if (user()) refresh().then(function () { route(); }); else route();
  });
})();

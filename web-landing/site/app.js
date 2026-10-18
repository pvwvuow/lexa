/* Lexa landing page: sign-up and sign-in, then the Lexa app at /app/.
 * Uses the same Supabase project and the same session key as the app
 * (lexa-sb-auth-v1), so the app opens already signed in. */
(function () {
  "use strict";

  var SB_URL = "https://tldjbpfcibangzmvzwfw.supabase.co";
  var SB_KEY = "sb_publishable_IaPGLBkmRkcsGlVE865PZw_krAWWmsz";
  var TOK_KEY = "lexa-sb-auth-v1";
  var APP_URL = "app/";

  var app = document.getElementById("app");
  var state = { tok: null };

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
    saveTok({ access_token: j.access_token, refresh_token: j.refresh_token, user: { id: j.user.id, email: j.user.email || "" } });
  }
  function redirectTo() { return location.origin + "/"; }
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
    route();
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

  /* ── layout ──────────────────────────────────────────── */
  function topbar(active) {
    var u = user();
    var links = u
      ? '<a href="app/" class="btn gold sm" style="color:#fff">ورود به داشبورد</a><a href="#/logout">خروج</a>'
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
    var stats = '<div class="stats"><div><b id="st-l">…</b><span>جلسهٔ آموزشی</span></div><div><b id="st-q">…</b><span>تست با پاسخ تشریحی</span></div><div><b>رایگان</b><span>برای همه</span></div></div>';
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
      feature("🧭", "پیشرفتت همه‌جا با توست", "با یک حساب، روی گوشی، اپ دسکتاپ و همین سایت از همان‌جا ادامه می‌دهی.") +
      feature("🤖", "تست‌های هوشمند", "سؤال‌های تمرینی تازه با هوش مصنوعی از دل هر جلسه ساخته می‌شود تا تمرین بی‌پایان داشته باشی.") +
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
    fetch("texts/manifest.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (m) {
      var ls = m.lessons || {}, l = 0, q = 0;
      Object.keys(ls).forEach(function (k) { l++; q += ls[k].q || 0; });
      set("st-l", fa(l)); set("st-q", fa(q.toLocaleString("en-US")).replace(/,/g, "٬"));
    }).catch(function () { set("st-l", "۳۰۰+"); set("st-q", "۲٬۰۰۰+"); });
  }
  function set(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  function feature(ic, h, p) { return '<div class="card feature"><div class="ic">' + ic + '</div><h3>' + h + '</h3><p>' + p + '</p></div>'; }

  var pendingNotice = "";
  function pageAuth(mode, notice) {
    if (user() && mode !== "reset") { goApp(); return; }
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
      '<li>همهٔ درس‌ها و جلسه‌ها باز است</li><li>متن کامل قوانین را می‌خوانی و جست‌وجو می‌کنی</li><li>تست هر جلسه با پاسخ تشریحی</li><li>پیشرفتت روی همهٔ دستگاه‌هایت یکی می‌شود</li></ul>' +
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
        else { if (r.info) toast(r.info); setTimeout(goApp, r.info ? 900 : 0); }
      }).catch(function () { b.disabled = false; b.textContent = btn; am.innerHTML = msg("err", "اتصال برقرار نشد. اینترنت (یا فیلترشکن) را بررسی کنید و دوباره بزنید."); });
    });
  }
  function field(n, label, type, ac) { return '<label class="f"><span>' + label + '</span><input name="' + n + '" type="' + type + '" autocomplete="' + ac + '"' + (type === "email" || type === "password" ? ' dir="ltr"' : "") + ' required></label>'; }
  function msg(k, t) { return '<div class="msg ' + k + '">' + esc(t) + '</div>'; }

  /* ── router ──────────────────────────────────────────── */
  function goApp() { location.href = APP_URL; }
  function route() {
    var parts = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
    var r = parts[0] || "";
    document.title = "Lexa · کتابخانهٔ درس‌های حقوق";
    if (r === "auth") return pageAuth(parts[1] || "in");
    if (r === "logout") { signOut(); return; }
    if (user() && !r) return goApp();
    return pageHome();
  }
  window.addEventListener("hashchange", route);

  document.addEventListener("click", function (e) {
    var go = e.target.closest("[data-go]"); if (go) { e.preventDefault(); location.hash = go.dataset.go; return; }
    var a = e.target.closest("[data-act]"); if (!a) return;
    if (a.dataset.act === "theme") { var cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"; localStorage.setItem("lexa-web-theme", cur); applyPrefs(); }
  });

  /* ── boot ────────────────────────────────────────────── */
  consumeAuthHash().then(function (r) {
    if (r && r.err) { pendingNotice = msg("err", r.err); location.hash = "#/auth/in"; route(); return; }
    if (r && r.type === "recovery") { location.hash = "#/auth/reset"; route(); return; }
    if (r) { goApp(); return; }
    if (user()) refresh().then(function () { route(); }); else route();
  });
})();

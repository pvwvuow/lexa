/* ─── Lexa — اسکریپت‌های سازگاری که قبل از همهٔ چانک‌ها اجرا می‌شوند ─────────
 *
 * چرا: WebView اندروید در خیلی از دستگاه‌ها (به‌دلیل تحریم و آپدیت‌نشدن Play)
 * قدیمی است؛ چانک‌های Next/React از structuredClone (Chrome 98+)،
 * AbortSignal.timeout (103+)، Object.hasOwn (93+)، ?. (80+) و… استفاده می‌کنند
 * → «Application error» در استارتاپ. این اسکریپت‌ها ES5 خالص‌اند تا روی
 * خود WebViewهای قدیمی هم پارس و اجرا شوند.
 * تزریق: در src/app/layout.tsx به‌صورت <script> اینلاین قبل از چانک‌ها.
 * ─────────────────────────────────────────────────────────────────────── */

export const compatScript = `(function(){
"use strict";
var w=window;
function has(o,k){ return Object.prototype.hasOwnProperty.call(o,k); }
function def(o,n,v){ try{ if(o[n]===undefined||o[n]===null){ o[n]=v; } }catch(e){} }

/* globalThis */
try{ if(typeof w.globalThis==="undefined"){ Object.defineProperty(w,"globalThis",{get:function(){return w;},configurable:true}); } }catch(e){ try{ w.globalThis=w; }catch(e2){} }

/* crypto.getRandomValues / randomUUID */
try{
  var C=w.crypto||w.msCrypto;
  if(!C){ C={}; try{ w.crypto=C; }catch(e3){} }
  if(C){
    def(C,"getRandomValues",function(arr){ for(var i=0;i<arr.length;i++){ arr[i]=Math.floor(Math.random()*256); } return arr; });
    def(C,"randomUUID",function(){ return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){ var r=Math.floor(Math.random()*16); var v=(c==="x")?r:((r&3)|8); return v.toString(16); }); });
  }
}catch(e){}

/* Object.entries / fromEntries / hasOwn */
def(Object,"entries",function(o){ if(!o||typeof o!=="object"){ return []; } var out=[]; for(var k in o){ if(has(o,k)){ out.push([k,o[k]]); } } return out; });
def(Object,"fromEntries",function(entries){ var out={}; if(!entries){ return out; } for(var i=0;i<entries.length;i++){ var en=entries[i]; if(en&&en.length){ out[en[0]]=en[1]; } } return out; });
def(Object,"hasOwn",function(o,k){ return !!o&&has(Object(o),k); });

/* Array/String .at — findLast/findLastIndex — flat/flatMap */
if(!Array.prototype.at){ Array.prototype.at=function(n){ n=Math.trunc(n)||0; var a=this; if(n<0){ n+=a.length; } return (n>=0&&n<a.length)?a[n]:undefined; }; }
if(!String.prototype.at){ String.prototype.at=function(n){ n=Math.trunc(n)||0; var s=String(this); if(n<0){ n+=s.length; } return (n>=0&&n<s.length)?s[n]:undefined; }; }
if(!Array.prototype.findLast){ Array.prototype.findLast=function(fn){ for(var i=this.length-1;i>=0;i--){ if(fn(this[i],i,this)){ return this[i]; } } }; }
if(!Array.prototype.findLastIndex){ Array.prototype.findLastIndex=function(fn){ for(var i=this.length-1;i>=0;i--){ if(fn(this[i],i,this)){ return i; } } return -1; }; }
if(!Array.prototype.flat){ Array.prototype.flat=function(d){ var depth=(d===undefined)?1:(d===Infinity?Infinity:Math.floor(d)); function fl(a,dep){ var out=[]; for(var i=0;i<a.length;i++){ if(Array.isArray(a[i])&&dep>0){ out=out.concat(fl(a[i],dep-1)); } else { out.push(a[i]); } } return out; } return fl(this,depth); }; }
if(!Array.prototype.flatMap){ Array.prototype.flatMap=function(fn,t){ var r=Array.prototype.map.call(this,fn,t); return r.flat ? r.flat() : [].concat.apply([],r); }; }

/* String.replaceAll */
if(!String.prototype.replaceAll){ String.prototype.replaceAll=function(s,r){ var v=String(this); if(s instanceof RegExp){ if(!s.global){ throw new TypeError("replaceAll بدون پرچم g"); } return v.replace(s,r); } return String(s).length?v.split(s).join(r):v; }; }

/* Promise.allSettled / any */
try{
  if(typeof w.Promise!=="undefined"){
    if(!Promise.allSettled){ Promise.allSettled=function(list){ var P=this; return new Promise(function(res){ var vals=Array.prototype.slice.call(list); var out=new Array(vals.length); var n=0; if(!vals.length){ res(out); return; } function done(){ if(++n===vals.length){ res(out); } } vals.forEach(function(v,i){ P.resolve(v).then(function(vv){ out[i]={status:"fulfilled",value:vv}; done(); }, function(er){ out[i]={status:"rejected",reason:er}; done(); }); }); }); }; }
    if(!Promise.any){ Promise.any=function(list){ var P=this; return new Promise(function(res,rej){ var vals=Array.prototype.slice.call(list); var errs=[]; var n=0; if(!vals.length){ rej(new Error("All promises were rejected")); return; } vals.forEach(function(v,i){ P.resolve(v).then(res, function(er){ errs[i]=er; if(++n===vals.length){ var e=new Error("All promises were rejected"); e.errors=errs; rej(e); } }); }); }); }; }
  }
}catch(e){}

/* structuredClone — کلون عمیق با پشتیبانی Date/RegExp/Map/Set/TypedArray */
try{
  if(!w.structuredClone){
    var WM=w.WeakMap;
    w.structuredClone=function(v){
      function cl(x,seen){
        if(x===null||typeof x!=="object"){ return x; }
        if(seen.has(x)){ return seen.get(x); }
        var i,out;
        if(x instanceof Date){ return new Date(x.getTime()); }
        if(x instanceof RegExp){ return new RegExp(x.source,x.flags); }
        if(x instanceof Map){ out=new Map(); seen.set(x,out); x.forEach(function(val,key){ out.set(key,cl(val,seen)); }); return out; }
        if(x instanceof Set){ out=new Set(); seen.set(x,out); x.forEach(function(val){ out.add(cl(val,seen)); }); return out; }
        if(x instanceof ArrayBuffer){ return x.slice(0); }
        if(ArrayBuffer.isView(x)){ out=new x.constructor(x.length); seen.set(x,out); for(i=0;i<x.length;i++){ out[i]=cl(x[i],seen); } return out; }
        if(Array.isArray(x)){ out=new Array(x.length); seen.set(x,out); for(i=0;i<x.length;i++){ out[i]=cl(x[i],seen); } return out; }
        out={}; seen.set(x,out); var ks=Object.keys(x); for(i=0;i<ks.length;i++){ out[ks[i]]=cl(x[ks[i]],seen); } return out;
      }
      return cl(v, new WM());
    };
  }
}catch(e){}

/* AbortSignal.timeout */
try{
  if(w.AbortController&&(!w.AbortSignal||typeof w.AbortSignal.timeout!=="function")){
    var AS=w.AbortSignal||function(){};
    var t=function(ms){ var c=new AbortController(); setTimeout(function(){ try{ c.abort(); }catch(e){} }, Math.max(0,ms|0)); return c.signal; };
    if(!w.AbortSignal){ w.AbortSignal={timeout:t}; } else { w.AbortSignal.timeout=t; }
  }
}catch(e){}

/* requestIdleCallback */
def(w,"requestIdleCallback",function(cb){ return setTimeout(function(){ cb({didTimeout:false,timeRemaining:function(){ return 50; }}); },1); });
def(w,"cancelIdleCallback",function(id){ clearTimeout(id); });

/* ResizeObserver — استاب نظرسنجی‌محور (فقط اگر کلاً نبود) */
try{
  if(!w.ResizeObserver){
    w.ResizeObserver=function(cb){
      var last={}, timer=null, targets=[];
      function tick(){
        var changed=[];
        for(var i=0;i<targets.length;i++){
          var el=targets[i];
          var k=el.offsetWidth+"x"+el.offsetHeight;
          if(last[i]!==k){ last[i]=k; changed.push({target:el,contentRect:{width:el.offsetWidth,height:el.offsetHeight,top:0,left:0}}); }
        }
        if(changed.length){ try{ cb(changed,self2); }catch(e){} }
      }
      var self2={observe:function(el){ if(targets.indexOf(el)<0){ targets.push(el); } if(!timer){ timer=setInterval(tick,250); } },
        unobserve:function(el){ var ix=targets.indexOf(el); if(ix>=0){ targets.splice(ix,1); delete last[ix]; } if(!targets.length&&timer){ clearInterval(timer); timer=null; } },
        disconnect:function(){ targets=[]; last={}; if(timer){ clearInterval(timer); timer=null; } }};
      return self2;
    };
  }
}catch(e){}
})();
`;

/* اورلی خطای قابل‌گزارش — فقط بیلد APK (کاربر devtools ندارد؛ خطا باید دیده شود) */
export const errorOverlayScript = `(function(){
"use strict";
var w=window, lastReport="", count=0;
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function copy(txt){
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt); return; }
  }catch(e){}
  try{
    var ta=document.createElement("textarea"); ta.value=txt; ta.style.cssText="position:fixed;opacity:0";
    document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
  }catch(e){}
}
function show(msg, stack){
  if(count>5){ return; } count++;
  lastReport="Lexa APK error\\n"+(msg||"unknown")+"\\n"+(stack?String(stack).slice(0,500):"")+"\\nUA: "+navigator.userAgent;
  var box=document.getElementById("lexa-err-overlay");
  if(!box){
    box=document.createElement("div"); box.id="lexa-err-overlay";
    box.style.cssText="position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;background:#2a1515;color:#ffdada;border:1px solid #b3261e;border-radius:10px;padding:10px 12px;font:12px/1.7 Tahoma,sans-serif;max-height:45%;overflow:auto;direction:rtl;box-shadow:0 6px 24px rgba(0,0,0,.4)";
    document.body.appendChild(box);
    var h=document.createElement("div"); h.innerHTML="<b>خطای برنامه</b> — می‌توانید گزارش را کپی و برای پشتیبانی بفرستید"; box.appendChild(h);
    var t=document.createElement("div"); t.style.cssText="white-space:pre-wrap;word-break:break-word;margin-top:6px;direction:ltr;text-align:left;color:#ffe9e9"; box.appendChild(t);
    box._t=t;
    var row=document.createElement("div"); row.style.cssText="margin-top:8px";
    var bc=document.createElement("button"); bc.textContent="کپی گزارش"; bc.style.cssText="background:#b3261e;color:#fff;border:0;border-radius:6px;padding:4px 10px;margin-left:6px;font:12px Tahoma";
    bc.onclick=function(){ copy(lastReport); bc.textContent="کپی شد ✓"; };
    var bx=document.createElement("button"); bx.textContent="بستن"; bx.style.cssText="background:#555;color:#fff;border:0;border-radius:6px;padding:4px 10px;font:12px Tahoma";
    bx.onclick=function(){ if(box.parentNode){ box.parentNode.removeChild(box); } };
    row.appendChild(bx); row.appendChild(bc); box.appendChild(row);
  }
  if(box._t){ box._t.textContent=lastReport; }
}
w.addEventListener("error",function(e){ show(e&&e.message, e&&(e.error&&e.error.stack||e.filename)); });
w.addEventListener("unhandledrejection",function(e){ var r=e&&e.reason; show("Unhandled promise: "+((r&&r.message)||r), r&&r.stack); });
})();
`;

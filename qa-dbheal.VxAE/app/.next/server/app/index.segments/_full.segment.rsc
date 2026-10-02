1:"$Sreact.fragment"
7:I[68027,["/_next/static/chunks/2f236954d6a65e12.js"],"default"]
:HL["/_next/static/chunks/545793704c3bbcbf.css","style"]
2:T1a9c,(function(){
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
0:{"P":null,"b":"5woOevtRsGJsqIM7YPxaa","c":["",""],"q":"","i":false,"f":[[["",{"children":["__PAGE__",{}]},"$undefined","$undefined",true],[["$","$1","c",{"children":[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/chunks/545793704c3bbcbf.css","precedence":"next","crossOrigin":"$undefined","nonce":"$undefined"}],["$","script","script-0",{"src":"/_next/static/chunks/5632aaf411328de2.js","async":true,"nonce":"$undefined"}],["$","script","script-1",{"src":"/_next/static/chunks/b475fe756643a716.js","async":true,"nonce":"$undefined"}],["$","script","script-2",{"src":"/_next/static/chunks/35ba2d5099e9ebd3.js","async":true,"nonce":"$undefined"}]],["$","html",null,{"lang":"fa","dir":"rtl","suppressHydrationWarning":true,"children":[["$","head",null,{"children":[["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$2"}}],null,null,"$L3"]}],"$L4"]}]]}],{"children":["$L5",{},null,false,false]},null,false,false],"$L6",false]],"m":"$undefined","G":["$7",[]],"S":true}
8:I[27410,["/_next/static/chunks/5632aaf411328de2.js","/_next/static/chunks/b475fe756643a716.js","/_next/static/chunks/35ba2d5099e9ebd3.js"],"ThemeProvider"]
9:I[39756,["/_next/static/chunks/2f236954d6a65e12.js"],"default"]
a:I[37457,["/_next/static/chunks/2f236954d6a65e12.js"],"default"]
b:I[52267,["/_next/static/chunks/5632aaf411328de2.js","/_next/static/chunks/b475fe756643a716.js","/_next/static/chunks/35ba2d5099e9ebd3.js"],"SwRegister"]
c:I[91722,["/_next/static/chunks/5632aaf411328de2.js","/_next/static/chunks/b475fe756643a716.js","/_next/static/chunks/35ba2d5099e9ebd3.js","/_next/static/chunks/7bab6600b6e60353.js","/_next/static/chunks/bc59047001fff070.js","/_next/static/chunks/fda79619a80ffa37.js"],"AuthProvider"]
d:I[73254,["/_next/static/chunks/5632aaf411328de2.js","/_next/static/chunks/b475fe756643a716.js","/_next/static/chunks/35ba2d5099e9ebd3.js","/_next/static/chunks/7bab6600b6e60353.js","/_next/static/chunks/bc59047001fff070.js","/_next/static/chunks/fda79619a80ffa37.js"],"AppShell"]
e:I[97367,["/_next/static/chunks/2f236954d6a65e12.js"],"OutletBoundary"]
f:"$Sreact.suspense"
11:I[97367,["/_next/static/chunks/2f236954d6a65e12.js"],"ViewportBoundary"]
13:I[97367,["/_next/static/chunks/2f236954d6a65e12.js"],"MetadataBoundary"]
3:["$","script",null,{"dangerouslySetInnerHTML":{"__html":"(function(){try{var t=localStorage.getItem(\"lexa-theme\")||localStorage.getItem(\"hh-theme\")||localStorage.getItem(\"theme\")||\"light\";var c=document.documentElement.classList;if(t===\"dark\")c.add(\"dark\");else if(t===\"glass\")c.add(\"theme-glass\");}catch(e){}})();"}}]
4:["$","body",null,{"className":"antialiased bg-background text-foreground min-h-screen flex flex-col","children":[["$","$L8",null,{"children":["$","$L9",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$La",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":[[["$","title",null,{"children":"404: This page could not be found."}],["$","div",null,{"style":{"fontFamily":"system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"","height":"100vh","textAlign":"center","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center"},"children":["$","div",null,{"children":[["$","style",null,{"dangerouslySetInnerHTML":{"__html":"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"}}],["$","h1",null,{"className":"next-error-h1","style":{"display":"inline-block","margin":"0 20px 0 0","padding":"0 23px 0 0","fontSize":24,"fontWeight":500,"verticalAlign":"top","lineHeight":"49px"},"children":404}],["$","div",null,{"style":{"display":"inline-block"},"children":["$","h2",null,{"style":{"fontSize":14,"fontWeight":400,"lineHeight":"49px","margin":0},"children":"This page could not be found."}]}]]}]}]],[]],"forbidden":"$undefined","unauthorized":"$undefined"}]}],["$","$Lb",null,{}]]}]
5:["$","$1","c",{"children":[["$","$Lc",null,{"children":["$","$Ld",null,{}]}],[["$","script","script-0",{"src":"/_next/static/chunks/7bab6600b6e60353.js","async":true,"nonce":"$undefined"}],["$","script","script-1",{"src":"/_next/static/chunks/bc59047001fff070.js","async":true,"nonce":"$undefined"}],["$","script","script-2",{"src":"/_next/static/chunks/fda79619a80ffa37.js","async":true,"nonce":"$undefined"}]],["$","$Le",null,{"children":["$","$f",null,{"name":"Next.MetadataOutlet","children":"$@10"}]}]]}]
6:["$","$1","h",{"children":[null,["$","$L11",null,{"children":"$L12"}],["$","div",null,{"hidden":true,"children":["$","$L13",null,{"children":["$","$f",null,{"name":"Next.Metadata","children":"$L14"}]}]}],null]}]
12:[["$","meta","0",{"charSet":"utf-8"}],["$","meta","1",{"name":"viewport","content":"width=device-width, initial-scale=1, viewport-fit=cover"}],["$","meta","2",{"name":"theme-color","content":"#0d211a"}]]
15:I[27201,["/_next/static/chunks/2f236954d6a65e12.js"],"IconMark"]
10:null
14:[["$","title","0",{"children":"Lexa — استاد حقوقی هوشمند"}],["$","meta","1",{"name":"description","content":"اپلیکیشن آموزشی حقوق برای دانشجویان کارشناسی؛ تدریس مرحله‌به‌مرحله حقوق مدنی و تجارت با استاد هوش مصنوعی، تست، فلش‌کارت و تحلیل پیشرفت."}],["$","meta","2",{"name":"application-name","content":"Lexa"}],["$","link","3",{"rel":"manifest","href":"/manifest.webmanifest","crossOrigin":"$undefined"}],["$","meta","4",{"name":"mobile-web-app-capable","content":"yes"}],["$","meta","5",{"name":"apple-mobile-web-app-title","content":"Lexa"}],["$","meta","6",{"name":"apple-mobile-web-app-status-bar-style","content":"black-translucent"}],["$","link","7",{"rel":"icon","href":"/favicon.svg"}],["$","link","8",{"rel":"apple-touch-icon","href":"/icons/apple-touch-icon.png"}],["$","$L15","9",{}]]

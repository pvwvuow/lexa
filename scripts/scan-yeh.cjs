const fs = require('fs'), path = require('path');
const dirs = ['src/lib/law/courses', 'src/lib/law/statutes', 'src/lib/law/exam-packs', 'public/texts'];
const hist = new Map();
function scan(p) {
  for (const f of fs.readdirSync(p)) {
    const fp = path.join(p, f);
    const st = fs.statSync(fp);
    if (st.isDirectory()) { scan(fp); continue; }
    if (!/\.(ts|tsx|json)$/.test(f)) continue;
    const txt = fs.readFileSync(fp, 'utf8');
    let idx = txt.indexOf('مدن');
    while (idx >= 0) {
      const next = txt[idx + 3] ?? '<end>';
      hist.set(next, (hist.get(next) ?? 0) + 1);
      idx = txt.indexOf('مدن', idx + 1);
    }
  }
}
for (const d of dirs) if (fs.existsSync(d)) scan(d);
for (const [ch, n] of [...hist.entries()].sort((a,b)=>b[1]-a[1])) {
  console.log(JSON.stringify(ch), 'U+' + ch.codePointAt(0).toString(16).padStart(4,'0'), n);
}

const fs = require('fs');
const src = fs.readFileSync('src/components/app/GlobalSearch.tsx', 'utf8');
const m = src.match(/function norm\(s: string\): string \{[\s\S]*?\n\}/);
// استخراج بدنه norm و اجرای آن
const body = m[0].replace('function norm(s: string): string {', 'function norm(s) {').replace(/\n\}$/, '\n}');
eval(body);
const q1 = "مدنی", q2 = "مدن";
console.log('query chars مدنی:', [...q1].map(c => 'U+' + c.codePointAt(0).toString(16)));
console.log('norm(مدنی) =', JSON.stringify(norm(q1)), [...norm(q1)].map(c => 'U+' + c.codePointAt(0).toString(16)).join(' '));
console.log('norm(مدن)  =', JSON.stringify(norm(q2)));
// متن واقعی درس‌ها — یک نمونه از داده مدنی
const c1 = fs.readFileSync('src/lib/law/courses/madani1-l6.ts', 'utf8');
const i = c1.indexOf('مدنی');
console.log('data sample مدنی:', JSON.stringify(c1.slice(i, i+8)), [...c1.slice(i, i+4)].map(c => 'U+' + c.codePointAt(0).toString(16)).join(' '));
console.log('norm(data).includes(norm(مدنی)):', norm(c1).includes(norm(q1)));

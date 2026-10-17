from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent
out=root/'preview/web';(out/'preview').mkdir(parents=True,exist_ok=True)
for p in root.glob('*.js'):
 if p.name in ['data.js','config.js']:continue
 s=p.read_text().replace('/afiyah/assets/','assets/')
 if p.name=='app.js':
  s=s.replace("'./data.js?v=20261015-example-copy'","'./preview/adapter.js'").replace('return html+content();','return `<div id="agent-anchor"></div>`+html+content();').replace('href="./"','href="preview/web/index.html"')
  s+='\ndocument.addEventListener("afiyah:refresh",()=>refresh());document.addEventListener("afiyah:navigate",ev=>{tab=ev.detail;render()});document.addEventListener("afiyah:context-request",()=>document.dispatchEvent(new CustomEvent("afiyah:context",{detail:{patient:p,tab}})));new MutationObserver(()=>document.dispatchEvent(new CustomEvent("afiyah:context",{detail:{patient:p,tab}}))).observe(document.getElementById("app"),{childList:true});'
 if p.name=='visit-report-ui.js':s=s.replace("new URL('./", "new URL('../../")
 (out/p.name).write_text(s)
for name in ['agent.js','adapter.js','core.js','voice.js','policy.js']:
 s=(root/'preview'/name).read_text()
 if name=='core.js':
  s=s.replace('import { randomUUID, createHash } from "node:crypto";','const randomUUID=()=>crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,"0")).join(""); const createHash=()=>({update(value){return {digest(){return value}}}});')
  s=s.replace('import { DatabaseSync } from "node:sqlite";', '''class DatabaseSync { constructor(){this.body=null;} exec(sql){if(sql==='BEGIN IMMEDIATE')this.before=this.body;if(sql==='ROLLBACK')this.body=this.before;} prepare(sql){return {run:(value)=>{if(sql.startsWith('INSERT'))this.body??=value;else this.body=value;},get:()=>({body:this.body})};} }''')
  s=s.replace('import { extractFixture } from "./extract.js";','const extractFixture=()=>{throw Error("الرفع متاح في المعاينة المحلية فقط")};')
 if name=='adapter.js':
  start=s.index('export async function api(');end=s.index('export async function selectActor',start)
  s=s[:start]+'''import {CareStore,actors,safety} from './core.js';
const demoStore=new CareStore();let activeActor='sarah';
setInterval(()=>demoStore.tick(),30000);
export async function api(path,body){
 await Promise.resolve();
 if(path==='session'){activeActor=body.actor;return {actor:actors[activeActor]};}
 if(path.startsWith('snapshot'))return demoStore.snapshot(activeActor,new URL('https://preview.invalid/'+path).searchParams.get('patient'));
 if(path==='tool')return demoStore.execute(activeActor,body);
 if(path==='safety')return {safety:safety(body.text,body.country)};
 throw Error('غير متاح في معاينة المتصفح');
}
''' +s[end:]
 if name=='agent.js':
  s=s.replace('معاينة ببيانات افتراضية فقط','معاينة تفاعلية · بيانات افتراضية')
  s=s.replace('التنفيذ النصي يعمل على سجلات الاختبار · الميكروفون محلي، فهم الصوت وصوت المزوّد ينتظران الاعتماد · قد يتوقف الصوت عند قفل الهاتف','سجلات التجربة داخل هذه الصفحة وتبدأ من جديد عند تحديثها · الصوت الحقيقي غير مفعل')
  start=s.index('$("#agent-attach").onclick');end=s.index('$("#agent-notifications").onclick',start)
  s=s[:start]+'''$("#agent-attach").onclick=()=>dialog('تجربة مراجعة المستندات','<p>اختر مصدرا افتراضيا لمعاينة النتيجة، لا ترفع مستندات صحية هنا</p><label>المصدر<select name="fixture"><option value="box">صورة علبة</option><option value="blur">صورة غير واضحة</option><option value="injection">تقرير اختبار تعليمات خبيثة</option></select></label>',v=>perform('attachFixture',v));
''' +s[end:]
 (out/'preview'/name).write_text(s)
s=(root/'index.html').read_text()
s=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; font-src \'self\'; connect-src \'none\'; object-src \'none\'; form-action \'none\'">',s)
s=s.replace('<head>','<head><base href="../../"><meta name="robots" content="noindex,nofollow">').replace('</head>','<link rel="stylesheet" href="preview/agent.css"></head>')
s=re.sub(r'<script type="module" src="app.js[^\"]*"', '<script type="module" src="preview/web/app.js"',s)
s=s.replace('</body>','<script type="module" src="preview/web/preview/agent.js"></script></body>')
s=re.sub(r'<link rel="manifest"[^>]+>','',s)
(out/'index.html').write_text(s)

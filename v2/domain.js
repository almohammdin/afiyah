export const sections=['profile','medications','appointments','tasks','reports','journal'];
export const labels={profile:'الملف الصحي',medications:'الأدوية',appointments:'المواعيد',tasks:'المهام',reports:'التقارير',journal:'المستجدات والزيارات'};
export const latin=s=>String(s??'').replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c<='٩'?1632:1776)));
export const normalize=s=>latin(s).normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0640]/g,'').replace(/\s+/g,' ').trim();
export function day(zone='Asia/Riyadh',now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
export function times(s){const a=[...new Set(latin(s).split(/[,،\s]+/).filter(Boolean))].sort();if(!a.length||a.length>12||a.some(x=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(x)))throw Error('أدخل الأوقات بصيغة 08:00، 20:00 وبحد أقصى 12 وقتًا');return a;}
export function active(m,date){return !m.deleted&&m.status==='active'&&m.start<=date&&(!m.end||m.end>=date);}
export const slotId=(med,date,time)=>`${med}_${date}_${time}`;
export function doses(meds,date){return meds.filter(m=>active(m,date)).flatMap(m=>m.times.map(time=>({id:slotId(m.id,date,time),medId:m.id,name:m.name,dose:m.dose,time,date}))).sort((a,b)=>a.time.localeCompare(b.time));}
export function duplicates(m,others){const n=normalize(m.name),ingredient=normalize(m.ingredient);return others.filter(x=>x.id!==m.id&&!x.deleted&&x.status==='active'&&(normalize(x.name)===n||(ingredient&&normalize(x.ingredient)===ingredient)));}
export function doseWarnings(m,guard,date,now=Date.now()) {const w=[];if(m.minHours>0&&guard?.lastGivenAt&&now-new Date(guard.lastGivenAt).getTime()<m.minHours*3600000)w.push('الفاصل منذ آخر تسجيل أقل من الفاصل الذي أدخلته من الوصفة');if(m.maxPerDay>0&&guard?.day===date&&guard.count>=m.maxPerDay)w.push('عدد الجرعات المسجلة اليوم وصل إلى الحد الذي أدخلته من الوصفة');return w;}
export function validate(s,d){
 const max={name:200,notes:5000,dose:300,ingredient:200,doctor:200,place:300,assignee:120,reason:500,allergies:1000,conditions:1000,emergencyName:120,emergencyPhone:40};
 for(const [k,n] of Object.entries(max))if(k in d&&(typeof d[k]!=='string'||d[k].length>n))throw Error('تحقق من طول وصحة الحقول');
 if(!d.name?.trim())throw Error('أدخل الاسم أو العنوان');
 for(const k of ['date','start','end'])if(d[k]&&!validDate(d[k]))throw Error('التاريخ غير صحيح، استخدم YYYY-MM-DD');
 if(s==='medications'){if(!d.dose.trim())throw Error('أدخل الجرعة كما وردت في الوصفة');times(d.times.join(','));if(d.end&&d.end<d.start)throw Error('النهاية تسبق البداية');if(!Number.isFinite(d.minHours)||d.minHours<0||d.minHours>168||!Number.isInteger(d.maxPerDay)||d.maxPerDay<0||d.maxPerDay>100)throw Error('تحقق من حدود الوصفة');}
 return d;
}
export const errorMessage=e=>({'permission-denied':'تعذر الوصول إلى هذا الملف، تحقق من صلاحيات المشاركة','unavailable':'تعذر الاتصال، حاول مرة أخرى','auth/popup-blocked':'اسمح بفتح نافذة تسجيل الدخول في المتصفح','auth/popup-closed-by-user':'لم يكتمل تسجيل الدخول','auth/unauthorized-domain':'تعذر تسجيل الدخول من هذا الرابط'}[e.code]||(e.code?'تعذر إكمال العملية، حاول مجددًا':e.message)||'تعذر إكمال العملية');

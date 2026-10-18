import {operationId} from './agent/id.js';
import {makeExample} from './example-patient.js?v=20261015-example-copy';
import {localInstant,recordable,eventWarnings,zones} from './care-time.js';
import {config} from './config.js';
import {sections,day,validate,slotId,doseWarnings,active} from './domain.js?v=20261014-care-fixes';
let sdk,db,auth,person=null,demo=false,mem,initPromise,memOwner;
export const user=()=>person;
export const isDemo=()=>demo;
let agentSandboxId=null,agentSandboxOwner=null;
export function isAgentSandbox(p){return !!person&&agentSandboxOwner===person.uid&&p?.id===agentSandboxId&&mem?.patients.some(x=>x===p&&x._agentSandbox);}
export function createAgentSandbox(){
 if(!person)throw Error('سجل الدخول أو اختر استكشاف المنصة');
 ensureExample();
 const old=mem.patients.find(x=>isAgentSandbox(x));if(old)return old;
 const sample=makeExample(person.uid);sample.patient.id='agent-test-'+operationId();sample.patient._agentSandbox=true;sample.patient.name='سارة · اختبار الوكيل';sample.patient.relation='';
 agentSandboxId=sample.patient.id;agentSandboxOwner=person.uid;
 mem.patients.push(sample.patient);mem.entries[sample.patient.id]=sample.entries;
 return sample.patient;
}
const uid=()=>person.uid, email=()=>person.email.toLowerCase(), uuid=()=>operationId();
const root='carePatients', grants='careMemberships';
const rootFor=p=>p._legacy?'patients':root,grantsFor=p=>p._legacy?'memberships':grants;
const local=p=>demo||p?._example;
const stamp=p=>local(p)?new Date().toISOString():sdk.serverTimestamp();
const ref=(...p)=>sdk.doc(db,...p), col=(...p)=>sdk.collection(db,...p);
function unpack(d){const out={...d.data(),id:d.id};for(const [k,v]of Object.entries(out))if(v?.toDate)out[k]=v.toDate().toISOString();return out;}
async function list(c,filters=[]){let out=[],last;for(;;){const q=sdk.query(c,...filters,sdk.orderBy(sdk.documentId()),...(last?[sdk.startAfter(last)]:[]),sdk.limit(200));const page=await sdk.getDocs(q);out.push(...page.docs.map(unpack));if(page.size<200)return out;last=page.docs.at(-1);}}
export const owner=p=>p.ownerId===uid();
export const can=(p,s,write=false)=>!p.deleting&&(owner(p)||p.grant?.[write?'editSections':'readSections']?.includes(s==='doseEvents'?'medications':s));
export async function init(callback){if(initPromise)return initPromise;initPromise=(async()=>{const [a,b,c]=await Promise.all(['app','auth','firestore'].map(x=>import(`https://www.gstatic.com/firebasejs/11.10.0/firebase-${x}.js`)));sdk={...b,...c};const app=a.initializeApp(config.firebase,'afiyah');auth=b.getAuth(app);await b.setPersistence(auth,b.browserSessionPersistence);db=c.initializeFirestore(app,{localCache:c.memoryLocalCache()});b.onAuthStateChanged(auth,u=>{if(demo)return;person=u;callback(u);});})();return initPromise;}
export async function login(){await initPromise;if(!auth)throw Error('تعذر تجهيز الدخول، أعد المحاولة');demo=false;await sdk.signInWithPopup(auth,new sdk.GoogleAuthProvider());}
export async function logout(){if(demo){demo=false;person=null;mem=null;if(auth)await sdk.signOut(auth);}else await sdk.signOut(auth);}
function ensureExample(){
 if(memOwner===uid()&&mem)return;
 memOwner=uid();mem={patients:[],members:[],entries:{}};
 let removed=false;try{removed=window.localStorage.getItem('afiyah-example-removed:'+uid())==='1';}catch{}
 if(!removed){const sample=makeExample(uid());mem.patients=[sample.patient];mem.entries[sample.patient.id]=sample.entries;}
}
export function startDemo(){demo=true;person={uid:'demo-owner',email:'demo@example.com',displayName:'زائر عافية'};ensureExample();return mem.patients[0];}
export async function patients(){ensureExample();if(demo)return mem.patients;const own=[];for(const name of [root,'patients']){const found=await list(col(name),[sdk.where('ownerId','==',uid())]);own.push(...found.map(p=>({...p,timezone:p.timezone||'Asia/Riyadh',_legacy:name==='patients'})));}const memberships=await invitations(false);for(const m of memberships.filter(x=>x.status==='active')){if(own.some(p=>p.id===m.patientId&&!!p._legacy===!!m._legacy))continue;try{const snap=await sdk.getDoc(ref(m._legacy?'patients':root,m.patientId));if(snap.exists()&&!snap.data().deleting)own.push({...unpack(snap),timezone:snap.data().timezone||'Asia/Riyadh',_legacy:!!m._legacy,grant:m});}catch(e){if(e.code!=='permission-denied')throw e;}}return [...own,...mem.patients];}
export async function invitations(pendingOnly=true){if(demo)return mem.members.filter(x=>x.email===email()&&(!pendingOnly||x.status==='pending'));const a=[];for(const name of [grants,'memberships']){a.push(...(await list(col(name),[sdk.where('email','==',email())])).map(m=>({...m,_legacy:name==='memberships'})));}return pendingOnly?a.filter(x=>x.status==='pending'):a;}
export async function members(p){return local(p)?mem.members.filter(x=>x.patientId===p.id):owner(p)?(await list(col(grantsFor(p)),[sdk.where('ownerId','==',uid())])).filter(x=>x.patientId===p.id):[p.grant];}
export async function accept(m){if(demo){m.status='active';m.memberUid=uid();return;}await sdk.updateDoc(ref(m._legacy?'memberships':grants,m.id),m._legacy?{status:'active'}:{status:'active',memberUid:uid()});}
export async function share(p,value){if(p._example)throw Error('المشاركة متاحة لملفاتك الفعلية');if(!owner(p))throw Error('إدارة المشاركة متاحة لصاحب الملف');const e=value.email.trim().toLowerCase();if(e===email())throw Error('هذا حساب صاحب الملف');if(!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(e))throw Error('البريد غير صحيح');const id=p.id+'_'+e;const payload={...value,email:e,patientId:p.id,patientName:p.name,ownerId:uid()};if(local(p)){const old=mem.members.find(m=>m.id===id);if(old)Object.assign(old,payload);else mem.members.push({...payload,id,status:'pending',memberUid:''});return;}
 await sdk.runTransaction(db,async tx=>{const r=ref(grantsFor(p),id),snap=await tx.get(r);const old=snap.exists()?snap.data():null;const next={...payload,status:old?.status||'pending'};if(!p._legacy||old?.memberUid!==undefined)next.memberUid=old?.memberUid||'';tx.set(r,next);});}
export async function revoke(p,m){if(!owner(p)&&m.email!==email())throw Error('ليس لديك صلاحية');if(local(p)){mem.members=mem.members.filter(x=>x.id!==m.id);return;}await sdk.deleteDoc(ref(grantsFor(p),m.id));}
export async function createPatient(v){const p={name:v.name.trim(),relation:v.relation||'',timezone:v.timezone||'Asia/Riyadh',basis:v.basis,policyVersion:'2026-10-14',ownerId:uid(),deleting:false,createdAt:stamp()};if(!p.name||p.name.length>120)throw Error('تحقق من اسم المريض');if(!['self','consent','guardian','representative'].includes(p.basis))throw Error('حدد صفتك في إدارة الملف');const id=uuid();if(demo){mem.patients.push({...p,id});mem.entries[id]=Object.fromEntries([...sections,'safety','doseEvents','doseGuards','audit'].map(x=>[x,[]]));}else await sdk.setDoc(ref(root,id),p);return {...p,id};}
export async function load(p){const out={};await Promise.all([...sections,'doseEvents','audit'].map(async s=>{const permitted=s==='audit'?owner(p):can(p,s==='doseEvents'?'medications':s);out[s]=permitted?(local(p)?mem.entries[p.id][s]:await list(col(rootFor(p),p.id,s))):[];}));
 if(p._legacy){for(const section of ['medications','appointments','tasks','reports'])out[section]=out[section].map(r=>normalizeLegacy(section,r));if(owner(p)&&!out.profile.length)out.profile=[{id:'health',name:'الملف الصحي',revision:0,allergyStatus:p.allergies?'known':'unknown',allergies:p.allergies||'',conditions:p.conditions||'',birthYear:p.birthYear||'',blood:p.blood||'',emergencyName:'',emergencyPhone:'',hospitalFiles:[]}];for(const med of out.medications){const raw=med.legacyRecord;if(!raw)continue;for(const date of raw.takenDates||[]){const id=slotId(med.id,date,raw.time);if(!out.doseEvents.some(x=>x.id===id))out.doseEvents.push({id,medId:med.id,name:med.name,day:date,time:raw.time,status:'given',imported:true,reason:'تسجيل محفوظ',updatedAt:raw.updatedAt||'',revision:0});}}}
 if(can(p,'medications')){if(local(p))out.safety=out.profile[0]||null;else{const safe=await sdk.getDoc(ref(rootFor(p),p.id,'safety','allergies'));out.safety=safe.exists()?unpack(safe):(owner(p)?out.profile[0]:null);}}
 return out;}
export function normalizeLegacy(section,r){if(r.revision)return r;const {id,...raw}=r;const common={id,name:r.name,notes:r.notes||'',revision:0,deleted:false,legacyRecord:raw};if(section==='medications')return {...common,ingredient:r.ingredient||'',dose:r.dose||'',times:r.times||[r.time],start:r.start||'',end:r.end||'',status:r.status||'active',minHours:r.minHours||0,maxPerDay:r.maxPerDay||0};if(section==='appointments')return {...common,date:r.date,time:r.time,doctor:r.doctor||'',place:r.place||''};if(section==='tasks')return {...common,date:r.date,assignee:r.assignee||'',status:r.status==='done'?'done':'open'};return {...common,date:r.date};}
function auditPayload(s,id,d){return {section:s,recordId:id,revision:d.revision,actorId:uid(),actor:person.displayName||person.email,at:d.updatedAt,snapshot:d};}
export async function save(p,s,value){if(!can(p,s,true))throw Error('ليست لديك صلاحية التعديل');if(s==='doseEvents')throw Error('استخدم تسجيل الجرعة أو تصحيحها');if(s==='profile'&&!owner(p))throw Error('تعديل الملف الصحي متاح لصاحب الملف');const id=value.id||uuid(),expected=value.revision||0;let {id:ignore,...body}=value;validate(s,body);body={...body,deleted:!!body.deleted,revision:expected+1,updatedById:uid(),updatedAt:stamp(p)};
 if(local(p)){const rows=mem.entries[p.id][s],old=rows.find(x=>x.id===id);if((old?.revision||0)!==expected)throw Error('تغيّر السجل، حدّث الصفحة قبل التعديل');if(old)Object.assign(old,body);else rows.push({...body,id});mem.entries[p.id].audit.push({...auditPayload(s,id,body),id:uuid()});return;}
 await sdk.runTransaction(db,async tx=>{const r=ref(rootFor(p),p.id,s,id),old=await tx.get(r);if((old.exists()?(old.data().revision||0):0)!==expected)throw Error('تغيّر السجل، حدّث الصفحة قبل التعديل');tx.set(r,body);if(s==='profile')tx.set(ref(rootFor(p),p.id,'safety','allergies'),{allergyStatus:body.allergyStatus,allergies:body.allergies,revision:body.revision});tx.set(ref(rootFor(p),p.id,'audit',`${s}_${id}_${body.revision}`),auditPayload(s,id,body));});}
export async function archive(p,s,r){if(s==='medications')return save(p,s,{...r,status:'stopped'});return save(p,s,{...r,deleted:true});}
export async function recordDose(p,m,date,time,status,reason='',ack=false,actual=null){
 if(!can(p,'medications',true))throw Error('ليست لديك صلاحية التسجيل');
 if(!['given','not-given'].includes(status))throw Error('اختر حالة الجرعة');
 if(status==='not-given'&&!reason.trim())throw Error('اكتب سبب عدم الإعطاء');
 if(!recordable(date,p.timezone)||!m.times.includes(time)||!active(m,date))throw Error('التسجيل متاح لجرعات اليوم وأمس من جدول العلاج الحالي');
 const scheduled=localInstant(date,time,p.timezone),occurred=actual?localInstant(actual.day,actual.time,p.timezone):{iso:new Date().toISOString()};
 if(Date.parse(occurred.iso)>Date.now()||Date.parse(occurred.iso)<Date.now()-172800000)throw Error('وقت الحدث يجب أن يكون خلال آخر 48 ساعة وحتى الآن');
 const id=slotId(m.id,date,time);
 return changeDose(p,m,id,old=>{
  if(old&&old.status!=='corrected')throw Error('هذه الجرعة مسجلة بالفعل، حدّث الصفحة لعرضها');
  if(old&&!reason.trim())throw Error('اكتب سبب إعادة التسجيل بعد التصحيح');
  return {name:m.name,medId:m.id,day:date,time,status,reason,warningAcknowledged:!!ack,scheduledAt:scheduled.iso,offsetMinutes:scheduled.offsetMinutes,timezone:p.timezone,occurredAt:occurred.iso,revision:(old?.revision||0)+1,deleted:false,updatedById:uid(),updatedAt:stamp(p)};
 },ack);
}
export async function correctDose(p,event,reason){
 if(!can(p,'medications',true))throw Error('ليست لديك صلاحية التسجيل');
 if(!reason.trim())throw Error('اكتب سبب التصحيح');if(event.imported)throw Error('هذا تسجيل محفوظ من السجل الأصلي');
 return changeDose(p,null,event.id,old=>{if(!old||old.status==='corrected'||old.revision!==event.revision)throw Error('تغيّر التسجيل، حدّث الصفحة قبل التصحيح');return {...old,status:'corrected',reason,revision:old.revision+1,updatedById:uid(),updatedAt:stamp(p)};});
}
async function changeDose(p,m,id,build,ack=false){
 const medId=m?.id||id.slice(0,id.lastIndexOf('_',id.lastIndexOf('_')-1));
 const prepare=(old,events,med)=>{const body=build(old);if(body.status==='given'){const warnings=eventWarnings(med,events.filter(x=>x.id!==id),body.occurredAt,p.timezone);if(warnings.length&&!ack){const e=Error(warnings.join(' — '));e.warnings=warnings;throw e;}}return body;};
 if(local(p)){const data=mem.entries[p.id],i=data.doseEvents.findIndex(x=>x.id===id),old=i<0?null:data.doseEvents[i];const body=prepare(old,data.doseEvents,m);if(i<0)data.doseEvents.push({...body,id});else data.doseEvents[i]={...body,id};data.audit.push({...auditPayload('doseEvents',id,body),snapshot:{...body},id:uuid()});return;}
 await sdk.runTransaction(db,async tx=>{
  const er=ref(rootFor(p),p.id,'doseEvents',id),lock=ref(rootFor(p),p.id,'doseGuards',medId);
  const [gs,es,ms]=await Promise.all([tx.get(lock),tx.get(er),tx.get(ref(rootFor(p),p.id,'medications',medId))]);
  const old=es.exists()?unpack(es):null;
  const med=ms.exists()?(p._legacy?normalizeLegacy('medications',unpack(ms)):unpack(ms)):null;
  if(m&&(!med||med.revision!==m.revision||!active(med,m?build(null).day:'')))throw Error('تغيّرت وصفة الدواء، حدّث الصفحة');
  // Every dose mutation also updates the transaction lock. A concurrent write
  // causes a retry, so this paginated read cannot silently miss another dose.
  const events=await list(col(rootFor(p),p.id,'doseEvents'),[sdk.where('medId','==',medId)]);
  if(med?.legacyRecord)for(const date of med.legacyRecord.takenDates||[])events.push({id:slotId(medId,date,med.legacyRecord.time),medId,day:date,status:'given'});
  if(m&&events.some(x=>x.id===id)&&!old)throw Error('هذه الجرعة مسجلة بالفعل');
  let body=prepare(old,events,med);delete body.id;
  const stored={...body};for(const k of ['occurredAt','scheduledAt'])if(stored[k])stored[k]=sdk.Timestamp.fromDate(new Date(stored[k]));
  tx.set(er,stored);tx.set(ref(rootFor(p),p.id,'audit',`doseEvents_${id}_${body.revision}`),auditPayload('doseEvents',id,stored));
  tx.set(lock,{revision:(gs.exists()?gs.data().revision||0:0)+1,eventId:id,eventRevision:body.revision,changedAt:stamp(p)});
 });
}
export async function exportPatient(p){if(!owner(p))throw Error('التصدير الكامل متاح لصاحب الملف');const entries=await load(p);return {format:'afiyah-2',exportedAt:new Date().toISOString(),patient:p,entries,members:await members(p)};}
export async function deletePatient(p){if(!owner(p))throw Error('الحذف متاح لصاحب الملف');if(local(p)){if(p._example&&!p._agentSandbox){try{window.localStorage.setItem('afiyah-example-removed:'+uid(),'1');}catch{throw Error('تعذر حفظ حذف المثال في هذا المتصفح');}}delete mem.entries[p.id];mem.members=mem.members.filter(x=>x.patientId!==p.id);mem.patients=mem.patients.filter(x=>x.id!==p.id);return;}
 await sdk.updateDoc(ref(rootFor(p),p.id),{deleting:true});
 // Root remains until all pages are deleted; retries resume the same operation.
 for(const s of [...sections,'safety','doseEvents','doseGuards','audit']){for(;;){const page=await sdk.getDocs(sdk.query(col(rootFor(p),p.id,s),sdk.limit(150)));if(page.empty)break;const batch=sdk.writeBatch(db);page.docs.forEach(d=>batch.delete(d.ref));await batch.commit();}}
 for(const m of await members(p))await sdk.deleteDoc(ref(grantsFor(p),m.id));await sdk.deleteDoc(ref(rootFor(p),p.id));}

export async function updatePatient(p,v){if(!owner(p))throw Error('تعديل البيانات متاح لصاحب الملف');const next={name:v.name.trim(),relation:v.relation.trim(),timezone:v.timezone};if(!next.name||next.name.length>120||next.relation.length>120||!zones.includes(next.timezone))throw Error('تحقق من بيانات المريض');if(local(p)){Object.assign(mem.patients.find(x=>x.id===p.id),next);mem.members.filter(x=>x.patientId===p.id).forEach(x=>x.patientName=next.name);return;}const ms=await members(p);if(ms.length>200)throw Error('عدد المشاركين يتطلب تحديثا إداريا');await sdk.runTransaction(db,async tx=>{const r=ref(rootFor(p),p.id);const old=await tx.get(r);if(!old.exists()||old.data().name!==p.name||(old.data().timezone||'Asia/Riyadh')!==p.timezone)throw Error('تغيّر الملف، حدّث الصفحة');const snaps=await Promise.all(ms.map(x=>tx.get(ref(grantsFor(p),x.id))));tx.update(r,next);snaps.filter(x=>x.exists()).forEach(x=>tx.update(x.ref,{patientName:next.name}));});}

import {operationId} from './id.js';
import {day,sections,slotId} from '../domain.js';
const clone=x=>structuredClone(x);
const fields=['id','name','dose','ingredient','times','start','end','status','date','time','place','doctor','notes','kind','revision','medId','day','occurredAt'];
const publicRow=row=>Object.fromEntries(fields.filter(k=>Object.hasOwn(row,k)).map(k=>[k,row[k]]));
export const careDeclaration={name:'care_action',description:'Read or update the selected fictional patient through Afiyah. Never supply patient IDs. Wait for success. For dose use the exact recorded medication ID and scheduled time; ask when unclear. Medication changes are not supported.',parameters:{type:'OBJECT',properties:{action:{type:'STRING',enum:['today','read','navigate','visit','save','dose','correctDose','undo']},section:{type:'STRING',enum:['today','medications','appointments','calendar','profile','tasks','reports','journal','summary','audit','settings']},id:{type:'STRING'},revision:{type:'NUMBER'},name:{type:'STRING'},notes:{type:'STRING'},date:{type:'STRING'},time:{type:'STRING'},place:{type:'STRING'},doctor:{type:'STRING'},status:{type:'STRING',enum:['open','done']},medId:{type:'STRING'},occurredDate:{type:'STRING'},occurredTime:{type:'STRING'},reason:{type:'STRING'},auditId:{type:'STRING'}},required:['action']}};
export function createCareTools({data:D,getPatient,navigate,refresh,review}){
 const operations=new Map(),undo=new Map();
 let queue=Promise.resolve();
 function guard(pid,actor){const p=getPatient();if(!D.isAgentSandbox(p)||p.id!==pid||D.user()?.uid!==actor)throw Error('تغير الملف أو الحساب، أعد الطلب داخل ملف اختبار الوكيل');return p;}
 async function execute(a,identity){
  const p=guard(identity.pid,identity.actor);
  const assert=(section,write=false)=>{guard(identity.pid,identity.actor);if(!D.can(p,section,write))throw Error('ليست لديك الصلاحية المطلوبة');};
  const read=async()=>{guard(identity.pid,identity.actor);const result=await D.load(p);guard(identity.pid,identity.actor);return result;};
  if(a.action==='navigate'||a.action==='visit'){
   const section=a.action==='visit'?'summary':a.section;
   if(sections.includes(section))assert(section);navigate(section);return {ok:true,kind:'navigate',message:'فتحت القسم',section};
  }
  const entries=await read();
  if(a.action==='today'||a.action==='read'){
   const names=a.action==='today'?['medications','appointments','tasks']: [a.section];
   const out={};for(const section of names){if(!sections.includes(section))throw Error('قسم غير صالح');assert(section);out[section]=(entries[section]||[]).filter(r=>!r.deleted).map(publicRow);}
   if(names.includes('medications'))out.doseEvents=(entries.doseEvents||[]).map(publicRow);
   return {ok:true,kind:'records',date:day(p.timezone),timezone:p.timezone,sections:out,message:'هذه المعلومات المسجلة، غياب تسجيل الجرعة لا يعني عدم تناولها'};
  }
  if(a.action==='save'){
   const section=a.section;if(!['appointments','tasks','journal'].includes(section))throw Error('تعديل العلاج والملف الصحي من خلال المراجعة اليدوية فقط');assert(section,true);
   const old=a.id?entries[section].find(r=>r.id===a.id):null;if(a.id&&!old)throw Error('السجل غير موجود');if(old&&a.revision!==old.revision)throw Error('تغير السجل، استرجعه قبل التعديل');
   const allowed={appointments:['name','notes','date','time','place','doctor'],tasks:['name','notes','date','status'],journal:['name','notes','date']};
   const before=clone(old);
   const value={...(old||{id:operationId(),revision:0,notes:'',date:day(p.timezone),...(section==='journal'?{kind:'update'}:{}),...(section==='tasks'?{status:'open',assignee:''}:{})}),...Object.fromEntries(allowed[section].filter(k=>a[k]!==undefined).map(k=>[k,a[k]]))};
   if(old&& !await review({title:'مراجعة التعديل',before:publicRow(old),after:publicRow(value)}))return {ok:false,message:'لم يعتمد التعديل'};
   assert(section,true);await D.save(p,section,value);guard(identity.pid,identity.actor);
   const auditId=operationId();undo.set(auditId,{...identity,section,id:value.id,before,revision:value.revision+1});await refresh();
   return {ok:true,persisted:true,kind:'saved',auditId,message:'حفظت في سجل الاختبار',record:publicRow(value)};
  }
  if(a.action==='dose'){
   assert('medications',true);const med=entries.medications.find(r=>r.id===a.medId&&!r.deleted);if(!med)throw Error('حدد الدواء المسجل دون تخمين');
   if(!a.date||!a.time)throw Error('حدد تاريخ وموعد الجرعة المقصودة');
   const id=slotId(med.id,a.date,a.time),old=entries.doseEvents.find(r=>r.id===id);
   if(old&&old.status!=='corrected')return {ok:true,kind:'duplicate',message:'هذا الموعد مسجل بالفعل، لم أضف تسجيلا آخر'};
   if(!a.occurredDate||!a.occurredTime)throw Error('ما وقت التناول الفعلي؟');
   await D.recordDose(p,med,a.date,a.time,'given',a.reason||'',false,{day:a.occurredDate,time:a.occurredTime});guard(identity.pid,identity.actor);
   const saved=(await read()).doseEvents.find(r=>r.id===id),auditId=operationId();undo.set(auditId,{...identity,section:'doseEvents',event:clone(saved)});await refresh();
   return {ok:true,persisted:true,kind:'saved',auditId,message:'سجلت التناول في ملف الاختبار',event:publicRow(saved)};
  }
  if(a.action==='correctDose'){
   assert('medications',true);const event=entries.doseEvents.find(r=>r.id===a.id);if(!event)throw Error('التسجيل غير موجود');
   if(!await review({title:'تصحيح تسجيل الجرعة',before:publicRow(event),after:{reason:a.reason}}))return {ok:false,message:'لم يعتمد التصحيح'};
   assert('medications',true);await D.correctDose(p,event,a.reason||'');await refresh();return {ok:true,persisted:true,kind:'saved',message:'حفظت التصحيح في سجل الاختبار'};
  }
  if(a.action==='undo'){
   const op=undo.get(a.auditId);if(!op||op.pid!==p.id||op.actor!==identity.actor)throw Error('التراجع غير متاح لهذه العملية');
   if(op.section==='doseEvents'){assert('medications',true);await D.correctDose(p,op.event,'تراجع عن تسجيل الوكيل');}
   else {assert(op.section,true);const current=entries[op.section].find(r=>r.id===op.id);if(!current||current.revision!==op.revision)throw Error('تغير السجل بعد العملية، راجعه يدويا');await D.save(p,op.section,{...(op.before||current),revision:current.revision,deleted:op.before?!!op.before.deleted:true});}
   undo.delete(a.auditId);await refresh();return {ok:true,persisted:true,kind:'saved',message:'حفظت التراجع في سجل التغييرات'};
  }
  throw Error('عملية غير مسموحة');
 }
 return async (args,key)=>{
  const p=getPatient(),actor=D.user()?.uid;if(!D.isAgentSandbox(p))return {ok:false,message:'الصوت والأدوات متاحة لملف اختبار الوكيل فقط'};
  if(!key)return {ok:false,message:'معرف العملية مطلوب'};
  const id=actor+':'+p.id+':'+key,signature=JSON.stringify(args);
  if(operations.has(id)){const old=operations.get(id);if(old.signature!==signature)return {ok:false,message:'معرف العملية مستخدم لطلب مختلف'};return old.promise;}
  const promise=queue.then(()=>execute(args,{pid:p.id,actor})).catch(e=>({ok:false,message:e.message}));queue=promise.then(()=>{});operations.set(id,{signature,promise});return promise;
 };
}

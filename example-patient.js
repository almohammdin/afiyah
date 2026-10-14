import {day,slotId} from './domain.js';
import {shiftDate} from './dashboard.js';
import {localInstant} from './care-time.js';

// Entirely fictional content, generated relative to the first visit so the calendar is useful.
export function makeExample(ownerId,now=new Date()){
 const timezone='Asia/Riyadh',today=day(timezone,now),date=n=>shiftDate(today,n);
 const patient={id:'afiyah-example',_example:true,name:'سارة',relation:'مثال توضيحي',timezone,ownerId,deleting:false,createdAt:now.toISOString()};
 const row=(id,value)=>({id,revision:1,deleted:false,...value});
 const medication=(id,name,dose,times,end='')=>row(id,{name,ingredient:'مادة افتراضية '+id,dose,times,start:date(-14),end,status:'active',notes:'دواء افتراضي لشرح الجدول فقط، لا يستخدم للعلاج',minHours:0,maxPerDay:0});
 const medications=[
  medication('sample','دواء توضيحي أ','قرص واحد — مثال فقط',['08:00','20:00']),
  medication('sample-b','دواء توضيحي ب','كبسولة واحدة — مثال فقط',['13:00']),
  medication('sample-c','دواء توضيحي ج','5 مل — مثال فقط',['09:00','21:00'],date(5))
 ];
 const entries={
  profile:[row('health',{name:'الملف الصحي',allergyStatus:'unknown',allergies:'',conditions:'متابعة دورية ومراجعة خطة العناية — بيانات افتراضية',blood:'O+',birthYear:'1963',emergencyName:'أحمد — ابن المريضة (مثال)',emergencyPhone:'',hospitalFiles:[{hospital:'مستشفى الملك فهد — مثال',number:'10023456'},{hospital:'مستشفى الحبيب — دبي — مثال',number:'20034567'},{hospital:'مركز الرعاية الصحية — مثال',number:'30045678'}]})],
  medications,
  appointments:[
   row('visit-today',{name:'مراجعة دورية',date:today,time:'17:00',doctor:'الطبيب المعالج — مثال',place:'مستشفى الملك فهد · العيادات الخارجية',notes:'إحضار قائمة الأدوية وأسئلة الزيارة'}),
   row('visit-lab',{name:'موعد مختبر',date:date(2),time:'09:30',doctor:'فريق المختبر — مثال',place:'مركز الرعاية الصحية',notes:'التأكد من تعليمات التحضير لدى المركز قبل الموعد'}),
   row('visit-followup',{name:'متابعة نتائج الفحوصات',date:date(7),time:'11:00',doctor:'الطبيب المعالج — مثال',place:'مستشفى الحبيب · دبي',notes:'اصطحاب نتائج الفحوصات وملخص الزيارة السابقة'})
  ],
  tasks:[row('task-bag',{name:'تجهيز ملف الزيارة',date:today,assignee:'أحمد — مثال',status:'open',notes:'قائمة الأدوية وأرقام الملفات وأسئلة الطبيب'}),row('task-ride',{name:'تنسيق مرافق الموعد',date:today,assignee:'ريم — مثال',status:'open',notes:'تأكيد وقت الانطلاق مع الأسرة'}),row('task-result',{name:'إضافة نتائج المختبر',date:date(2),assignee:'أحمد — مثال',status:'open',notes:'تسجيل ملخص النتائج بعد استلامها'}),row('task-check',{name:'تحديث بيانات المستشفيات',date:date(-1),assignee:'ريم — مثال',status:'done',notes:'تمت مراجعة أرقام الملفات الافتراضية'})],
  reports:[row('report-lab',{name:'ملخص فحوصات دورية — مثال',date:date(-3),notes:'مثال على حفظ ملخص التقرير وتاريخه للرجوع إليه وقت الزيارة، لا يتضمن نتائج طبية فعلية أو مرفقًا'}),row('report-plan',{name:'خطة متابعة — مثال',date:date(-7),notes:'مراجعة دورية، تدوين المستجدات وتجهيز الأسئلة للزيارة المقبلة'})],
  journal:[row('journal-update',{name:'متابعة يومية',date:today,kind:'update',notes:'تم تجهيز قائمة المواعيد وتوزيع المهام بين أفراد الأسرة — مثال'}),row('journal-question',{name:'سؤال للموعد القادم',date:today,kind:'question',notes:'متى تكون المراجعة المقبلة، وما المعلومات المطلوبة لمتابعة الخطة؟'}),row('journal-visit',{name:'ملخص الزيارة السابقة',date:date(-7),kind:'visit',notes:'تمت مراجعة خطة المتابعة وتحديد موعد للفحوصات — مثال افتراضي'})],
  doseEvents:[],doseGuards:[],audit:[],safety:[]
 };
 // Only past dates are pre-recorded; today's controls remain available to try.
 for(let offset=-6;offset<0;offset++)for(const med of medications)for(const time of med.times){
  const d=date(offset),instant=localInstant(d,time,timezone),status=offset===-2&&time==='20:00'?'not-given':'given';
  entries.doseEvents.push(row(slotId(med.id,d,time),{name:med.name,medId:med.id,day:d,time,status,reason:status==='not-given'?'مثال لتوضيح تسجيل جرعة لم تعط':'تسجيل توضيحي',scheduledAt:instant.iso,occurredAt:instant.iso,updatedAt:instant.iso,timezone,updatedById:ownerId,warningAcknowledged:false}));
 }
 return {patient,entries};
}

import {day,slotId} from './domain.js?v=20261020-session-fix';
import {shiftDate} from './dashboard.js?v=20261020-session-fix';
import {localInstant} from './care-time.js?v=20261020-session-fix';

// Entirely fictional content, generated relative to the first visit so the calendar is useful.
export function makeExample(ownerId,now=new Date()){
 const timezone='Asia/Riyadh',today=day(timezone,now),date=n=>shiftDate(today,n);
 const patient={id:'afiyah-example',_example:true,name:'سارة',relation:'الوالدة',timezone,ownerId,deleting:false,createdAt:now.toISOString()};
 const row=(id,value)=>({id,revision:1,deleted:false,...value});
 const medication=(id,name,dose,times,end='')=>row(id,{name,ingredient:'',dose,times,start:date(-14),end,status:'active',notes:'',minHours:0,maxPerDay:0});
 const medications=[
  {...medication('sample','فيفادول · Fevadol 500 mg','قرص واحد',['08:00','20:00'],date(3)),ingredient:'باراسيتامول · Paracetamol · 500 mg',notes:'مسكن ضمن خطة سارة القصيرة، مراجعة الحاجة إليه في الموعد القادم'},
  {...medication('sample-b','زيرتك · Zyrtec 10 mg','قرص واحد',['21:00'],date(7)),ingredient:'سيتريزين هيدروكلوريد · Cetirizine hydrochloride · 10 mg',notes:'مسجل لمتابعة أعراض الحساسية، تدوين أي نعاس لمناقشته مع الصيدلي'},
  {...medication('sample-c','يوثيروكس · Euthyrox 50 mcg','قرص واحد',['07:00']),ingredient:'ليفوثيروكسين الصوديوم · Levothyroxine sodium · 50 mcg',notes:'على معدة فارغة قبل الإفطار بـ 30 إلى 60 دقيقة، يفصل عن الكالسيوم 4 ساعات على الأقل في هذه الخطة'},
  {...medication('sample-calcium','كالترات · Caltrate 600 mg','قرص واحد',['13:00']),ingredient:'كربونات الكالسيوم · Calcium carbonate · 600 mg',notes:'بعد الغداء، وضع في الساعة 13:00 لفصله عن يوثيروكس المسجل الساعة 07:00؛ الفاصل في الجدول 6 ساعات، لا تغير توقيت علاج حقيقي دون مراجعة وصفته'},
  {...medication('sample-vitamin','جي بي فيتامين د3 · JP Vitamin D3 1000 IU','كبسولة واحدة',['13:00']),ingredient:'كوليكالسيفيرول · Cholecalciferol · 1000 IU',notes:'ضمن خطة المتابعة الغذائية، مناقشة مدة الاستخدام وموعد إعادة التحليل مع الطبيب'}
 ];
 const entries={
  profile:[row('health',{name:'الملف الصحي',allergyStatus:'unknown',allergies:'',conditions:'قصور الغدة الدرقية تحت المتابعة، ألم متقطع في الركبة، حساسية موسمية ومتابعة فيتامين د',blood:'O+',birthYear:'1963',emergencyName:'أحمد — ابن المريضة',emergencyPhone:'',hospitalFiles:[{hospital:'مستشفى الملك فهد',number:'10023456'},{hospital:'مستشفى الحبيب — دبي',number:'20034567'},{hospital:'مركز الرعاية الصحية',number:'30045678'}]})],
  medications,
  appointments:[
   row('visit-today',{name:'مراجعة دورية',date:today,time:'17:00',doctor:'الطبيب المعالج',place:'مستشفى الملك فهد · العيادات الخارجية',notes:'إحضار قائمة الأدوية وأسئلة الزيارة'}),
   row('visit-lab',{name:'موعد مختبر',date:date(2),time:'09:30',doctor:'فريق المختبر',place:'مركز الرعاية الصحية',notes:'التأكد من تعليمات التحضير لدى المركز قبل الموعد'}),
   row('visit-followup',{name:'متابعة نتائج الفحوصات',date:date(7),time:'11:00',doctor:'الطبيب المعالج',place:'مستشفى الحبيب · دبي',notes:'اصطحاب نتائج الفحوصات وملخص الزيارة السابقة'}),
   row('visit-xray-oct',{name:'أشعة سينية للركبة',date:'2026-10-25',time:'10:30',doctor:'قسم الأشعة',place:'مستشفى الملك فهد · جدة',notes:'إحضار طلب الأشعة، الوصول قبل الموعد بـ 20 دقيقة، تأكيد تعليمات التحضير مع القسم'}),
   row('visit-ortho-nov',{name:'مراجعة العظام ونتيجة الأشعة',date:'2026-11-03',time:'16:00',doctor:'عيادة العظام',place:'مستشفى الملك فهد · جدة',notes:'مناقشة ألم الركبة وخيارات المتابعة، إحضار التقرير السابق وقائمة الأدوية'}),
   row('visit-labs-nov',{name:'تحاليل متابعة الغدة وفيتامين د',date:'2026-11-17',time:'08:30',doctor:'المختبر',place:'مركز الرعاية الصحية',notes:'التحاليل وفق طلب الطبيب، سؤال المختبر عن التحضير وتوقيت الأدوية قبل الحضور'}),
   row('visit-thyroid-nov',{name:'مراجعة الغدد والنتائج',date:'2026-11-24',time:'11:15',doctor:'عيادة الغدد',place:'مستشفى الحبيب · دبي',notes:'مراجعة النتائج مع الطبيب، لا تعدل الجرعة بناء على نتيجة منفردة'}),
   row('visit-jan',{name:'متابعة دورية وخطة الأشهر القادمة',date:'2027-01-12',time:'14:00',doctor:'طبيب الأسرة',place:'مركز الرعاية الصحية',notes:'مراجعة المواعيد السابقة وقائمة العلاجات ومستجدات الحركة والنوم'})
  ],
  tasks:[row('task-xray',{name:'تأكيد موعد الأشعة',date:'2026-10-24',assignee:'أحمد',status:'open',notes:'تأكيد موقع القسم وطلب الأشعة ووقت الحضور'}),row('task-pharmacy',{name:'مراجعة الفاصل بين الأدوية مع الصيدلي',date:date(1),assignee:'ريم',status:'open',notes:'إحضار عبوتي يوثيروكس وكالترات والوصفة، وتأكيد الجدول قبل أي تعديل'}),row('task-bag',{name:'تجهيز ملف الزيارة',date:today,assignee:'أحمد',status:'open',notes:'قائمة الأدوية وأرقام الملفات وأسئلة الطبيب'}),row('task-ride',{name:'تنسيق مرافق الموعد',date:today,assignee:'ريم',status:'open',notes:'تأكيد وقت الانطلاق مع الأسرة'}),row('task-result',{name:'إضافة نتائج المختبر',date:date(2),assignee:'أحمد',status:'open',notes:'تسجيل ملخص النتائج بعد استلامها'}),row('task-check',{name:'تحديث بيانات المستشفيات',date:date(-1),assignee:'ريم',status:'done',notes:'تمت مراجعة أرقام الملفات'})],
  reports:[row('report-xray',{name:'طلب أشعة الركبة',date:'2026-10-18',notes:'طلب مسجل في الملف لموعد 25 أكتوبر، التقرير النهائي يضاف بعد الفحص ولا توجد صورة أشعة مرفوعة'}),row('report-thyroid',{name:'متابعة تحاليل الغدة',date:date(-10),notes:'بنود المتابعة: TSH وFree T4 حسب طلب الطبيب، مراجعة النتائج والجرعة في عيادة الغدد، لا توجد قيم مخبرية معتمدة في هذا النموذج'}),row('report-medication',{name:'خطة تنظيم الأدوية',date:date(-7),notes:'يوثيروكس 07:00، الإفطار بعده بـ 30 إلى 60 دقيقة، كالترات 13:00؛ فاصل 6 ساعات موضح لتجربة التنظيم، جدول سارة افتراضي وليس وصفة للمستخدم'}),row('report-lab',{name:'ملخص فحوصات دورية',date:date(-3),notes:'نتائج الفحوصات محفوظة لدى الأسرة لمراجعتها مع الطبيب في الموعد القادم'}),row('report-plan',{name:'خطة متابعة',date:date(-7),notes:'مراجعة دورية، تدوين المستجدات وتجهيز الأسئلة للزيارة المقبلة'})],
  journal:[row('journal-update',{name:'متابعة يومية',date:today,kind:'update',notes:'تم تجهيز قائمة المواعيد وتوزيع المهام بين أفراد الأسرة'}),row('journal-question',{name:'سؤال للموعد القادم',date:today,kind:'question',notes:'متى تكون المراجعة المقبلة، وما المعلومات المطلوبة لمتابعة الخطة؟'}),row('journal-visit',{name:'ملخص الزيارة السابقة',date:date(-7),kind:'visit',notes:'تمت مراجعة خطة المتابعة وتحديد موعد للفحوصات'})],
  doseEvents:[],doseGuards:[],audit:[],safety:[]
 };
 // Only past dates are pre-recorded; today's controls remain available to try.
 for(let offset=-6;offset<0;offset++)for(const med of medications)for(const time of med.times){
  const d=date(offset),instant=localInstant(d,time,timezone),status=offset===-2&&time==='20:00'?'not-given':'given';
  entries.doseEvents.push(row(slotId(med.id,d,time),{name:med.name,medId:med.id,day:d,time,status,reason:status==='not-given'?'لم يتم إعطاء الجرعة':'تم تسجيل الجرعة',scheduledAt:instant.iso,occurredAt:instant.iso,updatedAt:instant.iso,timezone,updatedById:ownerId,warningAcknowledged:false}));
 }
 return {patient,entries};
}

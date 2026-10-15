import {active,day,latin,validDate} from './domain.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function reportSnapshot(patient,entries,allowed){
 const out={patient:{name:patient.name,timezone:patient.timezone,_example:!!patient._example},entries:{}};
 for(const key of ['profile','medications','appointments','reports','journal','doseEvents'])out.entries[key]=allowed.includes(key==='doseEvents'?'medications':key)?structuredClone((entries[key]||[]).filter(x=>!x.deleted)):[];
 if(allowed.includes('medications'))out.safety=entries.safety?{allergyStatus:entries.safety.allergyStatus,allergies:entries.safety.allergies}:null;
 return out;
}
export function buildVisitReport(snapshot,options={}){
 const {patient:p,entries:d}=snapshot,lang=options.lang||'ar',en=lang==='en',both=lang==='both',tr=options.translations||{};
 const label=(ar,eng)=>both?`<span lang="ar" dir="rtl">${esc(ar)}</span><small lang="en" dir="ltr">${esc(eng)}</small>`:esc(en?eng:ar);
 const fields=[];let missing=0;
 const value=(key,source)=>{source=latin(source||'');if(!source)return label('غير مسجل','Not recorded');fields.push({key,source});const english=tr[key]?.trim();if(/[\u0600-\u06ff]/.test(source)&&!english)missing++;return both?`<div dir="auto">${esc(source)}</div>${english?`<div lang="en" dir="ltr">${esc(english)}</div>`:''}`:`<span dir="auto">${esc(en&&english?english:source)}</span>`;};
 const date=s=>{if(!s||!validDate(s))return label('غير مسجل','Not recorded');return esc(new Intl.DateTimeFormat(en?'en-GB':'ar-SA-u-ca-gregory-nu-latn',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z')));};
 const today=day(p.timezone),h=d.profile[0]||{},safe=snapshot.safety||h;
 const from=options.from||'',to=options.to||today;
 if((from&&!validDate(from))||(to&&!validDate(to))||(from&&from>to))throw Error('تحقق من الفترة الزمنية');
 const inPeriod=r=>(!from||(r.date||r.day)>=from)&&(!to||(r.date||r.day)<=to);
 const section=(title,body)=>`<section class="report-section"><h2>${title}</h2>${body}</section>`;
 const table=(heads,rows)=>`<table><thead><tr>${heads.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 const empty=label('لا توجد بيانات مسجلة في هذا القسم','No recorded data in this section');
 const pair=(ar,english,content)=>`<div class="report-pair"><strong>${label(ar,english)}</strong><div>${content}</div></div>`;
 let html=`<article class="visit-document" lang="${en?'en':'ar'}" dir="${en?'ltr':'rtl'}"><div class="report-header"><img src="assets/aafiya-icon.svg" width="38" height="38" alt="عافية"><div><h1>${label('تقرير الزيارة','Visit report')}</h1><p class="report-patient">${value('patient.name',p.name)}</p></div><div>${label(options.kind==='full'?'تقرير مفصل':'ملخص الزيارة',options.kind==='full'?'Detailed report':'Visit summary')}<p>${date(today)}</p></div></div>`;
 if(p._example)html+=`<p class="report-note">${label('مثال تجريبي','Sample patient')}</p>`;
 html+=`<div class="report-identity">${pair('سنة الميلاد','Year of birth',esc(h.birthYear||'—'))}${options.contact?pair('جهة الاتصال','Contact',value('contact.name',h.emergencyName)+' <bdi>'+esc(latin(h.emergencyPhone||''))+'</bdi>'):''}</div>`;
 const hospitals=(h.hospitalFiles||[]).map((r,i)=>({...r,index:i})).filter(r=>options.hospital===''||options.hospital==null||String(r.index)===String(options.hospital));
 if(hospitals.length)html+=section(label('الملفات الطبية','Hospital records'),table([label('المستشفى','Hospital'),label('رقم الملف','Record number')],hospitals.map(r=>[value('hospital.'+r.index,r.hospital),`<bdi>${esc(latin(r.number))}</bdi>`])));
 if(d.profile.length||snapshot.safety){const allergies=safe.allergyStatus==='known'?value('allergies',safe.allergies):safe.allergyStatus==='none'?label('لا توجد حساسية معروفة','No known allergies'):label('الحساسية غير معروفة','Allergy status unknown');html+=section(label('الحساسية والحالات الصحية','Allergies and health conditions'),`<div class="report-allergy">${pair('الحساسية','Allergies',allergies)}</div>${d.profile.length?pair('الحالات الصحية','Health conditions',value('conditions',h.conditions)):''}`);}
 if(options.reason?.trim())html+=section(label('سبب الزيارة','Reason for visit'),value('reason',options.reason));
 if(options.medications!==false&&d.medications.length){const meds=d.medications.filter(m=>active(m,today));html+=section(label('الأدوية الحالية','Current medications'),meds.length?table([label('الدواء / المادة الفعالة','Medication / ingredient'),label('الجرعة والتعليمات','Dose and instructions'),label('الأوقات','Schedule'),label('بداية / نهاية','Start / end')],meds.map(m=>[value('med.'+m.id+'.name',m.name)+(m.ingredient?'<div>'+value('med.'+m.id+'.ingredient',m.ingredient)+'</div>':''),value('med.'+m.id+'.dose',m.dose)+(m.notes?'<div>'+value('med.'+m.id+'.notes',m.notes)+'</div>':''),`<bdi>${esc(m.times.join(' · '))}</bdi>`,date(m.start)+(m.end?'<br>'+date(m.end):'')])):empty);}
 const journal=d.journal.filter(inPeriod),questions=journal.filter(x=>x.kind==='question'),updates=journal.filter(x=>x.kind!=='question');
 const list=(items,prefix)=>items.map(x=>`<div class="report-entry"><h3>${value(prefix+x.id+'.name',x.name)}</h3><small>${date(x.date)}</small><p>${value(prefix+x.id+'.notes',x.notes)}</p></div>`).join('')||empty;
 if(options.journal!==false&&d.journal.length){html+=section(label('أسئلة الزيارة','Questions for the visit'),list(questions,'journal.'));html+=section(label('المستجدات والزيارات','Updates and visits'),list(options.kind==='full'?updates:updates.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3),'journal.'));}
 if(options.kind==='full'){
  html+=`<p class="report-note">${label('الفترة','Period')}: ${from?date(from):label('من بداية السجل','From the first record')} — ${date(to)}</p>`;
  if(options.appointments!==false&&d.appointments.length)html+=section(label('المواعيد','Appointments'),table([label('الموعد','Appointment'),label('التاريخ والوقت','Date and time'),label('الطبيب والمكان','Doctor and location')],d.appointments.filter(inPeriod).map(r=>[value('appointment.'+r.id+'.name',r.name),date(r.date)+' <bdi>'+esc(r.time)+'</bdi>',value('appointment.'+r.id+'.doctor',r.doctor)+'<br>'+value('appointment.'+r.id+'.place',r.place)])));
  if(options.reports!==false&&d.reports.length)html+=section(label('التقارير المسجلة','Recorded reports'),list(d.reports.filter(inPeriod),'report.'));
  if(options.medications!==false){const stopped=d.medications.filter(m=>m.status==='stopped');if(stopped.length)html+=section(label('أدوية مسجلة كمتوقفة','Medications marked as stopped'),table([label('الدواء','Medication'),label('الجرعة المسجلة','Recorded dose')],stopped.map(m=>[value('med.'+m.id+'.name',m.name),value('med.'+m.id+'.dose',m.dose)])));}
  if(options.doses&&d.doseEvents.length)html+=section(label('سجل الجرعات','Dose records'),`<p>${label('غياب التسجيل لا يعني عدم إعطاء الجرعة','An absent record does not mean a dose was not given')}</p>`+table([label('الدواء','Medication'),label('موعد الجرعة','Scheduled dose'),label('الحالة','Status'),label('الملاحظة','Note')],d.doseEvents.filter(inPeriod).sort((a,b)=>(a.day+a.time).localeCompare(b.day+b.time)).map(r=>[value('event.'+r.id+'.name',r.name),date(r.day)+' <bdi>'+esc(r.time)+'</bdi>',label(...({given:['تم الإعطاء','Given'],'not-given':['لم تعط','Not given'],corrected:['تسجيل مصحح','Corrected record']}[r.status]||['غير محدد','Unspecified'])),r.reason?value('event.'+r.id+'.reason',r.reason):'—'])));
 }
 if(lang!=='ar'&&missing)html+=`<p class="report-note">${label('النصوص التي لم تراجع بالإنجليزية معروضة بلغتها الأصلية','Text without a reviewed English translation is shown in its original language')}</p>`;
 html+=`<p class="report-source">${label('أعد عبر عافية من البيانات المسجلة بواسطة المريض أو أسرته','Prepared through Afiyah from information recorded by the patient or family')}<br>${label('تاريخ الإعداد','Prepared')}: ${date(today)} · ${esc(new Intl.DateTimeFormat('en-GB',{timeZone:p.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()))} · ${esc(p.timezone||'Asia/Riyadh')} · ${label('الإصدار','Version')} <bdi>${esc(options.version||'')}</bdi></p></article>`;
 return {html,fields:[...new Map(fields.map(f=>[f.key,f])).values()],missing};
}

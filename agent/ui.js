import {operationId} from './id.js';
import {LiveVoice,liveInstruction,liveTools} from './live.js';
import {createCareTools,careDeclaration} from './tools.js';
import {connection,getLiveToken} from './connection.js';
import {safety} from './safety.js';
const mic='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>';
export function mountCareAgent({data:D,getPatient,navigate,refresh,selectSandbox,Voice=LiveVoice,voiceEnabled=connection.enabled}){
 const host=document.createElement('section');host.id='care-agent';host.hidden=true;host.setAttribute('aria-label','مساعد عافية');
 host.innerHTML=`<div class="agent-top"><div><h2>معك في تفاصيل العناية</h2><div id="agent-person"></div></div><button id="agent-expand" aria-label="تصغير أو توسيع المساعد">↗</button></div><div class="agent-body"><div class="agent-voice"><button id="agent-mic" aria-label="تحدث مع عافية">${mic}</button><div><strong id="voice-state" role="status">تحدث مع عافية</strong><div id="voice-wave" aria-hidden="true">${'<i></i>'.repeat(16)}</div><small id="voice-description">اضغط لبدء المحادثة</small></div></div><p id="agent-notice" role="status"></p><button id="agent-test">فتح ملف اختبار الوكيل</button><div class="voice-controls" id="active-controls" hidden><button id="voice-mute">كتم</button><button id="voice-interrupt">مقاطعة</button><button id="voice-stop">إنهاء</button></div><details id="agent-options"><summary>الكتابة والمرفقات والكاميرا</summary><form id="agent-form"><label class="sr-only" for="agent-input">اكتب للمساعد</label><input id="agent-input" maxlength="2000" placeholder="اكتب طلبك"><button>إرسال</button></form><div class="voice-controls"><button id="agent-attach">إرفاق</button><button id="agent-camera">تشغيل الكاميرا</button></div><div id="agent-input-area"></div><details><summary>المحادثة</summary><div id="agent-transcript"></div></details></details><div id="agent-results" aria-live="polite"></div></div><div class="agent-mini"><button id="mini-mic" aria-label="توسيع المساعد">${mic}</button><span class="mini-state">جاهز</span><button data-mini="voice-mute">كتم</button><button data-mini="voice-interrupt">مقاطعة</button><button data-mini="voice-stop">إنهاء</button></div>`;
 document.body.append(host);const $=s=>host.querySelector(s);
 const emergency=document.createElement('details');emergency.className='emergency-panel';emergency.innerHTML='<summary>مساعدة عاجلة</summary><p>عند طارئ محتمل اطلب المساعدة العاجلة ولا تنتظر الوكيل</p><label>البلد الحالي <select><option value="">اختر البلد</option><option value="SA">السعودية</option><option value="other">بلد آخر</option></select></label><div class="calls"></div>';document.body.append(emergency);
 const country=()=>emergency.querySelector('select').value;
 emergency.querySelector('select').onchange=()=>{emergency.querySelector('.calls').innerHTML=country()==='SA'?'<a href="tel:997">الإسعاف 997</a><a href="tel:937">استشارة صحية 937</a>':'تحقق من رقم الطوارئ في بلدك الحالي';};
 let currentKey='',tab='today',expanded=false,minimized=false,stream=null,reviewDialog=null,cancelReview=null,sessionKey='',transcriptRow=null,transcriptRole='',inputText='';
 const sessionAllowed=()=>D.isAgentSandbox(getPatient());
 function card(text){const el=document.createElement('article');el.className='agent-card';el.textContent=text;$('#agent-results').append(el);return el;}
 function stopCamera(){stream?.getTracks().forEach(t=>t.stop());stream=null;$('#agent-input-area').replaceChildren();}
 function review(value){return new Promise(resolve=>{
  cancelReview?.();const d=document.createElement('dialog');d.className='agent-dialog';reviewDialog=d;
  const h=document.createElement('h3');h.textContent=value.title;const pre=document.createElement('pre');pre.textContent=JSON.stringify({قبل:value.before,بعد:value.after},null,2);d.append(h,pre);
  const finish=ok=>{cancelReview=null;reviewDialog=null;d.remove();resolve(ok)};cancelReview=()=>finish(false);
  for(const [label,ok] of [['اعتماد التعديل',true],['رجوع',false]]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>finish(ok);d.append(b);}
  d.oncancel=e=>{e.preventDefault();finish(false)};document.body.append(d);d.showModal();
 });}
 const run=createCareTools({data:D,getPatient,navigate,refresh,review});
 function display(result){const el=card(result.message||'نتيجة الطلب');if(result.sections){for(const [section,rows]of Object.entries(result.sections)){const group=document.createElement('details'),summary=document.createElement('summary');summary.textContent=({medications:'الأدوية',appointments:'المواعيد',tasks:'المهام',journal:'الملاحظات',reports:'التقارير',doseEvents:'تسجيل الجرعات',profile:'الملف الصحي'})[section]||section;group.append(summary);for(const row of rows){const p=document.createElement('p');p.textContent=[row.name,row.date,row.time,row.dose,row.notes].filter(Boolean).join(' · ');group.append(p)}el.append(group)}}if(result.auditId){const b=document.createElement('button');b.textContent='تراجع';const key=currentKey;b.onclick=async()=>{if(key===currentKey)display(await run({action:'undo',auditId:result.auditId},operationId()))};el.append(b)}}
 function expandInput(mode){$('#agent-options').open=true;expanded=true;minimized=false;position();if(mode==='attachment')attach();else if(mode==='camera'){card('اضغط تشغيل الكاميرا عندما تكون جاهزا');$('#agent-camera').focus();}else $('#agent-input').focus();}
 const labels={idle:'تحدث مع عافية',permission:'بانتظار إذن الميكروفون',connecting:'أتصل بمساعد عافية',listening:'أسمعك الآن',speaking:'عافية يتحدث',muted:'الميكروفون مكتوم',processing:'أنفذ طلبك',failed:'تعذر الاتصال الصوتي'};
 const voice=new Voice({getToken:getLiveToken,tools:[careDeclaration,liveTools.find(t=>t.name==='open_input')],instruction:liveInstruction.replaceAll('care_request','care_action')+'\nاستخدم action وحقول الأداة المنظمة، وليس أوامر نصية ثابتة. الملف الوحيد المسموح سارة الافتراضية. استرجع الأدوية للحصول على المعرف قبل توثيق الجرعة. عند غموض الوقت اسأل. لا تدع أن الكاميرا أو المستند مرئيان لك، لا تصلك الصور في هذا الاختبار.',
 onState:state=>{host.dataset.voice=state;$('#voice-state').textContent=labels[state]||state;$('.mini-state').textContent=labels[state]||state;$('#active-controls').hidden=['idle','failed'].includes(state);$('#voice-description').textContent=state==='speaking'?'الصوت الخارج':state==='listening'?'الصوت الداخل':'اضغط الميكروفون لبدء المحادثة';},
 onLevel:level=>host.style.setProperty('--voice-level',String(Math.max(.08,level))),
 onText:(role,text)=>{
  if(!sessionAllowed()){voice.stop();return;}
  if(role!==transcriptRole||!transcriptRow){transcriptRole=role;transcriptRow=document.createElement('p');transcriptRow.textContent=role==='user'?'أنت: ':'عافية: ';$('#agent-transcript').append(transcriptRow);if(role==='user')inputText='';}
  transcriptRow.append(document.createTextNode(text));
  if(role==='user'){inputText+=text;const risk=safety(inputText,country());if(risk){voice.interrupt();card([risk.message,risk.question,risk.advice].filter(Boolean).join(' · '));if(risk.kind==='urgent')emergency.open=true;}}
 },
 onTool:async(name,args,id)=>{
  if(!sessionAllowed())return {ok:false,message:'الملف غير متاح للصوت'};
  if(name==='open_input'){if(!['text','attachment','camera'].includes(args.mode))return {ok:false};expandInput(args.mode);return {ok:true,message:'فتحت الخيار للمستخدم، لم أشغل الكاميرا أو أرفع ملفا'};}
  if(name!=='care_action')return {ok:false,message:'أداة غير مسموحة'};
  const key=currentKey;const result=await run(args,sessionKey+':'+id);if(currentKey===key)display(result);return result;
 }});
 function position(){const anchor=document.getElementById('agent-anchor');const floating=minimized||(!expanded&&(tab!=='today'||!anchor||anchor.getBoundingClientRect().bottom<70));host.classList.toggle('is-floating',floating);host.classList.toggle('is-expanded',expanded);}
 async function start(){
  if(!sessionAllowed()){card('افتح ملف اختبار الوكيل لتجربة الحديث');return;}
  if(voice.active){voice.interrupt();return;}
  if(!voiceEnabled){$('#agent-notice').textContent='تفعيل المحادثة الصوتية بانتظار اعتماد ربط الاختبار';return;}
  if(!await review({title:'بدء محادثة اختبار',after:'سيعالج Google الصوت ويقرأ ملف سارة الافتراضي بصوت مسموع، استخدم معلومات افتراضية فقط'}))return;
  if(!sessionAllowed())return;sessionKey=operationId();
  try{await voice.start()}catch(e){$('#agent-notice').textContent=e.message;}
 }
 $('#agent-mic').onclick=start;$('#voice-mute').onclick=()=>voice.mute();$('#voice-interrupt').onclick=()=>voice.interrupt();$('#voice-stop').onclick=()=>{voice.stop();stopCamera();cancelReview?.()};
 for(const b of host.querySelectorAll('[data-mini]'))b.onclick=()=>$('#'+b.dataset.mini).click();
 $('#agent-expand').onclick=()=>{expanded=host.classList.contains('is-floating');minimized=!expanded;position()};$('#mini-mic').onclick=()=>{expanded=true;minimized=false;position()};
 $('#agent-test').onclick=async()=>{voice.stop();await selectSandbox();document.getElementById('agent-anchor')?.scrollIntoView({block:'start'});};
 $('#agent-form').onsubmit=e=>{e.preventDefault();if(!sessionAllowed()){card('اختر ملف اختبار الوكيل');return;}const text=$('#agent-input').value.trim();if(!text)return;const risk=safety(text,country());if(risk){card([risk.message,risk.question,risk.advice].filter(Boolean).join(' · '));if(risk.kind==='urgent')emergency.open=true;return;}try{voice.sendText(text);$('#agent-input').value=''}catch(err){card(err.message)}};
 function attach(){stopCamera();const area=$('#agent-input-area');const p=document.createElement('p');p.textContent='اختر ملف اختبار فقط، المعاينة لا ترسل المستندات إلى المساعد';const input=document.createElement('input');input.type='file';input.accept='.pdf,.png';input.setAttribute('aria-label','إرفاق ملف اختبار');area.append(p,input);
  input.onchange=async()=>{const file=input.files[0],key=currentKey;if(!file||file.size>2*1024*1024)return;const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');const manifests=await fetch(new URL('../preview/fixtures/manifest.json',import.meta.url)).then(r=>r.json());if(key!==currentKey)return;const fixture=manifests[hash];card(fixture?'تم التعرف على ملف الاختبار محليا، استخراج المستند في الربط المدمج لم يفعل بعد':'هذا الملف غير معتمد للاختبار، لم يرفع أو يرسل');};
 }
 $('#agent-attach').onclick=()=>{if(sessionAllowed())expandInput('attachment');else card('اختر ملف اختبار الوكيل')};
 $('#agent-camera').onclick=async()=>{if(!sessionAllowed())return;stopCamera();const key=currentKey;const video=document.createElement('video');video.autoplay=true;video.playsInline=true;video.muted=true;video.style.width='100%';const close=document.createElement('button');close.textContent='إغلاق الكاميرا';close.onclick=stopCamera;$('#agent-input-area').append(video,close);try{const next=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});if(key!==currentKey||!video.isConnected){next.getTracks().forEach(t=>t.stop());return;}stream=next;video.srcObject=stream;card('الكاميرا للمعاينة المحلية فقط، الصورة لا ترسل للمساعد')}catch{stopCamera();card('تعذر تشغيل الكاميرا')}};
 window.addEventListener('scroll',position,{passive:true});window.addEventListener('pagehide',()=>{voice.stop();stopCamera()});
 return {park(){if(host.isConnected)document.body.append(host)},update({patient,tab:nextTab,logged,loading}){
  tab=nextTab;const key=logged?D.user()?.uid+':'+(patient?.id||''):'';
  if(key!==currentKey){voice.stop();stopCamera();cancelReview?.();$('#agent-results').replaceChildren();$('#agent-transcript').replaceChildren();transcriptRow=null;transcriptRole='';expanded=false;minimized=false;currentKey=key;}
  host.hidden=!logged;const anchor=document.getElementById('agent-anchor');if(anchor)anchor.append(host);
  $('#agent-person').textContent=patient?patient.name+' · '+(D.isAgentSandbox(patient)?'ملف اختبار الوكيل':'الملف المحدد'): 'اختر ملف المريض';
  $('#agent-test').hidden=D.isAgentSandbox(patient);$('#agent-notice').textContent=D.isAgentSandbox(patient)?'بيانات افتراضية، وتسجيلات الاختبار مؤقتة':'جرب الحديث بملف افتراضي معزول عن سجلاتك';
  $('#agent-mic').disabled=!!loading;position();
 }};
}

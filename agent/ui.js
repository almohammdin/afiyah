import {operationId} from './id.js';
import {LiveVoice,liveInstruction,liveTools} from './live.js?v=20261020-timers';
import {createCareTools,careDeclaration} from './tools.js';
import {connection,getLiveToken,checkVoiceConnection} from './connection.js?v=20261018-chat';
import {safety} from './safety.js?v=20261020-review';
const mic='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>';
const icon=path=>`<svg class="agent-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const minimizeIcon=icon('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 15h6"/>');
const expandIcon=icon('<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>');
const controlIcons={mute:icon('<path d="m3 3 18 18M9 9v3a3 3 0 0 0 5 2M9 5a3 3 0 0 1 6 0v4M5 10v2a7 7 0 0 0 12 5M19 10v2M12 19v3M8 22h8"/>'),interrupt:icon('<path d="M9 5v14M15 5v14"/>'),stop:icon('<rect x="6" y="6" width="12" height="12" rx="2"/>')};
const chevron=icon('<path d="m6 9 6 6 6-6"/>');
export function mountCareAgent({data:D,getPatient,navigate,refresh,selectSandbox,Voice=LiveVoice,voiceEnabled=connection.enabled}){
 const host=document.createElement('section');host.id='care-agent';host.hidden=true;host.setAttribute('aria-label','مساعد عافية');
 host.innerHTML=`<div class="agent-top"><div><h2>معك في تفاصيل العناية</h2><div id="agent-person"></div></div><button id="agent-expand" aria-label="تصغير المساعد" title="تصغير المساعد مع استمرار المحادثة">${minimizeIcon}</button></div><div class="agent-body"><div class="agent-voice"><button id="agent-mic" aria-label="تحدث مع عافية">${mic}</button><div><strong id="voice-state" role="status">تحدث مع عافية</strong><div id="voice-wave" aria-hidden="true">${'<i></i>'.repeat(16)}</div><small id="voice-description">اضغط لبدء المحادثة</small></div></div><p id="agent-notice" role="status"></p><button id="agent-test">جرب عافية</button><div class="voice-controls" id="active-controls" hidden><button id="voice-mute">${controlIcons.mute}<span>كتم</span></button><button id="voice-interrupt">${controlIcons.interrupt}<span>مقاطعة</span></button><button id="voice-stop">${controlIcons.stop}<span>إنهاء</span></button></div><details id="agent-options"><summary><span>الكتابة والمرفقات والكاميرا</span>${chevron}</summary><form id="agent-form"><label class="sr-only" for="agent-input">اكتب للمساعد</label><input id="agent-input" maxlength="2000" placeholder="اكتب طلبك"><button>إرسال</button></form><div class="voice-controls"><button id="agent-attach">إرفاق</button><button id="agent-camera">تشغيل الكاميرا</button><button id="agent-check">فحص الاتصال</button></div><details class="agent-processing-note"><summary>عن المحادثة</summary><p>تعالج Google الصوت والنص في ملف سارة التجريبي، ولا ترسل ملفاتك الأخرى</p></details><div id="agent-input-area"></div><div id="agent-transcript" role="log" aria-label="المحادثة" aria-live="polite"></div></details><div id="agent-results" aria-live="polite"></div></div><div class="agent-mini"><button id="mini-mic" aria-label="توسيع المساعد">${mic}</button><span class="mini-state">جاهز</span><button hidden data-mini="voice-mute" aria-label="كتم" title="كتم">${controlIcons.mute}</button><button hidden data-mini="voice-interrupt" aria-label="مقاطعة" title="مقاطعة">${controlIcons.interrupt}</button><button hidden data-mini="voice-stop" aria-label="إنهاء" title="إنهاء">${controlIcons.stop}</button></div>`;
 document.body.append(host);const $=s=>host.querySelector(s);
 const emergency=document.createElement('details');emergency.className='emergency-panel';emergency.hidden=true;emergency.innerHTML='<summary>مساعدة عاجلة</summary><p>عند طارئ محتمل اطلب المساعدة العاجلة ولا تنتظر الوكيل</p><label>البلد الحالي <select><option value="">اختر البلد</option><option value="SA">السعودية</option><option value="other">بلد آخر</option></select></label><div class="calls"></div>';emergency.querySelector('summary').insertAdjacentHTML('beforeend',chevron);$('#agent-results').after(emergency);
 const country=()=>emergency.querySelector('select').value;
 emergency.querySelector('select').onchange=()=>{emergency.querySelector('.calls').innerHTML=country()==='SA'?'<a href="tel:997">الإسعاف 997</a><a href="tel:937">استشارة صحية 937</a>':'تحقق من رقم الطوارئ في بلدك الحالي';};
 let currentKey='',tab='today',expanded=true,minimized=false,stream=null,reviewDialog=null,cancelReview=null,sessionKey='',transcriptRow=null,transcriptRole='',inputText='';
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
 const labels={idle:'تحدث مع عافية',permission:'بانتظار إذن الميكروفون',connecting:'أتصل بمساعد عافية',listening:'أسمعك الآن',speaking:'عافية يتحدث',muted:'الميكروفون مكتوم',processing:'أنفذ طلبك',failed:'تعذر الاتصال',writing:'جاهز لرسالتك',ended:'انتهت الجلسة'};
 const voice=new Voice({getToken:getLiveToken,tools:[careDeclaration,liveTools.find(t=>t.name==='open_input')],instruction:liveInstruction.replaceAll('care_request','care_action')+'\nاستخدم action وحقول الأداة المنظمة، وليس أوامر نصية ثابتة. الملف الوحيد المسموح سارة الافتراضية. استرجع الأدوية للحصول على المعرف قبل توثيق الجرعة. عند غموض الوقت اسأل. لا تدع أن الكاميرا أو المستند مرئيان لك، لا تصلك الصور في هذا الاختبار.',
 onState:state=>{
  host.dataset.voice=state;$('#voice-state').textContent=labels[state]||state;$('.mini-state').textContent=labels[state]||state;
  const pending=['permission','connecting'].includes(state),ready=['listening','speaking','muted','processing','writing'].includes(state);
  $('#active-controls').hidden=!ready;
  for(const button of host.querySelectorAll('[data-mini]'))button.hidden=!ready;
  $('#agent-mic').disabled=pending;
  $('#agent-mic').setAttribute('aria-pressed',String(ready));
  $('#agent-mic').setAttribute('aria-label',pending?labels[state]:ready?'إنهاء المحادثة':'تحدث مع عافية');
  const descriptions={idle:'اضغط الميكروفون وتحدث',permission:'اسمح باستخدام الميكروفون من نافذة المتصفح',connecting:'لحظات وأكون معك',listening:'تفضل، أنا أسمعك',speaking:'يمكنك مقاطعتي بالكلام أو بزر مقاطعة',muted:'اضغط كتم مرة أخرى لإعادة الميكروفون',processing:'أنتظر نتيجة تنفيذ طلبك',failed:'اضغط الميكروفون للمحاولة من جديد',writing:'اكتب طلبك في المحادثة',ended:'اضغط الميكروفون لبدء محادثة جديدة'};
  $('#voice-description').textContent=descriptions[state]||'';
  if(state!=='listening')host.style.setProperty('--voice-level','0');
  queueMicrotask(()=>{if(host.isConnected)position()});
 },

 onLevel:level=>host.style.setProperty('--voice-level',String(Math.max(.08,level))),
 onText:(role,text)=>{
  if(!sessionAllowed()){voice.stop();return;}
  if(role!==transcriptRole||!transcriptRow){transcriptRole=role;transcriptRow=document.createElement('p');transcriptRow.textContent=role==='user'?'أنت: ':'عافية: ';$('#agent-transcript').append(transcriptRow);if(role==='user')inputText='';}
  transcriptRow.append(document.createTextNode(text));
  if(role==='user'){inputText+=text;const risk=safety(inputText,country());if(risk){if(risk.kind==='urgent')voice.interrupt();card([risk.message,risk.question,risk.advice].filter(Boolean).join(' · '));if(risk.kind==='urgent'){emergency.hidden=false;emergency.open=true;expanded=true;minimized=false;position();}}}
 },
 onTool:async(name,args,id)=>{
  if(!sessionAllowed())return {ok:false,message:'الملف غير متاح للصوت'};
  if(name==='open_input'){if(!['text','attachment','camera'].includes(args.mode))return {ok:false};expandInput(args.mode);return {ok:true,message:'فتحت الخيار للمستخدم، لم أشغل الكاميرا أو أرفع ملفا'};}
  if(name!=='care_action')return {ok:false,message:'أداة غير مسموحة'};
  const key=currentKey;const result=await run(args,sessionKey+':'+id);if(currentKey===key)display(result);return result;
 }});
 // Presentation changes only through explicit user controls.
 function position(){
  const floating=minimized&&!expanded;
  host.classList.toggle('is-floating',floating);
  host.classList.toggle('is-expanded',!floating);
  const label=floating?'توسيع المساعد':'تصغير المساعد لمشاهدة الصفحة';
  if($('#agent-expand').getAttribute('aria-label')!==label){
   $('#agent-expand').innerHTML=floating?expandIcon:minimizeIcon;
   $('#agent-expand').setAttribute('aria-label',label);
   $('#agent-expand').title=label;
  }
 }

 let starting=false;
 async function start(textOnly=false){
  if(starting)return false;
  starting=true;
  try{return await startSession(textOnly)}finally{starting=false}
 }
 async function startSession(textOnly=false){
  if(['permission','connecting'].includes(voice.state))return false;
  let prepared;
  try{
   if(!textOnly&&!voice.active&&voiceEnabled)prepared=voice.prepareAudio?.();
   if(!D.user()||(!textOnly&&!sessionAllowed())){await selectSandbox();}
  }catch{prepared?.dispose();$('#agent-notice').textContent='تعذر تجهيز الميكروفون، أعد المحاولة';return false;}
  if(!sessionAllowed()){prepared?.dispose();$('#agent-notice').textContent='اختر ملف سارة لبدء المحادثة';return false;}
  if(voice.active&&(!voice.textOnly||textOnly)){if(textOnly)return true;voice.stop();return false;}if(voice.active)voice.stop();
  if(!voiceEnabled){$('#agent-notice').textContent='تفعيل المحادثة الصوتية بانتظار اعتماد ربط الاختبار';return;}
  if(!sessionAllowed())return;$('#agent-notice').textContent='';sessionKey=operationId();
  try{await voice.start({textOnly,prepared});return true}catch(e){$('#agent-notice').textContent=({NotFoundError:'لم يعثر المتصفح على ميكروفون، وصل ميكروفونا ثم أعد المحاولة',NotAllowedError:'اسمح باستخدام الميكروفون من إعدادات المتصفح ثم أعد المحاولة',NotReadableError:'تعذر تشغيل الميكروفون، أغلق التطبيقات التي تستخدمه ثم أعد المحاولة',TimeoutError:'لم يكتمل إذن الميكروفون، تحقق من إعدادات المتصفح وحاول مجددا',SecurityError:'المتصفح يمنع الميكروفون، راجع أذونات الموقع',OverconstrainedError:'إعدادات الميكروفون غير متاحة على هذا الجهاز',AbortError:'توقف تشغيل الميكروفون، حاول مرة أخرى'})[e.name]||e.message;}
 }
 $('#agent-mic').onclick=()=>start();$('#voice-mute').onclick=()=>voice.mute();$('#voice-interrupt').onclick=()=>voice.interrupt();$('#voice-stop').onclick=()=>{voice.stop();stopCamera();cancelReview?.()};
 for(const b of host.querySelectorAll('[data-mini]'))b.onclick=()=>$('#'+b.dataset.mini).click();
 $('#agent-expand').onclick=()=>{expanded=host.classList.contains('is-floating');minimized=!expanded;position()};$('#mini-mic').onclick=()=>{expanded=true;minimized=false;position()};
 $('#agent-check').onclick=async()=>{const button=$('#agent-check');button.disabled=true;$('#agent-notice').textContent='أفحص الاتصال';try{await checkVoiceConnection();$('#agent-notice').textContent='نجح التحقق وإصدار رمز الاتصال، جرب الميكروفون الآن'}catch(error){$('#agent-notice').textContent=error.message}finally{button.disabled=false}};
 $('#agent-test').onclick=async()=>{voice.stop();await selectSandbox();document.getElementById('agent-anchor')?.scrollIntoView({block:'start'});};
 $('#agent-form').onsubmit=async e=>{e.preventDefault();const text=$('#agent-input').value.trim();if(!text)return;const risk=safety(text,country());if(risk){card([risk.message,risk.question,risk.advice].filter(Boolean).join(' · '));if(risk.kind==='urgent'){emergency.hidden=false;emergency.open=true;expanded=true;minimized=false;position();return;}}const button=$('#agent-form button');button.disabled=true;try{if(!voice.active&&!await start(true))return;if(!sessionAllowed())return;voice.sendText(text);const row=document.createElement('p');row.textContent='أنت: '+text;$('#agent-transcript').append(row);transcriptRow=null;transcriptRole='';$('#agent-input').value=''}catch(err){card(err.message)}finally{button.disabled=false}};

 function attach(){stopCamera();const area=$('#agent-input-area');const p=document.createElement('p');p.textContent='اختر ملف اختبار فقط، المعاينة لا ترسل المستندات إلى المساعد';const input=document.createElement('input');input.type='file';input.accept='.pdf,.png';input.setAttribute('aria-label','إرفاق ملف اختبار');area.append(p,input);
  input.onchange=async()=>{try{const file=input.files[0],key=currentKey;if(!file)return;if(file.size>2*1024*1024){card('حجم الملف يتجاوز 2 MB');return;}const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');const manifests=await fetch(new URL('../preview/fixtures/manifest.json',import.meta.url)).then(r=>r.json());if(key!==currentKey)return;const fixture=manifests[hash];card(fixture?'تم التعرف على ملف الاختبار محليا، استخراج المستند في الربط المدمج لم يفعل بعد':'هذا الملف غير معتمد للاختبار، لم يرفع أو يرسل');}catch{card('تعذر فتح المرفق، أعد المحاولة');}};
 }
 $('#agent-attach').onclick=()=>{if(sessionAllowed())expandInput('attachment');else card('اضغط جرب عافية أولا')};
 $('#agent-camera').onclick=async()=>{if(!sessionAllowed())return;stopCamera();const key=currentKey;const video=document.createElement('video');video.autoplay=true;video.playsInline=true;video.muted=true;video.style.width='100%';const close=document.createElement('button');close.textContent='إغلاق الكاميرا';close.onclick=stopCamera;$('#agent-input-area').append(video,close);try{const next=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});if(key!==currentKey||!video.isConnected){next.getTracks().forEach(t=>t.stop());return;}stream=next;video.srcObject=stream;card('الكاميرا للمعاينة المحلية فقط، الصورة لا ترسل للمساعد')}catch{stopCamera();card('تعذر تشغيل الكاميرا')}};
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&expanded){expanded=false;minimized=true;position();$('#agent-expand').focus();}});
 
 window.addEventListener('pagehide',()=>{voice.stop();stopCamera()});
 return {park(){},update({patient,tab:nextTab,logged,loading}){
  tab=nextTab;const key=logged?D.user()?.uid+':'+(patient?.id||''):'';
  if(key!==currentKey){$('#agent-notice').textContent='';emergency.hidden=true;emergency.open=false;voice.stop();stopCamera();cancelReview?.();$('#agent-results').replaceChildren();$('#agent-transcript').replaceChildren();transcriptRow=null;transcriptRole='';currentKey=key;}
  host.hidden=false;
  $('#agent-person').textContent=patient?patient.name+' · '+(patient._example?'مثال تجريبي':'الملف المحدد'): '';
  $('#agent-test').hidden=!patient||D.isAgentSandbox(patient);
  $('#agent-mic').disabled=!!loading||['permission','connecting'].includes(voice.state);position();
 }};
}

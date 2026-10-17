import { api, execute, selectActor, user, requestId } from "./adapter.js";
import { LiveVoice } from "./live.js";
import { VoiceSession } from "./voice.js";
import { plan } from "./policy.js";
import { day } from "../domain.js";
const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const host = document.createElement("section");
host.id = "care-agent";
host.setAttribute("aria-label", "مساعد عافية");
host.innerHTML = `<div class="agent-top"><div><span class="agent-eyebrow">معاينة ببيانات افتراضية فقط</span><h2>معك في تفاصيل العناية</h2><div id="agent-person"></div></div><button id="agent-expand" aria-label="تصغير أو توسيع المساعد">↗</button></div><div class="agent-body"><div class="agent-voice"><button id="agent-mic" aria-label="تحدث مع عافية"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg></button><div><strong id="voice-state" role="status">تحدث مع عافية</strong><div id="voice-wave" aria-hidden="true">${"<i></i>".repeat(16)}</div><small id="voice-description">لا يبدأ الاستماع إلا باختيارك</small></div></div><details id="agent-options"><summary>الكتابة والمرفقات وخيارات المحادثة</summary><div class="voice-controls"><button id="voice-mute">كتم</button><button id="voice-interrupt">مقاطعة</button><button id="voice-stop">إنهاء الصوت</button><button id="voice-read">قراءة آخر رد</button></div><p class="agent-limit">التنفيذ النصي يعمل على سجلات الاختبار · الميكروفون محلي، فهم الصوت وصوت المزوّد ينتظران الاعتماد · قد يتوقف الصوت عند قفل الهاتف</p><div id="agent-results" aria-live="polite"></div><form id="agent-form"><label for="agent-input" class="sr-only">اكتب لمساعد عافية</label><input id="agent-input" maxlength="4000" autocomplete="off" placeholder="مثلاً: ملخص اليوم، أضف ملاحظة شعرت بتحسن"><button>إرسال</button><button type="button" id="agent-camera" hidden>تشغيل الكاميرا</button><button type="button" id="agent-attach" aria-label="إرفاق مستند اختبار">إرفاق</button></form><div class="agent-shortcuts"><button data-command="ملخص اليوم">ملخص اليوم</button><button data-command="أدويتي">الأدوية</button><button data-command="تقاريري">التقارير</button><button data-command="جهز ملخص الزيارة">ملخص الزيارة</button><button id="agent-new-appointment">موعد</button><button id="agent-new-task">مهمة</button><button id="agent-notifications">التنبيهات</button></div><details class="agent-lab"><summary>حسابات التجربة والصوت</summary><label>المستخدم الحالي <select id="agent-actor"><option value="sarah">سارة — مريضة</option><option value="ahmed">أحمد — مرافق لسارة وصاحب ملف عمر</option><option value="reader">ريم — اطلاع فقط</option></select></label><label>أصوات الجهاز المحلية <select id="device-voice"></select></label><button id="voice-sample">اختبار نطق افتراضي</button><p>هذه أصوات الجهاز وليست عينة صوت سعودي معتمدة للمزوّد</p></details></details></div>`;
const mini = document.createElement("div");
mini.className = "agent-mini";
mini.innerHTML =
  '<span class="mini-state">جاهز</span><button data-mini="voice-mute">كتم</button><button data-mini="voice-interrupt">مقاطعة</button><button data-mini="voice-stop">إنهاء</button>';
host.append(mini);
mini
  .querySelectorAll("button")
  .forEach(
    (b) => (b.onclick = () => host.querySelector("#" + b.dataset.mini).click()),
  );
document.body.append(host);
const emergency = document.createElement("details");
emergency.className = "emergency-panel";
emergency.innerHTML =
  '<summary>مساعدة عاجلة</summary><p>عند طارئ محتمل اطلب المساعدة العاجلة ولا تنتظر الوكيل</p><label>أين أنت الآن؟ <select id="current-country"><option value="">اختر البلد الحالي</option><option value="SA">السعودية</option><option value="other">بلد آخر</option></select></label><div id="emergency-links">تحقق من رقم الطوارئ المحلي عند السفر</div><small>الاتصال باختيارك، لا نرسل بلاغاً ولا نضمن وصول التنبيهات</small>';
document.body.append(emergency);
const $ = (s) => host.querySelector(s);
let patient = null,
  entries = {},
  pending = null,
  contextVersion = 0,
  lastReply = "",
  lastRequest = null,
  manualFloat = false,
  forcedExpand = false,
  loading = false,
  currentTab = "today";
const stateLabels = {
  connecting: "أتصل بمساعد عافية",
  idle: "تحدث مع عافية",
  permission: "بانتظار إذن الميكروفون",
  listening: "أسمعك الآن",
  processing: "جار تنفيذ الطلب",
  speaking: "المساعد يتحدث",
  muted: "الميكروفون مكتوم",
  failed: "تعذر الصوت، يمكنك الكتابة",
};
const voiceCallbacks = {
  onState: (s) => {
    $("#voice-state").textContent = stateLabels[s];
    host.querySelector(".mini-state").textContent = stateLabels[s];
    host.dataset.voice = s;
    $("#voice-description").textContent =
      s === "speaking"
        ? "صوت مساعد عافية"
        : s === "listening"
          ? "موجة الصوت الداخل"
          : "يمكنك متابعة الكتابة";
  },
  onLevel: (l) =>
    host.style.setProperty("--voice-level", String(Math.max(0.08, l))),
};
const localVoice = new VoiceSession(voiceCallbacks);
let voice = localVoice;
const live = new LiveVoice({...voiceCallbacks,
 getToken: undefined,
 onText: (role,text)=>{ $("#voice-description").textContent=text; },
 onTool: async(name,args)=>{
  if(name==='open_input'){
   $("#agent-options").open=true;
   forcedExpand=true;manualFloat=false;floating();
   if(args.mode==='attachment')$("#agent-attach").click();
   else if(args.mode==='camera'){card('اضغط تشغيل الكاميرا عندما تكون جاهزا، لا تصور مستندات صحية حقيقية في المعاينة');$("#agent-camera").hidden=false;}
   else $("#agent-input").focus();
   return {ok:true,message:'فتحت خيارات الإدخال، لم يتم رفع أو حفظ ملف'};
  }
  if(name==='care_request')return await send(String(args.text||''))||{ok:false,message:'لم يتأكد التنفيذ'};
  return {ok:false,message:'أداة غير مسموحة'};
 }
});
function card(text, cls = "") {
  $("#agent-options").open=true;
  const d = document.createElement("article");
  d.className = "agent-card " + cls;
  d.textContent = text;
  $("#agent-results").append(d);
  $("#agent-results").scrollTop = 99999;
  lastReply = text;
  return d;
}
function button(parent, text, fn) {
  const b = document.createElement("button");
  b.textContent = text;
  b.onclick = fn;
  parent.append(b);
  return b;
}
function currentCountry() {
  return document.querySelector("#current-country").value;
}
document.querySelector("#current-country").onchange = () => {
  document.querySelector("#emergency-links").innerHTML =
    currentCountry() === "SA"
      ? '<a href="tel:997">الإسعاف 997</a><a href="tel:937">استشارة صحية 937 — على مدار الساعة</a>'
      : "تحقق من رقم الطوارئ المحلي في البلد الذي أنت فيه";
};
function floating() {
  const anchor = document.getElementById("agent-anchor");
  const should =
    manualFloat ||
    (!forcedExpand &&
      (currentTab !== "today" ||
        !anchor ||
        anchor.getBoundingClientRect().bottom < 80));
  host.classList.toggle("is-floating", should);
  host.classList.toggle("is-expanded", forcedExpand);
}
addEventListener("scroll", floating, { passive: true });
$("#agent-expand").onclick = () => {
  if (host.classList.contains("is-floating")) {
    forcedExpand = true;
    manualFloat = false;
  } else {
    forcedExpand = false;
    manualFloat = true;
  }
  floating();
};
async function context(ev) {
  currentTab = ev.detail.tab;
  const p = ev.detail.patient;
  if (p?.id !== patient?.id) {
    contextVersion++;
    voice.stop();
    pending = null;
    lastReply = "";
    lastRequest = null;
    $("#agent-results").replaceChildren();
    patient = p;
    entries = {};
    if (p) {
      const version = contextVersion;
      try {
        const snap = await api("snapshot?patient=" + p.id);
        if (version === contextVersion) entries = snap.entries;
      } catch (e) {
        card(e.message);
      }
    }
  }
  patient = p;
  $("#agent-person").textContent = p
    ? `${p.name} · ملف تجريبي · ${user()?.displayName || ""}${p.grant?.relation ? " · " + p.grant.relation : ""} · ${p.timezone}`
    : "اختر ملف المريض";
  const anchor = document.getElementById("agent-anchor");
  if (anchor && !anchor.contains(host)) anchor.append(host);
  else if (!anchor && host.parentElement !== document.body)
    document.body.append(host);
  floating();
}
document.addEventListener("afiyah:context", context);
document.dispatchEvent(new Event("afiyah:context-request"));
document.addEventListener("afiyah:actor", () => {
  contextVersion++;
  patient = null;
  pending = null;
  voice.stop();
  $("#agent-results").replaceChildren();
  document.dispatchEvent(new Event("afiyah:context-request"));
});
$("#agent-actor").onchange = async (ev) => {
  voice.stop();
  await selectActor(ev.target.value);
};
async function perform(tool, args = {}, reuse = null) {
  if (!patient || loading) return {ok:false,message:"حدد المريض وانتظر اكتمال العملية الحالية"};
  const pid = patient.id,
    version = contextVersion;
  const request = reuse || {
    patientId: pid,
    tool,
    args,
    operationId: requestId(),
  };
  lastRequest = request;
  loading = true;
  voice.set("processing");
  try {
    const result = await api("tool", request);
    if (version !== contextVersion) return {ok:false,message:"تغير الملف، تجاهل النتيجة السابقة"};
    show(result);
    lastRequest = null;
    if (result.kind === "navigate")
      document.dispatchEvent(
        new CustomEvent("afiyah:navigate", { detail: result.section }),
      );
    if (["saved", "duplicate"].includes(result.kind)) {
      const snap = await api("snapshot?patient=" + pid);
      if (version !== contextVersion) return {ok:false,message:"تغير الملف، تجاهل النتيجة السابقة"};
      entries = snap.entries;
      document.dispatchEvent(new Event("afiyah:refresh"));
    }
    return {ok:true,...result};
  } catch (e) {
    if (version !== contextVersion) return {ok:false,message:"تغير الملف، تجاهل النتيجة السابقة"};
    const rejected = e.status >= 400 && e.status < 500;
    const d = card(
      (rejected ? "لم تُحفظ العملية: " : "لم أتلق تأكيد الحفظ: ") + e.message,
      "error",
    );
    if (!rejected)
      button(d, "إعادة المحاولة بنفس الطلب", () =>
        perform(tool, args, request),
      );
    return {ok:false,message:e.message};
  } finally {
    loading = false;
    if (voice.state === "processing") voice.interrupt();
  }
}
function show(r) {
  const d = card(r.message || "نتيجة المتابعة");
  if (r.kind === "records") {
    if (r.slots) {
      for (const slot of r.slots) {
        const line = document.createElement("p");
        line.textContent = `${slot.name} · ${slot.time} · ${slot.label}`;
        d.append(line);
        if (!slot.event || slot.event.status === "corrected")
          button(line, "تسجيل التناول", () =>
            perform("dose", {
              medId: slot.medId,
              date: slot.date,
              time: slot.time,
              status: "given",
            }),
          );
        else
          button(line, "تصحيح", () => {
            const reason = prompt("ما سبب تصحيح التسجيل؟");
            if (reason) perform("correctDose", { id: slot.event.id, reason });
          });
      }
    }
    for (const [section, rows] of Object.entries(r.sections)) {
      const group = document.createElement("details");
      group.innerHTML = `<summary>${esc({ medications: "الأدوية", appointments: "المواعيد", tasks: "المهام", reports: "التقارير", journal: "الملاحظات", profile: "الملف الصحي" }[section])} (${rows.length})</summary>`;
      rows.forEach((row) => {
        const p = document.createElement("p");
        p.textContent = [row.name, row.dose, row.date, row.time, row.notes]
          .filter(Boolean)
          .join(" · ");
        group.append(p);
        if (["appointments", "tasks", "journal"].includes(section))
          button(p, "تعديل", () => editForm(section, row));
      });
      d.append(group);
    }
    button(d, "فتح ملخص الزيارة للطباعة", () =>
      document.dispatchEvent(
        new CustomEvent("afiyah:navigate", { detail: "summary" }),
      ),
    );
  }
  if (r.kind === "review") {
    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify(r.proposal.args, null, 2);
    d.append(pre);
    const pid = patient.id;
    button(d, "اعتماد التعديل", async () => {
      if (patient.id === pid) await perform("approve", { token: r.token });
    });
    button(d, "إلغاء", () => d.remove());
  }
  if (r.kind === "draft") {
    const a = r.attachment;
    const p = document.createElement("p");
    p.textContent = `${a.name} · المصدر: ${a.source} · الصفحة ${a.page} · ${a.unclear.join("، ")}`;
    d.append(p);
    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify(a.fields, null, 2);
    d.append(pre);
    for (const page of a.pages || []) {
      const source = document.createElement("details");
      source.innerHTML = `<summary>المصدر · الصفحة ${page.page}</summary>`;
      const text = document.createElement("p");
      text.textContent = page.text;
      source.append(text);
      d.append(source);
    }
    if (a.sha) {
      const link = document.createElement("a");
      link.href = "/api/attachment?patient=" + patient.id + "&id=" + a.id;
      link.textContent = "تنزيل المصدر الخاص";
      d.append(link);
    }
    button(d, "حفظ كملاحظة مصدر بعد المراجعة", () =>
      perform("save", {
        section: "journal",
        value: {
          name: a.name,
          date: day(patient.timezone),
          kind: "update",
          notes: `مصدر تجريبي ${a.id}، الصفحة ${a.page}، حقول غير واضحة: ${a.unclear.join("، ")}`,
        },
      }),
    );
  }
  if (r.auditId) {
    const pid = patient.id;
    button(d, "تراجع موثق", () => {
      if (patient.id === pid) perform("undo", { auditId: r.auditId });
    });
  }
}
async function send(text) {
  if (!patient || loading) return {ok:false,message:"حدد المريض وانتظر اكتمال العملية الحالية"};
  card(text, "user");
  const version = contextVersion;
  const { safety } = await api("safety", { text, country: currentCountry() });
  if (version !== contextVersion) return {ok:false,message:"تغير الملف، تجاهل النتيجة السابقة"};
  if (safety) {
    card(
      [safety.message, safety.question, safety.advice, safety.disclaimer]
        .filter(Boolean)
        .join(" — "),
      "safety",
    );
    if (safety.kind === "urgent") {
      emergency.open = true;
      emergency.scrollIntoView({ block: "center" });
    }
    return {ok:false,safety};
  }
  const result = plan(text, { patient, entries, pending });
  pending = result.pending || null;
  if (result.question) {card(result.question);return {ok:false,question:result.question};}
  else if (result.form) {editForm(result.form);return {ok:true,message:"فتحت النموذج للمراجعة، لم يحفظ بعد"};}
  else return await perform(result.tool, result.args);
}
$("#agent-form").onsubmit = (ev) => {
  ev.preventDefault();
  const input = $("#agent-input"),
    text = input.value.trim();
  if (text) {
    input.value = "";
    send(text).catch((e) => card(e.message));
  }
};
host
  .querySelectorAll("[data-command]")
  .forEach(
    (b) =>
      (b.onclick = () =>
        send(
          b.dataset.command === "أدويتي"
            ? "الأدوية"
            : b.dataset.command === "تقاريري"
              ? "التقارير"
              : b.dataset.command,
        )),
  );
$("#agent-mic").onclick = async () => {
 if(live.active){live.interrupt();return;}
 if(!patient){card('اختر المريض أولا');return;}
 // Host supplies a vetted short-lived token function; never accept a raw API key.
 live.getToken=globalThis.AfiyahPreviewGetLiveToken;
 if(!live.getToken){card('رابط المعاينة لم يعتمد بعد في خدمة الصوت، الاتصال غير متاح حاليا');return;}
 if(!confirm(`ستبدأ محادثة صوتية خارجية لملف ${patient.name} الافتراضي. استخدم بيانات الاختبار فقط، ويسمح بقراءة هذا الملف بصوت مسموع؟`))return;
 localVoice.stop();voice=live;
 try{await live.start()}catch(e){card(e.message,'error')}
};
$("#voice-mute").onclick = () => voice.mute();
$("#voice-interrupt").onclick = () => voice.interrupt();
$("#voice-stop").onclick = () => voice.stop();
let voices = [];
function updateVoices() {
  voices = (globalThis.speechSynthesis?.getVoices() || []).filter(
    (v) => v.localService && v.lang.startsWith("ar"),
  );
  $("#device-voice").innerHTML = voices.length
    ? voices
        .map(
          (v, i) =>
            `<option value="${i}">${esc(v.name)} · ${esc(v.lang)}</option>`,
        )
        .join("")
    : "<option>لا يوجد صوت عربي محلي متاح</option>";
}
updateVoices();
globalThis.speechSynthesis?.addEventListener("voiceschanged", updateVoices);
$("#voice-read").onclick = () => {
  if (
    patient &&
    lastReply &&
    confirm(`هل تريد قراءة رد ملف ${patient.name} بصوت مسموع الآن؟`)
  )
    localVoice.speak(lastReply, voices[$("#device-voice").value]);
};
$("#voice-sample").onclick = () =>
  localVoice.speak(
    "أنا مساعد عافية. هذا اختبار نطق فقط. باراسيتامول، خمسمئة مليغرام. الساعة الثامنة والنصف صباحاً. لا يوجد تسجيل للجرعة",
    voices[$("#device-voice").value],
  );
function dialog(title, html, submit) {
  const d = document.createElement("dialog");
  d.className = "agent-dialog";
  d.innerHTML = `<form><h2>${esc(title)}</h2>${html}<div><button>حفظ</button><button type="button" class="cancel">إلغاء</button></div></form>`;
  document.body.append(d);
  d.querySelector(".cancel").onclick = () => d.close();
  d.onclose = () => d.remove();
  const pid = patient.id;
  d.querySelector("form").onsubmit = (ev) => {
    ev.preventDefault();
    if (patient?.id !== pid) {
      d.close();
      return;
    }
    submit(Object.fromEntries(new FormData(ev.target)));
    d.close();
  };
  d.showModal();
}
function editForm(section, row = {}) {
  dialog(
    row.id ? "مراجعة التعديل" : "إضافة للسجل",
    `<label>العنوان<input name="name" required maxlength="200" value="${esc(row.name)}"></label><label>التاريخ<input name="date" type="date" required value="${esc(row.date || day(patient.timezone))}"></label>${section === "appointments" ? `<label>الوقت<input name="time" type="time" required value="${esc(row.time || "09:00")}"></label><label>المكان<input name="place" value="${esc(row.place)}"></label>` : ""}<label>ملاحظات<textarea name="notes">${esc(row.notes)}</textarea></label>`,
    (v) =>
      perform("save", {
        section,
        value: {
          ...row,
          ...v,
          ...(section === "tasks"
            ? { status: row.status || "open", assignee: row.assignee || "" }
            : {}),
          ...(section === "journal" ? { kind: "update" } : {}),
        },
      }),
  );
}
$("#agent-new-appointment").onclick = () => editForm("appointments");
$("#agent-new-task").onclick = () => editForm("tasks");
$("#agent-attach").onclick = () => {
  const d = document.createElement("dialog");
  d.className = "agent-dialog";
  d.innerHTML = `<h2>إرفاق مصدر للمراجعة</h2><p>اختر أحد ملفات الاختبار أدناه وحمّله ثم أرفقه، تُرفض الملفات الأخرى لحماية بياناتكم في المعاينة</p><p><a href="preview/fixtures/synthetic-box.png" download>علبة افتراضية</a> · <a href="preview/fixtures/synthetic-report.pdf" download>تقرير اختبار</a> · <a href="preview/fixtures/synthetic-unclear.png" download>صورة غير واضحة</a></p><input type="file" accept="application/pdf,image/png" aria-label="ملف اختبار"><p>الاستخراج محلي ومحدود، لا يفسّر صور الأشعة ولا يثبت الجرعة الشخصية</p><button>إغلاق</button>`;
  document.body.append(d);
  d.querySelector("button").onclick = () => d.close();
  d.onclose = () => d.remove();
  const pid = patient.id;
  d.querySelector("input").onchange = async (ev) => {
    const file = ev.target.files[0];
    if (!file || file.size > 2 * 1024 * 1024) return;
    if (pid !== patient?.id) {
      d.close();
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    d.close();
    await perform("uploadFixture", { base64: btoa(binary) });
  };
  d.showModal();
};
$("#agent-notifications").onclick = async () => {
  const snap = await api("snapshot?patient=" + patient.id);
  const d = card(
    "تنبيهات تجريبية مستقلة عن الصوت — لا يُرسل بريد أو إشعار حقيقي",
  );
  if (patient.ownerId === user().uid) {
    for (const recipient of ["sarah", "ahmed", "reader"])
      button(
        d,
        "تفعيل قناة تجريبية لـ " +
          { sarah: "سارة", ahmed: "أحمد", reader: "ريم" }[recipient],
        () => perform("channel", { recipient, channel: "push", enabled: true }),
      );
  }
  snap.channels
    .filter((c) => c.recipient === user().uid && !c.consented)
    .forEach((c) =>
      button(d, "الموافقة على القناة التجريبية", () =>
        perform("consent", { channel: c.channel, consented: true }),
      ),
    );
  snap.notifications.forEach((n) => {
    const p = document.createElement("p");
    p.textContent = n.text + " · " + n.internalReason + " · " + n.status;
    d.append(p);
    button(p, "اطلعت", () =>
      perform("notification", { id: n.id, status: "seen" }),
    );
    button(p, "عولج", () =>
      perform("notification", { id: n.id, status: "handled" }),
    );
  });
};
addEventListener("pagehide", () => voice.stop());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) voice.interrupt();
});

$("#agent-camera").onclick=async()=>{
 const d=document.createElement('dialog');d.className='agent-dialog';
 const video=document.createElement('video');video.autoplay=true;video.muted=true;video.playsInline=true;video.style.width='100%';
 const close=document.createElement('button');close.textContent='إغلاق الكاميرا';d.append(video,close);document.body.append(d);d.showModal();
 let stream;const pid=patient?.id;
 const changed=()=>{if(patient?.id!==pid)d.close()};document.addEventListener('afiyah:context',changed);
 d.onclose=()=>{stream?.getTracks().forEach(t=>t.stop());document.removeEventListener('afiyah:context',changed);d.remove()};close.onclick=()=>d.close();
 try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});if(!d.open||patient?.id!==pid){stream.getTracks().forEach(t=>t.stop());d.close();return;}video.srcObject=stream;}
 catch{d.close();card('تعذر تشغيل الكاميرا، يمكنك إرفاق ملف اختبار')}
};

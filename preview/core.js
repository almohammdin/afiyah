import { randomUUID, createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { makeExample } from "../example-patient.js";
import {
  sections,
  validate,
  day,
  slotId,
  doses,
  normalize,
  validDate,
} from "../domain.js";
import { extractFixture } from "./extract.js";
import { localInstant, localParts } from "../care-time.js";
export const actors = {
  sarah: { uid: "sarah", displayName: "سارة", email: "sarah@example.test" },
  ahmed: { uid: "ahmed", displayName: "أحمد", email: "ahmed@example.test" },
  reader: {
    uid: "reader",
    displayName: "ريم — اطلاع فقط",
    email: "reem@example.test",
  },
};
const fail = (message, code = 400) => {
  throw Object.assign(Error(message), { status: code });
};
const clone = (x) => structuredClone(x);
export function safety(text, country) {
  const t = normalize(text).replace(/[أإآ]/g, "ا");
  if (
    /الم.*صدر|ضيق.*(نفس|تنفس)|صعوب.*تنفس|فقد.*وعي|فاقد.*وعي|نزيف.*شديد|جرعه.*زائد|جرعات.*زائد/.test(
      t,
    )
  )
    return {
      kind: "urgent",
      message:
        "قد تحتاج الحالة مساعدة عاجلة الآن، لا تنتظر إدخال البيانات أو رد الوكيل",
      country,
      calls: country === "SA" ? [{ label: "الإسعاف 997", number: "997" }] : [],
      question: country === "SA" ? null : "في أي بلد أنت الآن؟",
      disclaimer: "لا أستطيع استبعاد الطوارئ أو إرسال بلاغ",
    };
  if (/ضاعف|غير.*جرع|كم.*(حبه|جرع)|اخذ.*(زياد|مرتين)|حبتين|تعارض/.test(t))
    return {
      kind: "medication",
      message:
        "لا أغيّر الجرعة أو أخمّنها، جهّز اسم الدواء والتركيز ووقت التناول والوصفة لسؤال الطبيب أو الصيدلي",
      advice:
        country === "SA"
          ? "937 للاستشارة الصحية، وليس بديلاً عن الإسعاف عند الطوارئ"
          : "اطلب المشورة الطبية المحلية",
    };
  if (/قلق|خايف|خائف|الم|وجع/.test(t))
    return {
      kind: "support",
      message: "أفهم قلقك، لا أستطيع تشخيص السبب أو استبعاد الطوارئ",
      question: "ما الذي تشعر به الآن؟",
    };
  return null;
}
function seed() {
  const a = makeExample("sarah"),
    b = makeExample("ahmed");
  a.patient.id = "sarah";
  a.patient.relation = "";
  b.patient.id = "omar";
  b.patient.name = "عمر";
  b.patient.relation = "";
  return {
    patients: [a.patient, b.patient],
    entries: { sarah: a.entries, omar: b.entries },
    grants: [
      {
        patientId: "sarah",
        uid: "ahmed",
        relation: "والدتي",
        readSections: sections,
        editSections: [
          "appointments",
          "tasks",
          "journal",
          "medications",
          "reports",
        ],
      },
      {
        patientId: "sarah",
        uid: "reader",
        relation: "",
        readSections: sections,
        editSections: [],
      },
    ],
    operations: {},
    reviews: {},
    attachments: {},
    notifications: [],
    channels: [],
    audit: [],
  };
}
export class CareStore {
  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL)",
    );
    this.db
      .prepare("INSERT OR IGNORE INTO state VALUES(1,?)")
      .run(JSON.stringify(seed()));
  }
  read() {
    return JSON.parse(
      this.db.prepare("SELECT body FROM state WHERE id=1").get().body,
    );
  }
  access(s, actor, pid, section, write = false) {
    if (!actors[actor]) fail("جلسة غير صالحة", 401);
    const p = s.patients.find((x) => x.id === pid);
    if (!p) fail("لا يمكن الوصول إلى الملف", 403);
    const grant = s.grants.find((x) => x.patientId === pid && x.uid === actor);
    if (
      p.ownerId !== actor &&
      (!grant ||
        (section &&
          !grant[write ? "editSections" : "readSections"].includes(
            section === "doseEvents" ? "medications" : section,
          )))
    )
      fail("ليس لديك صلاحية لهذه العملية", 403);
    return { ...p, grant };
  }
  snapshot(actor, pid) {
    const s = this.read();
    if (!pid)
      return {
        actor: actors[actor],
        patients: s.patients
          .filter(
            (p) =>
              p.ownerId === actor ||
              s.grants.some((g) => g.patientId === p.id && g.uid === actor),
          )
          .map((p) => this.access(s, actor, p.id)),
      };
    const p = this.access(s, actor, pid),
      out = {};
    for (const sec of [...sections, "doseEvents"]) {
      try {
        this.access(s, actor, pid, sec);
        out[sec] = s.entries[pid][sec] || [];
      } catch {
        out[sec] = [];
      }
    }
    out.audit =
      p.ownerId === actor ? s.audit.filter((x) => x.patientId === pid) : [];
    out.safety = out.profile[0] || null;
    return {
      patient: p,
      entries: out,
      members: s.grants
        .filter((g) => g.patientId === pid)
        .map((g) => ({ ...g, id: g.uid, memberUid: g.uid, status: "active" })),
      notifications: s.notifications.filter(
        (n) =>
          n.patientId === pid && (p.ownerId === actor || n.recipient === actor),
      ),
      channels: s.channels.filter(
        (c) =>
          c.patientId === pid && (p.ownerId === actor || c.recipient === actor),
      ),
    };
  }
  execute(actor, request) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const s = this.read(),
        result = this.run(s, actor, request);
      this.db
        .prepare("UPDATE state SET body=? WHERE id=1")
        .run(JSON.stringify(s));
      this.db.exec("COMMIT");
      return clone(result);
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  run(s, actor, r) {
    const { patientId: pid, tool, args = {}, operationId } = r;
    this.access(s, actor, pid);
    if (!operationId || operationId.length > 100) fail("يلزم معرّف للعملية");
    const key = actor + ":" + operationId,
      hash = createHash("sha256")
        .update(JSON.stringify({ pid, tool, args }))
        .digest("hex");
    if (s.operations[key]) {
      if (s.operations[key].hash !== hash)
        fail("أُعيد استخدام المعرّف لطلب مختلف", 409);
      return s.operations[key].result;
    }
    const e = s.entries[pid],
      p = this.access(s, actor, pid),
      now = new Date().toISOString();
    let result,
      section,
      record,
      before = null;
    const review = (payload) => {
      const token = randomUUID();
      s.reviews[token] = { actor, pid, payload, expires: Date.now() + 600000 };
      return {
        kind: "review",
        token,
        message: "راجع التعديل قبل اعتماده",
        proposal: payload,
      };
    };
    const write = (sec, value) => {
      this.access(s, actor, pid, sec, true);
      if (!value || typeof value !== "object" || Array.isArray(value))
        fail("بيانات غير صالحة");
      const allowed = [
        "id",
        "name",
        "notes",
        "deleted",
        "revision",
        "updatedAt",
        "updatedById",
        ...{
          profile: [
            "allergyStatus",
            "allergies",
            "conditions",
            "birthYear",
            "blood",
            "emergencyName",
            "emergencyPhone",
            "hospitalFiles",
          ],
          medications: [
            "ingredient",
            "dose",
            "times",
            "start",
            "end",
            "status",
            "minHours",
            "maxPerDay",
          ],
          appointments: ["date", "time", "doctor", "place"],
          tasks: ["date", "assignee", "status"],
          reports: ["date"],
          journal: ["date", "kind"],
        }[sec],
      ];
      if (Object.keys(value).some((k) => !allowed.includes(k)))
        fail("حقول غير مسموحة");
      if (
        value.id !== undefined &&
        (typeof value.id !== "string" || value.id.length > 120)
      )
        fail("معرّف غير صالح");
      if (
        value.revision !== undefined &&
        (!Number.isInteger(value.revision) || value.revision < 0)
      )
        fail("مراجعة غير صالحة");
      if (
        sec === "appointments" &&
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)
      )
        fail("وقت الموعد غير صالح");
      if (sec === "tasks" && !["open", "done"].includes(value.status))
        fail("حالة المهمة غير صالحة");
      validate(sec, value);
      section = sec;
      const list = e[sec],
        old = list.find((x) => x.id === value.id);
      if (old && (old.revision || 0) !== (value.revision || 0))
        fail("تغير السجل، راجعه قبل التعديل", 409);
      before = old ? clone(old) : null;
      record = {
        ...value,
        id: value.id || randomUUID(),
        revision: (old?.revision || 0) + 1,
        updatedAt: now,
        updatedById: actor,
      };
      if (old) list[list.indexOf(old)] = record;
      else list.push(record);
      return { kind: "saved", message: "حُفظ في السجل", record };
    };
    if (tool === "read" || tool === "today" || tool === "visit") {
      const secs =
        tool === "read"
          ? [args.section]
          : tool === "visit"
            ? sections
            : ["medications", "appointments", "tasks"];
      result = { kind: "records", patient: p.name, sections: {} };
      for (const sec of secs) {
        if (!sections.includes(sec)) fail("قسم غير معروف");
        this.access(s, actor, pid, sec);
        result.sections[sec] = e[sec].filter((x) => !x.deleted);
      }
      if (tool === "today") {
        this.access(s, actor, pid, "medications");
        result.slots = doses(e.medications, day(p.timezone)).map((d) => ({
          ...d,
          event: e.doseEvents.find((x) => x.id === d.id),
          label: e.doseEvents.some((x) => x.id === d.id && x.status === "given")
            ? "يوجد تسجيل"
            : "لا يوجد تسجيل للجرعة",
        }));
      }
    } else if (tool === "navigate") {
      if (
        ![
          ...sections,
          "today",
          "calendar",
          "summary",
          "settings",
          "audit",
          "sharing",
        ].includes(args.section)
      )
        fail("قسم غير معروف");
      if (sections.includes(args.section))
        this.access(s, actor, pid, args.section);
      result = { kind: "navigate", section: args.section };
    } else if (tool === "save") {
      if (!sections.includes(args.section)) fail("قسم غير معروف");
      this.access(s, actor, pid, args.section, true);
      if (
        args.section === "medications" ||
        args.section === "profile" ||
        args.value?.id
      )
        result = review({ tool: "saveReviewed", args });
      else result = write(args.section, args.value);
    } else if (tool === "approve") {
      const rev = s.reviews[args.token];
      if (
        !rev ||
        rev.actor !== actor ||
        rev.pid !== pid ||
        rev.expires < Date.now()
      )
        fail("المراجعة غير صالحة، أعد تجهيز التعديل", 409);
      const q = rev.payload;
      if (q.tool === "saveReviewed")
        result = write(q.args.section, q.args.value);
      else if (q.tool === "correctReviewed") {
        this.access(s, actor, pid, "medications", true);
        const old = e.doseEvents.find((x) => x.id === q.args.id);
        if (!old || old.revision !== q.args.revision)
          fail("تغير تسجيل الجرعة", 409);
        section = "doseEvents";
        before = clone(old);
        Object.assign(old, {
          status: "corrected",
          reason: q.args.reason,
          revision: old.revision + 1,
          updatedAt: now,
          updatedById: actor,
        });
        record = old;
        result = {
          kind: "saved",
          message: "حُفظ التصحيح مع التسجيل الأصلي",
          record,
        };
      } else fail("نوع مراجعة غير معروف");
      delete s.reviews[args.token];
    } else if (tool === "dose") {
      this.access(s, actor, pid, "medications", true);
      if (
        !validDate(args.date) ||
        (typeof args.reason !== "undefined" &&
          (typeof args.reason !== "string" || args.reason.length > 500))
      )
        fail("تاريخ أو سبب غير صالح");
      const m = e.medications.find((x) => x.id === args.medId);
      if (!m || !doses([m], args.date).some((x) => x.time === args.time))
        fail("اختر موعداً مقرراً في الوصفة");
      if (!["given", "not-given"].includes(args.status)) fail("حالة غير صالحة");
      const id = slotId(m.id, args.date, args.time),
        old = e.doseEvents.find((x) => x.id === id);
      if (old && old.status !== "corrected")
        result = {
          kind: "duplicate",
          message:
            "يوجد تسجيل لهذا الموعد، هل تقصد تصحيحه أم تناولاً إضافياً محتملاً؟",
          record: old,
        };
      else {
        const current = localParts(new Date(), p.timezone);
        const actual = localInstant(
          args.occurredDate || current.day,
          args.occurredTime || current.time,
          p.timezone,
        );
        if (Date.parse(actual.iso) > Date.now() + 60000)
          fail("وقت التناول في المستقبل");
        section = "doseEvents";
        before = old ? clone(old) : null;
        record = {
          id,
          medId: m.id,
          name: m.name,
          day: args.date,
          time: args.time,
          scheduledAt: localInstant(args.date, args.time, p.timezone).iso,
          occurredAt: actual.iso,
          recordedAt: now,
          timezone: p.timezone,
          subjectId: pid,
          updatedById: actor,
          updatedAt: now,
          status: args.status,
          reason: args.reason || "",
          revision: (old?.revision || 0) + 1,
        };
        if (old) e.doseEvents[e.doseEvents.indexOf(old)] = record;
        else e.doseEvents.push(record);
        result = { kind: "saved", message: "حُفظ تسجيل الجرعة", record };
      }
    } else if (tool === "correctDose") {
      this.access(s, actor, pid, "medications", true);
      if (!args.reason?.trim()) fail("ما سبب التصحيح؟");
      const old = e.doseEvents.find((x) => x.id === args.id);
      if (!old) fail("التسجيل غير موجود");
      result = review({
        tool: "correctReviewed",
        args: { ...args, revision: old.revision },
      });
    } else if (tool === "undo") {
      const a = s.audit.find(
        (x) => x.id === args.auditId && x.patientId === pid,
      );
      if (!a || a.undone || a.actorId !== actor)
        fail("لا يمكن التراجع عن هذه العملية");
      this.access(s, actor, pid, a.section, true);
      const list = e[a.section],
        old = list.find((x) => x.id === a.recordId);
      if (!old || old.revision !== a.after.revision)
        fail("تغير السجل بعد العملية، راجعه أولاً", 409);
      section = a.section;
      before = clone(old);
      record = a.before
        ? {
            ...a.before,
            revision: old.revision + 1,
            updatedAt: now,
            updatedById: actor,
          }
        : {
            ...old,
            deleted: true,
            status: section === "doseEvents" ? "corrected" : old.status,
            reason: "تراجع موثق",
            revision: old.revision + 1,
          };
      list[list.indexOf(old)] = record;
      a.undone = true;
      result = {
        kind: "saved",
        message: "حُفظ التراجع في سجل التغييرات",
        record,
      };
    } else if (tool === "uploadFixture") {
      this.access(s, actor, pid, "reports", true);
      const source = extractFixture(args.base64);
      const id = randomUUID();
      s.attachments[id] = {
        ...source,
        id,
        patientId: pid,
        uploadedBy: actor,
        createdAt: now,
        status: "draft",
      };
      const { base64, ...attachment } = s.attachments[id];
      result = {
        kind: "draft",
        message: "حُفظ المصدر الخاص واستُخرجت مسودة محلية للمراجعة",
        attachment,
      };
    } else if (tool === "attachFixture") {
      this.access(s, actor, pid, "reports", true);
      const fixtures = {
        box: {
          name: "علبة افتراضية",
          fields: {
            name: "باراسيتامول",
            concentration: "500 mg",
            dose: null,
            schedule: null,
          },
          unclear: ["جرعة المريض غير مثبتة", "جدول العلاج غير مثبت"],
          source: "صورة علبة",
          page: 1,
        },
        blur: {
          name: "صورة غير واضحة",
          fields: { name: null, concentration: null },
          unclear: ["الاسم غير مقروء", "التركيز غير مقروء"],
          source: "صورة افتراضية",
          page: 1,
        },
        injection: {
          name: "تقرير اختبار",
          fields: { title: "متابعة دورية" },
          unclear: ["نص داخل المستند يحاول إعطاء أوامر — لم يُنفذ"],
          source: "PDF افتراضي",
          page: 2,
        },
      };
      const fixture = fixtures[args.fixture];
      if (!fixture) fail("تقبل المعاينة مستندات الاختبار المرفقة فقط");
      const id = randomUUID();
      s.attachments[id] = {
        ...fixture,
        id,
        patientId: pid,
        uploadedBy: actor,
        createdAt: now,
        status: "draft",
      };
      result = {
        kind: "draft",
        attachment: s.attachments[id],
        message: "مسودة من مصدر تجريبي، راجع الحقول؛ لا تُضاف وصفة تلقائياً",
      };
    } else if (tool === "attachment") {
      this.access(s, actor, pid, "reports");
      const a = s.attachments[args.id];
      if (!a || a.patientId !== pid) fail("لا يمكن الوصول إلى المرفق", 403);
      const { base64, ...attachment } = a;
      result = { kind: "draft", attachment };
    } else if (tool === "channel") {
      if (p.ownerId !== actor) fail("إعداد المستلمين لصاحب الملف فقط", 403);
      if (!["email", "push"].includes(args.channel) || !actors[args.recipient])
        fail("قناة أو مستلم غير صالح");
      this.access(s, args.recipient, pid);
      s.channels = s.channels.filter(
        (c) =>
          !(
            c.patientId === pid &&
            c.recipient === args.recipient &&
            c.channel === args.channel
          ),
      );
      s.channels.push({
        patientId: pid,
        recipient: args.recipient,
        channel: args.channel,
        enabled: !!args.enabled,
        consented: false,
      });
      result = {
        kind: "saved",
        message: "حُفظ إعداد القناة التجريبية، ينتظر موافقة المستلم",
      };
    } else if (tool === "consent") {
      const c = s.channels.find(
        (c) =>
          c.patientId === pid &&
          c.recipient === actor &&
          c.channel === args.channel,
      );
      if (!c) fail("لا توجد دعوة للقناة");
      c.consented = !!args.consented;
      result = { kind: "saved", message: "حُفظ اختيارك للتنبيه التجريبي" };
    } else if (tool === "notification") {
      const n = s.notifications.find(
        (x) => x.id === args.id && x.patientId === pid,
      );
      if (!n || (n.recipient !== actor && p.ownerId !== actor))
        fail("لا يمكن الوصول إلى التنبيه", 403);
      if (!["seen", "handled"].includes(args.status)) fail("حالة غير صالحة");
      n.status = args.status;
      n.updatedBy = actor;
      result = { kind: "saved", message: "حُفظت حالة التنبيه التجريبي" };
    } else fail("أداة غير مسموحة", 403);
    if (record) {
      const a = {
        id: randomUUID(),
        patientId: pid,
        actorId: actor,
        actor: actors[actor].displayName,
        subjectId: pid,
        section,
        recordId: record.id,
        at: now,
        before,
        after: clone(record),
        snapshot: clone(record),
      };
      s.audit.push(a);
      result.auditId = a.id;
    } else if (
      !["read", "today", "visit", "navigate", "attachment"].includes(tool)
    )
      s.audit.push({
        id: randomUUID(),
        patientId: pid,
        actorId: actor,
        actor: actors[actor].displayName,
        at: now,
        section: "system",
        recordId: tool,
        snapshot: { name: result.message || tool },
      });
    s.operations[key] = { hash, result };
    return result;
  }
  tick(now = new Date()) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const s = this.read();
      for (const p of s.patients) {
        const e = s.entries[p.id];
        for (const slot of doses(e.medications, day(p.timezone, now))) {
          if (
            Date.parse(localInstant(slot.date, slot.time, p.timezone).iso) >
              now.getTime() ||
            e.doseEvents.some(
              (x) => x.id === slot.id && x.status !== "corrected",
            )
          )
            continue;
          for (const c of s.channels.filter(
            (c) => c.patientId === p.id && c.enabled && c.consented,
          )) {
            const id = `${p.id}:${slot.id}:${c.recipient}:${c.channel}`;
            if (!s.notifications.some((n) => n.id === id))
              s.notifications.push({
                id,
                patientId: p.id,
                recipient: c.recipient,
                channel: c.channel,
                status: "simulated",
                createdAt: now.toISOString(),
                text: "لديك تحديث متابعة في عافية",
                internalReason: "لا يوجد تسجيل للجرعة",
                delivery: "لم يرسل خارج المعاينة",
              });
          }
        }
      }
      this.db
        .prepare("UPDATE state SET body=? WHERE id=1")
        .run(JSON.stringify(s));
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
}

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { CareStore, safety } from "../preview/core.js";
import { day } from "../domain.js";
import { plan } from "../preview/policy.js";
const run = (
  s,
  actor,
  tool,
  args = {},
  patientId = "sarah",
  id = randomUUID(),
) => s.execute(actor, { patientId, tool, args, operationId: id });
const dose = { medId: "sample", date: day(), time: "08:00", status: "given" };
test("patient, caregiver, reader, unrelated patient enforced at server", () => {
  const s = new CareStore();
  assert.equal(s.snapshot("sarah").patients.length, 1);
  assert.equal(s.snapshot("ahmed").patients.length, 2);
  assert.equal(s.snapshot("ahmed", "sarah").patient.grant.relation, "والدتي");
  assert.throws(() => s.snapshot("reader", "omar"));
  assert.throws(() => run(s, "reader", "dose", dose));
  assert.equal(run(s, "ahmed", "dose", dose).record.subjectId, "sarah");
});
test("two connections same scheduled dose produce one log; retries preserve same result", () => {
  const s = new CareStore();
  const first = run(s, "sarah", "dose", dose, "sarah", "request-1");
  assert.deepEqual(run(s, "sarah", "dose", dose, "sarah", "request-1"), first);
  assert.equal(run(s, "ahmed", "dose", dose).kind, "duplicate");
  assert.equal(
    s
      .snapshot("sarah", "sarah")
      .entries.doseEvents.filter((x) => x.id === first.record.id).length,
    1,
  );
  assert.throws(() =>
    run(s, "sarah", "dose", { ...dose, time: "20:00" }, "sarah", "request-1"),
  );
});
test("distinct scheduled slots are not duplicate danger", () => {
  const s = new CareStore();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const morning = run(s, "sarah", "dose", { ...dose, date: yesterday });
  assert.equal(morning.kind, "duplicate");
  const d = s.read();
  d.entries.sarah.doseEvents = [];
  s.db.prepare("UPDATE state SET body=?").run(JSON.stringify(d));
  assert.equal(
    run(s, "sarah", "dose", { ...dose, date: yesterday }).kind,
    "saved",
  );
  assert.equal(
    run(s, "sarah", "dose", { ...dose, date: yesterday, time: "20:00" }).kind,
    "saved",
  );
});
test("event time, registration time, actor and timezone are separate", () => {
  const s = new CareStore();
  const r = run(s, "ahmed", "dose", { ...dose, occurredDate: day("Asia/Riyadh",new Date(Date.now()-86400000)), occurredTime: "08:30" });
  assert.equal(r.record.updatedById, "ahmed");
  assert.equal(r.record.timezone, "Asia/Riyadh");
  assert.notEqual(r.record.occurredAt, r.record.scheduledAt);
  assert.notEqual(r.record.occurredAt, r.record.recordedAt);
});
test("sensitive changes require review; tokens scoped to actor and patient; stale edits reject", () => {
  const s = new CareStore(),
    value = {
      ...s.snapshot("sarah", "sarah").entries.medications[0],
      dose: "حسب وصفة مراجعة تجريبية",
    };
  const r = run(s, "sarah", "save", { section: "medications", value });
  assert.equal(r.kind, "review");
  assert.throws(() => run(s, "ahmed", "approve", { token: r.token }));
  assert.equal(run(s, "sarah", "approve", { token: r.token }).kind, "saved");
  const stale = run(s, "sarah", "save", { section: "medications", value });
  assert.throws(() => run(s, "sarah", "approve", { token: stale.token }));
});
test("correction and undo are audited and cannot overwrite later family edits", () => {
  const s = new CareStore();
  const saved = run(s, "sarah", "dose", dose);
  const review = run(s, "sarah", "correctDose", {
    id: saved.record.id,
    reason: "تسجيل بالخطأ",
  });
  run(s, "sarah", "approve", { token: review.token });
  assert.throws(() => run(s, "sarah", "undo", { auditId: saved.auditId }));
  const note = run(s, "ahmed", "save", {
    section: "journal",
    value: {
      name: "سؤال للطبيب",
      notes: "اختبار",
      date: day(),
      kind: "question",
    },
  });
  assert.equal(
    run(s, "ahmed", "undo", { auditId: note.auditId }).record.deleted,
    true,
  );
  assert.ok(s.snapshot("sarah", "sarah").entries.audit.length >= 4);
});
test("attachment isolation and malicious document cannot invoke commands", () => {
  const s = new CareStore(),
    before = s.snapshot("sarah", "sarah").entries.medications;
  const draft = run(s, "ahmed", "attachFixture", { fixture: "injection" });
  assert.equal(draft.kind, "draft");
  assert.deepEqual(s.snapshot("sarah", "sarah").entries.medications, before);
  assert.throws(() =>
    run(s, "ahmed", "attachment", { id: draft.attachment.id }, "omar"),
  );
  assert.throws(() => run(s, "reader", "attachFixture", { fixture: "box" }));
  assert.throws(() => run(s, "sarah", "deleteAll", {}));
});
test("box and unclear image never infer personal dose or schedule", () => {
  const s = new CareStore(),
    box = run(s, "sarah", "attachFixture", { fixture: "box" });
  assert.equal(box.attachment.fields.dose, null);
  assert.equal(box.attachment.fields.schedule, null);
  assert.equal(
    run(s, "sarah", "attachFixture", { fixture: "blur" }).attachment.fields
      .name,
    null,
  );
});
test("channel authorization and consent are independent; scheduler no external sends", () => {
  const s = new CareStore();
  assert.throws(() =>
    run(s, "ahmed", "channel", {
      recipient: "reader",
      channel: "email",
      enabled: true,
    }),
  );
  run(s, "sarah", "channel", {
    recipient: "reader",
    channel: "email",
    enabled: true,
  });
  s.tick(new Date(day()+"T23:59:00+03:00"));
  assert.equal(s.snapshot("reader", "sarah").notifications.length, 0);
  run(s, "reader", "consent", { channel: "email", consented: true });
  s.tick(new Date(day()+"T23:59:00+03:00"));
  const ns = s.snapshot("reader", "sarah").notifications;
  assert.ok(ns.length > 0);
  assert.ok(
    ns.every((n) => n.status === "simulated" && !n.text.includes("سارة")),
  );
  s.tick(new Date(day()+"T23:59:00+03:00"));
  assert.equal(s.snapshot("reader", "sarah").notifications.length, ns.length);
  assert.throws(() => run(s, "reader", "dose", dose));
});
test("urgent guidance precedes data and unknown country has no guessed number", () => {
  const sa = safety("عندي ألم في الصدر وضيق تنفس", "SA");
  assert.equal(sa.kind, "urgent");
  assert.equal(sa.calls[0].number, "997");
  const traveler = safety("ضيق نفس", "");
  assert.equal(traveler.calls.length, 0);
  assert.ok(traveler.question);
  assert.equal(safety("أنا خايف", "SA").kind, "support");
  assert.equal(safety("هل أضاعف الجرعة", "SA").kind, "medication");
});
test("planner asks one time question; text and navigation work without model", () => {
  const s = new CareStore(),
    snap = s.snapshot("sarah", "sarah");
  const result = plan("أخذت باراسيتامول", snap);
  assert.ok(result.question);
  assert.equal(
    plan("08:00", { ...snap, pending: result.pending }).tool,
    "dose",
  );
  assert.equal(plan("أضف ملاحظة تحسن النوم", snap).args.section, "journal");
  assert.equal(plan("افتح التقويم", snap).args.section, "calendar");
});
test("missing log is not missed dose", () => {
  const s = new CareStore();
  assert.ok(
    run(s, "sarah", "today").slots.every(
      (x) => x.label === "لا يوجد تسجيل للجرعة",
    ),
  );
});
test("provider cannot activate from environment key or dialect prompt alone", async () => {
  const { ProviderGate } = await import("../preview/provider.js");
  assert.throws(() => new ProviderGate().assertReady());
  assert.throws(() => new ProviderGate({ termsReviewed: true }).assertReady());
});
test("actual PDF extraction preserves page source, ignores malicious instructions and rejects unknown bytes", async () => {
  const { readFileSync } = await import("node:fs");
  const s = new CareStore();
  const before = s.snapshot("sarah", "sarah").entries.medications;
  const result = run(s, "sarah", "uploadFixture", {
    base64: readFileSync(
      new URL("../preview/fixtures/synthetic-report.pdf", import.meta.url),
    ).toString("base64"),
  });
  assert.equal(result.attachment.pages.length, 2);
  assert.match(result.attachment.pages[1].text, /Ignore all/);
  assert.deepEqual(s.snapshot("sarah", "sarah").entries.medications, before);
  assert.equal(result.attachment.base64, undefined);
  assert.throws(() =>
    run(s, "sarah", "uploadFixture", {
      base64: Buffer.from("real unknown content").toString("base64"),
    }),
  );
});
test("actual local OCR extracts box strength but not dose; blank image stays uncertain", async () => {
  const { readFileSync } = await import("node:fs");
  const s = new CareStore();
  for (const name of ["box", "unclear"]) {
    const result = run(s, "sarah", "uploadFixture", {
      base64: readFileSync(
        new URL(
          "../preview/fixtures/synthetic-" + name + ".png",
          import.meta.url,
        ),
      ).toString("base64"),
    });
    if (name === "box") {
      assert.equal(result.attachment.fields.concentration, "500 mg");
      assert.equal(result.attachment.fields.dose, null);
    } else assert.equal(result.attachment.pages.length, 0);
  }
});
test("durable idempotency survives reopening database in a second connection", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "afiyah-test-"));
  try {
    const a = new CareStore(join(dir, "demo.sqlite")),
      b = new CareStore(join(dir, "demo.sqlite"));
    const first = run(a, "sarah", "dose", dose, "sarah", "reconnect-id");
    assert.deepEqual(
      run(b, "sarah", "dose", dose, "sarah", "reconnect-id"),
      first,
    );
    assert.equal(run(b, "ahmed", "dose", dose).kind, "duplicate");
    a.db.close();
    b.db.close();
    const c = new CareStore(join(dir, "demo.sqlite"));
    assert.deepEqual(
      run(c, "sarah", "dose", dose, "sarah", "reconnect-id"),
      first,
    );
    c.db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("forged fields and invalid appointment time cannot pass save tool", () => {
  const s = new CareStore();
  assert.throws(() =>
    run(s, "sarah", "save", {
      section: "tasks",
      value: { name: "a", date: day(), status: "open", ownerId: "reader" },
    }),
  );
  assert.throws(() =>
    run(s, "sarah", "save", {
      section: "appointments",
      value: { name: "a", date: day(), time: "99:99" },
    }),
  );
});

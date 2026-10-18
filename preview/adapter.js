export const requestId = () =>
  globalThis.crypto.randomUUID?.() ||
  Array.from(globalThis.crypto.getRandomValues(new Uint8Array(24)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
let person, callback;
export async function api(path, body) {
  const r = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const v = await r.json();
  if (!r.ok) throw Object.assign(Error(v.message), { status: r.status });
  return v;
}
export async function selectActor(actor) {
  const r = await api("session", { actor });
  person = r.actor;
  await callback?.(person);
  document.dispatchEvent(new CustomEvent("afiyah:actor", { detail: person }));
}
export const user = () => person,
  isDemo = () => true,
  owner = (p) => p.ownerId === person?.uid,
  can = (p, s, write = false) =>
    owner(p) ||
    !!p.grant?.[write ? "editSections" : "readSections"]?.includes(
      s === "doseEvents" ? "medications" : s,
    );
export async function init(cb) {
  callback = cb;
  await selectActor("sarah");
}
export const login = () => selectActor("sarah"),
  logout = () => selectActor("sarah"),
  startDemo = () => {};
export const patients = async () => (await api("snapshot")).patients;
export const invitations = async () => [];
export const members = async (p) =>
  (await api("snapshot?patient=" + encodeURIComponent(p.id))).members;
export const load = async (p) =>
  (await api("snapshot?patient=" + encodeURIComponent(p.id))).entries;
export const execute = (p, tool, args = {}, operationId = requestId()) =>
  api("tool", {
    patientId: typeof p === "string" ? p : p.id,
    tool,
    args,
    operationId,
  });
async function reviewed(p, tool, args) {
  let r = await execute(p, tool, args);
  if (r.kind === "review") {
    if (!confirm("راجع البيانات المدخلة، هل تعتمد هذا التعديل؟"))
      throw Error("لم يُعتمد التعديل");
    r = await execute(p, "approve", { token: r.token });
  }
  return r;
}
export const save = (p, s, value) => reviewed(p, "save", { section: s, value });
export const archive = (p, s, r) =>
  save(p, s, {
    ...r,
    ...(s === "medications" ? { status: "stopped" } : { deleted: true }),
  });
export const recordDose = (
  p,
  m,
  date,
  time,
  status,
  reason = "",
  ack = false,
  actual = null,
) =>
  execute(p, "dose", {
    medId: m.id,
    date,
    time,
    status,
    reason,
    occurredDate: actual?.date || date,
    occurredTime: actual?.time || time,
  }).then((r) => {
    if (r.kind === "duplicate") throw Error(r.message);
    return r;
  });
export const correctDose = (p, event, reason) =>
  reviewed(p, "correctDose", { id: event.id, reason });
export const exportPatient = async (p) => ({
  patient: p,
  entries: await load(p),
  synthetic: true,
});
const unavailable = async () => {
  throw Error("هذه المعاينة محصورة في حسابات وملفات الاختبار");
};
export const createPatient = unavailable,
  deletePatient = unavailable,
  updatePatient = unavailable,
  share = unavailable,
  revoke = unavailable,
  accept = unavailable;

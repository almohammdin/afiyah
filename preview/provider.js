import { persona } from "./policy.js";
// Transport must be supplied by an approved server-side integration. No provider
// credentials or endpoints from the other platforms are inherited here.
export class ProviderGate {
  constructor(approval = {}, transport = null) {
    this.approval = approval;
    this.transport = transport;
  }
  assertReady() {
    for (const key of [
      "termsReviewed",
      "healthDataApproved",
      "retentionApproved",
      "regionApproved",
      "budgetApproved",
      "voiceApproved",
    ])
      if (this.approval[key] !== true)
        throw Error("Provider activation blocked: " + key);
    if (!this.transport)
      throw Error("Approved server transport is not configured");
  }
  async respond({ patientId, actorId, messages, tools }) {
    this.assertReady();
    return this.transport.respond({
      system: persona,
      patientId,
      actorId,
      messages,
      tools,
    });
  }
  async transcribe(audio) {
    this.assertReady();
    return this.transport.transcribe(audio);
  }
  async speak(text, voice) {
    this.assertReady();
    return this.transport.speak({ text, voice, locale: "ar-SA" });
  }
}
export const voiceAcceptance = [
  "أنا مساعد عافية، كيف أقدر أساعدك اليوم؟",
  "باراسيتامول 500 مليغرام، سيتريزين 10 مليغرام، محلول بتركيز 0.9 بالمئة",
  "الساعة 08:30 صباحاً والساعة 20:00 مساءً",
  "لا يوجد تسجيل للجرعة، وهذا لا يعني أنها لم تؤخذ",
  "قد تحتاج الحالة مساعدة عاجلة الآن، لا تنتظر ردي",
  "ملف سارة هو المحدد، هل يناسبك قراءة التفاصيل بصوت مسموع؟",
];

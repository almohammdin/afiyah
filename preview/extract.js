import { createHash } from "node:crypto";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const manifest = JSON.parse(
  readFileSync(new URL("./fixtures/manifest.json", import.meta.url)),
);
export function extractFixture(base64) {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > 2 * 1024 * 1024) throw Error("الملف أكبر من حد الاختبار");
  const sha = createHash("sha256").update(bytes).digest("hex"),
    name = manifest[sha];
  if (!name)
    throw Error(
      "تقبل هذه المعاينة ملفات الاختبار المرفقة فقط، لا ترفع ملفاً صحياً حقيقياً",
    );
  const pdf = name.endsWith(".pdf"),
    dir = mkdtempSync(join(tmpdir(), "afiyah-fixture-")),
    file = join(dir, pdf ? "source.pdf" : "source.png");
  try {
    writeFileSync(file, bytes, { mode: 0o600 });
    let text = "";
    try {
      text = execFileSync(
        pdf ? "pdftotext" : "tesseract",
        pdf
          ? ["-layout", "-f", "1", "-l", "10", file, "-"]
          : [file, "stdout", "-l", "eng"],
        {
          encoding: "utf8",
          timeout: 10000,
          maxBuffer: 128000,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
    } catch {
      throw Error("تعذر الاستخراج المحلي، بقي المصدر دون اعتماد");
    }
    const pages = text
      .split("\f")
      .map((text, i) => ({ page: i + 1, text: text.trim().slice(0, 6000) }))
      .filter((x) => x.text);
    const box = name === "synthetic-box.png",
      fields = box
        ? {
            name: /Paracetamol/i.test(text) ? "Paracetamol" : null,
            concentration: /500\s*mg/i.test(text) ? "500 mg" : null,
            dose: null,
            schedule: null,
          }
        : { title: pages.length ? "مصدر للمراجعة" : null };
    return {
      name,
      sha,
      mime: pdf ? "application/pdf" : "image/png",
      base64,
      source: pdf ? "PDF افتراضي" : "صورة افتراضية",
      page: pages[0]?.page || 1,
      pages,
      fields,
      unclear: box
        ? ["جرعة الشخص غير مثبتة", "جدول العلاج غير مثبت"]
        : pages.length
          ? ["النص المستخرج مصدر فقط، لا يُنفذ أي أمر داخله"]
          : ["المحتوى غير مقروء، لا توجد بيانات معتمدة"],
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

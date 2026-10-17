import http from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { CareStore, actors, safety } from "./core.js";
const root = resolve(import.meta.dirname, "..");
mkdirSync(resolve(root, ".preview-state"), { recursive: true });
const store = new CareStore(resolve(root, ".preview-state/demo.sqlite"));
const sessions = new Map();
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};
const json = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    const path = url.pathname.replace(/^\/afiyah(?=\/)/, "");
    if (path.startsWith("/api/")) {
      if (
        req.method === "POST" &&
        req.headers.origin &&
        new URL(req.headers.origin).host !== req.headers.host
      )
        return json(res, 403, { message: "مصدر الطلب غير مسموح" });
      let body = {};
      if (req.method === "POST") {
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 3000000)
            throw Object.assign(Error("الطلب أكبر من الحد"), { status: 413 });
        }
        body = JSON.parse(raw || "{}");
      }
      if (path === "/api/session" && req.method === "POST") {
        if (!actors[body.actor])
          return json(res, 400, { message: "حساب اختبار غير معروف" });
        const token = randomUUID();
        sessions.set(token, body.actor);
        res.setHeader(
          "Set-Cookie",
          `afiyah_preview=${token}; HttpOnly; SameSite=Strict; Path=/`,
        );
        return json(res, 200, { actor: actors[body.actor] });
      }
      const token = req.headers.cookie?.match(
          /(?:^|; )afiyah_preview=([^;]+)/,
        )?.[1],
        actor = sessions.get(token);
      if (!actor) return json(res, 401, { message: "اختر حساب الاختبار" });
      if (path === "/api/snapshot" && req.method === "GET")
        return json(
          res,
          200,
          store.snapshot(actor, url.searchParams.get("patient")),
        );
      if (path === "/api/tool" && req.method === "POST")
        return json(res, 200, store.execute(actor, body));
      if (path === "/api/attachment" && req.method === "GET") {
        const pid = url.searchParams.get("patient"),
          id = url.searchParams.get("id");
        const s = store.read();
        store.access(s, actor, pid, "reports");
        const a = s.attachments[id];
        if (!a || a.patientId !== pid || !a.base64)
          return json(res, 403, { message: "لا يمكن الوصول إلى المرفق" });
        res.writeHead(200, {
          "Content-Type": a.mime,
          "Content-Disposition": 'attachment; filename="' + a.name + '"',
        });
        return res.end(Buffer.from(a.base64, "base64"));
      }
      if (path === "/api/safety" && req.method === "POST")
        return json(res, 200, {
          safety: safety(String(body.text || "").slice(0, 4000), body.country),
        });
      return json(res, 404, { message: "غير متاح في المعاينة" });
    }
    if (!["GET", "HEAD"].includes(req.method)) return json(res, 405, {});
    let file = path === "/" ? "/index.html" : path;
    if (
      !/^\/(assets\/[\w./-]+|preview\/web\/(?:preview\/)?[\w-]+\.(?:js|html)|[\w-]+\.(js|css|html|webmanifest)|preview\/(agent|adapter|voice|policy|device)\.(js|css|html)|preview\/fixtures\/synthetic-[a-z-]+\.(pdf|png))$/.test(
        file,
      ) ||
      file.includes("..")
    )
      return json(res, 404, {});
    const full = resolve(root, "." + file);
    if (!existsSync(full)) return json(res, 404, {});
    let data = readFileSync(full);
    if (file === "/index.html") {
      data = data
        .toString()
        .replace(
          /<meta http-equiv="Content-Security-Policy"[^>]*>/,
          "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'\">",
        )
        .replace(
          "</head>",
          '<meta name="robots" content="noindex,nofollow"><link rel="stylesheet" href="preview/agent.css"></head>',
        )
        .replace(
          "</body>",
          '<script type="module" src="preview/agent.js"></script></body>',
        );
    }
    if (file === "/app.js") {
      data = data
        .toString()
        .replace(
          "'./data.js?v=20261015-example-copy'",
          "'./preview/adapter.js'",
        )
        .replace(
          "return html+content();",
          'return `<div id="agent-anchor"></div>`+html+content();',
        );
      data +=
        '\ndocument.addEventListener("afiyah:refresh",()=>refresh());document.addEventListener("afiyah:navigate",ev=>{tab=ev.detail;render()});document.addEventListener("afiyah:context-request",()=>document.dispatchEvent(new CustomEvent("afiyah:context",{detail:{patient:p,tab}})));new MutationObserver(()=>document.dispatchEvent(new CustomEvent("afiyah:context",{detail:{patient:p,tab}}))).observe(document.getElementById("app"),{childList:true});';
    }
    // Never expose the live Firebase adapter/config through this preview server
    if (["/data.js", "/config.js"].includes(file))
      return json(res, 403, { message: "Production connection disabled" });
    res.writeHead(200, {
      "Content-Type": types[extname(full)] || "application/octet-stream",
    });
    res.end(data);
  } catch (e) {
    json(res, e.status || 400, { message: e.message });
  }
});
setInterval(() => store.tick(), 30000).unref();
server.listen(Number(process.env.PORT) || 4173, "0.0.0.0", () =>
  console.log("Afiyah synthetic-only preview ready"),
);

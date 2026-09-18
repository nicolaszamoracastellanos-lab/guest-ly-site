// State proxy for the Part 9 audit. Node built-ins only.
//
//   node scripts/part9/proxy.mjs            (listens on 127.0.0.1:8787)
//   curl -s "http://127.0.0.1:8787/__part9/mode?set=fail"
//   curl -s "http://127.0.0.1:8787/__part9/mode"          (current mode and hit count)
//
// Metro must be started with the app pointed here, and with --clear every
// time the base changes (the value is inlined into the bundle):
//   EXPO_PUBLIC_API_BASE=http://127.0.0.1:8787 npx expo start --dev-client --port 8097 --no-dev --minify --clear
//
// Modes
//   pass       forward unchanged (streaming, so the Coordinator SSE works)
//   slow       4 s delay, then forward                     -> skeletons
//   fail       HTTP 500 with the API error envelope        -> error states
//   fail-html  HTTP 502 with a short HTML body, no JSON    -> what a real outage looks like
//   offline    destroy the socket                          -> offline banner, cached data
//   expired    HTTP 401 with the envelope                  -> session expired handling
//   update     HTTP 426 code update_required               -> update overlay
//   hang       accept and never answer                     -> the 20 s client timeout
// Every failure mode leaves /api/mobile/v1/auth/* alone so the app can still boot.
//
// Rules (plan C8): binds to 127.0.0.1 only; sends Host app.guest-ly.com and
// the matching TLS server name; never adds or forwards x-forwarded-for; while
// a failure mode is on, any path outside /api/mobile/v1/ is refused; logs
// method, path, status and mode to the console only, never headers, never
// bodies, never to disk. Works only with the sim-dev binary.

import http from "node:http";
import https from "node:https";

const PORT = Number(process.env.GL_PROXY_PORT ?? 8787);
const UPSTREAM_HOST = "app.guest-ly.com";
const MODES = ["pass", "slow", "fail", "fail-html", "offline", "expired", "update", "hang"];
const API_PREFIX = "/api/mobile/v1/";
const AUTH_PREFIX = "/api/mobile/v1/auth/";

let mode = "pass";
let hits = 0;
const agent = new https.Agent({ keepAlive: true });

const envelope = (code, en, es) => JSON.stringify({ ok: false, error: { code, message_en: en, message_es: es } });

function log(req, status) {
  const p = (req.url ?? "").split("?")[0];
  console.log(`${new Date().toISOString().slice(11, 19)} ${mode.padEnd(9)} ${String(status).padEnd(7)} ${req.method} ${p}`);
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}

function forward(req, res) {
  const headers = { ...req.headers, host: UPSTREAM_HOST };
  delete headers["x-forwarded-for"];
  delete headers["x-forwarded-host"];
  delete headers["x-forwarded-proto"];
  delete headers.forwarded;
  const up = https.request({ host: UPSTREAM_HOST, servername: UPSTREAM_HOST, port: 443, method: req.method, path: req.url, headers, agent }, (upRes) => {
    res.writeHead(upRes.statusCode ?? 502, upRes.headers);
    upRes.pipe(res); // streaming keeps SSE alive
    log(req, upRes.statusCode ?? 502);
  });
  up.on("error", () => {
    if (!res.headersSent) json(res, 502, envelope("upstream_unreachable", "The service is not reachable.", "El servicio no está disponible."));
    else res.destroy();
    log(req, "up-err");
  });
  req.pipe(up);
}

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";
  if (url.startsWith("/__part9/mode")) {
    const set = new URL(url, "http://x").searchParams.get("set");
    if (set) {
      if (!MODES.includes(set)) return json(res, 400, JSON.stringify({ ok: false, modes: MODES }));
      mode = set;
      hits = 0;
      console.log(`mode is now ${mode}`);
    }
    return json(res, 200, JSON.stringify({ ok: true, mode, hits, modes: MODES }));
  }

  hits += 1;
  const isApi = url.startsWith(API_PREFIX);
  const isAuth = url.startsWith(AUTH_PREFIX);

  if (mode !== "pass" && mode !== "slow" && !isApi) {
    log(req, "refused");
    return json(res, 403, envelope("part9_fence", "Refused by the Part 9 proxy.", "Rechazado por el proxy de Part 9."));
  }
  if (mode === "pass" || isAuth) return forward(req, res);
  if (mode === "slow") return void setTimeout(() => forward(req, res), 4000);

  // Failure modes never reach production. Drain the request body first.
  req.resume();
  if (mode === "fail") {
    log(req, 500);
    return json(res, 500, envelope("server_error", "Something went wrong. Please try again.", "Algo salió mal. Inténtelo de nuevo."));
  }
  if (mode === "fail-html") {
    log(req, 502);
    res.writeHead(502, { "content-type": "text/html; charset=utf-8" });
    return res.end("<!doctype html><html><head><title>502 Bad Gateway</title></head><body><h1>502 Bad Gateway</h1><p>The upstream server returned an invalid response.</p></body></html>");
  }
  if (mode === "expired") {
    log(req, 401);
    return json(res, 401, envelope("unauthorized", "Your session has ended. Please sign in again.", "Su sesión terminó. Inicie sesión de nuevo."));
  }
  if (mode === "update") {
    log(req, 426);
    return json(res, 426, envelope("update_required", "Please update Guest-ly to continue.", "Actualice Guest-ly para continuar."));
  }
  if (mode === "offline") {
    log(req, "destroy");
    return req.socket.destroy();
  }
  if (mode === "hang") {
    log(req, "hang");
    return; // never answers; the client gives up after 20 s
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`part9 proxy on http://127.0.0.1:${PORT} -> https://${UPSTREAM_HOST} (mode ${mode}). Modes: ${MODES.join(", ")}`);
});

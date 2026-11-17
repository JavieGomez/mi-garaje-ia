// Control mínimo de Edge/Chrome sin ventana mediante el protocolo DevTools (sin dependencias).
// Requiere Node 22+ (WebSocket global).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CANDIDATOS = [
  process.env.NAVEGADOR,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);

export const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export async function abrirNavegador({ puerto = 9335 } = {}) {
  const ruta = CANDIDATOS.find((p) => fs.existsSync(p));
  if (!ruta) throw new Error('No encuentro Edge ni Chrome. Indica la ruta con la variable NAVEGADOR.');
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-garaje-ia-'));
  const proc = spawn(ruta, ['--headless=new', `--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
  let ws;
  for (let i = 0; ; i++) {
    try {
      const pag = (await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json()).find((t) => t.type === 'page');
      if (pag) { ws = new WebSocket(pag.webSocketDebuggerUrl); break; }
    } catch { /* aún arrancando */ }
    if (i > 60) throw new Error('El navegador no arranca');
    await espera(300);
  }
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pendientes = new Map();
  const oyentes = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); } else oyentes.forEach((f) => f(m));
  });
  const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; pendientes.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); })
    .then((m) => { if (m.error) throw new Error(method + ': ' + m.error.message); return m.result; });
  const js = async (expr) => {
    const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || expr);
    return r.result.value;
  };
  const cerrar = async () => {
    try { ws.close(); } catch { /* nada */ }
    proc.kill();
    await espera(500);
    try { fs.rmSync(perfil, { recursive: true, force: true }); } catch { /* Windows puede tenerlo bloqueado */ }
  };
  return { cdp, js, cerrar, oyentes, perfil };
}

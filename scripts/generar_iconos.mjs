// Genera los PNG del icono a partir de los SVG (Edge/Chrome sin ventana). Uso: node scripts/generar_iconos.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { abrirNavegador, espera } from '../pruebas/navegador/cdp.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRABAJOS = [
  ['icono.svg', 192, 'icono-192.png'],
  ['icono.svg', 512, 'icono-512.png'],
  ['icono.svg', 180, 'apple-touch-icon.png'],
  ['icono-maskable.svg', 512, 'icono-maskable-512.png']
];

const nav = await abrirNavegador({ puerto: 9336 });
const { cdp } = nav;
await cdp('Page.enable');
await cdp('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
for (const [svg, lado, png] of TRABAJOS) {
  const contenido = fs.readFileSync(path.join(RAIZ, 'iconos', svg), 'utf8');
  const html = `<!doctype html><html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(contenido).toString('base64')}" width="${lado}" height="${lado}" style="display:block"></body></html>`;
  await cdp('Emulation.setDeviceMetricsOverride', { width: lado, height: lado, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(html).toString('base64') });
  await espera(500);
  const { data } = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: lado, height: lado, scale: 1 } });
  fs.writeFileSync(path.join(RAIZ, 'iconos', png), Buffer.from(data, 'base64'));
  console.log('✔', png, lado + 'px');
}
await nav.cerrar();
void pathToFileURL;

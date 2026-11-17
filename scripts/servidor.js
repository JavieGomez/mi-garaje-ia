/*
 * Servidor local mínimo para probar Mi Garaje IA (sin dependencias).
 * Uso:  node scripts/servidor.js [--puerto 8080] [--base /MI_GARAJE_IA/] [--abrir]
 *   --base   sirve la app bajo una subruta, igual que GitHub Pages (usuario.github.io/repositorio/).
 *   --abrir  abre el navegador predeterminado.
 * Solo escucha en 127.0.0.1 (no es accesible desde otros equipos).
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { exec } = require('node:child_process');

const RAIZ = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opcion = (n, def) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const PUERTO = Number(opcion('--puerto', process.env.PORT || 8080));
let BASE = opcion('--base', '/');
if (!BASE.startsWith('/')) BASE = '/' + BASE;
if (!BASE.endsWith('/')) BASE += '/';

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8'
};

const servidor = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end('Petición no válida'); }
  if (url === '/' && BASE !== '/') { res.writeHead(302, { Location: BASE }); return res.end(); }
  if (!url.startsWith(BASE)) { res.writeHead(404); return res.end('No encontrado'); }
  let rel = url.slice(BASE.length) || 'index.html';
  if (rel.endsWith('/')) rel += 'index.html';
  const archivo = path.resolve(RAIZ, rel);
  if (!archivo.startsWith(RAIZ + path.sep) || /[\\/](node_modules|\.git)[\\/]/.test(archivo)) { res.writeHead(403); return res.end('Prohibido'); }
  fs.readFile(archivo, (err, contenido) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(contenido);
  });
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  const direccion = `http://localhost:${PUERTO}${BASE}`;
  console.log(`Mi Garaje IA disponible en ${direccion}`);
  console.log('Pulsa Ctrl+C para detener el servidor.');
  if (args.includes('--abrir')) {
    const cmd = process.platform === 'win32' ? `start "" "${direccion}"` : process.platform === 'darwin' ? `open "${direccion}"` : `xdg-open "${direccion}"`;
    exec(cmd);
  }
});
servidor.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `El puerto ${PUERTO} está ocupado. Prueba: node scripts/servidor.js --puerto 8090` : e.message);
  process.exit(1);
});

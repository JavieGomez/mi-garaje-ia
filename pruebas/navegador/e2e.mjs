// Prueba de extremo a extremo de Mi Garaje IA en un navegador real (Edge/Chrome sin ventana).
// Usa la app como una persona: clics de ratón, escritura de teclado, recarga, descarga e importación de archivos.
// La app se sirve bajo /MI_GARAJE_IA/ para simular GitHub Pages (subruta del repositorio).
// Uso: node pruebas/navegador/e2e.mjs      (resultado en pruebas/resultados/e2e.txt y capturas en capturas/)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegador, espera } from './cdp.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CAPTURAS = path.join(RAIZ, 'capturas');
const RESULTADOS = path.join(RAIZ, 'pruebas', 'resultados');
fs.mkdirSync(CAPTURAS, { recursive: true });
fs.mkdirSync(RESULTADOS, { recursive: true });
const DESCARGAS = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-garaje-descargas-'));
const PUERTO = 8093;
const URL_APP = `http://localhost:${PUERTO}/MI_GARAJE_IA/`;

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const HOY = iso(new Date());
const HACE_30 = iso(new Date(Date.now() - 30 * 86400000));

/* ---------- Servidor ---------- */
const servidor = spawn(process.execPath, [path.join(RAIZ, 'scripts', 'servidor.js'), '--puerto', String(PUERTO), '--base', '/MI_GARAJE_IA/'], { stdio: 'pipe' });
await new Promise((r) => servidor.stdout.once('data', r));

/* ---------- Navegador ---------- */
const nav = await abrirNavegador({ puerto: 9341 });
const { cdp, js } = nav;
const erroresConsola = [];
let selectorArchivo = null;
nav.oyentes.push((m) => {
  if (m.method === 'Runtime.exceptionThrown') erroresConsola.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') erroresConsola.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon/.test(m.params.entry.url || '')) erroresConsola.push('[log] ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
  if (m.method === 'Page.fileChooserOpened') selectorArchivo = m.params.backendNodeId;
});
await cdp('Page.enable');
await cdp('Runtime.enable');
await cdp('Log.enable');
await cdp('Page.setInterceptFileChooserDialog', { enabled: true });
try { await cdp('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DESCARGAS, eventsEnabled: true }); }
catch { await cdp('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DESCARGAS }); }

const MOVIL = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true };
const ESCRITORIO = { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false };
const pantalla = (p) => cdp('Emulation.setDeviceMetricsOverride', p);
await pantalla(MOVIL);

/* ---------- Utilidades ---------- */
const resultados = [];
let fallos = 0;
function comprobar(nombre, ok, detalle = '') {
  resultados.push(`${ok ? '✔' : '✖'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
  if (!ok) fallos++;
  console.log(resultados[resultados.length - 1]);
}
async function esperarA(expr, ms = 4000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if (await js(`!!(${expr})`)) return true; await espera(80); }
  return false;
}
async function cargar(url = URL_APP) {
  await cdp('Page.navigate', { url });
  await esperarA(`document.readyState === 'complete' && document.querySelector('#vista').children.length > 0`, 8000);
  await espera(300);
}
async function clic(selector) {
  const r = await js(`(() => { const e = ${JSON.stringify(selector)}.startsWith('//') ? document.evaluate(${JSON.stringify(selector)}, document, null, 9, null).singleNodeValue : document.querySelector(${JSON.stringify(selector)});
    if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
  if (!r) throw new Error('No encuentro ' + selector);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await cdp('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await espera(220);
}
const xBoton = (texto) => `//button[contains(normalize-space(.), ${JSON.stringify(texto)})]`;
async function escribir(selector, texto) {
  await js(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); e.focus(); e.select && e.select(); })()`);
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
  if (texto) await cdp('Input.insertText', { text: texto });
  await espera(60);
}
async function ponerFecha(selector, valor) {
  await js(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); e.value = ${JSON.stringify(valor)}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
}
async function tecla(key, code, vk) {
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk });
  await espera(250);
}
const texto = (selector) => js(`(document.querySelector(${JSON.stringify(selector)}) || {}).textContent || ''`);
const limpio = (s) => String(s).replace(/\s+/g, ' ').trim();
const totalHero = async () => limpio(await texto('.hero-importe'));
async function captura(nombre, completa = false) {
  await espera(450);
  let params = { format: 'png' };
  if (completa) {
    // En la captura de página entera, la barra fija y los avisos aparecerían en medio: se ocultan solo para la foto.
    await js(`(() => { const s = document.createElement('style'); s.id = 'estilo-captura'; s.textContent = '.nav, #avisos { display: none !important; }'; document.head.appendChild(s); })()`);
    const alto = await js('Math.ceil(document.documentElement.scrollHeight)');
    params = { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: await js('innerWidth'), height: alto, scale: 1 } };
  }
  const { data } = await cdp('Page.captureScreenshot', params);
  fs.writeFileSync(path.join(CAPTURAS, nombre + '.png'), Buffer.from(data, 'base64'));
  await js(`(document.getElementById('estilo-captura') || { remove() {} }).remove()`);
}
async function textoEstable(selector) {
  let previo = null;
  for (let i = 0; i < 30; i++) { const t = limpio(await texto(selector)); if (t === previo) return t; previo = t; await espera(120); }
  return previo;
}
async function sinDesbordeHorizontal(vista) {
  const r = await js(`({ sw: document.documentElement.scrollWidth, w: innerWidth })`);
  comprobar(`Móvil: sin desplazamiento horizontal en «${vista}»`, r.sw <= r.w, `${r.sw}px de contenido en ${r.w}px`);
}
async function abrirGasto() { await clic('.fab'); await esperarA(`document.querySelector('#form-gasto')`); }
async function guardarFormulario(id) { await clic(`#${id} button[type=submit]`); await espera(350); }
const hojaAbierta = () => js(`!document.querySelector('#capa-hoja').hidden`);
const errorDe = (campo) => texto(`#e-${campo}`);
async function confirmarDialogo() { await esperarA(`document.querySelector('#capa-dialogo .dialogo')`); await clic('#capa-dialogo [data-r="1"]'); await espera(300); }
async function elegirArchivo(ruta, boton) {
  selectorArchivo = null;
  await clic(boton);
  const fin = Date.now() + 4000;
  while (!selectorArchivo && Date.now() < fin) await espera(50);
  if (selectorArchivo) {
    await cdp('DOM.setFileInputFiles', { files: [ruta], backendNodeId: selectorArchivo });
  } else {
    // Algunas versiones sin ventana no emiten el evento del selector: se asigna el archivo al mismo <input> que abre el botón.
    const { root } = await cdp('DOM.getDocument');
    const { nodeId } = await cdp('DOM.querySelector', { nodeId: root.nodeId, selector: '#archivo-importar' });
    await cdp('DOM.setFileInputFiles', { files: [ruta], nodeId });
  }
  await espera(400);
}
function esperarDescarga(patron, ms = 6000) {
  const fin = Date.now() + ms;
  return (async () => {
    while (Date.now() < fin) {
      const f = fs.readdirSync(DESCARGAS).find((n) => patron.test(n) && !n.endsWith('.crdownload'));
      if (f) { await espera(200); return path.join(DESCARGAS, f); }
      await espera(100);
    }
    return null;
  })();
}

try {
  /* ===== 1. Primera visita ===== */
  await cargar();
  comprobar('Bienvenida visible en la primera visita', (await texto('.bienvenida')).includes('Registrar mi coche'));
  comprobar('La bienvenida ofrece datos de demostración', (await texto('.bienvenida')).includes('datos de demostración'));
  comprobar('Ruta de subcarpeta (GitHub Pages): CSS cargado', await js(`getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)'`));
  await captura('01-bienvenida-movil');
  await sinDesbordeHorizontal('bienvenida');

  /* ===== 2. Crear vehículo (con validaciones) ===== */
  await clic(xBoton('Registrar mi coche'));
  comprobar('Se abre el formulario de vehículo', await esperarA(`document.querySelector('#form-vehiculo')`));
  await guardarFormulario('form-vehiculo');
  comprobar('Campos vacíos: error en marca', (await errorDe('marca')).includes('marca'));
  comprobar('Campos vacíos: error en modelo', (await errorDe('modelo')).includes('modelo'));
  comprobar('Campos vacíos: error en kilometraje inicial', (await errorDe('kmInicial')).length > 0);
  await escribir('#f-marca', 'Toyota');
  await escribir('#f-modelo', 'Corolla Hybrid');
  await escribir('#f-anio', '2020');
  await escribir('#f-kmInicial', '50.000');
  await ponerFecha('#f-fechaKmInicial', HACE_30);
  await escribir('#f-kmActual', '49000');
  await guardarFormulario('form-vehiculo');
  comprobar('Km inconsistentes: actual menor que el inicial se rechaza', (await errorDe('kmActual')).includes('No puede ser menor'));
  await escribir('#f-kmActual', '51.000');
  await guardarFormulario('form-vehiculo');
  comprobar('Se puede crear un vehículo', await esperarA(`document.querySelector('#btn-vehiculo') && document.querySelector('#btn-vehiculo').textContent.includes('Toyota')`));
  comprobar('Panel vacío invita a añadir el primer gasto', (await texto('#vista')).includes('Añadir mi primer gasto'));
  await captura('02-coche-sin-gastos-movil');

  /* ===== 3. Añadir gastos (con validaciones) ===== */
  await abrirGasto();
  await captura('03-formulario-gasto-movil');
  await escribir('#f-importe', '-20');
  await guardarFormulario('form-gasto');
  comprobar('Importe negativo rechazado', (await errorDe('importe')).includes('negativo'));
  await escribir('#f-importe', '');
  await guardarFormulario('form-gasto');
  comprobar('Importe vacío rechazado', (await errorDe('importe')).includes('Indica'));
  await escribir('#f-importe', 'abc');
  await guardarFormulario('form-gasto');
  comprobar('Importe con texto rechazado', (await errorDe('importe')).includes('no válido'));
  await escribir('#f-importe', '45,90');
  await ponerFecha('#f-fecha', '');
  await guardarFormulario('form-gasto');
  comprobar('Fecha vacía rechazada', (await errorDe('fecha')).includes('Indica'));
  await ponerFecha('#f-fecha', '2099-01-01');
  await guardarFormulario('form-gasto');
  comprobar('Fecha futura rechazada', (await errorDe('fecha')).includes('posterior a hoy'));
  await ponerFecha('#f-fecha', HOY);
  await escribir('#f-km', '49.500');
  await guardarFormulario('form-gasto');
  comprobar('Kilometraje incoherente en un gasto rechazado', (await errorDe('km')).includes('ya tenías'), await errorDe('km'));
  comprobar('Con errores, el formulario sigue abierto y no guarda', await hojaAbierta() && (await js(`MiGaraje.estado().datos.gastos.length`)) === 0);
  await escribir('#f-km', '51.000');
  await escribir('#f-descripcion', 'Repostaje gasolinera');
  await guardarFormulario('form-gasto');
  comprobar('Se puede añadir un gasto', !(await hojaAbierta()) && (await js(`MiGaraje.estado().datos.gastos.length`)) === 1);
  comprobar('Total tras el primer gasto = 45,90 €', (await totalHero()).includes('45,90'), await totalHero());

  await abrirGasto();
  await clic('input[name=categoria][value=seguro] + .chip-cat-cuerpo');
  await escribir('#f-importe', '300');
  await escribir('#f-descripcion', 'Seguro anual');
  await guardarFormulario('form-gasto');
  await esperarA(`document.querySelector('.hero-importe').textContent.includes('345,90')`, 2500);
  comprobar('Suma de importes: 45,90 + 300 = 345,90 €', (await totalHero()).includes('345,90'), await totalHero());

  await abrirGasto();
  await clic('input[name=categoria][value=gasolina] + .chip-cat-cuerpo');
  await escribir('#f-litros', '30');
  await escribir('#f-precioLitro', '1,5');
  comprobar('Combustible: litros × precio rellena el importe (45,00)', (await js(`document.querySelector('#f-importe').value`)) === '45,00');
  await guardarFormulario('form-gasto');
  await esperarA(`document.querySelector('.hero-importe').textContent.includes('390,90')`, 2500);
  comprobar('Total con tres gastos = 390,90 €', (await totalHero()).includes('390,90'), await totalHero());
  comprobar('Número de movimientos = 3', (await texto('.hero-pie')).includes('3 movimientos'));

  /* ===== 4. Coste por km ===== */
  await clic('[data-accion="periodo-tipo"][data-tipo="total"]');
  await esperarA(`document.querySelector('.kpi-km .kpi-valor')`);
  const ckm = await textoEstable('.kpi-km .kpi-valor');
  comprobar('Coste por km correcto: 390,90 € / 1.000 km = 0,39 €/km', ckm.includes('0,39'), ckm);
  await clic('.kpi-km');
  const detalle = limpio(await texto('.coste-km'));
  comprobar('Detalle del cálculo muestra gastos, km y resultado', detalle.includes('390,90') && detalle.includes('1.000 km') && detalle.includes('0,39'), detalle.slice(0, 120));
  comprobar('El detalle aclara que el precio de compra no se suma', detalle.includes('precio de compra no se suma'));
  await tecla('Escape', 'Escape', 27);
  comprobar('Tecla Escape cierra la hoja', !(await hojaAbierta()));

  /* ===== 5. Editar y eliminar ===== */
  await clic(xBoton('Seguro anual'));
  await esperarA(`document.querySelector('#form-gasto')`);
  await escribir('#f-importe', '200');
  await guardarFormulario('form-gasto');
  await esperarA(`document.querySelector('.hero-importe').textContent.includes('290,90')`, 2500);
  comprobar('Editar un gasto actualiza el total (290,90 €)', (await totalHero()).includes('290,90'), await totalHero());
  const ckm2 = await textoEstable('.kpi-km .kpi-valor');
  comprobar('Editar un gasto actualiza el €/km (0,29)', ckm2.includes('0,29'), ckm2);
  await clic(`//button[contains(@class,'mov') and contains(normalize-space(.), '45,00')]`);
  await esperarA(`document.querySelector('#form-gasto')`);
  await clic('[data-accion="borrar-gasto"]');
  comprobar('Eliminar pide confirmación', await esperarA(`document.querySelector('#capa-dialogo .dialogo')`));
  await clic('#capa-dialogo [data-r="0"]');
  await espera(300);
  comprobar('Cancelar la confirmación no borra nada', (await js(`MiGaraje.estado().datos.gastos.length`)) === 3);
  await clic('[data-accion="borrar-gasto"]');
  await confirmarDialogo();
  await esperarA(`document.querySelector('.hero-importe').textContent.includes('245,90')`, 2500);
  comprobar('Eliminar un gasto actualiza el total (245,90 €)', (await totalHero()).includes('245,90'), await totalHero());
  comprobar('Eliminar ofrece «Deshacer»', (await texto('#avisos')).includes('Deshacer'));

  /* ===== 6. Filtros, búsqueda y orden ===== */
  await cargar(URL_APP + '#movimientos');
  const nRes = async () => js(`document.querySelectorAll('#resultados .mov').length`);
  comprobar('Lista de movimientos muestra 2 gastos', (await nRes()) === 2);
  await escribir('#f-texto', 'seguro');
  await espera(200);
  comprobar('Búsqueda por texto («seguro») → 1 resultado', (await nRes()) === 1);
  await escribir('#f-texto', '45,90');
  await espera(200);
  comprobar('Búsqueda por importe («45,90») → 1 resultado', (await nRes()) === 1);
  await escribir('#f-texto', '');
  await clic('[data-accion="filtro-cat"][data-cat="gasolina"]');
  comprobar('Filtro por categoría (Gasolina) → 1 resultado', (await nRes()) === 1);
  await clic('[data-accion="filtro-cat"][data-cat=""]');
  await clic('[data-accion="toggle-filtros"]');
  await js(`(() => { const s = document.querySelector('#f-orden'); s.value = 'importe-asc'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await espera(150);
  const primero = limpio(await texto('#resultados .mov .mov-importe'));
  comprobar('Orden por importe ascendente (primero 45,90 €)', primero.includes('45,90'), primero);
  await ponerFecha('#f-desde', iso(new Date(Date.now() + 86400000)));
  await espera(150);
  comprobar('Filtro por fecha sin coincidencias → 0 resultados y mensaje', (await nRes()) === 0 && (await texto('#resultados')).includes('Nada coincide'));
  await clic(xBoton('Quitar filtros'));
  comprobar('Quitar filtros recupera la lista', (await nRes()) === 2);
  await sinDesbordeHorizontal('gastos');

  /* ===== 7. Gráficos con datos reales ===== */
  await cargar(URL_APP + '#estadisticas');
  const segs = await js(`Array.from(document.querySelectorAll('.dona-seg')).map(s => s.getAttribute('data-tip'))`);
  comprobar('Gráfico circular: un sector por categoría con gasto (2)', segs.length === 2, segs.join(' | ').replace(/\n/g, ' '));
  comprobar('Gráfico circular: importes reales (200,00 € y 45,90 €)', segs.some((s) => s.includes('200,00')) && segs.some((s) => s.includes('45,90')));
  const barra = await js(`Array.from(document.querySelectorAll('.barra-hit')).map(b => b.getAttribute('aria-label')).filter(l => !/[  ]0,00[  ]€$/.test(l))`);
  comprobar('Gráfico de barras: el mes actual suma 245,90 €', barra.length === 1 && barra[0].includes('245,90'), barra.join(' | '));
  comprobar('Gráfico acumulado dibujado con el total', (await js(`document.querySelector('.grafico-linea').getAttribute('aria-label')`)).includes('245,90'));
  await sinDesbordeHorizontal('estadísticas');

  /* ===== 8. Persistencia ===== */
  await cargar(URL_APP + '#inicio');
  comprobar('Los datos permanecen tras recargar', (await totalHero()).includes('245,90'), await totalHero());

  /* ===== 9. Segundo vehículo sin km suficientes (no divide entre cero) ===== */
  await clic('#btn-vehiculo');
  await clic(xBoton('Añadir vehículo'));
  await esperarA(`document.querySelector('#form-vehiculo')`);
  await escribir('#f-marca', 'Kia');
  await escribir('#f-modelo', 'Picanto');
  await escribir('#f-kmInicial', '10000');
  await guardarFormulario('form-vehiculo');
  await esperarA(`document.querySelector('#btn-vehiculo').textContent.includes('Kia')`);
  await abrirGasto();
  await escribir('#f-importe', '20');
  await guardarFormulario('form-gasto');
  await espera(300);
  const kpiKia = await textoEstable('.kpi-km');
  comprobar('Sin km recorridos: no se calcula €/km y se explica', kpiKia.includes('—') && /kilometraje|kilómetros/i.test(kpiKia), kpiKia);
  comprobar('Ningún NaN ni Infinity en pantalla', !/NaN|Infinity/.test(await texto('body')));
  comprobar('Gastos por vehículo separados (Kia: 20,00 €)', (await totalHero()).includes('20,00'));

  /* ===== 10. Exportar e importar ===== */
  await cargar(URL_APP + '#ajustes');
  await clic(xBoton('Exportar copia (JSON)'));
  const rutaJSON = await esperarDescarga(/^mi-garaje-ia-copia-.*\.json$/);
  comprobar('Exportar JSON descarga un archivo', !!rutaJSON);
  const copia = rutaJSON ? JSON.parse(fs.readFileSync(rutaJSON, 'utf8')) : null;
  comprobar('El JSON exportado contiene 2 vehículos y 3 gastos', copia && copia.datos.vehiculos.length === 2 && copia.datos.gastos.length === 3);
  await clic(xBoton('Exportar movimientos (CSV)'));
  const rutaCSV = await esperarDescarga(/^mi-garaje-ia-movimientos-.*\.csv$/);
  const csv = rutaCSV ? fs.readFileSync(rutaCSV, 'utf8') : '';
  comprobar('Exportar CSV: cabecera + 3 filas, separador «;»', csv.split('\r\n').length === 4 && csv.includes('Fecha;Vehículo') && csv.includes(';200,00;'));

  const malo = path.join(DESCARGAS, 'roto.json');
  fs.writeFileSync(malo, '{ esto no es json');
  await elegirArchivo(malo, xBoton('Importar copia (JSON)'));
  comprobar('Importar un archivo inválido muestra error', (await texto('.hoja')).includes('No se ha podido importar'));
  comprobar('Importación inválida no toca los datos', (await js(`MiGaraje.estado().datos.gastos.length`)) === 3);
  await tecla('Escape', 'Escape', 27);
  const ajeno = path.join(DESCARGAS, 'ajeno.json');
  fs.writeFileSync(ajeno, JSON.stringify({ app: 'otra-app', datos: {} }));
  await elegirArchivo(ajeno, xBoton('Importar copia (JSON)'));
  comprobar('Importar JSON de otra app se rechaza con explicación', (await texto('.hoja')).includes('no es una copia de Mi Garaje IA'));
  await tecla('Escape', 'Escape', 27);

  await clic(xBoton('Borrar todos mis datos'));
  await confirmarDialogo();
  comprobar('Borrar datos (con confirmación) vuelve a la bienvenida', await esperarA(`document.querySelector('.bienvenida')`));
  comprobar('Tras borrar, el almacenamiento real queda vacío', await js(`localStorage.getItem('miGarajeIA.datos.v1') === null`));
  await elegirArchivo(rutaJSON, xBoton('Impórtala'));
  await confirmarDialogo();
  await esperarA(`document.querySelector('.hero-importe')`);
  comprobar('Importar la copia restaura los datos', (await js(`MiGaraje.estado().datos.gastos.length`)) === 3);
  await clic('#btn-vehiculo');
  await clic(`//button[contains(@class,'opcion-veh') and contains(normalize-space(.), 'Toyota')]`);
  await espera(300);
  comprobar('Tras importar, el Toyota vuelve a sumar 245,90 €', (await totalHero()).includes('245,90'), await totalHero());

  /* ===== 11. Modo demostración separado ===== */
  const realAntes = await js(`localStorage.getItem('miGarajeIA.datos.v1')`);
  await cargar(URL_APP + '#ajustes');
  await clic(xBoton('Ver la demostración'));
  await esperarA(`!document.querySelector('#banner-demo').hidden`);
  comprobar('Modo demo identificado con un banner', (await texto('#banner-demo')).includes('MODO DEMO'));
  comprobar('La demo tiene datos del mes actual', (await js(`MiGaraje.estado().datos.gastos.filter(g => g.fecha.slice(0,7) === '${HOY.slice(0, 7)}').length`)) > 0);
  await esperarA(`document.querySelector('.kpi-km .num')`);
  await captura('10-demo-inicio-movil');
  await captura('11-demo-inicio-movil-completo', true);
  await sinDesbordeHorizontal('inicio (demo)');
  await cargar(URL_APP + '#estadisticas');
  await captura('12-demo-estadisticas-movil-completo', true);
  await cargar(URL_APP + '#movimientos');
  await captura('13-demo-gastos-movil');
  await cargar(URL_APP + '#garaje');
  await captura('14-demo-garaje-movil-completo', true);
  await sinDesbordeHorizontal('garaje (demo)');
  await cargar(URL_APP + '#ajustes');
  await sinDesbordeHorizontal('ajustes (demo)');
  await cargar(URL_APP + '#inicio');
  await abrirGasto();
  await escribir('#f-importe', '52,40');
  await captura('15-demo-nuevo-gasto-movil');
  await tecla('Escape', 'Escape', 27);
  comprobar('Los datos reales no cambian al usar la demo', (await js(`localStorage.getItem('miGarajeIA.datos.v1')`)) === realAntes);
  await clic('[data-accion="tema"]');
  comprobar('Cambio a tema claro', (await js(`document.documentElement.getAttribute('data-tema')`)) === 'claro');
  await captura('16-demo-inicio-tema-claro-movil');
  await clic('[data-accion="tema"]');

  await pantalla(ESCRITORIO);
  await cargar(URL_APP + '#inicio');
  await captura('20-demo-inicio-escritorio');
  await cargar(URL_APP + '#estadisticas');
  await captura('21-demo-estadisticas-escritorio');
  await cargar(URL_APP + '#garaje');
  await captura('22-demo-garaje-escritorio');
  await pantalla(MOVIL);

  await cargar(URL_APP + '#inicio');
  await clic('#banner-demo [data-accion="salir-demo"]');
  await esperarA(`document.querySelector('#banner-demo').hidden`);
  comprobar('Salir de la demo devuelve los datos reales', (await js(`MiGaraje.estado().datos.gastos.length`)) === 3 && (await js(`MiGaraje.estado().modo`)) === 'real');

  /* ===== 12. PWA ===== */
  const sw = await js(`navigator.serviceWorker.getRegistration().then(r => !!r)`);
  comprobar('Service worker registrado (instalable y sin conexión)', sw);
  const manifiesto = await js(`fetch('manifest.webmanifest').then(r => r.json()).then(m => m.name + ' · ' + m.icons.length + ' iconos')`);
  comprobar('Manifiesto PWA accesible con rutas relativas', manifiesto.startsWith('Mi Garaje IA'), manifiesto);

  /* ===== 13. Consola ===== */
  comprobar('Sin errores en la consola', erroresConsola.length === 0, erroresConsola.slice(0, 5).join(' | '));
} catch (e) {
  comprobar('La prueba se ha ejecutado completa', false, e.message);
  await captura('error').catch(() => {});
} finally {
  const resumen = `Mi Garaje IA — prueba en navegador real (${new Date().toLocaleString('es-ES')})\nURL: ${URL_APP}\n\n${resultados.join('\n')}\n\n${resultados.length - fallos} de ${resultados.length} comprobaciones superadas.\n`;
  fs.writeFileSync(path.join(RESULTADOS, 'e2e.txt'), resumen);
  console.log(`\n${resultados.length - fallos}/${resultados.length} comprobaciones superadas`);
  await nav.cerrar();
  servidor.kill();
  try { fs.rmSync(DESCARGAS, { recursive: true, force: true }); } catch { /* nada */ }
  process.exit(fallos ? 1 : 0);
}

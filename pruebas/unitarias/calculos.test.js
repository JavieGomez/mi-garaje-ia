// Pruebas del motor de cálculo. Ejecutar: node --test pruebas/unitarias/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../js/calculos.js');
const Demo = require('../../js/demo.js');

const HOY = '2026-11-16';
const CATS = C.CATEGORIAS_BASE.map((c) => c.id);
let n = 0;
const g = (fecha, euros, categoria = 'gasolina', extra = {}) => ({ id: 'g' + (++n), vehiculoId: 'v1', fecha, importe: Math.round(euros * 100), categoria, descripcion: '', notas: '', km: null, ...extra });
const veh = (lecturas, extra = {}) => ({ id: 'v1', marca: 'Test', modelo: 'Coche', lecturas, ...extra });

test('Formato español de euros, km y fechas', () => {
  assert.equal(C.formatoEuros(155000).replace(/\s/g, ' '), '1.550,00 €');
  assert.equal(C.formatoEuros(4590).replace(/\s/g, ' '), '45,90 €');
  assert.equal(C.formatoKm(5000), '5.000 km');
  assert.equal(C.formatoEurKm(0.31), '0,31 €/km');
  assert.equal(C.formatoFecha('2026-03-07'), '07/03/2026');
  assert.equal(C.nombreMes('2026-11'), 'noviembre 2026');
});

test('Lectura de números escritos a la española', () => {
  assert.equal(C.parseNumeroES('45,90', true), 45.9);
  assert.equal(C.parseNumeroES('1.234,56', true), 1234.56);
  assert.equal(C.parseNumeroES('1.500', true), 1500);
  assert.equal(C.parseNumeroES('1.659', false), 1.659);
  assert.equal(C.parseNumeroES('12.5', true), 12.5);
  assert.equal(C.parseNumeroES(' 30 € ', true), 30);
  assert.ok(Number.isNaN(C.parseNumeroES('abc', true)));
  assert.ok(Number.isNaN(C.parseNumeroES('', true)));
  assert.ok(Number.isNaN(C.parseNumeroES('1,2,3', true)));
  assert.equal(C.aCentimos(0.1 + 0.2), 30);
  assert.equal(C.aCentimos(1.005), 101);
});

test('Ejemplo del enunciado: 1.550 € / 5.000 km = 0,31 €/km', () => {
  const v = veh([{ fecha: '2026-01-01', km: 10000 }, { fecha: '2026-12-31', km: 15000 }]);
  const gastos = [g('2026-02-01', 800), g('2026-03-01', 500, 'seguro'), g('2026-04-01', 200, 'reparaciones'), g('2026-05-01', 50, 'itv')];
  const r = C.costePorKm(gastos, C.lecturasVehiculo(v, gastos), null, null);
  assert.equal(r.coste, 155000);
  assert.equal(r.km, 5000);
  assert.equal(r.eurKm, 0.31);
  assert.equal(r.estado, 'ok');
});

test('Las sumas son exactas (sin errores de coma flotante)', () => {
  const gastos = [g('2026-01-01', 0.1), g('2026-01-02', 0.2), g('2026-01-03', 19.99), g('2026-01-04', 45.9)];
  assert.equal(C.suma(gastos), 6619);
  assert.equal(C.formatoEuros(C.suma(gastos)).replace(/\s/g, ' '), '66,19 €');
});

test('No divide entre cero ni con una sola lectura', () => {
  const v1 = veh([{ fecha: '2026-01-01', km: 1000 }]);
  const gs = [g('2026-01-05', 50)];
  const r1 = C.costePorKm(gs, C.lecturasVehiculo(v1, gs), null, null);
  assert.equal(r1.estado, 'sin-km'); assert.equal(r1.eurKm, null);
  const v2 = veh([{ fecha: '2026-01-01', km: 1000 }, { fecha: '2026-02-01', km: 1000 }]);
  const r2 = C.costePorKm(gs, C.lecturasVehiculo(v2, gs), null, null);
  assert.equal(r2.estado, 'km-cero'); assert.equal(r2.eurKm, null);
  const r3 = C.costePorKm([], C.lecturasVehiculo(v2, []), null, null);
  assert.ok(r3.eurKm === null);
});

test('Coste/km mensual usa los mismos días para gastos y km (interpolación)', () => {
  // 31 días de enero, 1 km/día exacto entre 31/12 y 31/01
  const v = veh([{ fecha: '2025-12-31', km: 1000 }, { fecha: '2026-01-31', km: 1031 }]);
  const gs = [g('2025-12-31', 999), g('2026-01-10', 31)];
  const r = C.costePorKm(gs, C.lecturasVehiculo(v, gs), '2026-01-01', '2026-01-31');
  assert.equal(r.km, 31);
  assert.equal(r.coste, 3100); // el gasto del 31/12 no cuenta en enero
  assert.equal(r.eurKm, 1);
  assert.equal(r.estado, 'ok');
  // Un mes a medias: lecturas solo hasta el 15/01
  const v2 = veh([{ fecha: '2025-12-31', km: 1000 }, { fecha: '2026-01-15', km: 1150 }]);
  const gs2 = [g('2026-01-10', 30), g('2026-01-20', 70)];
  const r2 = C.costePorKm(gs2, C.lecturasVehiculo(v2, gs2), '2026-01-01', '2026-01-31');
  assert.equal(r2.estado, 'parcial');
  assert.equal(r2.km, 150);
  assert.equal(r2.coste, 3000);
  assert.equal(r2.excluido, 7000);
  assert.ok(r2.avisos.some((a) => a.includes('70,00')));
  // Interpolación: a mitad de un tramo de 10 días con 100 km
  const pts = C.puntosDiarios(C.lecturasVehiculo(veh([{ fecha: '2026-01-01', km: 0 }, { fecha: '2026-01-11', km: 100 }]), []));
  assert.equal(C.kmEnDia(pts, C.diaNum('2026-01-06')), 50);
  assert.equal(C.kmEnDia(pts, C.diaNum('2026-02-01')), null);
});

test('Los gastos con kilometraje cuentan como lecturas', () => {
  const v = veh([{ fecha: '2026-01-01', km: 20000 }]);
  const gs = [g('2026-03-01', 60, 'gasolina', { km: 21000 })];
  const r = C.costePorKm(gs, C.lecturasVehiculo(v, gs), null, null);
  assert.equal(r.km, 1000);
  assert.equal(r.eurKm, 0.06);
  assert.deepEqual(C.kmActual(v, gs), { km: 21000, fecha: '2026-03-01' });
});

test('El precio de compra NO entra en el coste por km', () => {
  const v = veh([{ fecha: '2026-01-01', km: 0 }, { fecha: '2026-12-31', km: 10000 }], { precioCompra: 2000000, valorEstimado: 1500000, fechaAdquisicion: '2026-01-01' });
  const gs = [g('2026-06-01', 1000)];
  const r = C.resumenPeriodo(v, gs, C.CATEGORIAS_BASE, { tipo: 'total' }, '2026-12-31');
  assert.equal(r.coste.eurKm, 0.1);
  const d = C.depreciacion(v, '2026-12-31');
  assert.equal(d.perdida, 500000);
  assert.equal(d.fraccion, 0.25);
});

test('Kilometraje incoherente se detecta', () => {
  const v = veh([{ fecha: '2026-01-01', km: 10000 }, { fecha: '2026-06-01', km: 15000 }]);
  const ls = C.lecturasVehiculo(v, []);
  assert.match(C.comprobarKm(ls, '2026-03-01', 9000), /ya tenías 10\.000 km/);
  assert.match(C.comprobarKm(ls, '2026-03-01', 16000), /tenías 15\.000 km/);
  assert.equal(C.comprobarKm(ls, '2026-03-01', 12000), null);
  assert.equal(C.comprobarKm(ls, '2026-07-01', 15000), null);
  assert.ok(C.coherenciaLecturas(C.lecturasVehiculo(veh([{ fecha: '2026-01-01', km: 500 }, { fecha: '2026-02-01', km: 400 }]), [])));
});

test('Validación de gastos: negativos, vacíos, fechas inválidas, futuras, km incoherentes', () => {
  const ctx = { hoy: HOY, categorias: CATS, lecturas: C.lecturasVehiculo(veh([{ fecha: '2026-01-01', km: 10000 }]), []) };
  const base = { importe: '45,90', categoria: 'gasolina', fecha: '2026-11-01', descripcion: ' Repostaje ', km: '', notas: '' };
  const ok = C.validarGasto(base, ctx);
  assert.ok(ok.ok); assert.equal(ok.valor.importe, 4590); assert.equal(ok.valor.descripcion, 'Repostaje'); assert.equal(ok.valor.km, null);
  assert.match(C.validarGasto({ ...base, importe: '-20' }, ctx).errores.importe, /negativo/);
  assert.match(C.validarGasto({ ...base, importe: '' }, ctx).errores.importe, /Indica/);
  assert.match(C.validarGasto({ ...base, importe: '0' }, ctx).errores.importe, /mayor que 0/);
  assert.match(C.validarGasto({ ...base, importe: 'doce' }, ctx).errores.importe, /no válido/);
  assert.match(C.validarGasto({ ...base, importe: '2000000' }, ctx).errores.importe, /demasiado alto/);
  assert.match(C.validarGasto({ ...base, fecha: '2026-02-30' }, ctx).errores.fecha, /no válida/);
  assert.match(C.validarGasto({ ...base, fecha: '' }, ctx).errores.fecha, /Indica/);
  assert.match(C.validarGasto({ ...base, fecha: '2027-01-01' }, ctx).errores.fecha, /posterior a hoy/);
  assert.match(C.validarGasto({ ...base, categoria: 'inventada' }, ctx).errores.categoria, /categoría/);
  assert.match(C.validarGasto({ ...base, km: '-5' }, ctx).errores.km, /negativo/);
  assert.match(C.validarGasto({ ...base, km: '12,5' }, ctx).errores.km, /enteros/);
  assert.match(C.validarGasto({ ...base, km: '9000' }, ctx).errores.km, /ya tenías/);
  assert.ok(C.validarGasto({ ...base, km: '10.250' }, ctx).ok);
  assert.equal(C.validarGasto({ ...base, km: '10.250' }, ctx).valor.km, 10250);
});

test('Combustible: litros × precio calcula el importe', () => {
  const ctx = { hoy: HOY, categorias: CATS, lecturas: [] };
  const r = C.validarGasto({ importe: '', categoria: 'gasolina', fecha: HOY, litros: '40,5', precioLitro: '1,589' }, ctx);
  assert.ok(r.ok);
  assert.equal(r.valor.importe, 6435); // 40,5 × 1,589 = 64,3545 → 64,35 €
  assert.equal(r.valor.litros, 40.5);
  // Si se dan ambos, manda el cálculo aunque el importe escrito sea otro
  assert.equal(C.validarGasto({ importe: '10', categoria: 'gasolina', fecha: HOY, litros: '10', precioLitro: '1,5' }, ctx).valor.importe, 1500);
  // Con importe y litros, se deduce el precio por litro
  assert.equal(C.validarGasto({ importe: '60', categoria: 'gasolina', fecha: HOY, litros: '40' }, ctx).valor.precioLitro, 1.5);
  assert.match(C.validarGasto({ importe: '', categoria: 'gasolina', fecha: HOY, litros: '40', precioLitro: '1659' }, ctx).errores.precioLitro, /demasiado alto/);
  assert.ok(C.validarGasto({ importe: '', categoria: 'gasolina', fecha: HOY, litros: '-3', precioLitro: '1,5' }, ctx).errores.litros);
  // En otras categorías los litros se ignoran
  assert.equal(C.validarGasto({ importe: '30', categoria: 'peajes', fecha: HOY, litros: '10', precioLitro: '2' }, ctx).valor.importe, 3000);
});

test('Validación de vehículos', () => {
  const ok = C.validarVehiculo({ marca: 'SEAT', modelo: 'Ibiza', kmInicial: '58.240', fechaKmInicial: '2026-01-01', kmActual: '60000' }, { hoy: HOY });
  assert.ok(ok.ok); assert.equal(ok.valor.kmInicial, 58240);
  const mal = C.validarVehiculo({ marca: '', modelo: '', anio: '1800', kmInicial: '', fechaKmInicial: '2026-13-01', precioCompra: '-1' }, { hoy: HOY });
  assert.ok(!mal.ok);
  for (const k of ['marca', 'modelo', 'anio', 'kmInicial', 'fechaKmInicial', 'precioCompra']) assert.ok(mal.errores[k], 'falta error en ' + k);
  assert.ok(C.validarVehiculo({ marca: 'A', modelo: 'B', kmInicial: '5000', fechaKmInicial: '2026-01-01', kmActual: '4000' }, { hoy: HOY }).errores.kmActual);
  assert.ok(C.validarVehiculo({ marca: 'A', modelo: 'B', kmInicial: '5000', fechaKmInicial: '2026-01-01', fechaAdquisicion: '2026-02-01' }, { hoy: HOY }).errores.fechaKmInicial);
});

test('Filtros, búsqueda y orden', () => {
  const gs = [
    g('2026-01-10', 50, 'gasolina', { descripcion: 'Repostaje Repsol' }),
    g('2026-02-10', 400, 'seguro', { descripcion: 'Seguro anual', notas: 'Mapfre' }),
    g('2026-03-10', 12.5, 'aparcamiento', { descripcion: 'Parking estación' })
  ];
  assert.equal(C.filtrarGastos(gs, { categoria: 'seguro' }).length, 1);
  assert.equal(C.filtrarGastos(gs, { texto: 'mapfre' }).length, 1);
  assert.equal(C.filtrarGastos(gs, { texto: 'ESTACION' }).length, 1); // sin acentos ni mayúsculas
  assert.equal(C.filtrarGastos(gs, { texto: '12,50' }).length, 1); // por importe
  assert.equal(C.filtrarGastos(gs, { desde: '2026-02-01', hasta: '2026-02-28' }).length, 1);
  assert.equal(C.filtrarGastos(gs, { texto: 'nada que coincida' }).length, 0);
  assert.deepEqual(C.ordenarGastos(gs, 'importe-desc').map((x) => x.importe), [40000, 5000, 1250]);
  assert.deepEqual(C.ordenarGastos(gs, 'fecha-asc').map((x) => x.fecha), ['2026-01-10', '2026-02-10', '2026-03-10']);
  assert.deepEqual(C.ordenarGastos(gs, 'fecha-desc').map((x) => x.fecha), ['2026-03-10', '2026-02-10', '2026-01-10']);
});

test('Resumen del periodo: total, categoría más cara, comparación y media', () => {
  const v = veh([{ fecha: '2026-01-01', km: 0 }, { fecha: '2026-11-16', km: 10000 }], { fechaAdquisicion: '2026-01-01' });
  const gs = [g('2026-10-05', 100), g('2026-10-20', 300, 'seguro'), g('2026-11-02', 60), g('2026-11-10', 90, 'mantenimiento')];
  const r = C.resumenPeriodo(v, gs, C.CATEGORIAS_BASE, { tipo: 'mes', ref: '2026-11' }, HOY);
  assert.equal(r.total, 15000);
  assert.equal(r.numMov, 2);
  assert.equal(r.top.id, 'mantenimiento');
  assert.equal(r.anterior.total, 40000);
  assert.equal(r.anterior.fraccion, -0.625);
  assert.equal(r.combustible.total, 6000);
  assert.ok(r.historial.completo);
  const anio = C.resumenPeriodo(v, gs, C.CATEGORIAS_BASE, { tipo: 'anio', ref: '2026' }, HOY);
  assert.equal(anio.total, 55000);
  assert.equal(anio.top.id, 'seguro');
  // media: 550 € entre ~10,5 meses (1 ene – 16 nov)
  const meses = (C.diaNum(HOY) - C.diaNum('2026-01-01') + 1) / 30.4375;
  assert.equal(anio.media.cent, Math.round(55000 / meses));
  // Historial parcial si se compró antes de empezar a registrar
  const v2 = { ...v, fechaAdquisicion: '2020-05-01' };
  assert.equal(C.calidadHistorial(v2, gs).completo, false);
});

test('Series para gráficos', () => {
  const gs = [g('2026-01-10', 10), g('2026-01-20', 5, 'peajes'), g('2026-03-01', 20)];
  const s = C.serieMensual(gs, '2026-01', '2026-03');
  assert.deepEqual(s.map((x) => x.total), [1500, 0, 2000]);
  assert.equal(s[0].porCat.peajes, 500);
  const a = C.serieAcumulada(gs, null, null);
  assert.deepEqual(a.map((p) => p.valor), [1000, 1500, 3500]);
  const cmp = C.compararMeses(gs, '2026-03', '2026-01', C.CATEGORIAS_BASE);
  assert.equal(cmp.totalA, 2000); assert.equal(cmp.totalB, 1500); assert.equal(cmp.dif, 500);
  assert.equal(C.listaMeses('2025-11', '2026-02').join(','), '2025-11,2025-12,2026-01,2026-02');
  assert.equal(C.sumarMeses('2026-01', -1), '2025-12');
  assert.equal(C.sumarMeses('2026-12', 1), '2027-01');
});

test('Recordatorios y aceite', () => {
  assert.equal(C.estadoRecordatorio('2026-11-10', HOY).nivel, 'vencido');
  assert.equal(C.estadoRecordatorio('2026-12-01', HOY).nivel, 'pronto');
  assert.equal(C.estadoRecordatorio('2027-06-01', HOY).nivel, 'ok');
  const a = C.estadoAceite({ aceite: { kmUltimo: 50000, intervalo: 15000 } }, 64000);
  assert.equal(a.restantes, 1000); assert.equal(a.nivel, 'pronto');
  assert.equal(C.estadoAceite({ aceite: null }, 1000), null);
});

test('Copia de seguridad: ida y vuelta y rechazo de archivos malos', () => {
  const datos = Demo.generar(HOY);
  const copia = JSON.parse(JSON.stringify(C.crearCopia(datos, true)));
  const r = C.validarImportacion(copia);
  assert.ok(r.ok, r.errores && r.errores.join(' | '));
  assert.equal(r.datos.gastos.length, datos.gastos.length);
  assert.equal(C.suma(r.datos.gastos), C.suma(datos.gastos));
  assert.ok(r.demo);
  assert.ok(!C.validarImportacion(null).ok);
  assert.ok(!C.validarImportacion([]).ok);
  assert.ok(!C.validarImportacion({ app: 'otra' }).ok);
  assert.ok(!C.validarImportacion({ app: 'mi-garaje-ia', version: 99, datos: {} }).ok);
  const malo = JSON.parse(JSON.stringify(copia));
  malo.datos.gastos[0].importe = -500;
  malo.datos.gastos[1].fecha = '2026-02-31';
  malo.datos.gastos[2].vehiculoId = 'no-existe';
  const rm = C.validarImportacion(malo);
  assert.ok(!rm.ok);
  assert.ok(rm.errores.some((e) => /importe/.test(e)));
  assert.ok(rm.errores.some((e) => /fecha/.test(e)));
  assert.ok(rm.errores.some((e) => /vehículo que no existe/.test(e)));
  const foto = JSON.parse(JSON.stringify(copia));
  foto.datos.vehiculos[0].foto = 'javascript:alert(1)';
  const rf = C.validarImportacion(foto);
  assert.ok(rf.ok); assert.equal(rf.datos.vehiculos[0].foto, null); assert.equal(rf.avisos.length, 1);
});

test('CSV: separador ; coma decimal y sin fórmulas inyectadas', () => {
  const v = [{ id: 'v1', marca: 'SEAT', modelo: 'León', matricula: '1234 JKL' }];
  const csv = C.aCSV([g('2026-01-05', 45.9, 'gasolina', { descripcion: '=HYPERLINK("x")', litros: 30, precioLitro: 1.53, km: 1000 }), g('2026-01-01', 10, 'peajes', { descripcion: 'Peaje; "AP-7"' })], v);
  const filas = csv.split('\r\n');
  assert.equal(filas.length, 3);
  assert.ok(filas[0].startsWith('Fecha;Vehículo'));
  assert.ok(filas[1].startsWith('01/01/2026;SEAT León;1234 JKL;Peajes;"Peaje; ""AP-7""";10,00'));
  assert.ok(filas[2].includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(filas[2].includes(';45,90;1000;30,00;1,530;'));
});

test('Datos de demostración: realistas, coherentes y con datos del mes actual', () => {
  const d = Demo.generar(HOY);
  assert.equal(d.vehiculos.length, 2);
  assert.ok(d.gastos.length > 60);
  assert.ok(d.gastos.every((x) => x.importe > 0 && x.fecha <= HOY && C.esFechaISO(x.fecha)));
  for (const v of d.vehiculos) assert.equal(C.coherenciaLecturas(C.lecturasVehiculo(v, d.gastos)), null);
  const v1 = d.vehiculos[0];
  const gs = d.gastos.filter((x) => x.vehiculoId === v1.id);
  const r = C.resumenPeriodo(v1, gs, C.CATEGORIAS_BASE.concat(d.categorias), { tipo: 'mes', ref: '2026-11' }, HOY);
  assert.ok(r.numMov > 0, 'hay gastos en el mes actual');
  const total = C.resumenPeriodo(v1, gs, C.CATEGORIAS_BASE.concat(d.categorias), { tipo: 'total' }, HOY);
  assert.ok(total.coste.eurKm > 0.12 && total.coste.eurKm < 0.45, 'coste/km verosímil: ' + total.coste.eurKm);
  assert.deepEqual(Demo.generar(HOY), d, 'la demo es reproducible');
});

/*
 * Mi Garaje IA — datos FICTICIOS de demostración.
 * Se generan relativos a la fecha de hoy (último año) con una semilla fija, así siempre hay
 * datos del mes actual. Se guardan en una clave aparte y nunca se mezclan con los datos reales.
 * Los importes y precios son verosímiles para España, pero inventados.
 */
(function (raiz, fabrica) {
  var api = fabrica(typeof module === 'object' && module.exports ? require('./calculos.js') : raiz.Calculos);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.Demo = api;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  function azar(semilla) { // mulberry32: pseudoaleatorio reproducible
    var a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generar(hoy) {
    hoy = hoy || C.hoyISO();
    var r = azar(20261116);
    var entre = function (a, b) { return a + (b - a) * r(); };
    var dHoy = C.diaNum(hoy);
    var gastos = [], n = 0;
    var creado = 1;

    function odometro(kmInicial, diaInicio, dias, mediaDiaria) {
      var km = [kmInicial];
      for (var i = 1; i <= dias; i++) {
        var fin = new Date((diaInicio + i) * 86400000).getUTCDay() % 6 === 0; // sábado/domingo
        km.push(km[i - 1] + Math.round(mediaDiaria * (fin ? entre(0.2, 2.2) : entre(0.6, 1.4))));
      }
      return km;
    }
    function gasto(vehiculoId, dia, categoria, cent, descripcion, extra) {
      if (dia > dHoy) return;
      gastos.push(Object.assign({ id: 'demo-g' + (++n), vehiculoId: vehiculoId, fecha: C.isoDeDia(dia), importe: cent, categoria: categoria, descripcion: descripcion, notas: '', km: null, litros: null, precioLitro: null, creado: creado++ }, extra || {}));
    }
    var precioGasolina = function (dia) { return 1.585 + 0.07 * Math.sin(dia / 58) + entre(-0.02, 0.02); };

    /* ---------- Coche 1: registro del último año (histórico parcial) ---------- */
    var v1 = 'demo-v1';
    var ini1 = dHoy - 364;
    var km1 = odometro(58240, ini1, 364, 36);
    var kmD1 = function (dia) { return km1[dia - ini1]; };
    var gasolineras = ['Repostaje gasolinera', 'Repostaje autovía', 'Repostaje gasolinera del barrio', 'Repostaje low cost'];
    for (var d = ini1 + 3; d <= dHoy; d += Math.round(entre(9, 13))) {
      var litros = Math.round(entre(36, 47) * 100) / 100;
      var p = Math.round(precioGasolina(d) * 1000) / 1000;
      gasto(v1, d, 'gasolina', C.importeCombustible(litros, p), gasolineras[Math.floor(r() * gasolineras.length)], { litros: litros, precioLitro: p, km: kmD1(d) });
    }
    gasto(v1, ini1 + 21, 'reparaciones', 11900, 'Batería nueva', { km: kmD1(ini1 + 21) });
    gasto(v1, ini1 + 40, 'mantenimiento', 2490, 'Escobillas limpiaparabrisas');
    gasto(v1, ini1 + 95, 'mantenimiento', 18640, 'Revisión: aceite y filtros', { km: kmD1(ini1 + 95), notas: 'Aceite 5W30 y filtros de aire y aceite.' });
    gasto(v1, ini1 + 122, 'seguro', 43860, 'Renovación seguro todo riesgo con franquicia', { notas: 'Pago anual.' });
    gasto(v1, ini1 + 151, 'impuestos', 9230, 'Impuesto de circulación (IVTM)');
    gasto(v1, ini1 + 203, 'itv', 4690, 'ITV periódica (favorable)', { km: kmD1(ini1 + 203) });
    gasto(v1, ini1 + 252, 'mantenimiento', 23800, 'Neumáticos delanteros (2)', { km: kmD1(ini1 + 252) });
    gasto(v1, ini1 + 301, 'reparaciones', 14850, 'Pastillas de freno delanteras', { km: kmD1(ini1 + 301) });
    for (d = ini1 + 6; d <= dHoy; d += Math.round(entre(11, 19))) {
      if (r() < 0.55) gasto(v1, d, 'aparcamiento', Math.round(entre(150, 420)), 'Zona azul');
      else gasto(v1, d, 'aparcamiento', Math.round(entre(600, 1450)), 'Parking centro');
    }
    for (d = ini1 + 18; d <= dHoy; d += Math.round(entre(35, 55))) gasto(v1, d, 'peajes', Math.round(entre(740, 1890)), 'Peaje autopista');
    for (d = ini1 + 12; d <= dHoy; d += Math.round(entre(26, 36))) gasto(v1, d, 'demo-lavado', Math.round(entre(700, 1200)), 'Lavado completo');
    gasto(v1, dHoy - 2, 'aparcamiento', 380, 'Zona azul');

    /* ---------- Coche 2: comprado hace 5 meses (histórico completo) ---------- */
    var v2 = 'demo-v2';
    var ini2 = dHoy - 150;
    var km2 = odometro(41300, ini2, 150, 24);
    var kmD2 = function (dia) { return km2[dia - ini2]; };
    for (d = ini2 + 2; d <= dHoy; d += Math.round(entre(13, 17))) {
      var l2 = Math.round(entre(30, 38) * 100) / 100;
      var p2 = Math.round(precioGasolina(d) * 1000) / 1000;
      gasto(v2, d, 'gasolina', C.importeCombustible(l2, p2), 'Repostaje gasolinera', { litros: l2, precioLitro: p2, km: kmD2(d) });
    }
    gasto(v2, ini2, 'seguro', 36540, 'Seguro a terceros ampliado', { notas: 'Contratado el día de la compra.' });
    gasto(v2, ini2 + 1, 'impuestos', 5600, 'Cambio de titularidad (DGT)');
    gasto(v2, ini2 + 64, 'aparcamiento', 4500, 'Abono parking mensual');
    gasto(v2, ini2 + 95, 'aparcamiento', 4500, 'Abono parking mensual');
    gasto(v2, ini2 + 126, 'aparcamiento', 4500, 'Abono parking mensual');
    gasto(v2, ini2 + 80, 'mantenimiento', 8990, 'Cambio de aceite', { km: kmD2(ini2 + 80) });
    gasto(v2, ini2 + 110, 'peajes', 1265, 'Peaje autopista');

    var vehiculos = [
      {
        id: v1, marca: 'SEAT', modelo: 'León 1.4 TSI', anio: 2016, matricula: '1234 JKL', fechaAdquisicion: '2020-06-15',
        precioCompra: 1450000, valorEstimado: 980000, foto: null, creado: 1,
        lecturas: [{ fecha: C.isoDeDia(ini1), km: km1[0] }, { fecha: hoy, km: kmD1(dHoy) }],
        aceite: { kmUltimo: kmD1(ini1 + 95), intervalo: 12000 }
      },
      {
        id: v2, marca: 'Renault', modelo: 'Clio TCe 90', anio: 2021, matricula: '5678 LMN', fechaAdquisicion: C.isoDeDia(ini2),
        precioCompra: 1390000, valorEstimado: 1280000, foto: null, creado: 2,
        lecturas: [{ fecha: C.isoDeDia(ini2), km: km2[0] }, { fecha: hoy, km: kmD2(dHoy) }],
        aceite: { kmUltimo: kmD2(ini2 + 80), intervalo: 15000 }
      }
    ];
    var recordatorios = [
      { id: 'demo-r1', vehiculoId: v1, tipo: 'itv', titulo: 'ITV anual', fecha: C.isoDeDia(ini1 + 203 + 365), notas: 'Coche de más de 10 años: ITV cada año.' },
      { id: 'demo-r2', vehiculoId: v1, tipo: 'seguro', titulo: 'Renovar seguro', fecha: C.isoDeDia(ini1 + 122 + 365), notas: 'Comparar precios un mes antes.' },
      { id: 'demo-r3', vehiculoId: v1, tipo: 'mantenimiento', titulo: 'Revisar presión de neumáticos', fecha: C.isoDeDia(dHoy + 9), notas: '' },
      { id: 'demo-r4', vehiculoId: v2, tipo: 'seguro', titulo: 'Renovar seguro', fecha: C.isoDeDia(ini2 + 365), notas: '' }
    ];
    return {
      version: C.VERSION_DATOS,
      vehiculos: vehiculos,
      gastos: gastos,
      categorias: [{ id: 'demo-lavado', nombre: 'Lavado', icono: 'gota', color: '#38BDF8', personalizada: true }],
      recordatorios: recordatorios
    };
  }

  return { generar: generar };
});

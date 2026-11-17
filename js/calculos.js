/*
 * Mi Garaje IA — motor de cálculo (funciones puras, sin DOM).
 * Se usa en el navegador (window.Calculos) y en Node para las pruebas (require).
 *
 * Convenciones:
 *  - Importes en CÉNTIMOS (enteros) para evitar errores de coma flotante.
 *  - Fechas como texto ISO 'AAAA-MM-DD'. Internamente se convierten a "número de día" (UTC).
 *  - Kilometrajes como enteros.
 */
(function (raiz, fabrica) {
  var api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.Calculos = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION_DATOS = 1;
  var DIA_MS = 86400000;
  var MAX_IMPORTE_CENT = 100000000; // 1.000.000 €
  var MAX_KM = 3000000;

  var CATEGORIAS_BASE = [
    { id: 'gasolina', nombre: 'Gasolina', icono: 'gasolina', color: '#2F7BFF' },
    { id: 'seguro', nombre: 'Seguro', icono: 'seguro', color: '#8B5CF6' },
    { id: 'reparaciones', nombre: 'Reparaciones', icono: 'reparaciones', color: '#F05252' },
    { id: 'mantenimiento', nombre: 'Mantenimiento', icono: 'mantenimiento', color: '#22C55E' },
    { id: 'itv', nombre: 'ITV', icono: 'itv', color: '#14B8A6' },
    { id: 'impuestos', nombre: 'Impuestos', icono: 'impuestos', color: '#F59E0B' },
    { id: 'aparcamiento', nombre: 'Aparcamiento', icono: 'aparcamiento', color: '#EC4899' },
    { id: 'peajes', nombre: 'Peajes', icono: 'peajes', color: '#A3E635' },
    { id: 'otros', nombre: 'Otros', icono: 'otros', color: '#94A3B8' }
  ];
  // Pagos que suelen hacerse una vez al año: distorsionan el €/km de un solo mes.
  var CATEGORIAS_ANUALES = ['seguro', 'itv', 'impuestos'];
  var ICONOS_PERSONALIZADOS = ['etiqueta', 'gota', 'rueda', 'bateria', 'carrito', 'estrella', 'llave', 'otros'];
  var COLORES_PERSONALIZADOS = ['#38BDF8', '#F472B6', '#FB923C', '#34D399', '#C084FC', '#FACC15', '#F87171', '#60A5FA'];
  var TIPOS_RECORDATORIO = ['itv', 'seguro', 'mantenimiento', 'impuestos', 'otro'];

  /* ------------------------------------------------------------------ */
  /* Fechas                                                              */
  /* ------------------------------------------------------------------ */
  function pad(n) { return String(n).padStart(2, '0'); }

  function esFechaISO(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var p = s.split('-').map(Number);
    if (p[0] < 1900 || p[0] > 2200) return false;
    var f = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return f.getUTCFullYear() === p[0] && f.getUTCMonth() === p[1] - 1 && f.getUTCDate() === p[2];
  }
  function diaNum(iso) {
    var p = iso.split('-').map(Number);
    return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / DIA_MS);
  }
  function isoDeDia(n) { return new Date(n * DIA_MS).toISOString().slice(0, 10); }
  function hoyISO(fecha) {
    var f = fecha || new Date();
    return f.getFullYear() + '-' + pad(f.getMonth() + 1) + '-' + pad(f.getDate());
  }
  function sumarDias(iso, n) { return isoDeDia(diaNum(iso) + n); }
  function mesDe(iso) { return iso.slice(0, 7); }
  function sumarMeses(mes, n) {
    var p = mes.split('-').map(Number);
    var total = p[0] * 12 + (p[1] - 1) + n;
    return Math.floor(total / 12) + '-' + pad((total % 12) + 1);
  }
  function ultimoDiaMes(mes) {
    var p = mes.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1], 0)).getUTCDate();
  }
  function listaMeses(desdeMes, hastaMes) {
    var r = [];
    for (var m = desdeMes; m <= hastaMes && r.length < 600; m = sumarMeses(m, 1)) r.push(m);
    return r;
  }

  /** Rango de fechas de un periodo. tipo: 'mes' (ref 'AAAA-MM'), 'anio' (ref 'AAAA'), 'total'. */
  function rangoPeriodo(tipo, ref) {
    if (tipo === 'mes') return { desde: ref + '-01', hasta: ref + '-' + pad(ultimoDiaMes(ref)) };
    if (tipo === 'anio') return { desde: ref + '-01-01', hasta: ref + '-12-31' };
    return { desde: null, hasta: null };
  }
  function periodoAnterior(tipo, ref) {
    if (tipo === 'mes') return sumarMeses(ref, -1);
    if (tipo === 'anio') return String(Number(ref) - 1);
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* Formato español                                                     */
  /* ------------------------------------------------------------------ */
  function crearFormato(opciones) {
    // useGrouping 'always' fuerza el punto de miles también en cifras de 4 dígitos (1.550 €).
    try { return new Intl.NumberFormat('es-ES', Object.assign({}, opciones, { useGrouping: 'always' })); }
    catch (e) { return new Intl.NumberFormat('es-ES', opciones); }
  }
  var fEur = crearFormato({ style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var fEur0 = crearFormato({ style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  var fEnt = crearFormato({ maximumFractionDigits: 0 });
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

  function formatoEuros(cent, sinDecimales) {
    if (cent == null || !Number.isFinite(cent)) return '—';
    return (sinDecimales ? fEur0 : fEur).format(cent / 100);
  }
  function formatoNumero(n, decimales) {
    if (n == null || !Number.isFinite(n)) return '—';
    if (!decimales) return fEnt.format(n);
    return crearFormato({ minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(n);
  }
  function formatoKm(n) { return n == null ? '—' : formatoNumero(n) + ' km'; }
  function formatoEurKm(eur) {
    if (eur == null || !Number.isFinite(eur)) return '—';
    return formatoNumero(eur, eur < 0.1 ? 3 : 2) + ' €/km';
  }
  function formatoFecha(iso) {
    if (!esFechaISO(iso)) return '—';
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function formatoFechaCorta(iso) {
    if (!esFechaISO(iso)) return '—';
    var p = iso.split('-').map(Number);
    return p[2] + ' ' + MESES_CORTOS[p[1] - 1];
  }
  function nombreMes(mes, corto) {
    var p = mes.split('-').map(Number);
    return corto ? MESES_CORTOS[p[1] - 1] + ' ' + String(p[0]).slice(2) : MESES[p[1] - 1] + ' ' + p[0];
  }
  function mesCorto(mes) { return MESES_CORTOS[Number(mes.slice(5, 7)) - 1]; }
  function porcentaje(fraccion) {
    if (fraccion == null || !Number.isFinite(fraccion)) return '—';
    return formatoNumero(fraccion * 100, Math.abs(fraccion) < 0.1 && fraccion !== 0 ? 1 : 0) + ' %';
  }

  /* ------------------------------------------------------------------ */
  /* Lectura de números escritos por el usuario                          */
  /* ------------------------------------------------------------------ */
  /**
   * Convierte "1.234,56", "12,5", "12.50" o "1.500" en número.
   * milesConPunto=true: "1.500" se interpreta como mil quinientos (uso español para importes y km).
   * milesConPunto=false: "1.659" es uno coma seis (precio por litro, litros).
   */
  function parseNumeroES(entrada, milesConPunto) {
    if (typeof entrada === 'number') return Number.isFinite(entrada) ? entrada : NaN;
    if (typeof entrada !== 'string') return NaN;
    var s = entrada.trim().replace(/[\s €]/g, '').replace(/km$/i, '');
    if (!s || !/^-?[\d.,]+$/.test(s)) return NaN;
    var punto = s.indexOf('.') >= 0, coma = s.indexOf(',') >= 0;
    if (punto && coma) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (coma) {
      if ((s.match(/,/g) || []).length > 1) {
        if (!/^-?\d{1,3}(,\d{3})+$/.test(s)) return NaN;
        s = s.replace(/,/g, '');
      } else s = s.replace(',', '.');
    } else if (punto) {
      if (milesConPunto !== false && /^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
      else if ((s.match(/\./g) || []).length > 1) return NaN;
    }
    var n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  function aCentimos(euros) { return Math.round(Number((euros * 100).toFixed(6))); }
  function importeCombustible(litros, precioLitro) { return aCentimos(litros * precioLitro); }
  function vacio(v) { return v == null || (typeof v === 'string' && v.trim() === ''); }

  /* ------------------------------------------------------------------ */
  /* Kilometraje                                                         */
  /* ------------------------------------------------------------------ */
  /** Todas las lecturas de cuentakilómetros de un vehículo: las suyas + los gastos con km. */
  function lecturasVehiculo(vehiculo, gastos, excluirGastoId) {
    var ls = [];
    (vehiculo.lecturas || []).forEach(function (l) {
      if (esFechaISO(l.fecha) && Number.isFinite(l.km)) ls.push({ fecha: l.fecha, dia: diaNum(l.fecha), km: l.km, origen: 'lectura' });
    });
    (gastos || []).forEach(function (g) {
      if (g.vehiculoId === vehiculo.id && g.km != null && g.id !== excluirGastoId && esFechaISO(g.fecha))
        ls.push({ fecha: g.fecha, dia: diaNum(g.fecha), km: g.km, origen: 'gasto', id: g.id });
    });
    ls.sort(function (a, b) { return a.dia - b.dia || a.km - b.km; });
    return ls;
  }
  /** Una lectura por día (la mayor), ordenadas. */
  function puntosDiarios(lecturas) {
    var mapa = new Map();
    lecturas.forEach(function (l) { if (!mapa.has(l.dia) || mapa.get(l.dia) < l.km) mapa.set(l.dia, l.km); });
    return Array.from(mapa.entries()).map(function (e) { return { dia: e[0], km: e[1] }; }).sort(function (a, b) { return a.dia - b.dia; });
  }
  function kmActual(vehiculo, gastos) {
    var ls = lecturasVehiculo(vehiculo, gastos);
    if (!ls.length) return null;
    var max = ls[0], i;
    for (i = 1; i < ls.length; i++) if (ls[i].dia > max.dia || (ls[i].dia === max.dia && ls[i].km > max.km)) max = ls[i];
    return { km: max.km, fecha: max.fecha };
  }
  /** Kilometraje (interpolado) al final del día indicado; null si está fuera del tramo conocido. */
  function kmEnDia(puntos, dia) {
    if (!puntos.length || dia < puntos[0].dia || dia > puntos[puntos.length - 1].dia) return null;
    for (var i = 0; i < puntos.length; i++) {
      if (puntos[i].dia === dia) return puntos[i].km;
      if (puntos[i].dia > dia) {
        var a = puntos[i - 1], b = puntos[i];
        return a.km + (b.km - a.km) * (dia - a.dia) / (b.dia - a.dia);
      }
    }
    return null;
  }
  /**
   * ¿Es coherente registrar `km` en `fecha` con las lecturas existentes?
   * Devuelve null si es coherente o un texto explicando el conflicto.
   */
  function comprobarKm(lecturas, fecha, km) {
    var d = diaNum(fecha), antes = null, despues = null;
    lecturas.forEach(function (l) {
      if (l.dia < d && l.km > km && (!antes || l.km > antes.km)) antes = l;
      if (l.dia > d && l.km < km && (!despues || l.km < despues.km)) despues = l;
    });
    if (antes) return 'El ' + formatoFecha(antes.fecha) + ' ya tenías ' + formatoKm(antes.km) + '. Una fecha posterior no puede tener menos kilómetros.';
    if (despues) return 'El ' + formatoFecha(despues.fecha) + ' tenías ' + formatoKm(despues.km) + '. Una fecha anterior no puede tener más kilómetros.';
    return null;
  }
  /** Revisa un conjunto completo de lecturas. */
  function coherenciaLecturas(lecturas) {
    var ps = lecturas.slice().sort(function (a, b) { return a.dia - b.dia; });
    var maxPrevio = null;
    for (var i = 0; i < ps.length; i++) {
      if (maxPrevio && ps[i].dia > maxPrevio.dia && ps[i].km < maxPrevio.km)
        return 'El ' + formatoFecha(maxPrevio.fecha) + ' consta ' + formatoKm(maxPrevio.km) + ', pero el ' + formatoFecha(ps[i].fecha) + ' consta ' + formatoKm(ps[i].km) + '.';
      if (!maxPrevio || ps[i].km >= maxPrevio.km) maxPrevio = ps[i];
    }
    return null;
  }

  /**
   * Kilómetros recorridos en [desde, hasta] (ambos incluidos; null = sin límite).
   * Toma el cuentakilómetros al final del día anterior a `desde` y al final de `hasta`.
   */
  function kmPeriodo(lecturas, desde, hasta) {
    var pts = puntosDiarios(lecturas);
    if (pts.length < 2) return { km: null, cobertura: 'ninguna', motivo: 'pocas-lecturas', lecturas: pts.length };
    var primera = pts[0].dia, ultima = pts[pts.length - 1].dia;
    var ini = desde == null ? primera : diaNum(desde) - 1;
    var fin = hasta == null ? ultima : diaNum(hasta);
    var iniC = Math.max(ini, primera), finC = Math.min(fin, ultima);
    if (finC <= iniC) return { km: null, cobertura: 'ninguna', motivo: 'fuera-de-tramo', primera: primera, ultima: ultima, lecturas: pts.length };
    var kmIni = kmEnDia(pts, iniC), kmFin = kmEnDia(pts, finC);
    var exacto = function (d) { return pts.some(function (p) { return p.dia === d; }); };
    return {
      km: Math.round(kmFin - kmIni),
      cobertura: ini >= primera && fin <= ultima ? 'completa' : 'parcial',
      desdeDia: iniC, hastaDia: finC, primera: primera, ultima: ultima,
      interpolado: !exacto(iniC) || !exacto(finC),
      lecturas: pts.length
    };
  }

  /* ------------------------------------------------------------------ */
  /* Gastos: filtros y sumas                                             */
  /* ------------------------------------------------------------------ */
  function enRango(g, desde, hasta) {
    return (desde == null || g.fecha >= desde) && (hasta == null || g.fecha <= hasta);
  }
  function suma(lista) { return lista.reduce(function (t, g) { return t + g.importe; }, 0); }
  function normalizar(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  /** filtros: { texto, categoria, desde, hasta, vehiculoId } */
  function filtrarGastos(gastos, filtros, categorias) {
    var f = filtros || {};
    var q = normalizar(f.texto).trim();
    var nombres = {};
    (categorias || CATEGORIAS_BASE).forEach(function (c) { nombres[c.id] = c.nombre; });
    return gastos.filter(function (g) {
      if (f.vehiculoId && g.vehiculoId !== f.vehiculoId) return false;
      if (f.categoria && g.categoria !== f.categoria) return false;
      if (f.desde && g.fecha < f.desde) return false;
      if (f.hasta && g.fecha > f.hasta) return false;
      if (q) {
        var texto = normalizar([g.descripcion, g.notas, nombres[g.categoria], formatoEuros(g.importe), (g.importe / 100).toFixed(2), formatoFecha(g.fecha)].join(' '));
        return q.split(/\s+/).every(function (p) { return texto.indexOf(p) >= 0; });
      }
      return true;
    });
  }
  function ordenarGastos(gastos, criterio) {
    var l = gastos.slice();
    var porFecha = function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.creado || 0) - (b.creado || 0); };
    switch (criterio) {
      case 'fecha-asc': return l.sort(porFecha);
      case 'importe-desc': return l.sort(function (a, b) { return b.importe - a.importe || -porFecha(a, b); });
      case 'importe-asc': return l.sort(function (a, b) { return a.importe - b.importe || -porFecha(a, b); });
      default: return l.sort(function (a, b) { return -porFecha(a, b); });
    }
  }
  function porCategoria(gastos, categorias) {
    var mapa = {}, total = suma(gastos);
    gastos.forEach(function (g) { mapa[g.categoria] = (mapa[g.categoria] || 0) + g.importe; });
    var cats = categorias || CATEGORIAS_BASE;
    return Object.keys(mapa).map(function (id) {
      var c = cats.find(function (x) { return x.id === id; }) || cats.find(function (x) { return x.id === 'otros'; }) || { id: id, nombre: id, color: '#94A3B8', icono: 'otros' };
      return { id: id, nombre: c.nombre, color: c.color, icono: c.icono, cent: mapa[id], fraccion: total ? mapa[id] / total : 0 };
    }).sort(function (a, b) { return b.cent - a.cent; });
  }

  /* ------------------------------------------------------------------ */
  /* Coste por kilómetro                                                 */
  /* ------------------------------------------------------------------ */
  /**
   * Coste por km = gastos del periodo / km recorridos en ESE MISMO tramo.
   * Solo se usan los gastos cuyas fechas caen dentro del tramo en que se conoce el kilometraje.
   * El precio de compra NO interviene: es inversión, no gasto de uso.
   * estado: 'ok' | 'parcial' | 'sin-km' | 'km-cero' | 'sin-gastos'
   */
  function costePorKm(gastos, lecturas, desde, hasta) {
    var enPeriodo = gastos.filter(function (g) { return enRango(g, desde, hasta); });
    var totalPeriodo = suma(enPeriodo);
    var kp = kmPeriodo(lecturas, desde, hasta);
    var base = { totalPeriodo: totalPeriodo, km: null, coste: 0, eurKm: null, excluido: 0, avisos: [], kmInfo: kp };
    if (kp.cobertura === 'ninguna') {
      base.estado = 'sin-km';
      base.avisos.push(kp.motivo === 'pocas-lecturas'
        ? 'Necesitas al menos dos lecturas del cuentakilómetros en fechas distintas (por ejemplo, el km inicial y el actual).'
        : 'No hay lecturas de kilometraje que cubran este periodo.');
      return base;
    }
    var gDesde = Math.max(desde == null ? -Infinity : diaNum(desde), kp.primera);
    var gHasta = kp.hastaDia;
    var usados = enPeriodo.filter(function (g) { var d = diaNum(g.fecha); return d >= gDesde && d <= gHasta; });
    base.coste = suma(usados);
    base.km = kp.km;
    base.excluido = totalPeriodo - base.coste;
    base.desde = isoDeDia(gDesde);
    base.hasta = isoDeDia(gHasta);
    base.numGastos = usados.length;
    if (kp.km <= 0) {
      base.estado = 'km-cero';
      base.avisos.push('No consta ningún kilómetro recorrido en este periodo, así que no se puede dividir.');
      return base;
    }
    if (base.coste === 0) {
      base.estado = 'sin-gastos';
      base.avisos.push('No hay gastos dentro del tramo con kilometraje conocido.');
      return base;
    }
    base.eurKm = base.coste / 100 / kp.km;
    base.estado = kp.cobertura === 'completa' && base.excluido === 0 ? 'ok' : 'parcial';
    if (kp.cobertura === 'parcial')
      base.avisos.push('Solo se conoce el kilometraje del ' + formatoFecha(base.desde) + ' al ' + formatoFecha(base.hasta) + '; el cálculo se limita a esos días.');
    if (base.excluido > 0)
      base.avisos.push(formatoEuros(base.excluido) + ' en gastos fuera de ese tramo no entran en el cálculo. Actualiza el kilometraje para incluirlos.');
    if (kp.km < 300)
      base.avisos.push('Con solo ' + formatoKm(kp.km) + ' el resultado puede no ser representativo.');
    return base;
  }

  /* ------------------------------------------------------------------ */
  /* Resumen de un periodo (panel principal)                             */
  /* ------------------------------------------------------------------ */
  /**
   * gastos: los del vehículo. periodo: {tipo, ref}. hoy: 'AAAA-MM-DD'.
   */
  function resumenPeriodo(vehiculo, gastos, categorias, periodo, hoy) {
    var r = rangoPeriodo(periodo.tipo, periodo.ref);
    var desde = r.desde, hasta = r.hasta && r.hasta > hoy ? hoy : r.hasta;
    var lista = gastos.filter(function (g) { return enRango(g, desde, hasta); });
    var lecturas = lecturasVehiculo(vehiculo, gastos);
    var total = suma(lista);
    var cats = porCategoria(lista, categorias);
    var combustible = lista.filter(function (g) { return g.categoria === 'gasolina'; });
    var conLitros = combustible.filter(function (g) { return g.litros > 0; });
    var litros = conLitros.reduce(function (t, g) { return t + g.litros; }, 0);

    // Comparación con el periodo anterior equivalente.
    var anterior = null;
    var refAnt = periodoAnterior(periodo.tipo, periodo.ref);
    if (refAnt) {
      var ra = rangoPeriodo(periodo.tipo, refAnt);
      var totAnt = suma(gastos.filter(function (g) { return enRango(g, ra.desde, ra.hasta); }));
      anterior = { ref: refAnt, total: totAnt, dif: total - totAnt, fraccion: totAnt > 0 ? (total - totAnt) / totAnt : null };
    }

    return {
      desde: desde, hasta: hasta, total: total, numMov: lista.length,
      porCategoria: cats, top: cats[0] || null,
      combustible: { total: suma(combustible), repostajes: combustible.length, litros: litros, precioMedio: litros > 0 ? suma(conLitros) / 100 / litros : null },
      coste: costePorKm(gastos, lecturas, desde, hasta),
      media: mediaMensual(vehiculo, gastos, periodo, hoy),
      anterior: anterior,
      historial: calidadHistorial(vehiculo, gastos)
    };
  }

  /** Inicio de los datos: primera lectura o primer gasto, lo que sea anterior. */
  function inicioDatos(vehiculo, gastos) {
    var fechas = (vehiculo.lecturas || []).map(function (l) { return l.fecha; })
      .concat(gastos.filter(function (g) { return g.vehiculoId === vehiculo.id; }).map(function (g) { return g.fecha; }))
      .filter(esFechaISO).sort();
    return fechas[0] || null;
  }

  /**
   * Gasto medio mensual. Ventana: mes → 12 meses hasta el mes elegido; año → ese año; total → todo.
   * Se recorta al tramo con datos (desde la primera lectura/gasto hasta hoy).
   */
  function mediaMensual(vehiculo, gastos, periodo, hoy) {
    var ini = inicioDatos(vehiculo, gastos);
    if (!ini) return { cent: null, meses: 0, etiqueta: '' };
    var desde, hasta, etiqueta;
    if (periodo.tipo === 'mes') {
      desde = sumarMeses(periodo.ref, -11) + '-01';
      hasta = rangoPeriodo('mes', periodo.ref).hasta;
      etiqueta = 'últimos 12 meses';
    } else if (periodo.tipo === 'anio') {
      var ra = rangoPeriodo('anio', periodo.ref); desde = ra.desde; hasta = ra.hasta;
      etiqueta = 'en ' + periodo.ref;
    } else { desde = ini; hasta = hoy; etiqueta = 'desde ' + formatoFecha(ini); }
    if (desde < ini) desde = ini;
    if (hasta > hoy) hasta = hoy;
    if (hasta < desde) return { cent: null, meses: 0, etiqueta: etiqueta };
    var dias = diaNum(hasta) - diaNum(desde) + 1;
    var meses = dias / 30.4375;
    var total = suma(gastos.filter(function (g) { return enRango(g, desde, hasta); }));
    return { cent: Math.round(total / Math.max(meses, 1)), meses: meses, total: total, desde: desde, hasta: hasta, etiqueta: etiqueta, pocosDatos: meses < 1 };
  }

  /** ¿Los datos cubren toda la vida del coche con su dueño actual o solo una parte? */
  function calidadHistorial(vehiculo, gastos) {
    var ini = inicioDatos(vehiculo, gastos);
    if (!ini) return { completo: false, texto: 'Sin datos todavía' };
    if (vehiculo.fechaAdquisicion && esFechaISO(vehiculo.fechaAdquisicion)) {
      if (ini <= vehiculo.fechaAdquisicion || diaNum(ini) - diaNum(vehiculo.fechaAdquisicion) <= 7)
        return { completo: true, texto: 'Histórico completo desde la compra' };
      return { completo: false, texto: 'Registro parcial: desde ' + formatoFecha(ini) + ' (comprado el ' + formatoFecha(vehiculo.fechaAdquisicion) + ')', desde: ini };
    }
    return { completo: false, texto: 'Registro desde ' + formatoFecha(ini), desde: ini };
  }

  /* ------------------------------------------------------------------ */
  /* Series para gráficos                                                */
  /* ------------------------------------------------------------------ */
  function serieMensual(gastos, desdeMes, hastaMes) {
    var meses = listaMeses(desdeMes, hastaMes);
    var idx = {};
    var serie = meses.map(function (m, i) { idx[m] = i; return { mes: m, total: 0, porCat: {} }; });
    gastos.forEach(function (g) {
      var i = idx[mesDe(g.fecha)];
      if (i == null) return;
      serie[i].total += g.importe;
      serie[i].porCat[g.categoria] = (serie[i].porCat[g.categoria] || 0) + g.importe;
    });
    return serie;
  }
  /** Gasto acumulado día a día dentro de [desde, hasta]. */
  function serieAcumulada(gastos, desde, hasta) {
    var porDia = new Map();
    gastos.forEach(function (g) {
      if (!enRango(g, desde, hasta)) return;
      porDia.set(g.fecha, (porDia.get(g.fecha) || 0) + g.importe);
    });
    var acum = 0;
    return Array.from(porDia.keys()).sort().map(function (f) {
      acum += porDia.get(f);
      return { fecha: f, dia: diaNum(f), delDia: porDia.get(f), valor: acum };
    });
  }
  function compararMeses(gastos, mesA, mesB, categorias) {
    var ga = gastos.filter(function (g) { return mesDe(g.fecha) === mesA; });
    var gb = gastos.filter(function (g) { return mesDe(g.fecha) === mesB; });
    var ca = porCategoria(ga, categorias), cb = porCategoria(gb, categorias);
    var ids = Array.from(new Set(ca.map(function (c) { return c.id; }).concat(cb.map(function (c) { return c.id; }))));
    var filas = ids.map(function (id) {
      var a = ca.find(function (c) { return c.id === id; }), b = cb.find(function (c) { return c.id === id; });
      var info = a || b;
      return { id: id, nombre: info.nombre, color: info.color, icono: info.icono, a: a ? a.cent : 0, b: b ? b.cent : 0 };
    }).sort(function (x, y) { return Math.max(y.a, y.b) - Math.max(x.a, x.b); });
    var ta = suma(ga), tb = suma(gb);
    return { mesA: mesA, mesB: mesB, totalA: ta, totalB: tb, dif: ta - tb, fraccion: tb > 0 ? (ta - tb) / tb : null, filas: filas };
  }

  /* ------------------------------------------------------------------ */
  /* Extras: depreciación, recordatorios, aceite                         */
  /* ------------------------------------------------------------------ */
  function depreciacion(vehiculo, hoy) {
    if (!(vehiculo.precioCompra > 0) || vehiculo.valorEstimado == null) return null;
    var perdida = vehiculo.precioCompra - vehiculo.valorEstimado;
    var anios = null, porAnio = null;
    if (esFechaISO(vehiculo.fechaAdquisicion)) {
      anios = (diaNum(hoy) - diaNum(vehiculo.fechaAdquisicion)) / 365.25;
      if (anios >= 0.25) porAnio = Math.round(perdida / anios);
    }
    return { precio: vehiculo.precioCompra, valor: vehiculo.valorEstimado, perdida: perdida, fraccion: perdida / vehiculo.precioCompra, anios: anios, porAnio: porAnio };
  }
  function estadoRecordatorio(fecha, hoy) {
    var dias = diaNum(fecha) - diaNum(hoy);
    return { dias: dias, nivel: dias < 0 ? 'vencido' : dias <= 30 ? 'pronto' : 'ok' };
  }
  function estadoAceite(vehiculo, kmAhora) {
    var a = vehiculo.aceite;
    if (!a || a.kmUltimo == null || !(a.intervalo > 0) || kmAhora == null) return null;
    var proximo = a.kmUltimo + a.intervalo, restantes = proximo - kmAhora;
    var fr = (kmAhora - a.kmUltimo) / a.intervalo;
    return { proximo: proximo, restantes: restantes, fraccion: Math.max(0, Math.min(1, fr)), nivel: restantes < 0 ? 'vencido' : restantes <= 1500 ? 'pronto' : 'ok' };
  }

  /* ------------------------------------------------------------------ */
  /* Validación de formularios                                           */
  /* ------------------------------------------------------------------ */
  function leerKm(v) {
    if (vacio(v)) return { vacio: true };
    var n = parseNumeroES(String(v), true);
    if (!Number.isFinite(n)) return { error: 'Escribe solo números (por ejemplo 71.250).' };
    if (n < 0) return { error: 'El kilometraje no puede ser negativo.' };
    if (!Number.isInteger(n)) return { error: 'Usa kilómetros enteros, sin decimales.' };
    if (n > MAX_KM) return { error: 'Kilometraje demasiado alto.' };
    return { valor: n };
  }
  function leerImporte(v, obligatorio) {
    if (vacio(v)) return obligatorio ? { error: 'Indica el importe.' } : { vacio: true };
    var n = parseNumeroES(String(v), true);
    if (!Number.isFinite(n)) return { error: 'Importe no válido. Ejemplo: 45,90' };
    if (n < 0) return { error: 'El importe no puede ser negativo.' };
    var c = aCentimos(n);
    if (c === 0) return obligatorio ? { error: 'El importe debe ser mayor que 0 €.' } : { valor: 0 };
    if (c > MAX_IMPORTE_CENT) return { error: 'Importe demasiado alto (máximo 1.000.000 €).' };
    return { valor: c };
  }
  function leerFecha(v, hoy, opciones) {
    var o = opciones || {};
    if (vacio(v)) return o.obligatoria === false ? { vacio: true } : { error: 'Indica la fecha.' };
    if (!esFechaISO(v)) return { error: 'Fecha no válida.' };
    if (!o.permitirFutura && v > hoy) return { error: 'La fecha no puede ser posterior a hoy.' };
    if (v < '1950-01-01') return { error: 'Fecha demasiado antigua.' };
    return { valor: v };
  }

  /**
   * d: {importe, categoria, fecha, descripcion, km, notas, litros, precioLitro}
   * ctx: {hoy, categorias:[ids], lecturas: lecturas del vehículo SIN este gasto}
   */
  function validarGasto(d, ctx) {
    var e = {}, v = {};
    var ids = ctx.categorias || CATEGORIAS_BASE.map(function (c) { return c.id; });
    if (ids.indexOf(d.categoria) < 0) e.categoria = 'Elige una categoría.';
    v.categoria = d.categoria;

    var litros = null, precio = null;
    if (d.categoria === 'gasolina') {
      if (!vacio(d.litros)) {
        litros = parseNumeroES(String(d.litros), false);
        if (!Number.isFinite(litros) || litros <= 0) { e.litros = 'Litros no válidos.'; litros = null; }
        else if (litros > 500) { e.litros = 'Demasiados litros para un repostaje.'; litros = null; }
        else litros = Math.round(litros * 100) / 100;
      }
      if (!vacio(d.precioLitro)) {
        precio = parseNumeroES(String(d.precioLitro), false);
        if (!Number.isFinite(precio) || precio <= 0) { e.precioLitro = 'Precio no válido.'; precio = null; }
        else if (precio > 10) { e.precioLitro = 'Precio por litro demasiado alto. ¿Querías decir ' + formatoNumero(precio / 1000, 3) + '?'; precio = null; }
        else precio = Math.round(precio * 1000) / 1000;
      }
    }
    if (litros != null && precio != null) {
      v.importe = importeCombustible(litros, precio);
      if (v.importe <= 0) e.importe = 'El importe calculado es 0 €.';
    } else {
      var im = leerImporte(d.importe, true);
      if (im.error) e.importe = im.error; else v.importe = im.valor;
    }
    v.litros = litros;
    v.precioLitro = litros != null && precio == null && v.importe ? Math.round(v.importe / 100 / litros * 1000) / 1000 : precio;

    var f = leerFecha(d.fecha, ctx.hoy);
    if (f.error) e.fecha = f.error; else v.fecha = f.valor;

    var k = leerKm(d.km);
    if (k.error) e.km = k.error;
    else v.km = k.vacio ? null : k.valor;
    if (v.km != null && v.fecha && ctx.lecturas) {
      var conflicto = comprobarKm(ctx.lecturas, v.fecha, v.km);
      if (conflicto) e.km = conflicto;
    }

    v.descripcion = String(d.descripcion || '').trim().slice(0, 120);
    v.notas = String(d.notas || '').trim().slice(0, 500);
    return { ok: Object.keys(e).length === 0, errores: e, valor: v };
  }

  /**
   * d: {marca, modelo, anio, matricula, fechaAdquisicion, precioCompra, valorEstimado, kmInicial, fechaKmInicial, kmActual}
   */
  function validarVehiculo(d, ctx) {
    var e = {}, v = {};
    var hoy = ctx.hoy;
    v.marca = String(d.marca || '').trim().slice(0, 40);
    v.modelo = String(d.modelo || '').trim().slice(0, 40);
    if (!v.marca) e.marca = 'Indica la marca.';
    if (!v.modelo) e.modelo = 'Indica el modelo.';
    v.anio = null;
    if (!vacio(d.anio)) {
      var a = Number(String(d.anio).trim());
      var max = Number(hoy.slice(0, 4)) + 1;
      if (!Number.isInteger(a) || a < 1900 || a > max) e.anio = 'Año entre 1900 y ' + max + '.';
      else v.anio = a;
    }
    v.matricula = String(d.matricula || '').trim().toUpperCase().slice(0, 15);

    var fa = leerFecha(d.fechaAdquisicion, hoy, { obligatoria: false });
    if (fa.error) e.fechaAdquisicion = fa.error; else v.fechaAdquisicion = fa.vacio ? null : fa.valor;
    if (v.fechaAdquisicion && v.anio && Number(v.fechaAdquisicion.slice(0, 4)) < v.anio - 1)
      e.fechaAdquisicion = 'Es anterior al año del coche.';

    var pc = leerImporte(d.precioCompra, false);
    if (pc.error) e.precioCompra = pc.error; else v.precioCompra = pc.vacio ? null : pc.valor;
    var ve = leerImporte(d.valorEstimado, false);
    if (ve.error) e.valorEstimado = ve.error; else v.valorEstimado = ve.vacio ? null : ve.valor;
    if (v.valorEstimado != null && v.precioCompra == null) e.valorEstimado = 'Indica también el precio de compra.';

    var ki = leerKm(d.kmInicial);
    if (ki.vacio) e.kmInicial = 'Indica el kilometraje inicial (míralo en el cuadro).';
    else if (ki.error) e.kmInicial = ki.error; else v.kmInicial = ki.valor;
    var fk = leerFecha(d.fechaKmInicial, hoy);
    if (fk.error) e.fechaKmInicial = fk.error; else v.fechaKmInicial = fk.valor;
    if (v.fechaKmInicial && v.fechaAdquisicion && v.fechaKmInicial < v.fechaAdquisicion)
      e.fechaKmInicial = 'No puede ser anterior a la fecha de compra.';

    var ka = leerKm(d.kmActual);
    if (ka.error) e.kmActual = ka.error;
    else v.kmActual = ka.vacio ? null : ka.valor;
    if (v.kmActual != null && v.kmInicial != null && v.kmActual < v.kmInicial)
      e.kmActual = 'No puede ser menor que el kilometraje inicial (' + formatoKm(v.kmInicial) + ').';
    if (v.kmActual != null && v.kmInicial != null && v.kmActual > v.kmInicial && v.fechaKmInicial === hoy)
      e.fechaKmInicial = 'Si el kilometraje inicial es de hoy, el actual debe ser el mismo. Pon una fecha anterior.';
    return { ok: Object.keys(e).length === 0, errores: e, valor: v };
  }

  /* ------------------------------------------------------------------ */
  /* Copias de seguridad                                                 */
  /* ------------------------------------------------------------------ */
  function datosVacios() { return { version: VERSION_DATOS, vehiculos: [], gastos: [], categorias: [], recordatorios: [] }; }

  function crearCopia(datos, demo, ahora) {
    return { app: 'mi-garaje-ia', version: VERSION_DATOS, exportado: ahora || new Date().toISOString(), demo: !!demo, datos: datos };
  }

  function esTexto(v, max) { return typeof v === 'string' && v.length <= (max || 200); }
  function esEnteroEn(v, min, max) { return Number.isInteger(v) && v >= min && v <= max; }

  /** Valida y normaliza un objeto importado. Nunca lanza excepciones. */
  function validarImportacion(obj) {
    var errores = [], avisos = [];
    var malo = function (m) { if (errores.length < 12) errores.push(m); };
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, errores: ['El archivo no contiene una copia de seguridad válida.'] };
    if (obj.app !== 'mi-garaje-ia') return { ok: false, errores: ['Este archivo no es una copia de Mi Garaje IA.'] };
    if (!Number.isInteger(obj.version) || obj.version < 1 || obj.version > VERSION_DATOS)
      return { ok: false, errores: ['Versión de copia no compatible (' + String(obj.version) + ').'] };
    var d = obj.datos;
    if (!d || typeof d !== 'object' || !Array.isArray(d.vehiculos) || !Array.isArray(d.gastos))
      return { ok: false, errores: ['Faltan las listas de vehículos o de gastos.'] };

    var limpio = datosVacios();
    var idsVeh = new Set(), idsGas = new Set();
    var idsCat = new Set(CATEGORIAS_BASE.map(function (c) { return c.id; }));

    (Array.isArray(d.categorias) ? d.categorias : []).forEach(function (c, i) {
      if (!c || !esTexto(c.id, 60) || !c.id || idsCat.has(c.id)) return malo('Categoría ' + (i + 1) + ': identificador no válido o repetido.');
      if (!esTexto(c.nombre, 30) || !c.nombre.trim()) return malo('Categoría ' + (i + 1) + ': nombre no válido.');
      if (!/^#[0-9a-f]{6}$/i.test(c.color)) return malo('Categoría «' + c.nombre + '»: color no válido.');
      idsCat.add(c.id);
      limpio.categorias.push({ id: c.id, nombre: c.nombre.trim(), color: c.color, icono: ICONOS_PERSONALIZADOS.indexOf(c.icono) >= 0 ? c.icono : 'etiqueta', personalizada: true });
    });

    d.vehiculos.forEach(function (v, i) {
      var n = 'Vehículo ' + (i + 1);
      if (!v || !esTexto(v.id, 60) || !v.id || idsVeh.has(v.id)) return malo(n + ': identificador no válido o repetido.');
      if (!esTexto(v.marca, 40) || !v.marca.trim() || !esTexto(v.modelo, 40) || !v.modelo.trim()) return malo(n + ': falta la marca o el modelo.');
      if (!Array.isArray(v.lecturas) || !v.lecturas.length) return malo(n + ': no tiene lecturas de kilometraje.');
      var lecturasOk = v.lecturas.every(function (l) { return l && esFechaISO(l.fecha) && esEnteroEn(l.km, 0, MAX_KM); });
      if (!lecturasOk) return malo(n + ': hay lecturas de kilometraje no válidas.');
      if (v.anio != null && !esEnteroEn(v.anio, 1900, 2200)) return malo(n + ': año no válido.');
      if (v.fechaAdquisicion != null && !esFechaISO(v.fechaAdquisicion)) return malo(n + ': fecha de compra no válida.');
      if (v.precioCompra != null && !esEnteroEn(v.precioCompra, 0, MAX_IMPORTE_CENT * 10)) return malo(n + ': precio de compra no válido.');
      if (v.valorEstimado != null && !esEnteroEn(v.valorEstimado, 0, MAX_IMPORTE_CENT * 10)) return malo(n + ': valor estimado no válido.');
      var foto = null;
      if (v.foto != null) {
        if (typeof v.foto === 'string' && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(v.foto) && v.foto.length < 3000000) foto = v.foto;
        else avisos.push(n + ': la foto no era válida y se ha descartado.');
      }
      var aceite = null;
      if (v.aceite && esEnteroEn(v.aceite.kmUltimo, 0, MAX_KM) && esEnteroEn(v.aceite.intervalo, 500, 200000))
        aceite = { kmUltimo: v.aceite.kmUltimo, intervalo: v.aceite.intervalo };
      idsVeh.add(v.id);
      limpio.vehiculos.push({
        id: v.id, marca: v.marca.trim(), modelo: v.modelo.trim(), anio: v.anio == null ? null : v.anio,
        matricula: esTexto(v.matricula, 15) ? v.matricula : '', fechaAdquisicion: v.fechaAdquisicion || null,
        precioCompra: v.precioCompra == null ? null : v.precioCompra, valorEstimado: v.valorEstimado == null ? null : v.valorEstimado,
        lecturas: v.lecturas.map(function (l) { return { fecha: l.fecha, km: l.km }; }), foto: foto, aceite: aceite,
        creado: Number.isFinite(v.creado) ? v.creado : 0
      });
    });

    d.gastos.forEach(function (g, i) {
      var n = 'Gasto ' + (i + 1);
      if (!g || !esTexto(g.id, 60) || !g.id || idsGas.has(g.id)) return malo(n + ': identificador no válido o repetido.');
      if (!idsVeh.has(g.vehiculoId)) return malo(n + ': pertenece a un vehículo que no existe.');
      if (!esFechaISO(g.fecha)) return malo(n + ': fecha no válida.');
      if (!esEnteroEn(g.importe, 1, MAX_IMPORTE_CENT)) return malo(n + ': importe no válido (debe ser positivo).');
      if (!idsCat.has(g.categoria)) return malo(n + ': categoría desconocida «' + String(g.categoria) + '».');
      if (g.km != null && !esEnteroEn(g.km, 0, MAX_KM)) return malo(n + ': kilometraje no válido.');
      if (g.litros != null && !(typeof g.litros === 'number' && g.litros > 0 && g.litros <= 500)) return malo(n + ': litros no válidos.');
      if (g.precioLitro != null && !(typeof g.precioLitro === 'number' && g.precioLitro > 0 && g.precioLitro <= 10)) return malo(n + ': precio por litro no válido.');
      idsGas.add(g.id);
      limpio.gastos.push({
        id: g.id, vehiculoId: g.vehiculoId, fecha: g.fecha, importe: g.importe, categoria: g.categoria,
        descripcion: esTexto(g.descripcion, 120) ? g.descripcion : '', notas: esTexto(g.notas, 500) ? g.notas : '',
        km: g.km == null ? null : g.km, litros: g.litros == null ? null : g.litros, precioLitro: g.precioLitro == null ? null : g.precioLitro,
        creado: Number.isFinite(g.creado) ? g.creado : 0
      });
    });

    (Array.isArray(d.recordatorios) ? d.recordatorios : []).forEach(function (r, i) {
      if (!r || !esTexto(r.id, 60) || !idsVeh.has(r.vehiculoId) || !esFechaISO(r.fecha) || TIPOS_RECORDATORIO.indexOf(r.tipo) < 0)
        return malo('Recordatorio ' + (i + 1) + ': datos no válidos.');
      limpio.recordatorios.push({ id: r.id, vehiculoId: r.vehiculoId, tipo: r.tipo, titulo: esTexto(r.titulo, 60) ? r.titulo : '', fecha: r.fecha, notas: esTexto(r.notas, 300) ? r.notas : '' });
    });

    // Coherencia de kilometraje por vehículo.
    limpio.vehiculos.forEach(function (v) {
      var c = coherenciaLecturas(lecturasVehiculo(v, limpio.gastos));
      if (c) malo(v.marca + ' ' + v.modelo + ': kilometraje incoherente. ' + c);
    });

    if (errores.length) return { ok: false, errores: errores };
    return { ok: true, errores: [], avisos: avisos, datos: limpio, demo: !!obj.demo, resumen: { vehiculos: limpio.vehiculos.length, gastos: limpio.gastos.length, recordatorios: limpio.recordatorios.length, categorias: limpio.categorias.length } };
  }

  /* ------------------------------------------------------------------ */
  /* CSV (separador «;» y coma decimal, como lo abre Excel en España)     */
  /* ------------------------------------------------------------------ */
  function celdaCSV(v) {
    var s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita fórmulas inyectadas al abrir en una hoja de cálculo
    if (/[;"\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function decimalCSV(n, dec) { return n == null ? '' : n.toFixed(dec).replace('.', ','); }
  function aCSV(gastos, vehiculos, categorias) {
    var cab = ['Fecha', 'Vehículo', 'Matrícula', 'Categoría', 'Descripción', 'Importe (€)', 'Kilometraje', 'Litros', 'Precio por litro (€)', 'Notas'];
    var filas = ordenarGastos(gastos, 'fecha-asc').map(function (g) {
      var v = vehiculos.find(function (x) { return x.id === g.vehiculoId; }) || {};
      var c = (categorias || CATEGORIAS_BASE).find(function (x) { return x.id === g.categoria; }) || { nombre: g.categoria };
      return [formatoFecha(g.fecha), (v.marca || '') + ' ' + (v.modelo || ''), v.matricula || '', c.nombre, g.descripcion || '',
        decimalCSV(g.importe / 100, 2), g.km == null ? '' : g.km, decimalCSV(g.litros, 2), decimalCSV(g.precioLitro, 3), g.notas || ''];
    });
    return [cab].concat(filas).map(function (f) { return f.map(celdaCSV).join(';'); }).join('\r\n');
  }

  function nuevoId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  return {
    VERSION_DATOS: VERSION_DATOS, CATEGORIAS_BASE: CATEGORIAS_BASE, CATEGORIAS_ANUALES: CATEGORIAS_ANUALES,
    ICONOS_PERSONALIZADOS: ICONOS_PERSONALIZADOS, COLORES_PERSONALIZADOS: COLORES_PERSONALIZADOS, TIPOS_RECORDATORIO: TIPOS_RECORDATORIO,
    esFechaISO: esFechaISO, diaNum: diaNum, isoDeDia: isoDeDia, hoyISO: hoyISO, sumarDias: sumarDias, mesDe: mesDe,
    sumarMeses: sumarMeses, ultimoDiaMes: ultimoDiaMes, listaMeses: listaMeses, rangoPeriodo: rangoPeriodo, periodoAnterior: periodoAnterior,
    formatoEuros: formatoEuros, formatoNumero: formatoNumero, formatoKm: formatoKm, formatoEurKm: formatoEurKm,
    formatoFecha: formatoFecha, formatoFechaCorta: formatoFechaCorta, nombreMes: nombreMes, mesCorto: mesCorto, porcentaje: porcentaje,
    parseNumeroES: parseNumeroES, aCentimos: aCentimos, importeCombustible: importeCombustible,
    lecturasVehiculo: lecturasVehiculo, puntosDiarios: puntosDiarios, kmActual: kmActual, kmEnDia: kmEnDia,
    comprobarKm: comprobarKm, coherenciaLecturas: coherenciaLecturas, kmPeriodo: kmPeriodo,
    suma: suma, filtrarGastos: filtrarGastos, ordenarGastos: ordenarGastos, porCategoria: porCategoria,
    costePorKm: costePorKm, resumenPeriodo: resumenPeriodo, mediaMensual: mediaMensual, calidadHistorial: calidadHistorial, inicioDatos: inicioDatos,
    serieMensual: serieMensual, serieAcumulada: serieAcumulada, compararMeses: compararMeses,
    depreciacion: depreciacion, estadoRecordatorio: estadoRecordatorio, estadoAceite: estadoAceite,
    validarGasto: validarGasto, validarVehiculo: validarVehiculo, leerKm: leerKm,
    datosVacios: datosVacios, crearCopia: crearCopia, validarImportacion: validarImportacion, aCSV: aCSV, nuevoId: nuevoId
  };
});

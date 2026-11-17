/*
 * Mi Garaje IA — persistencia en el navegador (localStorage).
 * Los datos reales y los de demostración van en claves SEPARADAS para que nunca se mezclen.
 * Nada sale del dispositivo.
 */
(function (raiz) {
  'use strict';
  var C = raiz.Calculos;
  var CLAVES = { real: 'miGarajeIA.datos.v1', demo: 'miGarajeIA.demo.v1', prefs: 'miGarajeIA.prefs.v1' };

  function leerJSON(clave) {
    try {
      var t = raiz.localStorage.getItem(clave);
      return t ? JSON.parse(t) : null;
    } catch (e) { return null; }
  }

  function cargar(modo) {
    var d = leerJSON(CLAVES[modo === 'demo' ? 'demo' : 'real']);
    if (!d || !Array.isArray(d.vehiculos) || !Array.isArray(d.gastos)) return C.datosVacios();
    d.categorias = Array.isArray(d.categorias) ? d.categorias : [];
    d.recordatorios = Array.isArray(d.recordatorios) ? d.recordatorios : [];
    return d;
  }

  /** Devuelve {ok:true} o {ok:false, error} (p. ej. si el almacenamiento está lleno o bloqueado). */
  function guardar(modo, datos) {
    try {
      raiz.localStorage.setItem(CLAVES[modo === 'demo' ? 'demo' : 'real'], JSON.stringify(datos));
      return { ok: true };
    } catch (e) {
      var lleno = e && (e.name === 'QuotaExceededError' || e.code === 22);
      return { ok: false, error: lleno ? 'El almacenamiento del navegador está lleno. Prueba a quitar fotos de los vehículos.' : 'El navegador no permite guardar datos (¿modo privado?).' };
    }
  }

  function borrar(modo) {
    try { raiz.localStorage.removeItem(CLAVES[modo === 'demo' ? 'demo' : 'real']); } catch (e) { /* nada */ }
  }

  var PREFS_BASE = { modo: 'real', tema: 'oscuro', activo: { real: null, demo: null }, ultimaCategoria: 'gasolina', bienvenidaVista: false };
  function cargarPrefs() {
    var p = leerJSON(CLAVES.prefs) || {};
    var r = Object.assign({}, PREFS_BASE, p);
    r.activo = Object.assign({ real: null, demo: null }, p.activo || {});
    if (r.modo !== 'demo') r.modo = 'real';
    return r;
  }
  function guardarPrefs(p) {
    try { raiz.localStorage.setItem(CLAVES.prefs, JSON.stringify(p)); } catch (e) { /* preferencia no crítica */ }
  }

  /** Bytes aproximados ocupados por la app (UTF-16 → 2 bytes por carácter). */
  function bytesUsados() {
    var t = 0;
    try {
      [CLAVES.real, CLAVES.demo, CLAVES.prefs].forEach(function (k) {
        var v = raiz.localStorage.getItem(k); if (v) t += (v.length + k.length) * 2;
      });
    } catch (e) { /* nada */ }
    return t;
  }

  /** Pide al navegador que no borre estos datos automáticamente (si lo permite). */
  function pedirPersistencia() {
    try {
      if (raiz.navigator.storage && raiz.navigator.storage.persist) return raiz.navigator.storage.persist();
    } catch (e) { /* nada */ }
    return Promise.resolve(false);
  }

  raiz.Almacen = { CLAVES: CLAVES, cargar: cargar, guardar: guardar, borrar: borrar, cargarPrefs: cargarPrefs, guardarPrefs: guardarPrefs, bytesUsados: bytesUsados, pedirPersistencia: pedirPersistencia };
})(self);

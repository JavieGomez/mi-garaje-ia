/*
 * Mi Garaje IA — interfaz.
 * Arquitectura sencilla: un estado (datos + preferencias), funciones que devuelven HTML por vista,
 * delegación de eventos con atributos data-accion y persistencia inmediata en localStorage.
 */
(function () {
  'use strict';
  var C = window.Calculos, A = window.Almacen, G = window.Graficos, ico = window.Iconos.icono;
  var VERSION_APP = '1.0.0';

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                          */
  /* ------------------------------------------------------------------ */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.from((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var eur = C.formatoEuros, fkm = C.formatoKm, ffecha = C.formatoFecha;
  function hoy() { return C.hoyISO(); }
  function mesHoy() { return hoy().slice(0, 7); }
  function entradaImporte(cent) { return cent == null ? '' : (cent / 100).toFixed(2).replace('.', ','); }
  function entradaDecimal(n) { return n == null ? '' : String(n).replace('.', ','); }
  function plural(n, uno, varios) { return C.formatoNumero(n) + ' ' + (n === 1 ? uno : varios); }
  var movimientoReducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ */
  /* Estado                                                              */
  /* ------------------------------------------------------------------ */
  var prefs = A.cargarPrefs();
  var modo = prefs.modo;
  var datos = A.cargar(modo);
  var vistaActual = 'inicio';
  var periodo = { tipo: 'mes', ref: mesHoy() };
  var filtros = { texto: '', categoria: '', desde: '', hasta: '', orden: 'fecha-desc', abierto: false, limite: 150 };
  var comparacion = { a: null, b: null };
  var memoriaNumeros = new Map();
  var datosCambiados = false;
  var graficosVista = [];

  if (modo === 'demo' && !datos.vehiculos.length) { datos = window.Demo.generar(hoy()); A.guardar('demo', datos); }

  function categorias() { return C.CATEGORIAS_BASE.concat(datos.categorias); }
  function categoria(id) { return categorias().find(function (c) { return c.id === id; }) || C.CATEGORIAS_BASE[8]; }
  function vehiculo(id) { return datos.vehiculos.find(function (v) { return v.id === id; }); }
  function vehiculoActivo() {
    return vehiculo(prefs.activo[modo]) || datos.vehiculos[0] || null;
  }
  function gastosDe(v) { return v ? datos.gastos.filter(function (g) { return g.vehiculoId === v.id; }) : []; }
  function nombreVehiculo(v) { return v.marca + ' ' + v.modelo; }
  function kmAhora(v) { return C.kmActual(v, datos.gastos); }

  function persistir() {
    var r = A.guardar(modo, datos);
    if (!r.ok) { aviso(r.error, 'error'); return false; }
    datosCambiados = true;
    return true;
  }
  function guardarPrefs() { prefs.modo = modo; A.guardarPrefs(prefs); }

  /* ------------------------------------------------------------------ */
  /* Avisos (toasts) y diálogos                                          */
  /* ------------------------------------------------------------------ */
  function aviso(texto, tipo, accion) {
    var cont = $('#avisos');
    var el = document.createElement('div');
    el.className = 'aviso-toast ' + (tipo || 'ok');
    el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    el.innerHTML = ico(tipo === 'error' ? 'aviso' : tipo === 'info' ? 'info' : 'check') + '<span>' + esc(texto) + '</span>' +
      (accion ? '<button type="button" class="btn-mini">' + esc(accion.etiqueta) + '</button>' : '');
    if (accion) el.querySelector('button').addEventListener('click', function () { accion.fn(); quitar(); });
    cont.appendChild(el);
    while (cont.children.length > 3) cont.removeChild(cont.firstChild);
    var t = setTimeout(quitar, accion ? 7000 : 4200);
    function quitar() { clearTimeout(t); el.classList.add('saliendo'); setTimeout(function () { el.remove(); }, 250); }
  }

  var pilaFoco = [];
  function trampaFoco(capa, e) {
    var foc = $$('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select,textarea,[tabindex="0"]', capa).filter(function (x) { return x.offsetParent !== null; });
    if (!foc.length) return;
    var pri = foc[0], ult = foc[foc.length - 1];
    if (e.shiftKey && document.activeElement === pri) { e.preventDefault(); ult.focus(); }
    else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); pri.focus(); }
  }

  /** confirmar({titulo, texto, boton, peligro}) → Promise<boolean> */
  function confirmar(o) {
    return new Promise(function (resolver) {
      var capa = $('#capa-dialogo');
      pilaFoco.push(document.activeElement);
      capa.innerHTML = '<div class="dialogo" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby="dlg-d">' +
        '<div class="dialogo-ico ' + (o.peligro ? 'peligro' : '') + '">' + ico(o.peligro ? 'papelera' : 'info') + '</div>' +
        '<h2 id="dlg-t">' + esc(o.titulo) + '</h2><p id="dlg-d">' + esc(o.texto) + '</p>' +
        '<div class="dialogo-acciones"><button type="button" class="btn secundario" data-r="0">Cancelar</button>' +
        '<button type="button" class="btn ' + (o.peligro ? 'peligro' : 'primario') + '" data-r="1">' + esc(o.boton || 'Aceptar') + '</button></div></div>';
      capa.hidden = false;
      requestAnimationFrame(function () { capa.classList.add('abierta'); });
      $('[data-r="' + (o.peligro ? '0' : '1') + '"]', capa).focus();
      function fin(valor) {
        capa.classList.remove('abierta');
        capa.removeEventListener('click', clic);
        capa._cerrar = null;
        setTimeout(function () { capa.hidden = true; capa.innerHTML = ''; }, 160);
        var f = pilaFoco.pop(); if (f && f.focus) f.focus();
        resolver(valor);
      }
      function clic(e) {
        var b = e.target.closest('[data-r]');
        if (b) fin(b.getAttribute('data-r') === '1');
        else if (e.target === capa) fin(false);
      }
      capa.addEventListener('click', clic);
      capa._cerrar = function () { fin(false); };
    });
  }

  /** Hoja inferior (en escritorio, ventana centrada). */
  function abrirHoja(titulo, cuerpo, alMontar) {
    var capa = $('#capa-hoja');
    if (capa.hidden) pilaFoco.push(document.activeElement);
    capa.innerHTML = '<div class="hoja" role="dialog" aria-modal="true" aria-labelledby="hoja-titulo">' +
      '<div class="hoja-cab"><h2 id="hoja-titulo">' + titulo + '</h2>' +
      '<button type="button" class="btn-icono" data-accion="cerrar-hoja" aria-label="Cerrar">' + ico('cerrar') + '</button></div>' +
      '<div class="hoja-cuerpo">' + cuerpo + '</div></div>';
    capa.hidden = false;
    document.body.classList.add('con-capa');
    requestAnimationFrame(function () { capa.classList.add('abierta'); });
    hidratarIconos(capa);
    var hoja = $('.hoja', capa);
    if (alMontar) alMontar(hoja);
    var primero = $('[autofocus]', hoja) || $('input:not([type=radio]):not([type=hidden]),select,textarea,button:not([data-accion=cerrar-hoja])', hoja);
    if (primero) setTimeout(function () { try { primero.focus({ preventScroll: true }); } catch (e) { primero.focus(); } }, 60);
    return hoja;
  }
  function cerrarHoja() {
    var capa = $('#capa-hoja');
    if (capa.hidden) return;
    capa.classList.remove('abierta');
    document.body.classList.remove('con-capa');
    setTimeout(function () { if (!capa.classList.contains('abierta')) { capa.hidden = true; capa.innerHTML = ''; } }, 220);
    var f = pilaFoco.pop();
    if (f && f.focus && document.contains(f)) f.focus();
  }

  /* ------------------------------------------------------------------ */
  /* Piezas de formulario                                                */
  /* ------------------------------------------------------------------ */
  function campo(o) {
    var id = 'f-' + o.nombre;
    var desc = 'e-' + o.nombre + (o.ayuda ? ' a-' + o.nombre : '');
    var control = o.tipo === 'textarea'
      ? '<textarea id="' + id + '" name="' + o.nombre + '" rows="3" maxlength="' + (o.max || 500) + '" aria-describedby="' + desc + '" placeholder="' + esc(o.placeholder || '') + '">' + esc(o.valor) + '</textarea>'
      : o.tipo === 'select'
        ? '<select id="' + id + '" name="' + o.nombre + '" aria-describedby="' + desc + '">' + o.opciones + '</select>'
        : '<input id="' + id + '" name="' + o.nombre + '" type="' + (o.tipo || 'text') + '" value="' + esc(o.valor) + '" aria-describedby="' + desc + '"' +
          (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + ' ' + (o.attrs || '') + '>';
    return '<div class="campo ' + (o.clase || '') + '"><label for="' + id + '">' + esc(o.etiqueta) + (o.opcional ? ' <span class="opcional">(opcional)</span>' : '') + '</label>' +
      '<div class="entrada' + (o.sufijo ? ' con-sufijo' : '') + '">' + control + (o.sufijo ? '<span class="sufijo" aria-hidden="true">' + esc(o.sufijo) + '</span>' : '') + '</div>' +
      (o.ayuda ? '<p class="ayuda" id="a-' + o.nombre + '">' + o.ayuda + '</p>' : '') +
      '<p class="error" id="e-' + o.nombre + '"></p></div>';
  }
  function mostrarErrores(form, errores, general) {
    $$('.error', form).forEach(function (p) { p.textContent = ''; });
    $$('[aria-invalid]', form).forEach(function (i) { i.removeAttribute('aria-invalid'); });
    var primero = null;
    Object.keys(errores).forEach(function (k) {
      var p = $('#e-' + k, form);
      if (p) p.textContent = errores[k];
      var el = form.elements[k];
      if (el && el.length && !el.tagName) el = el[0];
      if (el && el.setAttribute) { el.setAttribute('aria-invalid', 'true'); if (!primero) primero = el; }
    });
    var g = $('.error-general', form);
    if (g) { g.textContent = general || ''; g.hidden = !general; }
    if (primero) primero.focus();
    else if (general && g) g.scrollIntoView({ block: 'nearest' });
  }
  function valores(form) {
    var r = {};
    new FormData(form).forEach(function (v, k) { r[k] = typeof v === 'string' ? v : v; });
    return r;
  }

  /* ------------------------------------------------------------------ */
  /* Renderizado general                                                 */
  /* ------------------------------------------------------------------ */
  function hidratarIconos(raiz) {
    $$('[data-icono]', raiz).forEach(function (el) { el.innerHTML = ico(el.getAttribute('data-icono')); el.removeAttribute('data-icono'); });
  }
  function grafico(id, fn) { graficosVista.push({ id: id, fn: fn }); return '<div class="lienzo" id="' + id + '"></div>'; }
  function dibujarGraficos() {
    graficosVista.forEach(function (g) {
      var el = document.getElementById(g.id);
      if (el) el.innerHTML = g.fn(Math.floor(el.clientWidth));
    });
  }

  function render() {
    document.documentElement.setAttribute('data-tema', prefs.tema === 'claro' ? 'claro' : 'oscuro');
    var meta = $('meta[name=theme-color]'); if (meta) meta.setAttribute('content', prefs.tema === 'claro' ? '#F3F6FC' : '#0A1124');
    var hay = datos.vehiculos.length > 0;
    $('#banner-demo').hidden = modo !== 'demo';
    $('#cabecera').hidden = !hay;
    $('#nav').hidden = !hay;
    document.body.classList.toggle('sin-vehiculo', !hay);
    document.body.classList.toggle('modo-demo', modo === 'demo');
    graficosVista = [];
    var html;
    if (!hay && vistaActual !== 'ajustes') html = vistaBienvenida();
    else {
      pintarCabecera();
      $$('#nav [data-vista]').forEach(function (a) {
        if (a.getAttribute('data-vista') === vistaActual) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
      html = ({ inicio: vistaInicio, movimientos: vistaMovimientos, estadisticas: vistaEstadisticas, garaje: vistaGaraje, ajustes: vistaAjustes })[vistaActual]();
    }
    var main = $('#vista');
    main.innerHTML = html;
    main.setAttribute('data-vista', hay ? vistaActual : 'bienvenida');
    hidratarIconos(main);
    dibujarGraficos();
    animarNumeros();
    datosCambiados = false;
  }

  function formatear(f, v) {
    if (f === 'eur') return eur(Math.round(v));
    if (f === 'eurkm') return C.formatoEurKm(v);
    if (f === 'km') return fkm(Math.round(v));
    return C.formatoNumero(Math.round(v));
  }
  function num(clave, valor, f) {
    if (valor == null || !Number.isFinite(valor)) return '<span>—</span>';
    return '<span class="num" data-num="' + clave + '" data-v="' + valor + '" data-f="' + f + '">' + formatear(f, valor) + '</span>';
  }
  function animarNumeros() {
    var v = vehiculoActivo();
    $$('[data-num]').forEach(function (el) {
      var clave = el.getAttribute('data-num') + '|' + (v ? v.id : '') + '|' + modo;
      var nuevo = Number(el.getAttribute('data-v'));
      var previo = memoriaNumeros.get(clave);
      memoriaNumeros.set(clave, nuevo);
      if (previo == null || previo === nuevo) return;
      if (datosCambiados) {
        var tarjeta = el.closest('.kpi, .hero') || el;
        tarjeta.classList.remove('cambiado'); void tarjeta.offsetWidth; tarjeta.classList.add('cambiado');
      }
      if (movimientoReducido) return;
      var f = el.getAttribute('data-f'), t0 = performance.now(), dur = 750;
      (function paso(t) {
        var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = formatear(f, previo + (nuevo - previo) * e);
        if (k < 1) requestAnimationFrame(paso);
      })(t0);
    });
  }

  function avatar(v, clase) {
    if (v.foto) return '<img class="avatar ' + (clase || '') + '" src="' + esc(v.foto) + '" alt="">';
    var ini = (v.marca[0] || '') + (v.modelo[0] || '');
    return '<span class="avatar ' + (clase || '') + '" aria-hidden="true">' + esc(ini.toUpperCase()) + '</span>';
  }
  function pintarCabecera() {
    var v = vehiculoActivo();
    var k = kmAhora(v);
    $('#btn-vehiculo').innerHTML = avatar(v) + '<span class="sv-texto"><span class="sv-nombre">' + esc(nombreVehiculo(v)) + '</span><span class="sv-km">' + (k ? fkm(k.km) : '') + '</span></span>' + ico('abajo', 'sv-flecha');
    $('#btn-vehiculo').setAttribute('aria-label', 'Vehículo: ' + nombreVehiculo(v) + '. Cambiar de vehículo');
    $('#btn-tema').innerHTML = ico(prefs.tema === 'claro' ? 'luna' : 'sol');
    $('#btn-ajustes').innerHTML = ico('ajustes');
  }

  function etiquetaPeriodo() {
    if (periodo.tipo === 'mes') return C.nombreMes(periodo.ref);
    if (periodo.tipo === 'anio') return 'año ' + periodo.ref;
    return 'todo el registro';
  }
  function barraPeriodo() {
    var t = periodo.tipo;
    var texto = t === 'mes' ? C.nombreMes(periodo.ref) : t === 'anio' ? 'Año ' + periodo.ref : 'Todo el registro';
    var puede = t === 'mes' ? periodo.ref < mesHoy() : t === 'anio' ? periodo.ref < hoy().slice(0, 4) : false;
    var seg = [['mes', 'Mes'], ['anio', 'Año'], ['total', 'Total']].map(function (x) {
      return '<button type="button" data-accion="periodo-tipo" data-tipo="' + x[0] + '" aria-pressed="' + (t === x[0]) + '">' + x[1] + '</button>';
    }).join('');
    return '<div class="periodo"><div class="segmentado" role="group" aria-label="Tipo de periodo">' + seg + '</div>' +
      '<div class="periodo-nav">' +
      (t !== 'total' ? '<button type="button" class="btn-icono" data-accion="periodo-mover" data-paso="-1" aria-label="Periodo anterior">' + ico('izquierda') + '</button>' : '') +
      '<span class="periodo-texto" aria-live="polite">' + esc(texto) + '</span>' +
      (t !== 'total' ? '<button type="button" class="btn-icono" data-accion="periodo-mover" data-paso="1" aria-label="Periodo siguiente"' + (puede ? '' : ' disabled') + '>' + ico('derecha') + '</button>' : '') +
      '</div></div>';
  }

  function chipCategoria(c) { return '<span class="cat-ico" style="--c:' + esc(c.color) + '">' + ico(c.icono) + '</span>'; }
  function itemGasto(g) {
    var c = categoria(g.categoria);
    var meta = [c.nombre, C.formatoFechaCorta(g.fecha) + ' ' + g.fecha.slice(0, 4)];
    if (g.litros) meta.push(C.formatoNumero(g.litros, 2) + ' L');
    if (g.km != null) meta.push(fkm(g.km));
    return '<li><button type="button" class="mov" data-accion="editar-gasto" data-id="' + esc(g.id) + '" aria-label="' + esc((g.descripcion || c.nombre) + ', ' + eur(g.importe) + ', ' + ffecha(g.fecha) + '. Editar') + '">' +
      chipCategoria(c) + '<span class="mov-txt"><span class="mov-titulo">' + esc(g.descripcion || c.nombre) + '</span><span class="mov-meta">' + esc(meta.join(' · ')) + '</span></span>' +
      '<span class="mov-importe">' + eur(g.importe) + '</span></button></li>';
  }
  function vacioHTML(icono, titulo, texto, boton) {
    return '<div class="vacio"><div class="vacio-ico">' + ico(icono) + '</div><h3>' + esc(titulo) + '</h3><p>' + texto + '</p>' + (boton || '') + '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* Vista: bienvenida                                                   */
  /* ------------------------------------------------------------------ */
  function vistaBienvenida() {
    var item = function (i, t, s) { return '<li><span class="ventaja-ico">' + ico(i) + '</span><div><strong>' + t + '</strong><span>' + s + '</span></div></li>'; };
    return '<section class="bienvenida">' +
      '<div class="bienvenida-cab"><img src="iconos/icono.svg" alt="" width="84" height="84" class="bienvenida-logo">' +
      '<p class="sobretitulo">Chiky &amp; IA</p><h1>Mi Garaje <span class="acento">IA</span></h1>' +
      '<p class="lema">Descubre cuánto te cuesta <strong>de verdad</strong> tener tu coche.</p></div>' +
      '<ul class="ventajas">' +
      item('euro', 'Apunta gastos en segundos', 'Gasolina, seguro, taller, ITV, parking, peajes…') +
      item('velocimetro', 'Tu coste por kilómetro', 'Calculado con tus datos reales y avisando si faltan.') +
      item('grafico', 'Gráficos claros', 'En qué se va el dinero, mes a mes.') +
      item('candado', 'Privado y gratis', 'Sin cuentas ni anuncios. Tus datos no salen de este dispositivo.') +
      '</ul>' +
      '<div class="bienvenida-acciones">' +
      '<button type="button" class="btn primario grande" data-accion="nuevo-vehiculo">' + ico('coche') + 'Registrar mi coche</button>' +
      '<button type="button" class="btn secundario grande" data-accion="entrar-demo">' + ico('estrella') + 'Probar con datos de demostración</button>' +
      '<button type="button" class="btn enlace" data-accion="importar">¿Tienes una copia de seguridad? Impórtala</button></div>' +
      '<p class="nota-privacidad">' + ico('info') + '<span>Los datos se guardan solo en este navegador. Si borras los datos de navegación, se pierden: exporta copias de seguridad de vez en cuando.</span></p>' +
      '</section>';
  }

  /* ------------------------------------------------------------------ */
  /* Vista: inicio (panel principal)                                     */
  /* ------------------------------------------------------------------ */
  function textoEstadoCoste(c) {
    return { ok: 'Datos completos', parcial: 'Datos parciales', 'sin-km': 'Faltan kilómetros', 'km-cero': 'Sin km recorridos', 'sin-gastos': 'Sin gastos' }[c.estado];
  }
  function vistaInicio() {
    var v = vehiculoActivo(), gs = gastosDe(v);
    if (!gs.length) {
      return '<section class="tarjeta">' + vacioHTML('euro', 'Aún no hay gastos de tu ' + nombreVehiculo(v),
          'Empieza por lo más fácil: el último repostaje o el seguro. Con dos o tres gastos ya verás tus primeras estadísticas.',
          '<button type="button" class="btn primario" data-accion="nuevo-gasto">' + ico('mas') + 'Añadir mi primer gasto</button>') + '</section>' +
        '<div class="rejilla-2">' + tarjetaKm(v) + tarjetaRecordatorios(v, true) + '</div>';
    }
    var r = C.resumenPeriodo(v, gs, categorias(), periodo, hoy());
    var c = r.coste;
    var html = barraPeriodo();

    // Hero
    var comp = '';
    if (r.anterior && (r.anterior.total > 0 || r.total > 0)) {
      var sube = r.anterior.dif > 0;
      comp = r.anterior.fraccion == null ? '<span class="comp neutro">Sin gastos en ' + esc(periodo.tipo === 'mes' ? C.nombreMes(r.anterior.ref) : r.anterior.ref) + '</span>'
        : '<span class="comp ' + (r.anterior.dif === 0 ? 'neutro' : sube ? 'sube' : 'baja') + '">' + (r.anterior.dif === 0 ? '=' : sube ? '▲' : '▼') + ' ' + C.porcentaje(Math.abs(r.anterior.fraccion)) +
          ' vs ' + esc(periodo.tipo === 'mes' ? C.nombreMes(r.anterior.ref).split(' ')[0] : r.anterior.ref) + '</span>';
    }
    var tira = r.porCategoria.map(function (x) {
      return '<span style="--c:' + esc(x.color) + ';flex-grow:' + x.cent + '" title="' + esc(x.nombre + ': ' + eur(x.cent)) + '"></span>';
    }).join('');
    html += '<div class="panel">' +
      '<section class="hero" aria-label="Gasto total del periodo">' +
      '<div class="hero-cab"><span class="etiqueta">Gasto total · ' + esc(etiquetaPeriodo()) + '</span>' +
      '<span class="chip-calidad ' + (r.historial.completo ? 'ok' : 'parcial') + '" title="' + esc(r.historial.texto) + '">' + (r.historial.completo ? 'Histórico completo' : 'Registro parcial') + '</span></div>' +
      '<div class="hero-importe">' + num('total', r.total, 'eur') + '</div>' +
      '<div class="hero-pie"><span>' + num('nmov', r.numMov, 'int') + ' ' + (r.numMov === 1 ? 'movimiento' : 'movimientos') + (r.numMov ? ' · media ' + eur(Math.round(r.total / r.numMov)) : '') + '</span>' + comp + '</div>' +
      (r.total > 0 ? '<div class="tira" aria-hidden="true">' + tira + '</div>' : '') +
      '</section>';

    // KPIs
    var kpiKm = '<button type="button" class="kpi kpi-km destacado" data-accion="detalle-km">' +
      '<span class="kpi-cab">' + ico('velocimetro') + 'Coste por km</span>' +
      (c.eurKm != null
        ? '<span class="kpi-valor">' + num('eurkm', c.eurKm, 'eurkm') + '</span><span class="kpi-sub">≈ ' + eur(Math.round(c.eurKm * 10000)) + ' cada 100 km</span>'
        : '<span class="kpi-valor apagado">—</span><span class="kpi-sub">' + esc(c.estado === 'sin-km' ? 'Actualiza el kilometraje' : textoEstadoCoste(c)) + '</span>') +
      '<span class="estado-dato ' + c.estado + '">' + esc(textoEstadoCoste(c)) + ' · ver cálculo</span></button>';
    var top = r.top;
    var kpiTop = '<div class="kpi"><span class="kpi-cab">' + ico('trofeo') + 'Categoría más cara</span>' +
      (top ? '<span class="kpi-valor kpi-cat">' + chipCategoria(top) + esc(top.nombre) + '</span><span class="kpi-sub">' + eur(top.cent) + ' · ' + C.porcentaje(top.fraccion) + ' del total</span>'
        : '<span class="kpi-valor apagado">—</span><span class="kpi-sub">Sin gastos en este periodo</span>') + '</div>';
    var kpiMedia = '<div class="kpi"><span class="kpi-cab">' + ico('calendario') + 'Gasto medio mensual</span>' +
      '<span class="kpi-valor">' + num('media', r.media.cent, 'eur') + '</span><span class="kpi-sub">' + esc(r.media.etiqueta) + (r.media.pocosDatos ? ' · menos de un mes de datos' : '') + '</span></div>';
    var kpiMes;
    if (periodo.tipo === 'mes') {
      kpiMes = '<div class="kpi"><span class="kpi-cab">' + ico('euro') + 'Gasto mensual anterior</span><span class="kpi-valor">' + num('mesant', r.anterior.total, 'eur') + '</span><span class="kpi-sub">' + esc(C.nombreMes(r.anterior.ref)) + '</span></div>';
    } else {
      var rm = C.rangoPeriodo('mes', mesHoy());
      var totMes = C.suma(gs.filter(function (g) { return g.fecha >= rm.desde && g.fecha <= rm.hasta; }));
      kpiMes = '<div class="kpi"><span class="kpi-cab">' + ico('euro') + 'Gasto de este mes</span><span class="kpi-valor">' + num('mesact', totMes, 'eur') + '</span><span class="kpi-sub">' + esc(C.nombreMes(mesHoy())) + '</span></div>';
    }
    var cb = r.combustible;
    var kpiComb = '<div class="kpi"><span class="kpi-cab">' + ico('surtidor') + 'Combustible</span><span class="kpi-valor">' + num('comb', cb.total, 'eur') + '</span>' +
      '<span class="kpi-sub">' + (cb.repostajes ? plural(cb.repostajes, 'repostaje', 'repostajes') + (cb.precioMedio ? ' · ' + C.formatoNumero(cb.precioMedio, 3) + ' €/L' : '') : 'Sin repostajes') + '</span></div>';
    html += '<div class="kpis">' + kpiKm + kpiTop + kpiMedia + kpiMes + kpiComb + '</div>';

    // Por categoría
    var cats = r.porCategoria;
    html += '<section class="tarjeta" aria-labelledby="t-cat"><div class="tarjeta-cab"><h2 id="t-cat">En qué se va el dinero</h2><a class="enlace-sec" href="#estadisticas">Gráficos</a></div>' +
      (cats.length ? '<ul class="barras-cat">' + cats.map(function (x) {
        return '<li><button type="button" class="fila-cat" data-accion="filtrar-cat" data-cat="' + esc(x.id) + '" aria-label="' + esc(x.nombre + ': ' + eur(x.cent) + ', ' + C.porcentaje(x.fraccion) + '. Ver movimientos') + '">' + chipCategoria(x) +
          '<span class="fila-cat-txt"><span class="fila-cat-nombre">' + esc(x.nombre) + '</span><span class="barra-prog"><span style="--c:' + esc(x.color) + ';width:' + Math.max(2, Math.round(x.fraccion * 100)) + '%"></span></span></span>' +
          '<span class="fila-cat-val"><strong>' + eur(x.cent) + '</strong><span>' + C.porcentaje(x.fraccion) + '</span></span></button></li>';
      }).join('') + '</ul>' : '<p class="texto-sec">No hay gastos en ' + esc(etiquetaPeriodo()) + '.</p>') + '</section>';

    // Evolución (últimos 6 meses)
    var fin = periodo.tipo === 'mes' ? periodo.ref : periodo.tipo === 'anio' ? (periodo.ref + '-12' < mesHoy() ? periodo.ref + '-12' : mesHoy()) : mesHoy();
    var ini = C.sumarMeses(fin, -5);
    var serie = C.serieMensual(gs, ini, fin);
    html += '<section class="tarjeta" aria-labelledby="t-evo"><div class="tarjeta-cab"><h2 id="t-evo">Evolución · últimos 6 meses</h2><a class="enlace-sec" href="#estadisticas">Ver más</a></div>' +
      grafico('g-evo', function (w) { return G.barras(serie, categorias(), { ancho: w, alto: 190, destacado: periodo.tipo === 'mes' ? periodo.ref : null, titulo: 'Gastos de los últimos 6 meses' }); }) + '</section>';

    html += tarjetaRecordatorios(v, false);

    // Últimos movimientos
    var ult = C.ordenarGastos(gs, 'fecha-desc').slice(0, 5);
    html += '<section class="tarjeta" aria-labelledby="t-ult"><div class="tarjeta-cab"><h2 id="t-ult">Últimos movimientos</h2><a class="enlace-sec" href="#movimientos">Ver todos</a></div>' +
      '<ul class="lista-mov">' + ult.map(itemGasto).join('') + '</ul></section>';
    html += '</div>';
    html += '<p class="pie-privacidad">' + ico('candado') + 'Tus datos se guardan solo en este navegador. <a href="#ajustes">Copia de seguridad</a></p>';
    return html;
  }

  function tarjetaKm(v) {
    var k = kmAhora(v);
    return '<section class="tarjeta"><div class="tarjeta-cab"><h2>Kilometraje</h2></div><p class="dato-grande">' + (k ? fkm(k.km) : '—') + '</p>' +
      '<p class="texto-sec">Última lectura: ' + (k ? ffecha(k.fecha) : '—') + '</p>' +
      '<button type="button" class="btn secundario" data-accion="actualizar-km">' + ico('velocimetro') + 'Actualizar kilometraje</button></section>';
  }

  function textoDias(d) {
    if (d < 0) return 'Venció hace ' + plural(-d, 'día', 'días');
    if (d === 0) return 'Hoy';
    if (d === 1) return 'Mañana';
    return 'En ' + plural(d, 'día', 'días');
  }
  var NOMBRE_TIPO = { itv: 'ITV', seguro: 'Seguro', mantenimiento: 'Mantenimiento', impuestos: 'Impuestos', otro: 'Otro' };
  var ICONO_TIPO = { itv: 'itv', seguro: 'seguro', mantenimiento: 'mantenimiento', impuestos: 'impuestos', otro: 'campana' };
  function tarjetaRecordatorios(v, compacta) {
    var recs = datos.recordatorios.filter(function (r) { return r.vehiculoId === v.id; }).sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
    var k = kmAhora(v), ac = C.estadoAceite(v, k ? k.km : null);
    var lista = recs.slice(0, compacta ? 3 : 4).map(function (r) {
      var e = C.estadoRecordatorio(r.fecha, hoy());
      return '<li><button type="button" class="rec nivel-' + e.nivel + '" data-accion="editar-recordatorio" data-id="' + esc(r.id) + '">' +
        '<span class="rec-ico">' + ico(ICONO_TIPO[r.tipo]) + '</span><span class="rec-txt"><strong>' + esc(r.titulo || NOMBRE_TIPO[r.tipo]) + '</strong><span>' + ffecha(r.fecha) + '</span></span>' +
        '<span class="rec-dias">' + esc(textoDias(e.dias)) + '</span></button></li>';
    }).join('');
    var aceite = ac ? '<div class="aceite nivel-' + ac.nivel + '"><div class="aceite-cab"><span>' + ico('gotaAceite') + 'Cambio de aceite</span><strong>' +
      (ac.restantes >= 0 ? 'faltan ' + fkm(ac.restantes) : 'pasado ' + fkm(-ac.restantes)) + '</strong></div>' +
      '<div class="barra-prog grande"><span style="width:' + Math.round(ac.fraccion * 100) + '%"></span></div><span class="texto-sec">Próximo a los ' + fkm(ac.proximo) + '</span></div>' : '';
    return '<section class="tarjeta" aria-labelledby="t-rec"><div class="tarjeta-cab"><h2 id="t-rec">Recordatorios</h2><button type="button" class="enlace-sec" data-accion="nuevo-recordatorio">+ Añadir</button></div>' +
      aceite + (lista ? '<ul class="lista-rec">' + lista + '</ul>' : '') +
      (!lista && !ac ? '<p class="texto-sec">Apunta la ITV, el seguro o la próxima revisión y los verás aquí con los días que faltan. <button type="button" class="btn-texto" data-accion="aceite">Configurar aviso de aceite</button></p>' : '') +
      '<p class="nota-mini">Avisos visuales dentro de la app; no se envían notificaciones.</p></section>';
  }

  /* Bloque explicativo del coste por km (estadísticas y hoja de detalle). */
  function bloqueCosteKm(r) {
    var c = r.coste;
    var h = '<div class="coste-km">';
    if (c.eurKm != null) {
      h += '<div class="formula" aria-label="' + esc('Gastos ' + eur(c.coste) + ' entre ' + fkm(c.km) + ' igual a ' + C.formatoEurKm(c.eurKm)) + '">' +
        '<div><span>Gastos</span><strong>' + eur(c.coste) + '</strong></div><span class="op">÷</span>' +
        '<div><span>Kilómetros</span><strong>' + fkm(c.km) + '</strong></div><span class="op op-igual">=</span>' +
        '<div class="res"><span>= Coste por km</span><strong>' + C.formatoEurKm(c.eurKm) + '</strong></div></div>' +
        '<p class="texto-sec">Tramo calculado: del ' + ffecha(c.desde) + ' al ' + ffecha(c.hasta) + ' · ' + plural(c.numGastos, 'gasto', 'gastos') +
        (c.kmInfo && c.kmInfo.interpolado ? ' · km estimados entre tus lecturas' : ' · km de tus lecturas') + '</p>';
    } else {
      h += '<p class="dato-grande apagado">—</p>';
    }
    h += '<span class="estado-dato ' + c.estado + '">' + esc(textoEstadoCoste(c)) + '</span>';
    var avisos = c.avisos.slice();
    if (periodo.tipo === 'mes' && r.porCategoria.some(function (x) { return C.CATEGORIAS_ANUALES.indexOf(x.id) >= 0; }))
      avisos.push('Este mes incluye un pago anual (seguro, ITV o impuestos), por eso el €/km mensual sale más alto. El dato anual o total es más representativo.');
    if (avisos.length) h += '<ul class="avisos-dato">' + avisos.map(function (a) { return '<li>' + ico('aviso') + '<span>' + esc(a) + '</span></li>'; }).join('') + '</ul>';
    if (c.estado === 'sin-km' || c.estado === 'parcial' || c.estado === 'km-cero')
      h += '<button type="button" class="btn secundario" data-accion="actualizar-km">' + ico('velocimetro') + 'Actualizar kilometraje</button>';
    h += '<p class="nota-mini">Fórmula: gastos del periodo ÷ kilómetros recorridos en ese mismo periodo. El precio de compra no se suma: es una inversión, no un gasto de uso (la depreciación se muestra aparte, en Garaje).</p></div>';
    return h;
  }

  /* ------------------------------------------------------------------ */
  /* Vista: movimientos                                                  */
  /* ------------------------------------------------------------------ */
  function gastosFiltrados() {
    var v = vehiculoActivo();
    return C.ordenarGastos(C.filtrarGastos(gastosDe(v), filtros, categorias()), filtros.orden);
  }
  function hayFiltros() { return !!(filtros.texto || filtros.categoria || filtros.desde || filtros.hasta); }
  function vistaMovimientos() {
    var v = vehiculoActivo(), gs = gastosDe(v);
    var usadas = categorias().filter(function (c) { return gs.some(function (g) { return g.categoria === c.id; }); });
    var chips = '<button type="button" class="chip' + (!filtros.categoria ? ' activo' : '') + '" data-accion="filtro-cat" data-cat="" aria-pressed="' + !filtros.categoria + '">Todas</button>' +
      usadas.map(function (c) {
        var a = filtros.categoria === c.id;
        return '<button type="button" class="chip' + (a ? ' activo' : '') + '" data-accion="filtro-cat" data-cat="' + esc(c.id) + '" aria-pressed="' + a + '" style="--c:' + esc(c.color) + '"><span class="punto"></span>' + esc(c.nombre) + '</button>';
      }).join('');
    var opOrden = [['fecha-desc', 'Más recientes'], ['fecha-asc', 'Más antiguos'], ['importe-desc', 'Importe: mayor a menor'], ['importe-asc', 'Importe: menor a mayor']]
      .map(function (o) { return '<option value="' + o[0] + '"' + (filtros.orden === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
    var nFiltrosFecha = (filtros.desde ? 1 : 0) + (filtros.hasta ? 1 : 0);
    return '<div class="cab-vista"><div><h1>Gastos</h1><p class="sub">' + esc(nombreVehiculo(v)) + '</p></div>' +
      '<button type="button" class="btn primario solo-escritorio-inline" data-accion="nuevo-gasto">' + ico('mas') + 'Añadir gasto</button></div>' +
      '<div class="barra-busqueda"><label class="buscador">' + ico('buscar') + '<span class="sr">Buscar gastos</span>' +
      '<input type="search" id="f-texto" placeholder="Buscar: descripción, notas, importe…" value="' + esc(filtros.texto) + '" autocomplete="off"></label>' +
      '<button type="button" class="btn-icono con-borde' + (filtros.abierto || nFiltrosFecha ? ' activo' : '') + '" data-accion="toggle-filtros" aria-expanded="' + filtros.abierto + '" aria-controls="panel-filtros" aria-label="Filtros de fecha y orden">' + ico('filtro') +
      (nFiltrosFecha ? '<span class="insignia">' + nFiltrosFecha + '</span>' : '') + '</button></div>' +
      '<div class="chips" role="group" aria-label="Filtrar por categoría">' + chips + '</div>' +
      '<div class="panel-filtros" id="panel-filtros"' + (filtros.abierto ? '' : ' hidden') + '>' +
      '<div class="rapidos"><button type="button" class="chip" data-accion="rango-rapido" data-r="mes">Este mes</button><button type="button" class="chip" data-accion="rango-rapido" data-r="mesant">Mes pasado</button><button type="button" class="chip" data-accion="rango-rapido" data-r="anio">Este año</button><button type="button" class="chip" data-accion="rango-rapido" data-r="todo">Todo</button></div>' +
      '<div class="fila-2"><div class="campo"><label for="f-desde">Desde</label><input type="date" id="f-desde" value="' + esc(filtros.desde) + '"></div>' +
      '<div class="campo"><label for="f-hasta">Hasta</label><input type="date" id="f-hasta" value="' + esc(filtros.hasta) + '"></div></div>' +
      '<div class="campo"><label for="f-orden">Ordenar por</label><select id="f-orden">' + opOrden + '</select></div>' +
      '<button type="button" class="btn secundario" data-accion="limpiar-filtros">Quitar filtros</button></div>' +
      '<div id="resultados">' + resultadosHTML() + '</div>';
  }
  function resultadosHTML() {
    var lista = gastosFiltrados();
    var total = C.suma(lista);
    var cab = '<div class="resumen-filtro"><span>' + plural(lista.length, 'movimiento', 'movimientos') + (hayFiltros() ? ' (filtrados)' : '') + '</span><strong>' + eur(total) + '</strong>' +
      (lista.length ? '<button type="button" class="btn-texto" data-accion="csv-filtrados">' + ico('descargar') + 'CSV</button>' : '') + '</div>';
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta)
      return cab + '<p class="aviso-linea">' + ico('aviso') + 'La fecha «desde» es posterior a «hasta».</p>';
    if (!lista.length) {
      return cab + (hayFiltros()
        ? vacioHTML('buscar', 'Nada coincide', 'Prueba con otra búsqueda o quita los filtros.', '<button type="button" class="btn secundario" data-accion="limpiar-filtros">Quitar filtros</button>')
        : vacioHTML('euro', 'Todavía no hay gastos', 'Pulsa «Añadir gasto» para apuntar el primero.', '<button type="button" class="btn primario" data-accion="nuevo-gasto">' + ico('mas') + 'Añadir gasto</button>'));
    }
    var visibles = lista.slice(0, filtros.limite);
    var html = '';
    if (filtros.orden.indexOf('fecha') === 0) {
      var grupos = [];
      visibles.forEach(function (g) {
        var m = C.mesDe(g.fecha);
        if (!grupos.length || grupos[grupos.length - 1].mes !== m) grupos.push({ mes: m, items: [] });
        grupos[grupos.length - 1].items.push(g);
      });
      html = grupos.map(function (gr) {
        var totMes = C.suma(lista.filter(function (g) { return C.mesDe(g.fecha) === gr.mes; }));
        return '<section class="grupo-mes"><h2 class="grupo-cab"><span>' + esc(C.nombreMes(gr.mes)) + '</span><span>' + eur(totMes) + '</span></h2><ul class="lista-mov">' + gr.items.map(itemGasto).join('') + '</ul></section>';
      }).join('');
    } else html = '<ul class="lista-mov tarjeta">' + visibles.map(itemGasto).join('') + '</ul>';
    if (lista.length > visibles.length) html += '<button type="button" class="btn secundario ancho" data-accion="mas-resultados">Mostrar más (' + (lista.length - visibles.length) + ')</button>';
    return cab + html;
  }
  function refrescarResultados() {
    var r = $('#resultados');
    if (r) { r.innerHTML = resultadosHTML(); hidratarIconos(r); }
  }

  /* ------------------------------------------------------------------ */
  /* Vista: estadísticas                                                 */
  /* ------------------------------------------------------------------ */
  function vistaEstadisticas() {
    var v = vehiculoActivo(), gs = gastosDe(v);
    var html = '<div class="cab-vista"><div><h1>Estadísticas</h1><p class="sub">' + esc(nombreVehiculo(v)) + '</p></div></div>' + barraPeriodo();
    if (!gs.length) return html + '<section class="tarjeta">' + vacioHTML('grafico', 'Sin datos todavía', 'Los gráficos aparecerán cuando registres tus primeros gastos. Solo muestran datos reales.', '<button type="button" class="btn primario" data-accion="nuevo-gasto">' + ico('mas') + 'Añadir gasto</button>') + '</section>';
    var r = C.resumenPeriodo(v, gs, categorias(), periodo, hoy());
    var cats = categorias();
    html += '<div class="panel panel-estad">';
    html += '<section class="tarjeta tarjeta-coste" aria-labelledby="t-ckm"><div class="tarjeta-cab"><h2 id="t-ckm">Coste por kilómetro · ' + esc(etiquetaPeriodo()) + '</h2></div>' + bloqueCosteKm(r) + '</section>';

    // Dona
    html += '<section class="tarjeta" aria-labelledby="t-dona"><div class="tarjeta-cab"><h2 id="t-dona">Distribución por categoría</h2></div>' +
      (r.total ? '<div class="dona-fila"><div class="dona-caja">' + G.dona(r.porCategoria, { subtitulo: etiquetaPeriodo(), titulo: 'Distribución de gastos por categoría' }) + '</div>' +
        '<ul class="leyenda">' + r.porCategoria.map(function (x) {
          return '<li><button type="button" data-accion="filtrar-cat" data-cat="' + esc(x.id) + '"><span class="punto" style="--c:' + esc(x.color) + '"></span><span class="ley-nombre">' + esc(x.nombre) + '</span><span class="ley-pct">' + C.porcentaje(x.fraccion) + '</span><strong>' + eur(x.cent) + '</strong></button></li>';
        }).join('') + '</ul></div>' : '<p class="texto-sec">No hay gastos en ' + esc(etiquetaPeriodo()) + '.</p>') + '</section>';

    html += tarjetaCombustible(r);

    // Barras mensuales
    var rango = rangoMesesGrafico(v, gs);
    var serie = C.serieMensual(gs, rango[0], rango[1]);
    var presentes = cats.filter(function (c) { return serie.some(function (s) { return s.porCat[c.id]; }); });
    html += '<section class="tarjeta ancha" aria-labelledby="t-bar"><div class="tarjeta-cab"><h2 id="t-bar">Gastos mensuales</h2><span class="texto-sec">' + esc(C.nombreMes(rango[0], true) + ' – ' + C.nombreMes(rango[1], true)) + '</span></div>' +
      grafico('g-barras', function (w) { return G.barras(serie, cats, { ancho: w, alto: 240, destacado: periodo.tipo === 'mes' ? periodo.ref : null }); }) +
      '<ul class="leyenda-linea">' + presentes.map(function (c) { return '<li><span class="punto" style="--c:' + esc(c.color) + '"></span>' + esc(c.nombre) + '</li>'; }).join('') + '</ul>' +
      '<p class="nota-mini">Toca o pasa el ratón sobre una barra para ver el desglose.</p></section>';

    // Acumulado
    var desde = r.desde || C.inicioDatos(v, gs), hasta = r.hasta || hoy();
    if (desde < (C.inicioDatos(v, gs) || desde) && periodo.tipo === 'total') desde = C.inicioDatos(v, gs);
    var finEje = periodo.tipo === 'total' ? hoy() : C.rangoPeriodo(periodo.tipo, periodo.ref).hasta;
    var puntos = C.serieAcumulada(gs, desde, hasta);
    html += '<section class="tarjeta ancha" aria-labelledby="t-acu"><div class="tarjeta-cab"><h2 id="t-acu">Gasto acumulado</h2><strong class="texto-acento">' + eur(puntos.length ? puntos[puntos.length - 1].valor : 0) + '</strong></div>' +
      (puntos.length ? grafico('g-linea', function (w) { return G.lineaAcumulada(puntos, { ancho: w, alto: 210, desde: desde, hasta: finEje, hoy: hoy() }); }) : '<p class="texto-sec">Sin gastos en este periodo.</p>') + '</section>';

    // Comparación entre meses
    html += tarjetaComparacion(v, gs);

    html += tarjetaCompra(v).replace('class="tarjeta"', 'class="tarjeta ancha"');
    html += '</div>';
    return html;
  }
  function tarjetaCombustible(r) {
    var cb = r.combustible;
    return '<section class="tarjeta" aria-labelledby="t-comb"><div class="tarjeta-cab"><h2 id="t-comb">Combustible · ' + esc(etiquetaPeriodo()) + '</h2></div>' +
      (cb.repostajes ? '<div class="mini-datos"><div><span>Gasto</span><strong>' + eur(cb.total) + '</strong></div><div><span>Repostajes</span><strong>' + cb.repostajes + '</strong></div>' +
        '<div><span>Litros apuntados</span><strong>' + (cb.litros ? C.formatoNumero(cb.litros, 1) + ' L' : '—') + '</strong></div><div><span>Precio medio</span><strong>' + (cb.precioMedio ? C.formatoNumero(cb.precioMedio, 3) + ' €/L' : '—') + '</strong></div></div>' +
        '<p class="nota-mini">El precio medio solo usa los repostajes en los que apuntaste litros.</p>' : '<p class="texto-sec">No hay repostajes en este periodo.</p>') + '</section>';
  }
  function rangoMesesGrafico(v, gs) {
    var mh = mesHoy();
    var iniDatos = C.inicioDatos(v, gs);
    var mIni = iniDatos ? C.mesDe(iniDatos) : mh;
    if (periodo.tipo === 'mes') {
      var a = C.sumarMeses(periodo.ref, -11);
      if (a < mIni) a = mIni < C.sumarMeses(periodo.ref, -5) ? mIni : C.sumarMeses(periodo.ref, -5);
      return [a, periodo.ref];
    }
    if (periodo.tipo === 'anio') {
      var fin = periodo.ref + '-12' > mh ? mh : periodo.ref + '-12';
      if (fin < periodo.ref + '-01') fin = periodo.ref + '-01';
      return [periodo.ref + '-01', fin];
    }
    var desde = mIni;
    if (C.listaMeses(desde, mh).length > 24) desde = C.sumarMeses(mh, -23);
    if (C.listaMeses(desde, mh).length < 6) desde = C.sumarMeses(mh, -5);
    return [desde, mh];
  }
  function tarjetaComparacion(v, gs) {
    var ini = C.inicioDatos(v, gs);
    var meses = C.listaMeses(ini ? C.mesDe(ini) : mesHoy(), mesHoy()).reverse();
    var a = comparacion.a && meses.indexOf(comparacion.a) >= 0 ? comparacion.a : (periodo.tipo === 'mes' ? periodo.ref : mesHoy());
    var b = comparacion.b && meses.indexOf(comparacion.b) >= 0 ? comparacion.b : C.sumarMeses(a, -1);
    if (meses.indexOf(b) < 0) meses.push(b);
    if (meses.indexOf(a) < 0) meses.unshift(a);
    var cmp = C.compararMeses(gs, a, b, categorias());
    var max = Math.max.apply(null, cmp.filas.map(function (f) { return Math.max(f.a, f.b); }).concat([1]));
    var op = function (sel) { return meses.map(function (m) { return '<option value="' + m + '"' + (m === sel ? ' selected' : '') + '>' + esc(C.nombreMes(m)) + '</option>'; }).join(''); };
    var dif = cmp.fraccion == null ? (cmp.totalA ? 'sin gastos en el otro mes' : '') : (cmp.dif >= 0 ? '+' : '−') + eur(Math.abs(cmp.dif)) + ' (' + (cmp.dif >= 0 ? '+' : '−') + C.porcentaje(Math.abs(cmp.fraccion)) + ')';
    return '<section class="tarjeta ancha" aria-labelledby="t-cmp"><div class="tarjeta-cab"><h2 id="t-cmp">Comparar meses</h2></div>' +
      '<div class="fila-2 comparador"><div class="campo"><label for="cmp-a"><span class="punto a"></span>Mes</label><select id="cmp-a" data-cmp="a">' + op(a) + '</select></div>' +
      '<div class="campo"><label for="cmp-b"><span class="punto b"></span>Comparar con</label><select id="cmp-b" data-cmp="b">' + op(b) + '</select></div></div>' +
      '<div class="cmp-totales"><div><span>' + esc(C.nombreMes(a)) + '</span><strong>' + eur(cmp.totalA) + '</strong></div><div><span>' + esc(C.nombreMes(b)) + '</span><strong>' + eur(cmp.totalB) + '</strong></div>' +
      '<div><span>Diferencia</span><strong class="' + (cmp.dif > 0 ? 'sube' : cmp.dif < 0 ? 'baja' : '') + '">' + esc(dif || '—') + '</strong></div></div>' +
      (cmp.filas.length ? '<ul class="cmp-filas">' + cmp.filas.map(function (f) {
        return '<li><span class="cmp-nombre">' + esc(f.nombre) + '</span><span class="cmp-barras"><span class="cmp-b a" style="width:' + (f.a / max * 100).toFixed(1) + '%"></span><span class="cmp-b b" style="width:' + (f.b / max * 100).toFixed(1) + '%"></span></span>' +
          '<span class="cmp-val"><span>' + eur(f.a) + '</span><span>' + eur(f.b) + '</span></span></li>';
      }).join('') + '</ul>' : '<p class="texto-sec">No hay gastos en ninguno de los dos meses.</p>') + '</section>';
  }
  function tarjetaCompra(v) {
    var dep = C.depreciacion(v, hoy());
    var h = '<section class="tarjeta" aria-labelledby="t-compra"><div class="tarjeta-cab"><h2 id="t-compra">Compra y depreciación</h2><button type="button" class="enlace-sec" data-accion="editar-vehiculo" data-id="' + esc(v.id) + '">Editar</button></div>';
    if (!v.precioCompra) return h + '<p class="texto-sec">Si quieres, añade el precio de compra y una estimación del valor actual del coche. Se muestra aparte: no se mezcla con los gastos de uso.</p></section>';
    h += '<div class="mini-datos"><div><span>Precio de compra</span><strong>' + eur(v.precioCompra, true) + '</strong></div>' +
      '<div><span>Comprado</span><strong>' + (v.fechaAdquisicion ? ffecha(v.fechaAdquisicion) : '—') + '</strong></div>';
    if (dep) {
      h += '<div><span>Valor actual (tu estimación)</span><strong>' + eur(dep.valor, true) + '</strong></div>' +
        '<div><span>' + (dep.perdida >= 0 ? 'Depreciación estimada' : 'Revalorización estimada') + '</span><strong class="' + (dep.perdida > 0 ? 'sube' : '') + '">' + eur(Math.abs(dep.perdida), true) + ' (' + C.porcentaje(Math.abs(dep.fraccion)) + ')</strong></div>';
      if (dep.porAnio != null) h += '<div><span>Depreciación por año</span><strong>' + eur(dep.porAnio, true) + '</strong></div>';
    }
    h += '</div><p class="nota-mini">Métrica separada: el precio de compra y la depreciación NO se suman al coste por kilómetro. La depreciación depende del valor que tú estimes.</p></section>';
    return h;
  }

  /* ------------------------------------------------------------------ */
  /* Vista: garaje                                                       */
  /* ------------------------------------------------------------------ */
  function vistaGaraje() {
    var act = vehiculoActivo();
    var html = '<div class="cab-vista"><div><h1>Garaje</h1><p class="sub">' + plural(datos.vehiculos.length, 'vehículo', 'vehículos') + '</p></div>' +
      '<button type="button" class="btn secundario" data-accion="nuevo-vehiculo">' + ico('mas') + 'Añadir vehículo</button></div><div class="panel">';
    html += '<div class="lista-vehiculos">' + datos.vehiculos.map(function (v) {
      var gs = gastosDe(v), k = kmAhora(v);
      var cost = C.costePorKm(gs, C.lecturasVehiculo(v, datos.gastos), null, null);
      var activo = v.id === act.id;
      return '<article class="vehiculo' + (activo ? ' activo' : '') + '" aria-label="' + esc(nombreVehiculo(v)) + '">' +
        '<div class="veh-cab">' + avatar(v, 'grande') + '<div class="veh-nombre"><h2>' + esc(nombreVehiculo(v)) + '</h2><p>' + esc([v.anio, v.matricula].filter(Boolean).join(' · ') || 'Sin matrícula') + '</p></div>' +
        (activo ? '<span class="chip-activo">' + ico('check') + 'Activo</span>' : '<button type="button" class="btn secundario peq" data-accion="usar-vehiculo" data-id="' + esc(v.id) + '">Ver este</button>') + '</div>' +
        '<div class="mini-datos"><div><span>Kilometraje</span><strong>' + (k ? fkm(k.km) : '—') + '</strong></div><div><span>Gastos registrados</span><strong>' + eur(C.suma(gs)) + '</strong></div>' +
        '<div><span>Coste por km (total)</span><strong>' + (cost.eurKm != null ? C.formatoEurKm(cost.eurKm) : '—') + '</strong></div><div><span>Movimientos</span><strong>' + gs.length + '</strong></div></div>' +
        '<div class="veh-acciones"><button type="button" class="btn secundario peq" data-accion="actualizar-km" data-id="' + esc(v.id) + '">' + ico('velocimetro') + 'Actualizar km</button>' +
        '<button type="button" class="btn secundario peq" data-accion="editar-vehiculo" data-id="' + esc(v.id) + '">' + ico('editar') + 'Editar</button></div></article>';
    }).join('') + '</div>';

    var k = kmAhora(act), ac = C.estadoAceite(act, k ? k.km : null);
    html += '<section class="tarjeta" aria-labelledby="t-ac"><div class="tarjeta-cab"><h2 id="t-ac">Cambio de aceite · ' + esc(act.modelo) + '</h2><button type="button" class="enlace-sec" data-accion="aceite">' + (ac ? 'Editar' : 'Configurar') + '</button></div>' +
      (ac ? '<div class="aceite nivel-' + ac.nivel + '"><div class="aceite-cab"><span>' + (ac.restantes >= 0 ? 'Faltan' : 'Te has pasado') + '</span><strong>' + fkm(Math.abs(ac.restantes)) + '</strong></div><div class="barra-prog grande"><span style="width:' + Math.round(ac.fraccion * 100) + '%"></span></div>' +
        '<span class="texto-sec">Último cambio a los ' + fkm(act.aceite.kmUltimo) + ' · cada ' + fkm(act.aceite.intervalo) + ' · próximo a los ' + fkm(ac.proximo) + '</span></div>'
        : '<p class="texto-sec">Indica a qué kilometraje cambiaste el aceite y cada cuántos km toca. Calcularemos cuánto te queda con tu kilometraje actual.</p>') + '</section>';
    html += tarjetaRecordatoriosCompleta(act);
    html += tarjetaCompra(act);
    if (datos.vehiculos.length > 1) html += tarjetaComparacionVehiculos();
    html += '</div>';
    return html;
  }
  function tarjetaRecordatoriosCompleta(v) {
    var recs = datos.recordatorios.filter(function (r) { return r.vehiculoId === v.id; }).sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
    return '<section class="tarjeta" aria-labelledby="t-recs"><div class="tarjeta-cab"><h2 id="t-recs">Recordatorios · ' + esc(v.modelo) + '</h2><button type="button" class="enlace-sec" data-accion="nuevo-recordatorio">+ Añadir</button></div>' +
      (recs.length ? '<ul class="lista-rec">' + recs.map(function (r) {
        var e = C.estadoRecordatorio(r.fecha, hoy());
        return '<li><button type="button" class="rec nivel-' + e.nivel + '" data-accion="editar-recordatorio" data-id="' + esc(r.id) + '"><span class="rec-ico">' + ico(ICONO_TIPO[r.tipo]) + '</span>' +
          '<span class="rec-txt"><strong>' + esc(r.titulo || NOMBRE_TIPO[r.tipo]) + '</strong><span>' + ffecha(r.fecha) + (r.notas ? ' · ' + esc(r.notas) : '') + '</span></span><span class="rec-dias">' + esc(textoDias(e.dias)) + '</span></button></li>';
      }).join('') + '</ul>' : '<p class="texto-sec">Sin recordatorios. Añade la ITV, la renovación del seguro o la próxima revisión.</p>') +
      '<p class="nota-mini">Los recordatorios se ven al abrir la app (en rojo si están vencidos, en amarillo si faltan 30 días o menos). No hay notificaciones en segundo plano.</p></section>';
  }
  function tarjetaComparacionVehiculos() {
    var filas = datos.vehiculos.map(function (v) {
      var gs = gastosDe(v);
      var cost = C.costePorKm(gs, C.lecturasVehiculo(v, datos.gastos), null, null);
      var med = C.mediaMensual(v, gs, { tipo: 'total' }, hoy());
      return { v: v, total: C.suma(gs), km: cost.km, eurKm: cost.eurKm, media: med.cent, desde: C.inicioDatos(v, gs) };
    });
    var mejor = filas.filter(function (f) { return f.eurKm != null; }).sort(function (a, b) { return a.eurKm - b.eurKm; })[0];
    return '<section class="tarjeta ancha" aria-labelledby="t-cv"><div class="tarjeta-cab"><h2 id="t-cv">Comparación entre vehículos</h2></div><div class="tabla-scroll"><table class="tabla"><thead><tr><th scope="col">Vehículo</th><th scope="col">Desde</th><th scope="col">Gastos</th><th scope="col">Km</th><th scope="col">€/km</th><th scope="col">Media/mes</th></tr></thead><tbody>' +
      filas.map(function (f) {
        return '<tr' + (mejor && f === mejor ? ' class="mejor"' : '') + '><th scope="row">' + esc(nombreVehiculo(f.v)) + '</th><td>' + (f.desde ? ffecha(f.desde) : '—') + '</td><td>' + eur(f.total) + '</td><td>' + (f.km != null ? C.formatoNumero(f.km) : '—') + '</td><td>' + (f.eurKm != null ? C.formatoEurKm(f.eurKm) : '—') + '</td><td>' + eur(f.media) + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="nota-mini">Cada coche usa todo su registro. Si empezaste a apuntar en fechas distintas, compara con prudencia.</p></section>';
  }

  /* ------------------------------------------------------------------ */
  /* Vista: ajustes y datos                                              */
  /* ------------------------------------------------------------------ */
  function vistaAjustes() {
    var hay = datos.vehiculos.length > 0;
    var kb = Math.max(1, Math.round(A.bytesUsados() / 1024));
    var personal = datos.categorias;
    var html = '<div class="cab-vista"><div><h1>Ajustes y datos</h1><p class="sub">Mi Garaje IA ' + VERSION_APP + '</p></div>' +
      (!hay ? '<button type="button" class="btn secundario" data-accion="ir-inicio">' + ico('izquierda') + 'Volver</button>' : '') + '</div><div class="panel">';
    html += '<section class="tarjeta privacidad" aria-labelledby="t-priv"><div class="tarjeta-cab"><h2 id="t-priv">' + ico('candado') + 'Dónde están tus datos</h2></div>' +
      '<p>Todo se guarda <strong>solo en este navegador</strong>, en este dispositivo. No hay cuentas, ni servidores, ni analítica: la app no envía tus datos a ningún sitio.</p>' +
      '<p class="aviso-linea">' + ico('aviso') + '<span>Si borras los datos de navegación, desinstalas el navegador o usas modo privado, los datos se pueden perder. Exporta una copia de seguridad de vez en cuando.</span></p>' +
      '<p class="texto-sec">Espacio usado: ' + kb + ' KB' + (modo === 'demo' ? ' · estás en modo demostración' : '') + '</p></section>';

    html += '<section class="tarjeta" aria-labelledby="t-copias"><div class="tarjeta-cab"><h2 id="t-copias">Copias de seguridad</h2></div><div class="acciones-lista">' +
      '<button type="button" class="btn secundario" data-accion="exportar-json"' + (hay ? '' : ' disabled') + '>' + ico('descargar') + 'Exportar copia (JSON)</button>' +
      '<button type="button" class="btn secundario" data-accion="exportar-csv"' + (datos.gastos.length ? '' : ' disabled') + '>' + ico('descargar') + 'Exportar movimientos (CSV)</button>' +
      '<button type="button" class="btn secundario" data-accion="importar">' + ico('subir') + 'Importar copia (JSON)</button></div>' +
      '<p class="nota-mini">El JSON guarda todo (vehículos, gastos, categorías y recordatorios) y se puede volver a importar. El CSV se abre con Excel o Google Sheets.' + (modo === 'demo' ? ' En modo demo, las exportaciones se marcan como «demo».' : '') + '</p></section>';

    html += '<section class="tarjeta" aria-labelledby="t-apar"><div class="tarjeta-cab"><h2 id="t-apar">Apariencia</h2></div><div class="segmentado ancho" role="group" aria-label="Tema">' +
      '<button type="button" data-accion="tema-fijo" data-tema="oscuro" aria-pressed="' + (prefs.tema !== 'claro') + '">' + ico('luna') + 'Oscuro</button>' +
      '<button type="button" data-accion="tema-fijo" data-tema="claro" aria-pressed="' + (prefs.tema === 'claro') + '">' + ico('sol') + 'Claro</button></div></section>';

    html += '<section class="tarjeta" aria-labelledby="t-cats"><div class="tarjeta-cab"><h2 id="t-cats">Categorías</h2><button type="button" class="enlace-sec" data-accion="nueva-categoria">+ Crear</button></div>' +
      '<ul class="lista-cats">' + C.CATEGORIAS_BASE.map(function (c) { return '<li>' + chipCategoria(c) + '<span>' + esc(c.nombre) + '</span><span class="texto-sec">base</span></li>'; }).join('') +
      personal.map(function (c) { return '<li>' + chipCategoria(c) + '<span>' + esc(c.nombre) + '</span><button type="button" class="btn-texto" data-accion="editar-categoria" data-id="' + esc(c.id) + '">Editar</button></li>'; }).join('') + '</ul></section>';

    html += '<section class="tarjeta" aria-labelledby="t-demo"><div class="tarjeta-cab"><h2 id="t-demo">Datos de demostración</h2></div>' +
      (modo === 'demo'
        ? '<p class="texto-sec">Estás viendo datos ficticios. Tus datos reales están a salvo y separados.</p><div class="acciones-lista"><button type="button" class="btn primario" data-accion="salir-demo">Volver a mis datos</button><button type="button" class="btn secundario" data-accion="reiniciar-demo">Regenerar la demo</button></div>'
        : '<p class="texto-sec">Explora la app con dos coches ficticios y un año de gastos. No toca tus datos.</p><button type="button" class="btn secundario" data-accion="entrar-demo">' + ico('estrella') + 'Ver la demostración</button>') + '</section>';

    html += '<section class="tarjeta zona-peligro" aria-labelledby="t-borrar"><div class="tarjeta-cab"><h2 id="t-borrar">Borrar datos</h2></div>' +
      '<p class="texto-sec">' + (modo === 'demo' ? 'Elimina los datos de demostración.' : 'Elimina todos tus vehículos, gastos y recordatorios de este navegador. No se puede deshacer.') + '</p>' +
      '<button type="button" class="btn peligro" data-accion="borrar-todo"' + (hay ? '' : ' disabled') + '>' + ico('papelera') + (modo === 'demo' ? 'Borrar datos de demostración' : 'Borrar todos mis datos') + '</button></section>';

    html += '<section class="tarjeta acerca" aria-labelledby="t-acerca"><div class="tarjeta-cab"><h2 id="t-acerca">Acerca de</h2></div>' +
      '<p><strong>Mi Garaje IA</strong> es un proyecto de <strong>Chiky &amp; IA</strong>. Se ha desarrollado con ayuda de inteligencia artificial, pero la app funciona sola: no usa ninguna IA ni conexión para calcular. Todos los números salen de los datos que tú apuntas.</p>' +
      '<p class="texto-sec">Importes en euros y fechas en formato español. Se puede instalar como app desde el menú del navegador («Añadir a pantalla de inicio» / «Instalar»).</p></section>';
    html += '</div>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /* Hojas: gasto                                                        */
  /* ------------------------------------------------------------------ */
  function hojaGasto(g) {
    var v = g ? vehiculo(g.vehiculoId) : vehiculoActivo();
    var catSel = g ? g.categoria : (categorias().some(function (c) { return c.id === prefs.ultimaCategoria; }) ? prefs.ultimaCategoria : 'gasolina');
    var k = C.kmActual(v, datos.gastos.filter(function (x) { return !g || x.id !== g.id; }));
    var cuerpo = '<form id="form-gasto" novalidate>' +
      (datos.vehiculos.length > 1 ? campo({ nombre: 'vehiculoId', etiqueta: 'Vehículo', tipo: 'select', opciones: datos.vehiculos.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === v.id ? ' selected' : '') + '>' + esc(nombreVehiculo(x)) + '</option>'; }).join('') }) : '<input type="hidden" name="vehiculoId" value="' + esc(v.id) + '">') +
      '<div class="campo campo-importe"><label for="f-importe">Importe</label><div class="entrada con-sufijo grande"><input id="f-importe" name="importe" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + entradaImporte(g && g.importe) + '" aria-describedby="e-importe a-importe" autofocus><span class="sufijo" aria-hidden="true">€</span></div>' +
      '<p class="ayuda" id="a-importe"></p><p class="error" id="e-importe"></p></div>' +
      '<fieldset class="campo"><legend>Categoría</legend><div class="chips-cat">' + categorias().map(function (c) {
        return '<label class="chip-cat"><input type="radio" name="categoria" value="' + esc(c.id) + '"' + (c.id === catSel ? ' checked' : '') + '>' +
          '<span class="chip-cat-cuerpo">' + chipCategoria(c) + '<span>' + esc(c.nombre) + '</span></span></label>';
      }).join('') + '</div><p class="error" id="e-categoria"></p></fieldset>' +
      '<div class="bloque-comb"' + (catSel === 'gasolina' ? '' : ' hidden') + '><div class="fila-2">' +
      campo({ nombre: 'litros', etiqueta: 'Litros', opcional: true, valor: entradaDecimal(g && g.litros), attrs: 'inputmode="decimal" autocomplete="off"', placeholder: '40,5', sufijo: 'L' }) +
      campo({ nombre: 'precioLitro', etiqueta: 'Precio por litro', opcional: true, valor: entradaDecimal(g && g.precioLitro), attrs: 'inputmode="decimal" autocomplete="off"', placeholder: '1,589', sufijo: '€/L' }) +
      '</div></div>' +
      '<div class="fila-2">' +
      campo({ nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', valor: g ? g.fecha : hoy(), attrs: 'max="' + hoy() + '" min="1950-01-01" required' }) +
      campo({ nombre: 'km', etiqueta: 'Kilometraje', opcional: true, valor: g && g.km != null ? String(g.km) : '', attrs: 'inputmode="numeric" autocomplete="off"', placeholder: k ? String(k.km) : '', sufijo: 'km',
        ayuda: k ? 'Último: ' + fkm(k.km) + ' (' + ffecha(k.fecha) + ')' : '' }) +
      '</div>' +
      campo({ nombre: 'descripcion', etiqueta: 'Descripción', opcional: true, valor: g ? g.descripcion : '', placeholder: 'Ej.: Repostaje, revisión 60.000 km…', attrs: 'maxlength="120" autocomplete="off"' }) +
      '<details class="mas-detalles"' + (g && g.notas ? ' open' : '') + '><summary>Notas</summary>' + campo({ nombre: 'notas', etiqueta: 'Notas', tipo: 'textarea', clase: 'sin-etiqueta', valor: g ? g.notas : '', placeholder: 'Taller, garantía, nº de factura…' }) + '</details>' +
      '<p class="error-general" hidden></p>' +
      '<div class="acciones-hoja">' + (g ? '<button type="button" class="btn peligro-texto" data-accion="borrar-gasto" data-id="' + esc(g.id) + '">' + ico('papelera') + 'Eliminar</button>' : '') +
      '<button type="submit" class="btn primario grande">' + ico('check') + (g ? 'Guardar cambios' : 'Guardar gasto') + '</button></div></form>';
    abrirHoja(g ? 'Editar gasto' : 'Nuevo gasto', cuerpo, function (hoja) {
      var form = $('#form-gasto', hoja);
      var calc = function () {
        var cat = (form.elements.categoria.value || '');
        $('.bloque-comb', form).hidden = cat !== 'gasolina';
        var ayuda = $('#a-importe', form), imp = form.elements.importe;
        var l = C.parseNumeroES(form.elements.litros.value, false), p = C.parseNumeroES(form.elements.precioLitro.value, false);
        if (cat === 'gasolina' && l > 0 && p > 0 && p <= 10) {
          var c = C.importeCombustible(l, p);
          imp.value = entradaImporte(c); imp.readOnly = true; imp.classList.add('calculado');
          ayuda.textContent = 'Calculado: ' + C.formatoNumero(l, 2) + ' L × ' + C.formatoNumero(p, 3) + ' €/L = ' + eur(c);
        } else {
          if (imp.readOnly) { imp.readOnly = false; imp.classList.remove('calculado'); }
          var i = C.parseNumeroES(imp.value, true);
          ayuda.textContent = cat === 'gasolina' && l > 0 && i > 0 ? '≈ ' + C.formatoNumero(i / l, 3) + ' €/L' : (cat === 'gasolina' ? 'Si pones litros y precio por litro, el importe se calcula solo.' : '');
        }
      };
      form.addEventListener('input', calc);
      form.addEventListener('change', calc);
      calc();
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var d = valores(form);
        var veh = vehiculo(d.vehiculoId) || v;
        var res = C.validarGasto(d, { hoy: hoy(), categorias: categorias().map(function (c) { return c.id; }), lecturas: C.lecturasVehiculo(veh, datos.gastos, g && g.id) });
        if (!res.ok) { mostrarErrores(form, res.errores, 'Revisa los campos marcados.'); return; }
        var val = res.valor;
        var antes = C.costePorKm(gastosDe(veh), C.lecturasVehiculo(veh, datos.gastos), null, null);
        if (g) {
          Object.assign(g, val, { vehiculoId: veh.id });
        } else {
          datos.gastos.push(Object.assign({ id: C.nuevoId(), vehiculoId: veh.id, creado: Date.now() }, val));
          prefs.ultimaCategoria = val.categoria;
        }
        if (!persistir()) return;
        prefs.activo[modo] = veh.id; guardarPrefs();
        cerrarHoja();
        var r = C.rangoPeriodo(periodo.tipo, periodo.ref);
        var fuera = periodo.tipo !== 'total' && (val.fecha < r.desde || val.fecha > r.hasta);
        var despues = C.costePorKm(gastosDe(veh), C.lecturasVehiculo(veh, datos.gastos), null, null);
        var extra = despues.eurKm != null && antes.eurKm != null && Math.abs(despues.eurKm - antes.eurKm) > 0.0005 ? ' · €/km total: ' + C.formatoEurKm(antes.eurKm) + ' → ' + C.formatoEurKm(despues.eurKm) : '';
        aviso((g ? 'Gasto actualizado: ' : 'Gasto guardado: ') + eur(val.importe) + ' en ' + categoria(val.categoria).nombre + extra + (fuera ? ' (fuera del periodo que estás viendo)' : ''));
        render();
      });
    });
  }

  function borrarGasto(id) {
    var i = datos.gastos.findIndex(function (g) { return g.id === id; });
    if (i < 0) return;
    var g = datos.gastos[i];
    confirmar({ titulo: '¿Eliminar este gasto?', texto: (g.descripcion || categoria(g.categoria).nombre) + ' · ' + eur(g.importe) + ' · ' + ffecha(g.fecha) + '. Se recalcularán las estadísticas.', boton: 'Eliminar', peligro: true }).then(function (ok) {
      if (!ok) return;
      var copia = datos.gastos.splice(i, 1)[0];
      if (!persistir()) { datos.gastos.splice(i, 0, copia); return; }
      cerrarHoja();
      render();
      aviso('Gasto eliminado', 'info', { etiqueta: 'Deshacer', fn: function () { datos.gastos.splice(Math.min(i, datos.gastos.length), 0, copia); persistir(); render(); aviso('Gasto restaurado'); } });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Hojas: vehículo                                                     */
  /* ------------------------------------------------------------------ */
  function primeraLectura(v) { return v.lecturas.slice().sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.km - b.km; })[0]; }

  function hojaVehiculo(v) {
    var pl = v ? primeraLectura(v) : null;
    var k = v ? kmAhora(v) : null;
    var foto = v ? v.foto : null;
    var conCompra = v && (v.fechaAdquisicion || v.precioCompra);
    var cuerpo = '<form id="form-vehiculo" novalidate>' +
      (!v ? '<p class="intro-form">Solo te pedimos lo imprescindible. El resto es opcional.</p>' : '') +
      '<div class="fila-2">' + campo({ nombre: 'marca', etiqueta: 'Marca', valor: v ? v.marca : '', placeholder: 'Ej.: SEAT', attrs: 'maxlength="40" autocomplete="off" autocapitalize="words"' }) +
      campo({ nombre: 'modelo', etiqueta: 'Modelo', valor: v ? v.modelo : '', placeholder: 'Ej.: Ibiza 1.0', attrs: 'maxlength="40" autocomplete="off"' }) + '</div>' +
      '<div class="fila-2">' + campo({ nombre: 'anio', etiqueta: 'Año', opcional: true, valor: v && v.anio ? String(v.anio) : '', placeholder: '2019', attrs: 'inputmode="numeric" maxlength="4" autocomplete="off"' }) +
      campo({ nombre: 'matricula', etiqueta: 'Matrícula', opcional: true, valor: v ? v.matricula : '', placeholder: '1234 ABC', attrs: 'maxlength="15" autocomplete="off" autocapitalize="characters"' }) + '</div>' +
      '<div class="grupo-form"><h3>' + ico('velocimetro') + 'Kilometraje</h3><div class="fila-2">' +
      campo({ nombre: 'kmInicial', etiqueta: 'Km al empezar a registrar', valor: pl ? String(pl.km) : '', placeholder: '58.240', attrs: 'inputmode="numeric" autocomplete="off"', sufijo: 'km' }) +
      campo({ nombre: 'fechaKmInicial', etiqueta: 'Fecha de ese km', tipo: 'date', valor: pl ? pl.fecha : hoy(), attrs: 'max="' + hoy() + '"' }) + '</div>' +
      campo({ nombre: 'kmActual', etiqueta: 'Km actuales (hoy)', opcional: true, valor: v && k && k.km !== pl.km ? String(k.km) : '', placeholder: v && k ? String(k.km) : 'Si es el mismo, déjalo vacío', attrs: 'inputmode="numeric" autocomplete="off"', sufijo: 'km',
        ayuda: v ? 'Si lo cambias, se guarda como lectura de hoy.' : 'Si empiezas hoy, basta con el km inicial. El coste por km aparecerá cuando haya más lecturas (al repostar, por ejemplo).' }) + '</div>' +
      '<details class="mas-detalles"' + (conCompra ? ' open' : '') + '><summary>Compra del coche <span class="opcional">(opcional)</span></summary>' +
      campo({ nombre: 'fechaAdquisicion', etiqueta: 'Fecha de compra', tipo: 'date', opcional: true, valor: v && v.fechaAdquisicion ? v.fechaAdquisicion : '', attrs: 'max="' + hoy() + '"', ayuda: 'Sirve para saber si tu registro cubre toda la vida del coche contigo.' }) +
      '<div class="fila-2">' + campo({ nombre: 'precioCompra', etiqueta: 'Precio de compra', opcional: true, valor: v ? entradaImporte(v.precioCompra) : '', attrs: 'inputmode="decimal" autocomplete="off"', sufijo: '€' }) +
      campo({ nombre: 'valorEstimado', etiqueta: 'Valor actual estimado', opcional: true, valor: v ? entradaImporte(v.valorEstimado) : '', attrs: 'inputmode="decimal" autocomplete="off"', sufijo: '€' }) + '</div>' +
      '<p class="nota-mini">Se muestran aparte como inversión y depreciación. No se suman a los gastos ni al coste por km.</p></details>' +
      '<div class="campo"><span class="etiqueta-campo">Foto <span class="opcional">(opcional)</span></span><div class="foto-fila"><div class="foto-previa" id="foto-previa">' + (foto ? '<img src="' + esc(foto) + '" alt="Foto del vehículo">' : ico('camara')) + '</div>' +
      '<div class="foto-botones"><label class="btn secundario peq" for="f-foto">' + ico('camara') + (foto ? 'Cambiar foto' : 'Añadir foto') + '</label><input type="file" id="f-foto" accept="image/*" class="sr">' +
      '<button type="button" class="btn-texto" id="quitar-foto"' + (foto ? '' : ' hidden') + '>Quitar</button></div></div><p class="error" id="e-foto"></p></div>' +
      '<p class="error-general" hidden></p>' +
      '<div class="acciones-hoja">' + (v ? '<button type="button" class="btn peligro-texto" data-accion="borrar-vehiculo" data-id="' + esc(v.id) + '">' + ico('papelera') + 'Eliminar</button>' : '') +
      '<button type="submit" class="btn primario grande">' + ico('check') + (v ? 'Guardar cambios' : 'Guardar vehículo') + '</button></div></form>';
    abrirHoja(v ? 'Editar vehículo' : 'Registrar vehículo', cuerpo, function (hoja) {
      var form = $('#form-vehiculo', hoja);
      $('#f-foto', form).addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        $('#e-foto', form).textContent = '';
        reducirFoto(f).then(function (url) {
          foto = url;
          $('#foto-previa', form).innerHTML = '<img src="' + esc(url) + '" alt="Foto del vehículo">';
          $('#quitar-foto', form).hidden = false;
        }).catch(function (err) { $('#e-foto', form).textContent = err.message; });
      });
      $('#quitar-foto', form).addEventListener('click', function () {
        foto = null; $('#foto-previa', form).innerHTML = ico('camara'); this.hidden = true; $('#f-foto', form).value = '';
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var d = valores(form);
        var res = C.validarVehiculo(d, { hoy: hoy() });
        if (!res.ok) { mostrarErrores(form, res.errores, 'Revisa los campos marcados.'); return; }
        var val = res.valor;
        var lecturas;
        if (v) {
          lecturas = v.lecturas.slice().sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
          var idx = v.lecturas.indexOf(pl);
          lecturas = v.lecturas.map(function (l, i) { return i === idx ? { fecha: val.fechaKmInicial, km: val.kmInicial } : l; });
          if (val.kmActual != null && (!k || val.kmActual !== k.km)) {
            lecturas = lecturas.filter(function (l) { return l.fecha !== hoy() || l === lecturas[idx]; });
            lecturas.push({ fecha: hoy(), km: val.kmActual });
          }
        } else {
          lecturas = [{ fecha: val.fechaKmInicial, km: val.kmInicial }];
          if (val.kmActual != null && val.kmActual !== val.kmInicial) lecturas.push({ fecha: hoy(), km: val.kmActual });
        }
        var prueba = { id: v ? v.id : '__nuevo', lecturas: lecturas };
        var conflicto = C.coherenciaLecturas(C.lecturasVehiculo(prueba, datos.gastos));
        if (conflicto) { mostrarErrores(form, {}, 'Kilometraje incoherente con tus gastos: ' + conflicto); return; }
        var campos = { marca: val.marca, modelo: val.modelo, anio: val.anio, matricula: val.matricula, fechaAdquisicion: val.fechaAdquisicion, precioCompra: val.precioCompra, valorEstimado: val.valorEstimado, lecturas: lecturas, foto: foto };
        var nuevo = !v;
        if (v) Object.assign(v, campos);
        else { v = Object.assign({ id: C.nuevoId(), creado: Date.now(), aceite: null }, campos); datos.vehiculos.push(v); }
        if (!persistir()) { if (nuevo) datos.vehiculos.pop(); return; }
        prefs.activo[modo] = v.id; guardarPrefs();
        if (nuevo) A.pedirPersistencia();
        cerrarHoja();
        aviso(nuevo ? '¡' + nombreVehiculo(v) + ' registrado! Ya puedes añadir gastos.' : 'Vehículo actualizado');
        if (nuevo) { location.hash = '#inicio'; vistaActual = 'inicio'; }
        render();
      });
    });
  }

  function reducirFoto(archivo) {
    return new Promise(function (resolver, rechazar) {
      if (!/^image\//.test(archivo.type)) return rechazar(new Error('El archivo no es una imagen.'));
      if (archivo.size > 25 * 1024 * 1024) return rechazar(new Error('La imagen es demasiado grande (máx. 25 MB).'));
      var url = URL.createObjectURL(archivo), img = new Image();
      img.onload = function () {
        var max = 640, esc_ = Math.min(1, max / Math.max(img.width, img.height));
        var cv = document.createElement('canvas');
        cv.width = Math.round(img.width * esc_); cv.height = Math.round(img.height * esc_);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        resolver(cv.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = function () { URL.revokeObjectURL(url); rechazar(new Error('No se ha podido leer la imagen.')); };
      img.src = url;
    });
  }

  function borrarVehiculo(id) {
    var v = vehiculo(id);
    var n = gastosDe(v).length;
    confirmar({ titulo: '¿Eliminar ' + nombreVehiculo(v) + '?', texto: 'Se borrarán también sus ' + plural(n, 'gasto', 'gastos') + ' y recordatorios. No se puede deshacer.', boton: 'Eliminar vehículo', peligro: true }).then(function (ok) {
      if (!ok) return;
      datos.vehiculos = datos.vehiculos.filter(function (x) { return x.id !== id; });
      datos.gastos = datos.gastos.filter(function (g) { return g.vehiculoId !== id; });
      datos.recordatorios = datos.recordatorios.filter(function (r) { return r.vehiculoId !== id; });
      if (!persistir()) return;
      if (prefs.activo[modo] === id) { prefs.activo[modo] = datos.vehiculos[0] ? datos.vehiculos[0].id : null; guardarPrefs(); }
      cerrarHoja();
      aviso('Vehículo eliminado', 'info');
      render();
    });
  }

  function hojaKm(v) {
    var k = kmAhora(v);
    var manuales = v.lecturas.slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    var pl = primeraLectura(v);
    var cuerpo = '<form id="form-km" novalidate><p class="intro-form">' + esc(nombreVehiculo(v)) + ' · ahora: <strong>' + (k ? fkm(k.km) : '—') + '</strong> (' + (k ? ffecha(k.fecha) : '') + ')</p>' +
      '<div class="fila-2">' + campo({ nombre: 'km', etiqueta: 'Kilómetros que marca', valor: '', placeholder: k ? String(k.km) : '', attrs: 'inputmode="numeric" autocomplete="off" autofocus', sufijo: 'km' }) +
      campo({ nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', valor: hoy(), attrs: 'max="' + hoy() + '"' }) + '</div>' +
      '<p class="nota-mini">Apuntar el kilometraje de vez en cuando hace que el coste por km sea exacto. Los gastos con km también cuentan como lectura.</p>' +
      '<div class="acciones-hoja"><button type="submit" class="btn primario grande">' + ico('check') + 'Guardar lectura</button></div></form>' +
      '<h3 class="subtitulo-hoja">Lecturas guardadas</h3><ul class="lista-lecturas">' + manuales.map(function (l) {
        var i = v.lecturas.indexOf(l);
        return '<li><span>' + ffecha(l.fecha) + '</span><strong>' + fkm(l.km) + '</strong>' + (l === pl ? '<span class="texto-sec">inicial</span>' : '<button type="button" class="btn-icono peq" data-accion="borrar-lectura" data-v="' + esc(v.id) + '" data-i="' + i + '" aria-label="Borrar lectura del ' + ffecha(l.fecha) + '">' + ico('papelera') + '</button>') + '</li>';
      }).join('') + '</ul>';
    abrirHoja('Actualizar kilometraje', cuerpo, function (hoja) {
      var form = $('#form-km', hoja);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var d = valores(form), err = {};
        var km = C.leerKm(d.km);
        if (km.vacio) err.km = 'Indica los kilómetros.'; else if (km.error) err.km = km.error;
        if (!C.esFechaISO(d.fecha)) err.fecha = 'Fecha no válida.'; else if (d.fecha > hoy()) err.fecha = 'La fecha no puede ser posterior a hoy.';
        if (!err.km && !err.fecha) {
          var resto = { id: v.id, lecturas: v.lecturas.filter(function (l) { return l.fecha !== d.fecha || l === pl; }) };
          var c = C.comprobarKm(C.lecturasVehiculo(resto, datos.gastos), d.fecha, km.valor);
          if (c) err.km = c;
          if (d.fecha < pl.fecha) err.fecha = 'Es anterior a tu primera lectura (' + ffecha(pl.fecha) + '). Edita el vehículo para cambiarla.';
        }
        if (!err.fecha && d.fecha === pl.fecha) err.fecha = 'Ese día es tu lectura inicial. Usa otra fecha o edita el vehículo.';
        if (Object.keys(err).length) { mostrarErrores(form, err); return; }
        var antes = kmAhora(v);
        v.lecturas = v.lecturas.filter(function (l) { return l.fecha !== d.fecha || l === pl; });
        v.lecturas.push({ fecha: d.fecha, km: km.valor });
        if (!persistir()) return;
        cerrarHoja();
        aviso('Kilometraje guardado: ' + fkm(km.valor) + (antes && km.valor > antes.km ? ' (+' + C.formatoNumero(km.valor - antes.km) + ' km)' : ''));
        render();
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Hojas: recordatorios, aceite, categorías, selector                  */
  /* ------------------------------------------------------------------ */
  function hojaRecordatorio(r) {
    var v = r ? vehiculo(r.vehiculoId) : vehiculoActivo();
    var tipos = C.TIPOS_RECORDATORIO.map(function (t) { return '<option value="' + t + '"' + (r && r.tipo === t ? ' selected' : '') + '>' + NOMBRE_TIPO[t] + '</option>'; }).join('');
    var cuerpo = '<form id="form-rec" novalidate><p class="intro-form">' + esc(nombreVehiculo(v)) + '</p>' +
      '<div class="fila-2">' + campo({ nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: tipos }) +
      campo({ nombre: 'fecha', etiqueta: 'Fecha límite', tipo: 'date', valor: r ? r.fecha : '' }) + '</div>' +
      campo({ nombre: 'titulo', etiqueta: 'Título', opcional: true, valor: r ? r.titulo : '', placeholder: 'Ej.: Renovar seguro', attrs: 'maxlength="60" autocomplete="off"' }) +
      campo({ nombre: 'notas', etiqueta: 'Notas', tipo: 'textarea', opcional: true, valor: r ? r.notas : '', max: 300 }) +
      '<div class="acciones-hoja">' + (r ? '<button type="button" class="btn peligro-texto" data-accion="borrar-recordatorio" data-id="' + esc(r.id) + '">' + ico('check') + 'Hecho / quitar</button>' : '') +
      '<button type="submit" class="btn primario grande">' + ico('check') + 'Guardar</button></div></form>';
    abrirHoja(r ? 'Editar recordatorio' : 'Nuevo recordatorio', cuerpo, function (hoja) {
      var form = $('#form-rec', hoja);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var d = valores(form), err = {};
        if (!C.esFechaISO(d.fecha)) err.fecha = 'Indica una fecha válida.';
        if (C.TIPOS_RECORDATORIO.indexOf(d.tipo) < 0) err.tipo = 'Elige un tipo.';
        if (Object.keys(err).length) { mostrarErrores(form, err); return; }
        var val = { tipo: d.tipo, fecha: d.fecha, titulo: String(d.titulo || '').trim().slice(0, 60), notas: String(d.notas || '').trim().slice(0, 300) };
        if (r) Object.assign(r, val);
        else datos.recordatorios.push(Object.assign({ id: C.nuevoId(), vehiculoId: v.id }, val));
        if (!persistir()) return;
        cerrarHoja(); aviso('Recordatorio guardado'); render();
      });
    });
  }
  function hojaAceite(v) {
    var a = v.aceite || {};
    var k = kmAhora(v);
    var cuerpo = '<form id="form-aceite" novalidate><p class="intro-form">' + esc(nombreVehiculo(v)) + ' · ahora ' + (k ? fkm(k.km) : '—') + '</p><div class="fila-2">' +
      campo({ nombre: 'kmUltimo', etiqueta: 'Km del último cambio', valor: a.kmUltimo != null ? String(a.kmUltimo) : '', attrs: 'inputmode="numeric" autocomplete="off" autofocus', sufijo: 'km' }) +
      campo({ nombre: 'intervalo', etiqueta: 'Cambiar cada', valor: String(a.intervalo || 15000), attrs: 'inputmode="numeric" autocomplete="off"', sufijo: 'km', ayuda: 'Mira el libro de mantenimiento (suele ser 10.000–30.000 km).' }) + '</div>' +
      '<div class="acciones-hoja">' + (v.aceite ? '<button type="button" class="btn peligro-texto" data-accion="quitar-aceite">Quitar aviso</button>' : '') + '<button type="submit" class="btn primario grande">' + ico('check') + 'Guardar</button></div></form>';
    abrirHoja('Aviso de cambio de aceite', cuerpo, function (hoja) {
      var form = $('#form-aceite', hoja);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var d = valores(form), err = {};
        var ku = C.leerKm(d.kmUltimo), iv = C.leerKm(d.intervalo);
        if (ku.vacio) err.kmUltimo = 'Indica el kilometraje.'; else if (ku.error) err.kmUltimo = ku.error;
        else if (k && ku.valor > k.km) err.kmUltimo = 'Es mayor que tu kilometraje actual (' + fkm(k.km) + ').';
        if (iv.vacio || iv.error || iv.valor < 500 || iv.valor > 200000) err.intervalo = 'Entre 500 y 200.000 km.';
        if (Object.keys(err).length) { mostrarErrores(form, err); return; }
        v.aceite = { kmUltimo: ku.valor, intervalo: iv.valor };
        if (!persistir()) return;
        cerrarHoja(); aviso('Aviso de aceite guardado'); render();
      });
    });
  }
  function hojaCategoria(c) {
    var color = c ? c.color : C.COLORES_PERSONALIZADOS[datos.categorias.length % C.COLORES_PERSONALIZADOS.length];
    var icono = c ? c.icono : 'etiqueta';
    var cuerpo = '<form id="form-cat" novalidate>' + campo({ nombre: 'nombre', etiqueta: 'Nombre', valor: c ? c.nombre : '', placeholder: 'Ej.: Lavado, Multas, Accesorios', attrs: 'maxlength="30" autocomplete="off" autofocus' }) +
      '<fieldset class="campo"><legend>Color</legend><div class="muestras">' + C.COLORES_PERSONALIZADOS.map(function (col) {
        return '<label class="muestra" style="--c:' + col + '"><input type="radio" name="color" value="' + col + '"' + (col === color ? ' checked' : '') + '><span class="sr">' + col + '</span></label>';
      }).join('') + '</div></fieldset>' +
      '<fieldset class="campo"><legend>Icono</legend><div class="muestras">' + C.ICONOS_PERSONALIZADOS.map(function (i) {
        return '<label class="muestra-ico"><input type="radio" name="icono" value="' + i + '"' + (i === icono ? ' checked' : '') + '><span>' + ico(i) + '<span class="sr">' + i + '</span></span></label>';
      }).join('') + '</div></fieldset>' +
      '<div class="acciones-hoja">' + (c ? '<button type="button" class="btn peligro-texto" data-accion="borrar-categoria" data-id="' + esc(c.id) + '">' + ico('papelera') + 'Eliminar</button>' : '') +
      '<button type="submit" class="btn primario grande">' + ico('check') + 'Guardar</button></div></form>';
    abrirHoja(c ? 'Editar categoría' : 'Nueva categoría', cuerpo, function (hoja) {
      var form = $('#form-cat', hoja);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var d = valores(form);
        var nombre = String(d.nombre || '').trim().slice(0, 30);
        var err = {};
        if (!nombre) err.nombre = 'Escribe un nombre.';
        else if (categorias().some(function (x) { return (!c || x.id !== c.id) && x.nombre.toLowerCase() === nombre.toLowerCase(); })) err.nombre = 'Ya existe una categoría con ese nombre.';
        if (Object.keys(err).length) { mostrarErrores(form, err); return; }
        var val = { nombre: nombre, color: d.color || color, icono: d.icono || icono };
        if (c) Object.assign(c, val);
        else datos.categorias.push(Object.assign({ id: 'cat-' + C.nuevoId(), personalizada: true }, val));
        if (!persistir()) return;
        cerrarHoja(); aviso('Categoría guardada'); render();
      });
    });
  }
  function borrarCategoria(id) {
    var c = datos.categorias.find(function (x) { return x.id === id; });
    var n = datos.gastos.filter(function (g) { return g.categoria === id; }).length;
    confirmar({ titulo: '¿Eliminar «' + c.nombre + '»?', texto: n ? 'Sus ' + plural(n, 'gasto pasará', 'gastos pasarán') + ' a la categoría «Otros». Los importes no se pierden.' : 'No hay gastos en esta categoría.', boton: 'Eliminar', peligro: true }).then(function (ok) {
      if (!ok) return;
      datos.gastos.forEach(function (g) { if (g.categoria === id) g.categoria = 'otros'; });
      datos.categorias = datos.categorias.filter(function (x) { return x.id !== id; });
      if (filtros.categoria === id) filtros.categoria = '';
      if (!persistir()) return;
      cerrarHoja(); aviso('Categoría eliminada', 'info'); render();
    });
  }
  function hojaElegirVehiculo() {
    var act = vehiculoActivo();
    var cuerpo = '<ul class="elegir-veh">' + datos.vehiculos.map(function (v) {
      var k = kmAhora(v);
      return '<li><button type="button" class="opcion-veh' + (v.id === act.id ? ' activo' : '') + '" data-accion="usar-vehiculo" data-id="' + esc(v.id) + '" aria-pressed="' + (v.id === act.id) + '">' + avatar(v) +
        '<span class="sv-texto"><span class="sv-nombre">' + esc(nombreVehiculo(v)) + '</span><span class="sv-km">' + esc([v.matricula, k ? fkm(k.km) : ''].filter(Boolean).join(' · ')) + '</span></span>' + (v.id === act.id ? ico('check') : '') + '</button></li>';
    }).join('') + '</ul><div class="acciones-lista"><button type="button" class="btn secundario" data-accion="nuevo-vehiculo">' + ico('mas') + 'Añadir vehículo</button><a class="btn secundario" href="#garaje" data-accion="cerrar-hoja">' + ico('garaje') + 'Ir al garaje</a></div>';
    abrirHoja('Tus vehículos', cuerpo);
  }

  /* ------------------------------------------------------------------ */
  /* Datos: exportar, importar, demo, borrar                             */
  /* ------------------------------------------------------------------ */
  function descargar(nombre, contenido, tipo) {
    var blob = new Blob([contenido], { type: tipo });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function sufijoArchivo() { return (modo === 'demo' ? 'demo-' : '') + hoy(); }
  function exportarJSON() {
    descargar('mi-garaje-ia-copia-' + sufijoArchivo() + '.json', JSON.stringify(C.crearCopia(datos, modo === 'demo'), null, 2), 'application/json');
    aviso('Copia exportada (' + plural(datos.gastos.length, 'gasto', 'gastos') + ')');
  }
  function exportarCSV(lista, etiqueta) {
    descargar('mi-garaje-ia-movimientos-' + (etiqueta ? etiqueta + '-' : '') + sufijoArchivo() + '.csv', '﻿' + C.aCSV(lista, datos.vehiculos, categorias()), 'text/csv;charset=utf-8');
    aviso('CSV exportado (' + plural(lista.length, 'movimiento', 'movimientos') + ')');
  }
  function importar() {
    if (modo === 'demo') { aviso('Sal del modo demostración para importar tus datos.', 'info'); return; }
    var inp = $('#archivo-importar');
    inp.value = '';
    inp.click();
  }
  function procesarArchivo(archivo) {
    if (!archivo) return;
    if (archivo.size > 30 * 1024 * 1024) { aviso('El archivo es demasiado grande.', 'error'); return; }
    archivo.text().then(function (texto) {
      var obj;
      try { obj = JSON.parse(texto); } catch (e) { mostrarErroresImportacion(['El archivo no es un JSON válido (¿está dañado o es otro tipo de archivo?).']); return; }
      var res = C.validarImportacion(obj);
      if (!res.ok) { mostrarErroresImportacion(res.errores); return; }
      var actual = datos.vehiculos.length + datos.gastos.length;
      var texto2 = 'La copia tiene ' + plural(res.resumen.vehiculos, 'vehículo', 'vehículos') + ' y ' + plural(res.resumen.gastos, 'gasto', 'gastos') + (res.demo ? ' (son datos de DEMOSTRACIÓN)' : '') + '. ' +
        (actual ? 'Reemplazará tus datos actuales (' + plural(datos.vehiculos.length, 'vehículo', 'vehículos') + ', ' + plural(datos.gastos.length, 'gasto', 'gastos') + '). Te recomendamos exportar antes una copia.' : '');
      return confirmar({ titulo: actual ? '¿Reemplazar tus datos?' : '¿Importar esta copia?', texto: texto2, boton: actual ? 'Reemplazar' : 'Importar', peligro: !!actual }).then(function (ok) {
        if (!ok) return;
        var previo = datos;
        datos = res.datos;
        if (!persistir()) { datos = previo; return; }
        prefs.activo.real = datos.vehiculos[0] ? datos.vehiculos[0].id : null; guardarPrefs();
        cerrarHoja();
        aviso('Copia importada: ' + plural(res.resumen.gastos, 'gasto', 'gastos'));
        res.avisos.forEach(function (a) { aviso(a, 'info'); });
        irA('inicio');
      });
    }).catch(function () { aviso('No se ha podido leer el archivo.', 'error'); });
  }
  function mostrarErroresImportacion(errores) {
    abrirHoja('No se ha podido importar', '<p class="intro-form">El archivo no se ha importado y <strong>tus datos no han cambiado</strong>. Problemas encontrados:</p><ul class="avisos-dato">' +
      errores.map(function (e) { return '<li>' + ico('aviso') + '<span>' + esc(e) + '</span></li>'; }).join('') + '</ul><div class="acciones-hoja"><button type="button" class="btn primario grande" data-accion="cerrar-hoja">Entendido</button></div>');
  }
  function entrarDemo() {
    modo = 'demo';
    datos = A.cargar('demo');
    if (!datos.vehiculos.length) { datos = window.Demo.generar(hoy()); A.guardar('demo', datos); }
    prefs.activo.demo = prefs.activo.demo && vehiculo(prefs.activo.demo) ? prefs.activo.demo : datos.vehiculos[0].id;
    guardarPrefs();
    periodo = { tipo: 'mes', ref: mesHoy() };
    memoriaNumeros.clear();
    aviso('Modo demostración: datos ficticios. Tus datos reales no se tocan.', 'info');
    irA('inicio');
  }
  function salirDemo() {
    modo = 'real';
    datos = A.cargar('real');
    guardarPrefs();
    memoriaNumeros.clear();
    aviso('Has vuelto a tus datos', 'info');
    irA('inicio');
  }

  /* ------------------------------------------------------------------ */
  /* Navegación y eventos                                                */
  /* ------------------------------------------------------------------ */
  var VISTAS = ['inicio', 'movimientos', 'estadisticas', 'garaje', 'ajustes'];
  function irA(v) {
    if (location.hash !== '#' + v) location.hash = '#' + v;
    else { vistaActual = v; render(); }
  }
  function alCambiarHash() {
    var h = location.hash.replace('#', '');
    if (h === 'vista') return; // enlace «saltar al contenido»
    vistaActual = VISTAS.indexOf(h) >= 0 ? h : 'inicio';
    cerrarHoja();
    render();
    window.scrollTo(0, 0);
    try { $('#vista').focus({ preventScroll: true }); } catch (e) { /* nada */ }
  }

  var acciones = {
    'cerrar-hoja': cerrarHoja,
    'nuevo-gasto': function () { hojaGasto(null); },
    'editar-gasto': function (el) { var g = datos.gastos.find(function (x) { return x.id === el.dataset.id; }); if (g) hojaGasto(g); },
    'borrar-gasto': function (el) { borrarGasto(el.dataset.id); },
    'nuevo-vehiculo': function () { hojaVehiculo(null); },
    'editar-vehiculo': function (el) { hojaVehiculo(vehiculo(el.dataset.id) || vehiculoActivo()); },
    'borrar-vehiculo': function (el) { borrarVehiculo(el.dataset.id); },
    'usar-vehiculo': function (el) { prefs.activo[modo] = el.dataset.id; guardarPrefs(); cerrarHoja(); filtros.categoria = ''; render(); },
    'elegir-vehiculo': hojaElegirVehiculo,
    'actualizar-km': function (el) { hojaKm((el.dataset.id && vehiculo(el.dataset.id)) || vehiculoActivo()); },
    'borrar-lectura': function (el) {
      var v = vehiculo(el.dataset.v), l = v.lecturas[Number(el.dataset.i)];
      var resto = { id: v.id, lecturas: v.lecturas.filter(function (x) { return x !== l; }) };
      confirmar({ titulo: '¿Borrar la lectura?', texto: ffecha(l.fecha) + ' · ' + fkm(l.km), boton: 'Borrar', peligro: true }).then(function (ok) {
        if (!ok) return;
        v.lecturas = resto.lecturas; if (!persistir()) return;
        cerrarHoja(); aviso('Lectura borrada', 'info'); render();
      });
    },
    'detalle-km': function () {
      var v = vehiculoActivo(), r = C.resumenPeriodo(v, gastosDe(v), categorias(), periodo, hoy());
      abrirHoja('Coste por km · ' + esc(etiquetaPeriodo()), bloqueCosteKm(r));
    },
    'nuevo-recordatorio': function () { hojaRecordatorio(null); },
    'editar-recordatorio': function (el) { var r = datos.recordatorios.find(function (x) { return x.id === el.dataset.id; }); if (r) hojaRecordatorio(r); },
    'borrar-recordatorio': function (el) {
      datos.recordatorios = datos.recordatorios.filter(function (x) { return x.id !== el.dataset.id; });
      if (!persistir()) return; cerrarHoja(); aviso('Recordatorio quitado', 'info'); render();
    },
    'aceite': function () { hojaAceite(vehiculoActivo()); },
    'quitar-aceite': function () { vehiculoActivo().aceite = null; if (!persistir()) return; cerrarHoja(); aviso('Aviso de aceite quitado', 'info'); render(); },
    'nueva-categoria': function () { hojaCategoria(null); },
    'editar-categoria': function (el) { var c = datos.categorias.find(function (x) { return x.id === el.dataset.id; }); if (c) hojaCategoria(c); },
    'borrar-categoria': function (el) { borrarCategoria(el.dataset.id); },
    'periodo-tipo': function (el) {
      var t = el.dataset.tipo;
      if (t === periodo.tipo) return;
      var refMes = periodo.tipo === 'mes' ? periodo.ref : periodo.tipo === 'anio' ? (periodo.ref === hoy().slice(0, 4) ? mesHoy() : periodo.ref + '-12') : mesHoy();
      periodo = { tipo: t, ref: t === 'mes' ? refMes : t === 'anio' ? refMes.slice(0, 4) : null };
      render();
    },
    'periodo-mover': function (el) {
      var p = Number(el.dataset.paso);
      if (periodo.tipo === 'mes') { var m = C.sumarMeses(periodo.ref, p); if (m <= mesHoy()) periodo.ref = m; }
      else if (periodo.tipo === 'anio') { var a = String(Number(periodo.ref) + p); if (a <= hoy().slice(0, 4)) periodo.ref = a; }
      render();
    },
    'filtrar-cat': function (el) {
      var r = C.rangoPeriodo(periodo.tipo, periodo.ref);
      filtros = Object.assign(filtros, { categoria: el.dataset.cat, desde: r.desde || '', hasta: r.hasta || '', texto: '', abierto: !!r.desde, limite: 150 });
      irA('movimientos');
    },
    'filtro-cat': function (el) { filtros.categoria = el.dataset.cat; filtros.limite = 150; render(); },
    'toggle-filtros': function () { filtros.abierto = !filtros.abierto; render(); },
    'limpiar-filtros': function () { filtros = { texto: '', categoria: '', desde: '', hasta: '', orden: filtros.orden, abierto: false, limite: 150 }; render(); },
    'rango-rapido': function (el) {
      var r = el.dataset.r, h = hoy();
      if (r === 'mes') { filtros.desde = mesHoy() + '-01'; filtros.hasta = h; }
      else if (r === 'mesant') { var m = C.sumarMeses(mesHoy(), -1), rr = C.rangoPeriodo('mes', m); filtros.desde = rr.desde; filtros.hasta = rr.hasta; }
      else if (r === 'anio') { filtros.desde = h.slice(0, 4) + '-01-01'; filtros.hasta = h; }
      else { filtros.desde = ''; filtros.hasta = ''; }
      render();
    },
    'mas-resultados': function () { filtros.limite += 150; refrescarResultados(); },
    'csv-filtrados': function () { exportarCSV(gastosFiltrados(), 'filtrados'); },
    'exportar-json': exportarJSON,
    'exportar-csv': function () { exportarCSV(datos.gastos, ''); },
    'importar': importar,
    'entrar-demo': entrarDemo,
    'salir-demo': salirDemo,
    'reiniciar-demo': function () {
      confirmar({ titulo: '¿Regenerar la demostración?', texto: 'Se descartan los cambios hechos en los datos de demostración. Tus datos reales no se tocan.', boton: 'Regenerar' }).then(function (ok) {
        if (!ok) return;
        datos = window.Demo.generar(hoy()); persistir(); prefs.activo.demo = datos.vehiculos[0].id; guardarPrefs(); memoriaNumeros.clear();
        aviso('Demostración regenerada', 'info'); irA('inicio');
      });
    },
    'borrar-todo': function () {
      var esDemo = modo === 'demo';
      confirmar({
        titulo: esDemo ? '¿Borrar los datos de demostración?' : '¿Borrar TODOS tus datos?',
        texto: esDemo ? 'Saldrás del modo demostración.' : 'Se eliminarán ' + plural(datos.vehiculos.length, 'vehículo', 'vehículos') + ' y ' + plural(datos.gastos.length, 'gasto', 'gastos') + ' de este navegador. No se puede deshacer. Si no tienes una copia, cancela y exporta primero.',
        boton: 'Borrar definitivamente', peligro: true
      }).then(function (ok) {
        if (!ok) return;
        A.borrar(modo);
        if (esDemo) { modo = 'real'; datos = A.cargar('real'); }
        else { datos = C.datosVacios(); prefs.activo.real = null; }
        guardarPrefs(); memoriaNumeros.clear();
        aviso(esDemo ? 'Datos de demostración borrados' : 'Datos borrados', 'info');
        irA('inicio');
      });
    },
    'tema': function () { prefs.tema = prefs.tema === 'claro' ? 'oscuro' : 'claro'; guardarPrefs(); render(); },
    'tema-fijo': function (el) { prefs.tema = el.dataset.tema; guardarPrefs(); render(); },
    'ir-inicio': function () { irA('inicio'); }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-accion]');
    if (!el || el.disabled) return;
    var fn = acciones[el.getAttribute('data-accion')];
    if (!fn) return;
    if (el.tagName === 'A' && el.getAttribute('data-accion') === 'cerrar-hoja') { cerrarHoja(); return; }
    e.preventDefault();
    fn(el, e);
  });
  // Clic fuera de la hoja la cierra.
  $('#capa-hoja').addEventListener('click', function (e) { if (e.target === this) cerrarHoja(); });
  document.addEventListener('keydown', function (e) {
    var dlg = $('#capa-dialogo'), hoja = $('#capa-hoja');
    if (e.key === 'Escape') {
      if (!dlg.hidden && dlg._cerrar) dlg._cerrar();
      else if (!hoja.hidden) cerrarHoja();
    } else if (e.key === 'Tab') {
      if (!dlg.hidden) trampaFoco(dlg, e); else if (!hoja.hidden) trampaFoco(hoja, e);
    }
  });
  // Filtros de la lista (sin perder el foco al escribir).
  document.addEventListener('input', function (e) {
    if (e.target.id === 'f-texto') { filtros.texto = e.target.value; filtros.limite = 150; refrescarResultados(); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'f-desde' || t.id === 'f-hasta') {
      var v = t.value;
      if (v && !C.esFechaISO(v)) { aviso('Fecha no válida', 'error'); return; }
      filtros[t.id === 'f-desde' ? 'desde' : 'hasta'] = v; refrescarResultados();
    } else if (t.id === 'f-orden') { filtros.orden = t.value; refrescarResultados(); }
    else if (t.dataset && t.dataset.cmp) { comparacion[t.dataset.cmp] = t.value; render(); var s = document.getElementById(t.id); if (s) s.focus(); }
    else if (t.id === 'archivo-importar') procesarArchivo(t.files && t.files[0]);
  });
  var tRedim = null, anchoPrevio = window.innerWidth;
  window.addEventListener('resize', function () {
    clearTimeout(tRedim);
    tRedim = setTimeout(function () { if (window.innerWidth !== anchoPrevio) { anchoPrevio = window.innerWidth; dibujarGraficos(); } }, 150);
  });
  // Si los datos cambian en otra pestaña, recargamos.
  window.addEventListener('storage', function (e) {
    if (e.key === A.CLAVES.real || e.key === A.CLAVES.demo || e.key === A.CLAVES.prefs) {
      prefs = A.cargarPrefs(); modo = prefs.modo; datos = A.cargar(modo); render();
    }
  });
  window.addEventListener('hashchange', alCambiarHash);

  /* Inicio */
  hidratarIconos(document);
  G.activar();
  vistaActual = VISTAS.indexOf(location.hash.replace('#', '')) >= 0 ? location.hash.replace('#', '') : 'inicio';
  render();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* sin modo offline */ }); });
  }
  // Para depuración y pruebas automáticas (no expone nada fuera del navegador).
  window.MiGaraje = { version: VERSION_APP, estado: function () { return { modo: modo, vista: vistaActual, periodo: periodo, datos: datos }; } };
})();

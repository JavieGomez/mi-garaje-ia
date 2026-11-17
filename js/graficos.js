/*
 * Mi Garaje IA — gráficos SVG propios (sin bibliotecas externas).
 * Se dibujan al ancho real del contenedor para que el texto se lea bien en móvil.
 * Interacción: puntero (ratón/dedo) y teclado (Tab) muestran un tooltip con el dato exacto.
 */
(function (raiz) {
  'use strict';
  var C = raiz.Calculos;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var r1 = function (n) { return Math.round(n * 10) / 10; };
  var contador = 0;

  function escalaBonita(maxEuros, divisiones) {
    var div = divisiones || 4;
    if (!(maxEuros > 0)) return { max: 100, paso: 25 };
    var bruto = maxEuros / div;
    var mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    var norm = bruto / mag;
    var bonito = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    var paso = bonito * mag;
    return { max: Math.ceil(maxEuros / paso - 1e-9) * paso, paso: paso };
  }
  function etiquetaEje(euros) {
    if (euros >= 10000) return C.formatoNumero(euros / 1000, euros % 1000 ? 1 : 0) + ' mil';
    return C.formatoNumero(euros) + ' €';
  }

  /* ------------------------------ Dona ------------------------------ */
  /** segs: [{nombre, cent, color, fraccion}] */
  function dona(segs, o) {
    o = o || {};
    var tam = o.tam || 184, g = o.grosor || 26, r = (tam - g) / 2, c = tam / 2;
    var circ = 2 * Math.PI * r, off = 0, hueco = segs.length > 1 ? 2.5 : 0;
    var total = segs.reduce(function (t, s) { return t + s.cent; }, 0);
    var arcos = segs.map(function (s) {
      var len = s.fraccion * circ, vis = Math.max(len - hueco, 0.8);
      var tip = s.nombre + '\n' + C.formatoEuros(s.cent) + ' · ' + C.porcentaje(s.fraccion);
      var el = '<circle class="dona-seg" cx="' + c + '" cy="' + c + '" r="' + r1(r) + '" fill="none" stroke="' + esc(s.color) + '" stroke-width="' + g +
        '" stroke-dasharray="' + r1(vis) + ' ' + r1(circ - vis) + '" stroke-dashoffset="' + r1(-off) + '" transform="rotate(-90 ' + c + ' ' + c + ')"' +
        ' data-tip="' + esc(tip) + '" tabindex="0" role="img" aria-label="' + esc(tip.replace('\n', ': ')) + '"/>';
      off += len;
      return el;
    }).join('');
    return '<svg class="grafico dona" viewBox="0 0 ' + tam + ' ' + tam + '" width="' + tam + '" height="' + tam + '" role="group" aria-label="' + esc(o.titulo || 'Distribución por categoría') + '">' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + r1(r) + '" fill="none" class="dona-fondo" stroke-width="' + g + '"/>' + arcos +
      '<text x="' + c + '" y="' + (c - 4) + '" class="dona-total" text-anchor="middle">' + esc(C.formatoEuros(total, total >= 100000)) + '</text>' +
      '<text x="' + c + '" y="' + (c + 16) + '" class="dona-sub" text-anchor="middle">' + esc(o.subtitulo || 'en total') + '</text></svg>';
  }

  /* ------------------------- Barras apiladas ------------------------ */
  /**
   * serie: [{mes, total, porCat}] (de Calculos.serieMensual); categorias: lista con colores y nombres.
   * o: {ancho, alto, destacado:'AAAA-MM'}
   */
  function barras(serie, categorias, o) {
    o = o || {};
    var ancho = Math.max(o.ancho || 320, 240), alto = o.alto || 220;
    var izq = 50, der = 8, arr = 18, abj = 28;
    var w = ancho - izq - der, h = alto - arr - abj, n = serie.length || 1;
    var maxE = Math.max.apply(null, serie.map(function (s) { return s.total / 100; }).concat([0]));
    var esc_ = escalaBonita(maxE);
    var y = function (euros) { return arr + h - (euros / esc_.max) * h; };
    var paso = w / n, anchoBarra = Math.min(paso * 0.62, 38);
    var orden = categorias.map(function (c) { return c.id; });
    var info = {}; categorias.forEach(function (c) { info[c.id] = c; });
    var partes = [];
    // Rejilla
    for (var v = 0; v <= esc_.max + 1e-9; v += esc_.paso) {
      partes.push('<line class="rejilla" x1="' + izq + '" x2="' + (ancho - der) + '" y1="' + r1(y(v)) + '" y2="' + r1(y(v)) + '"/>');
      partes.push('<text class="eje" x="' + (izq - 6) + '" y="' + r1(y(v) + 4) + '" text-anchor="end">' + esc(etiquetaEje(v)) + '</text>');
    }
    var saltoEtiqueta = Math.ceil(n / Math.max(4, Math.floor(w / 46)));
    serie.forEach(function (s, i) {
      var x = izq + paso * i + (paso - anchoBarra) / 2;
      var base = 0;
      var ids = Object.keys(s.porCat).sort(function (a, b) { return (orden.indexOf(a) + 99 * (orden.indexOf(a) < 0)) - (orden.indexOf(b) + 99 * (orden.indexOf(b) < 0)); });
      var dest = o.destacado && s.mes === o.destacado;
      var g = '<g class="barra' + (dest ? ' destacada' : '') + (o.destacado && !dest ? ' atenuada' : '') + '">';
      ids.forEach(function (id) {
        var e = s.porCat[id] / 100, alto_ = (e / esc_.max) * h;
        if (alto_ <= 0) return;
        var yy = y(base + e);
        var col = (info[id] || info.otros || { color: '#94A3B8' }).color;
        g += '<rect x="' + r1(x) + '" y="' + r1(yy) + '" width="' + r1(anchoBarra) + '" height="' + r1(Math.max(alto_ - (alto_ > 3 ? 1.2 : 0), 0.8)) + '" rx="' + r1(Math.min(3.5, anchoBarra / 5)) + '" fill="' + esc(col) + '"/>';
        base += e;
      });
      if (dest && s.total > 0) g += '<text class="barra-valor" x="' + r1(x + anchoBarra / 2) + '" y="' + r1(y(base) - 6) + '" text-anchor="middle">' + esc(C.formatoEuros(s.total, true)) + '</text>';
      if (i % saltoEtiqueta === 0 || dest)
        g += '<text class="eje' + (dest ? ' eje-dest' : '') + '" x="' + r1(izq + paso * i + paso / 2) + '" y="' + (alto - 9) + '" text-anchor="middle">' + esc(C.mesCorto(s.mes) + (s.mes.slice(5) === '01' || i === 0 ? ' ' + s.mes.slice(2, 4) : '')) + '</text>';
      var lineas = [C.nombreMes(s.mes), 'Total: ' + C.formatoEuros(s.total)].concat(ids.slice().sort(function (a, b) { return s.porCat[b] - s.porCat[a]; }).map(function (id) {
        return '• ' + (info[id] ? info[id].nombre : id) + ': ' + C.formatoEuros(s.porCat[id]);
      }));
      var tip = lineas.join('\n');
      g += '<rect class="barra-hit" x="' + r1(izq + paso * i) + '" y="' + arr + '" width="' + r1(paso) + '" height="' + h + '" data-tip="' + esc(tip) + '" tabindex="0" role="img" aria-label="' + esc(C.nombreMes(s.mes) + ': ' + C.formatoEuros(s.total)) + '"/>';
      partes.push(g + '</g>');
    });
    partes.push('<line class="eje-linea" x1="' + izq + '" x2="' + (ancho - der) + '" y1="' + (arr + h) + '" y2="' + (arr + h) + '"/>');
    return '<svg class="grafico" viewBox="0 0 ' + ancho + ' ' + alto + '" width="' + ancho + '" height="' + alto + '" role="group" aria-label="' + esc(o.titulo || 'Gastos mensuales') + '">' + partes.join('') + '</svg>';
  }

  /* ------------------------ Línea acumulada ------------------------- */
  /** puntos: Calculos.serieAcumulada. o: {ancho, alto, desde, hasta} (ISO) */
  function lineaAcumulada(puntos, o) {
    o = o || {};
    var id = 'lin' + (++contador);
    var ancho = Math.max(o.ancho || 320, 240), alto = o.alto || 200;
    var izq = 50, der = 12, arr = 14, abj = 28;
    var w = ancho - izq - der, h = alto - arr - abj;
    var d0 = C.diaNum(o.desde), d1 = Math.max(C.diaNum(o.hasta), d0 + 1);
    var maxE = puntos.length ? puntos[puntos.length - 1].valor / 100 : 0;
    var es = escalaBonita(maxE);
    var x = function (d) { return izq + (d - d0) / (d1 - d0) * w; };
    var y = function (e) { return arr + h - (e / es.max) * h; };
    var partes = [];
    for (var v = 0; v <= es.max + 1e-9; v += es.paso) {
      partes.push('<line class="rejilla" x1="' + izq + '" x2="' + (ancho - der) + '" y1="' + r1(y(v)) + '" y2="' + r1(y(v)) + '"/>');
      partes.push('<text class="eje" x="' + (izq - 6) + '" y="' + r1(y(v) + 4) + '" text-anchor="end">' + esc(etiquetaEje(v)) + '</text>');
    }
    // Marcas de mes
    var meses = C.listaMeses(C.mesDe(o.desde), C.mesDe(C.isoDeDia(d1)));
    var salto = Math.ceil(meses.length / Math.max(3, Math.floor(w / 52)));
    meses.forEach(function (m, i) {
      var dm = C.diaNum(m + '-01');
      if (dm < d0 || i % salto) return;
      partes.push('<text class="eje" x="' + r1(x(dm)) + '" y="' + (alto - 9) + '" text-anchor="middle">' + esc(C.mesCorto(m) + (m.slice(5) === '01' ? ' ' + m.slice(2, 4) : '')) + '</text>');
    });
    // Escalones: el gasto acumulado sube el día del pago y se mantiene.
    var cam = 'M' + r1(x(d0)) + ' ' + r1(y(0)), ultimo = 0;
    puntos.forEach(function (p) {
      cam += ' H' + r1(x(p.dia)) + ' V' + r1(y(p.valor / 100));
      ultimo = p.valor / 100;
    });
    var dFin = Math.min(d1, C.diaNum(o.hoy || o.hasta));
    cam += ' H' + r1(x(Math.max(dFin, puntos.length ? puntos[puntos.length - 1].dia : d0)));
    var area = cam + ' V' + r1(y(0)) + ' Z';
    partes.push('<defs><linearGradient id="' + id + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="area-ini"/><stop offset="1" class="area-fin"/></linearGradient></defs>');
    partes.push('<path d="' + area + '" fill="url(#' + id + ')" class="area"/>');
    partes.push('<path d="' + cam + '" class="linea" fill="none"/>');
    partes.push('<line class="eje-linea" x1="' + izq + '" x2="' + (ancho - der) + '" y1="' + (arr + h) + '" y2="' + (arr + h) + '"/>');
    partes.push('<g class="marcador" style="display:none"><line class="marcador-linea" y1="' + arr + '" y2="' + (arr + h) + '"/><circle r="5" class="marcador-punto"/></g>');
    var datos = puntos.map(function (p) { return [r1(x(p.dia)), r1(y(p.valor / 100)), p.fecha, p.valor, p.delDia]; });
    partes.push('<rect class="linea-capa" x="' + izq + '" y="' + arr + '" width="' + w + '" height="' + h + '" fill="transparent"/>');
    return '<svg class="grafico grafico-linea" viewBox="0 0 ' + ancho + ' ' + alto + '" width="' + ancho + '" height="' + alto + '" role="img" aria-label="' +
      esc((o.titulo || 'Gasto acumulado') + ': ' + C.formatoEuros(Math.round(ultimo * 100))) + '" data-puntos="' + esc(JSON.stringify(datos)) + '">' + partes.join('') + '</svg>';
  }

  /* ----------------------------- Tooltip ---------------------------- */
  var tip = null, activo = null;
  function asegurarTip() {
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'tooltip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
      document.body.appendChild(tip);
    }
    return tip;
  }
  function mostrar(texto, x, y) {
    var t = asegurarTip();
    var lineas = String(texto).split('\n');
    t.innerHTML = '<strong>' + esc(lineas[0]) + '</strong>' + lineas.slice(1).map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('');
    t.hidden = false;
    var r = t.getBoundingClientRect();
    var left = Math.min(Math.max(8, x - r.width / 2), window.innerWidth - r.width - 8);
    var top = y - r.height - 14;
    if (top < 8) top = y + 18;
    t.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)';
  }
  function ocultar() { if (tip) tip.hidden = true; activo = null; }

  function moverLinea(svg, cx, cy) {
    var datos;
    try { datos = JSON.parse(svg.getAttribute('data-puntos')); } catch (e) { return; }
    if (!datos.length) return;
    var caja = svg.getBoundingClientRect();
    var escala = caja.width / svg.viewBox.baseVal.width;
    var xLocal = (cx - caja.left) / escala;
    var mejor = datos[0];
    datos.forEach(function (d) { if (Math.abs(d[0] - xLocal) < Math.abs(mejor[0] - xLocal)) mejor = d; });
    var m = svg.querySelector('.marcador');
    m.style.display = '';
    m.querySelector('line').setAttribute('x1', mejor[0]); m.querySelector('line').setAttribute('x2', mejor[0]);
    m.querySelector('circle').setAttribute('cx', mejor[0]); m.querySelector('circle').setAttribute('cy', mejor[1]);
    mostrar(C.formatoFecha(mejor[2]) + '\nAcumulado: ' + C.formatoEuros(mejor[3]) + '\nEse día: +' + C.formatoEuros(mejor[4]),
      caja.left + mejor[0] * escala, caja.top + mejor[1] * escala);
  }

  function activar() {
    document.addEventListener('pointermove', function (e) {
      var capa = e.target.closest && e.target.closest('.linea-capa');
      if (capa) { moverLinea(capa.ownerSVGElement, e.clientX, e.clientY); activo = capa; return; }
      var el = e.target.closest && e.target.closest('[data-tip]');
      if (el) { activo = el; mostrar(el.getAttribute('data-tip'), e.clientX, e.clientY); }
      else if (activo) {
        if (activo.classList && activo.classList.contains('linea-capa')) { var m = activo.ownerSVGElement.querySelector('.marcador'); if (m) m.style.display = 'none'; }
        ocultar();
      }
    }, { passive: true });
    document.addEventListener('pointerdown', function (e) {
      var el = e.target.closest && e.target.closest('[data-tip], .linea-capa');
      if (!el) ocultar();
    }, { passive: true });
    document.addEventListener('focusin', function (e) {
      var el = e.target.closest && e.target.closest('[data-tip]');
      if (el) { var r = el.getBoundingClientRect(); activo = el; mostrar(el.getAttribute('data-tip'), r.left + r.width / 2, r.top); }
    });
    document.addEventListener('focusout', ocultar);
    window.addEventListener('scroll', ocultar, { passive: true });
  }

  raiz.Graficos = { dona: dona, barras: barras, lineaAcumulada: lineaAcumulada, escalaBonita: escalaBonita, activar: activar, ocultar: ocultar };
})(self);

# Mi Garaje IA 🚗

**Controla cuánto te cuesta de verdad tener tu coche.** Apunta gastos en segundos, mira en qué se va el dinero y descubre tu **coste por kilómetro**, calculado con tus datos reales.

Un proyecto de **Chiky & IA**. Web gratuita, sin cuentas, sin anuncios y sin servidores: los datos se quedan en tu dispositivo.

👉 **Úsala ya:** https://javiegomez.github.io/mi-garaje-ia/ — en el móvil, «Instalar aplicación» (Android) o «Añadir a pantalla de inicio» (iPhone).

---

## Abrir la app

**Opción 1 — doble clic (Windows):** abre `ABRIR_MI_GARAJE_IA.bat`. Arranca un servidor local y abre el navegador en `http://localhost:8080/`. Cierra la ventana negra para detenerlo.

**Opción 2 — terminal:**

```bash
node scripts/servidor.js --abrir
```

**Opción 3 — sin Node.js:** abre `index.html` con doble clic. Funciona todo excepto la instalación como app y el modo sin conexión (los navegadores no activan el *service worker* en archivos locales).

> Los datos guardados con `http://localhost:8080` y con `index.html` son independientes (el navegador los separa por dirección). Usa siempre la misma forma de abrirla, o pasa los datos con Exportar/Importar.

## Funciones

**Vehículos**
- Varios coches con gastos separados y selector en la cabecera.
- Marca y modelo obligatorios; año, matrícula, foto, fecha y precio de compra y valor estimado, opcionales.
- Kilometraje inicial (con su fecha), kilometraje actual e historial de lecturas.

**Gastos**
- Añadir, editar y eliminar (con confirmación y opción de deshacer).
- Fecha, importe, categoría, descripción, kilometraje y notas.
- 9 categorías base con iconos + categorías personalizadas (nombre, color, icono).
- Combustible: litros × precio por litro calcula el importe; con importe y litros deduce el €/L.
- Búsqueda (texto, importe, notas; sin importar tildes), filtros por categoría y fechas, orden por fecha o importe, totales por mes.
- Validación: importes negativos, vacíos o no numéricos; fechas inválidas o futuras; kilometrajes negativos o incoherentes con otras lecturas.

**Panel principal** (mes, año o total, con flechas para moverse)
- Gasto total del periodo, número de movimientos, comparación con el periodo anterior y barra de reparto por categorías.
- Coste por km (con su estado: completo, parcial o sin datos), categoría más cara, gasto medio mensual, gasto del mes anterior o del mes actual, combustible.
- «En qué se va el dinero», evolución de 6 meses, recordatorios, aceite y últimos movimientos.
- Indicador de **histórico completo** o **registro parcial** (si compraste el coche antes de empezar a apuntar).
- Los números se animan al cambiar y la tarjeta destella: ideal para enseñar cómo cambia una estadística al añadir un gasto.

**Estadísticas**
- Detalle del coste por km con la fórmula a la vista: `gastos ÷ km = €/km`, el tramo de fechas usado y los avisos.
- Gráfico circular por categoría, barras mensuales apiladas, gasto acumulado y comparación entre dos meses cualesquiera.
- Combustible: repostajes, litros y precio medio.
- Compra y depreciación, **siempre aparte** del coste de uso.
- Gráficos interactivos: tocar o pasar el ratón muestra el dato exacto; también se recorren con el teclado (Tab).

**Garaje**
- Fichas de cada vehículo, comparación entre vehículos, aviso de cambio de aceite (km restantes) y recordatorios de ITV, seguro, mantenimiento o impuestos (vencido en rojo, ≤ 30 días en amarillo).
- Son avisos **visuales dentro de la app**: no hay notificaciones en segundo plano.

**Datos y privacidad**
- Guardado automático en el navegador (`localStorage`). Nada se envía a ningún servidor: no hay analítica ni recursos externos.
- Exportar copia (JSON), exportar movimientos (CSV para Excel, con `;` y coma decimal), importar copia con validación completa y confirmación antes de reemplazar, borrar todo con confirmación.
- Modo demostración con dos coches ficticios y un año de gastos, **en un almacenamiento separado** y con un banner amarillo bien visible.

**Extras**
- Tema oscuro y claro, diseño móvil primero (barra inferior con botón central) y vista de escritorio con menú lateral.
- Instalable como app (PWA) y utilizable sin conexión cuando se sirve por http/https.
- Accesibilidad: etiquetas en todos los campos, navegación por teclado, foco visible, Escape cierra ventanas, respeta «reducir movimiento».

## Cómo se calcula el coste por kilómetro

```
coste por km = gastos del periodo ÷ kilómetros recorridos en ese MISMO periodo
```

- Los kilómetros salen de tus lecturas: km inicial, km actual, lecturas que apuntes y gastos con kilometraje. Entre dos lecturas se interpola linealmente (y se indica).
- Si el kilometraje solo cubre parte del periodo, se usan solo los gastos de esa parte y se avisa de lo que queda fuera.
- Con menos de dos lecturas, sin km recorridos o sin gastos, no se calcula: se explica qué falta.
- El precio de compra **no** se suma. La depreciación (precio − valor actual que tú estimas) se muestra aparte.

Ejemplo comprobado en las pruebas: 800 + 500 + 200 + 50 = 1.550 € en 5.000 km → **0,31 €/km**.

## Publicar gratis en GitHub Pages

La app es estática y usa rutas relativas, así que funciona tal cual en `https://TU-USUARIO.github.io/NOMBRE-REPOSITORIO/`.

1. Crea un repositorio nuevo en GitHub (por ejemplo `mi-garaje-ia`), público.
2. Sube **el contenido** de la carpeta `MI_GARAJE_IA` a la raíz del repositorio (con `index.html` en la raíz). Desde la web: *Add file → Upload files* y arrastra los archivos y carpetas. O por terminal:
   ```bash
   cd MI_GARAJE_IA
   git init
   git add .
   git commit -m "Mi Garaje IA 1.0"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/mi-garaje-ia.git
   git push -u origin main
   ```
3. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
4. En uno o dos minutos estará en `https://TU-USUARIO.github.io/mi-garaje-ia/`.

No hay que compilar nada ni configurar claves. El archivo `.nojekyll` evita que GitHub procese los archivos.

**Al actualizar la app**, cambia el número de `CACHE` en `sw.js` (por ejemplo `v1.0.1`) para que los móviles con la app instalada descarguen la versión nueva.

> Los datos de cada persona se guardan en su propio navegador. Publicar la web no publica los datos de nadie.

## Pruebas

```bash
npm test
```
Pruebas del motor de cálculo con el ejecutor de Node (19 grupos, sin dependencias).

```bash
npm run test:navegador
```
Prueba de extremo a extremo en Microsoft Edge o Google Chrome sin ventana (72 comprobaciones): usa la app con ratón y teclado reales, sirviéndola bajo `/MI_GARAJE_IA/` como GitHub Pages. Guarda el informe en `pruebas/resultados/e2e.txt` y regenera las capturas de `capturas/`. Si el navegador está en otra ruta: `NAVEGADOR="ruta\al\navegador.exe"`.

Detalle de lo comprobado: [`docs/03_pruebas.md`](docs/03_pruebas.md).

## Estructura

```
MI_GARAJE_IA/
├── index.html              Página única de la app
├── css/estilos.css         Estilos (tema oscuro/claro, móvil y escritorio)
├── js/
│   ├── calculos.js         Motor de cálculo puro: €/km, resúmenes, validación, CSV, importación
│   ├── almacen.js          Guardado en el navegador (datos reales y demo separados)
│   ├── graficos.js         Gráficos SVG propios con tooltips
│   ├── iconos.js           Iconos SVG
│   ├── demo.js             Generador de datos ficticios de demostración
│   └── app.js              Interfaz: vistas, formularios, navegación
├── iconos/                 Icono de la app (SVG y PNG)
├── manifest.webmanifest    PWA
├── sw.js                   Service worker (modo sin conexión)
├── scripts/                Servidor local y generador de iconos
├── pruebas/                Pruebas unitarias, de navegador y resultados
├── capturas/               Capturas de la app generadas por las pruebas
├── docs/                   Prompt inicial, proceso de creación y pruebas
└── ABRIR_MI_GARAJE_IA.bat  Abrir con doble clic en Windows
```

## Limitaciones

- Los datos viven en un solo navegador y dispositivo: no se sincronizan entre el móvil y el ordenador. Para pasarlos, exporta e importa la copia JSON.
- Si se borran los datos de navegación (o en modo privado) se pierden. Haz copias de vez en cuando.
- `localStorage` admite unos 5 MB: miles de gastos caben de sobra, pero muchas fotos de coches pueden llenarlo (cada foto se reduce a unos 50–100 KB).
- El €/km entre dos lecturas lejanas usa kilómetros estimados (interpolación lineal); cuantas más lecturas, más exacto.
- No calcula el consumo (L/100 km): exigiría apuntar siempre depósitos llenos.
- Los recordatorios no envían notificaciones: solo se ven al abrir la app.
- Solo euros y español.

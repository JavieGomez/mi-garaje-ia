# Cómo se creó Mi Garaje IA

Resumen honesto del proceso, útil para el vídeo 2. Todo se hizo en una sesión con un asistente de IA (Claude, en Claude Code) el 16/11/2026, a partir del encargo de `01_prompt_inicial.md`.

## 1. Decisiones técnicas

| Decisión | Por qué |
|---|---|
| **HTML + CSS + JavaScript puro, sin React ni Vite** | No hace falta compilar: los mismos archivos se abren en el navegador y se suben a GitHub Pages tal cual. Nada que instalar, nada que se rompa con actualizaciones. |
| **Gráficos SVG propios** (sin Chart.js) | Cero dependencias y cero peticiones a internet. Se dibujan al ancho real de la pantalla para que el texto se lea bien en móvil. |
| **`localStorage`** con claves separadas para datos reales y demo | Persistente, sin servidor. La demo nunca se mezcla con los datos del usuario. |
| **Importes en céntimos (enteros)** | Evita errores de coma flotante (0,1 + 0,2 = 0,30 €, no 0,30000000000000004). |
| **Motor de cálculo aislado** (`js/calculos.js`) | Funciones puras que se prueban en Node sin navegador. |
| **Sin fuentes ni scripts externos** | Privacidad (ninguna petición a terceros) y funcionamiento sin conexión. |

## 2. El cálculo del coste por kilómetro

Es la parte más delicada. Reglas implementadas:

1. **Lecturas de kilometraje**: el km inicial, el km actual, las lecturas que apunta el usuario y **cada gasto que lleva kilometraje** (p. ej. al repostar).
2. **Kilómetros del periodo** = cuentakilómetros al final del último día del periodo − al final del día anterior a su inicio. Si no hay lectura justo esos días, se **interpola linealmente** entre las lecturas más cercanas, y la app lo indica («km estimados entre tus lecturas»).
3. **Mismo tramo para gastos y km**: si solo se conoce el kilometraje de una parte del periodo, el cálculo se limita a esa parte y se avisa de cuánto dinero queda fuera («Actualiza el kilometraje para incluirlos»).
4. **Nunca divide entre cero**: con menos de dos lecturas, sin km recorridos o sin gastos, se muestra «—» y una explicación.
5. **El precio de compra no entra**: se muestra aparte («Compra y depreciación»), con la depreciación calculada a partir del valor actual que estima el usuario.
6. **Avisos de calidad**: «Datos completos» / «Datos parciales», «Histórico completo» / «Registro parcial» (si el coche se compró antes de empezar a apuntar), aviso de pagos anuales que inflan el €/km mensual y de pocos km.

## 3. Iteraciones y errores corregidos durante el desarrollo

Errores reales que aparecieron al probar y se corrigieron:

- **Fondo de la página sin color**: el atajo CSS `background` mezclaba color y degradados en un orden no válido. Se separó en propiedades.
- **Contenido invisible**: las animaciones de entrada empezaban con opacidad 0; si el navegador las pausa (pestaña en segundo plano), el contenido no aparecía. Ahora solo hay un leve desplazamiento.
- **Clics «atravesando» una ventana que se cerraba**: durante el fundido de cierre, la capa oscura seguía capturando toques. Ahora deja de recibir clics al empezar a cerrarse.
- **Diseño en móvil**: el nombre de la app se tapaba con el selector de coche, la barra de periodo se partía en dos líneas desalineadas, quedaba una tarjeta suelta con hueco al lado, la fórmula del €/km se partía mal, las categorías del formulario no tenían celdas iguales y la comparación de meses cortaba textos. Todo corregido tras revisar capturas.
- **Escritorio**: el logotipo del menú lateral salía debajo del botón de añadir y quedaba un hueco junto al gráfico circular. Corregido.
- **Lectura de km duplicada** al guardar una lectura el mismo día que la inicial (encontrado revisando el código). Corregido con una validación previa.

## 4. Capturas

La carpeta `capturas/` contiene capturas **generadas automáticamente por la prueba de navegador** (`pruebas/navegador/e2e.mjs`) sobre la app real, con datos de demostración ficticios. No son grabaciones del proceso de desarrollo: son fotos de la app terminada tomadas por el script de pruebas. Se pueden regenerar en cualquier momento con `npm run test:navegador`.

En las capturas de página completa (`*-completo.png`) se ocultan la barra inferior y los avisos solo para la foto, porque al fotografiar la página entera aparecerían en medio.

## 5. Herramientas usadas

- Editor y asistente: Claude Code (IA) para escribir el código, ejecutar pruebas y revisar capturas.
- Node.js (ya instalado) para el servidor local y las pruebas. Ninguna dependencia de npm.
- Microsoft Edge en modo sin ventana para la prueba de extremo a extremo y para generar los PNG del icono.

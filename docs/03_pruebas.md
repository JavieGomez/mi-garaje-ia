# Pruebas realizadas

Ejecutadas el 16/11/2026. Resultados guardados en `pruebas/resultados/`. Para repetirlas: `npm test` y `npm run test:navegador`.

## Resultado

| Batería | Resultado |
|---|---|
| Pruebas unitarias del motor de cálculo (`node --test`) | **19/19** grupos superados |
| Prueba de extremo a extremo en Microsoft Edge real, sin ventana | **72/72** comprobaciones superadas |

## Correspondencia con las pruebas obligatorias del encargo

| # | Requisito | Cómo se ha comprobado |
|---|---|---|
| 1 | Crear un vehículo | E2E: formulario completo con clics y teclado → aparece en la cabecera |
| 2 | Añadir gastos | E2E: tres gastos (gasolina, seguro, gasolina por litros) |
| 3 | Sumas correctas | E2E: 45,90 → 345,90 → 390,90 €. Unitarias: sumas en céntimos sin errores de coma flotante |
| 4 | Estadísticas se actualizan | E2E: total, nº de movimientos y €/km cambian tras cada alta, edición y borrado |
| 5 | €/km matemáticamente correcto | Unitarias: ejemplo del enunciado 1.550 € / 5.000 km = 0,31 €/km; meses con interpolación; tramos parciales. E2E: 390,90 € / 1.000 km = 0,39 €/km |
| 6 | Sin división entre cero | Unitarias: una sola lectura, 0 km, sin gastos. E2E: coche sin km recorridos muestra «—» y «Faltan kilómetros», sin NaN ni Infinity |
| 7 | Editar actualiza | E2E: seguro de 300 a 200 € → total 290,90 € y 0,29 €/km |
| 8 | Eliminar funciona | E2E: pide confirmación, cancelar no borra, aceptar borra → 245,90 €; ofrece deshacer |
| 9 | Filtros | E2E: búsqueda por texto y por importe, filtro por categoría, por fechas, orden por importe, quitar filtros. Unitarias: búsqueda sin tildes ni mayúsculas |
| 10 | Gráficos con datos reales | E2E: sectores del gráfico circular = 200,00 € y 45,90 €; barra del mes = 245,90 €; acumulado = 245,90 € |
| 11 | Persistencia al recargar | E2E: recarga la página → 245,90 € |
| 12 | Exportar e importar | E2E: descarga JSON (2 vehículos, 3 gastos) y CSV; rechaza JSON roto y JSON de otra app sin tocar datos; borra todo, importa la copia y recupera 245,90 €. Unitarias: ida y vuelta, gastos con importe negativo, fecha imposible, vehículo inexistente, foto maliciosa |
| 13 | Móvil | E2E a 390×844: sin desplazamiento horizontal en bienvenida, gastos, estadísticas, inicio, garaje y ajustes. Capturas revisadas a mano y corregidos los defectos vistos |
| 14 | Consola sin errores | E2E: 0 errores ni excepciones durante toda la prueba |
| 15 | Publicable en GitHub Pages | No requiere compilación. E2E sirve la app bajo la subruta `/MI_GARAJE_IA/` (como `usuario.github.io/repositorio/`): CSS, JS, manifiesto y service worker cargan con rutas relativas |

Casos límite adicionales: importes negativos, vacíos, con texto, 0 € y mayores de 1.000.000 €; fechas vacías, imposibles (30 de febrero) y futuras; kilómetros negativos, con decimales, menores que el inicial e incoherentes con otras lecturas; precio por litro escrito con punto de miles (1659 → aviso «¿Querías decir 1,659?»); CSV con `;` y comillas en la descripción y fórmulas inyectadas (`=HYPERLINK…` se neutraliza).

## Qué NO se ha comprobado automáticamente

- La publicación real en GitHub: no se ha subido nada a tu cuenta (se simula la subruta en local).
- Teléfonos físicos: se ha usado la emulación móvil de Edge (390×844). Conviene probarla en tu móvil.
- Safari/iPhone y Firefox: solo se ha probado en Edge (motor Chromium). El código usa funciones estándar soportadas por ellos.
- El selector de archivos: en el modo sin ventana el navegador no siempre lo muestra, así que la prueba pulsa el botón «Importar» y entrega el archivo al mismo campo de archivo que abre ese botón.
- La instalación como app (PWA) se verifica por el registro del service worker y el manifiesto, no instalándola.

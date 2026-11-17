# Prompt inicial (conservado tal cual se entregó)

> Fecha: 16/11/2026. Texto original del encargo con el que se creó Mi Garaje IA.

PROYECTO: MI GARAJE IA — CONTROL DE GASTOS DEL COCHE
Actúa como un desarrollador full-stack senior especializado en aplicaciones web, experiencia de usuario, diseño responsive, análisis de datos y pruebas de software.
Quiero que desarrolles una aplicación web COMPLETA, FUNCIONAL Y PROFESIONAL llamada:
MI GARAJE IA
Creada para mi proyecto de redes sociales Chiky & IA.

1. OBJETIVO
Crear una aplicación que permita a cualquier persona controlar cuánto dinero le cuesta realmente tener su coche.
El usuario debe poder registrar gastos, consultar estadísticas, analizar sus costes y descubrir cuánto dinero gasta por kilómetro recorrido.
Quiero una aplicación que resulte útil de verdad y que pueda utilizarse diariamente.
No quiero una maqueta con botones decorativos.
TODAS LAS FUNCIONES DEBEN ESTAR IMPLEMENTADAS Y PROBADAS.
Esta aplicación formará parte de una serie de dos vídeos:
* Vídeo 1: enseñaré cómo funciona y qué utilidad tiene.
* Vídeo 2: explicaré cómo la hemos creado utilizando inteligencia artificial.

Ahora NO debes crear ningún vídeo. Concéntrate exclusivamente en desarrollar la aplicación.

2. TECNOLOGÍAS
Quiero que sea una aplicación web gratuita y fácil de mantener.
Prioriza:
* HTML5.
* CSS3.
* JavaScript.
* Bibliotecas gratuitas cuando realmente aporten valor.
* Almacenamiento local del navegador.
* Gráficos interactivos.
* Diseño responsive.

Puedes utilizar React o Vite si consideras que mejora el proyecto, siempre que el resultado pueda publicarse en GitHub Pages sin contratar un servidor.
Requisitos:
* Sin backend obligatorio.
* Sin suscripciones mensuales.
* Sin cuentas de usuario.
* Sin claves API.
* Sin servicios de pago.
* Compatible con GitHub Pages.
* Funcional desde móvil y ordenador.

La aplicación debe funcionar sin necesidad de utilizar una API de IA después de haber sido creada.
La inteligencia artificial se utilizará para desarrollar el software, no para fingir funcionalidades que realmente no existen.

3. GESTIÓN DE VEHÍCULOS
El usuario debe poder registrar un vehículo con:
* Marca.
* Modelo.
* Año.
* Matrícula opcional.
* Fecha de adquisición.
* Precio de compra opcional.
* Kilometraje inicial del periodo registrado.
* Kilometraje actual.
* Fotografía opcional del coche.

Si es razonablemente sencillo, permite registrar varios vehículos y consultar sus gastos por separado.
No obligues al usuario a proporcionar información innecesaria.

4. REGISTRO DE GASTOS
Quiero que el usuario pueda añadir movimientos con los siguientes campos:
* Fecha del gasto.
* Cantidad en euros.
* Categoría.
* Descripción.
* Kilometraje en el momento del gasto, opcional.
* Notas adicionales opcionales.

Categorías iniciales:
1. Gasolina.
2. Seguro.
3. Reparaciones.
4. Mantenimiento.
5. ITV.
6. Impuestos.
7. Aparcamiento.
8. Peajes.
9. Otros.

Incluye la posibilidad de crear categorías personalizadas.
En gastos de combustible, permite registrar opcionalmente litros y precio por litro.
Si se introducen ambos, calcula automáticamente el importe.
El usuario debe poder:
* Añadir gastos.
* Editarlos.
* Eliminarlos con confirmación.
* Consultarlos por fecha.
* Filtrarlos por categoría.
* Ordenarlos.
* Buscar movimientos.

Todos los cambios deben actualizar inmediatamente las estadísticas.

5. PANEL PRINCIPAL
Quiero un dashboard moderno donde aparezcan las métricas más importantes.
Tarjetas principales:
GASTO TOTAL
Suma de todos los gastos registrados para el vehículo y periodo seleccionado.
GASTO MENSUAL
Dinero gastado durante el mes seleccionado.
COSTE POR KILÓMETRO
Coste registrado dividido entre los kilómetros recorridos en el mismo periodo.
CATEGORÍA MÁS CARA
Categoría en la que más dinero se ha gastado.
Añade también:
* Gasto medio mensual.
* Gasto en combustible.
* Número de movimientos.
* Evolución de gastos.

Permite seleccionar periodos: mes, año o total.
Distingue los cálculos realizados con datos históricos completos de aquellos realizados con registros parciales.
No muestres estadísticas engañosas cuando falten kilómetros o gastos.

6. CÁLCULO DEL COSTE POR KILÓMETRO
Esta función es especialmente importante.
Fórmula básica:
Coste por km = gastos registrados del periodo / kilómetros recorridos durante ese periodo.
Ejemplo:
* Gasolina: 800 €.
* Seguro: 500 €.
* Reparaciones: 200 €.
* ITV: 50 €.
* Kilómetros recorridos: 5.000 km.

Total: 1.550 €.
Coste: 0,31 €/km.
La aplicación debe calcularlo automáticamente.
IMPORTANTE:
No confundas el precio de compra del coche con sus gastos de utilización.
El precio de compra debe aparecer separado de los gastos operativos.
Si decides implementar depreciación, utiliza una estimación de valor residual introducida por el usuario y muéstrala como una métrica diferenciada.
No sumes el precio de compra completo al coste por kilómetro como si fuera un gasto operativo.
Asegúrate de que el kilometraje y los gastos utilizados correspondan al mismo periodo.
Si los datos son insuficientes, muestra un aviso explicativo en lugar de un cálculo incorrecto.

7. GRÁFICOS Y ESTADÍSTICAS
Incluye gráficos atractivos e interactivos:
* Gráfico circular de distribución de gastos por categoría.
* Gráfico de barras con gastos mensuales.
* Gráfico de evolución de gastos acumulados.
* Comparación entre meses.

Utiliza colores coherentes y etiquetas legibles.
Los gráficos deben actualizarse automáticamente al modificar los datos.
En móvil deben visualizarse perfectamente.
No quiero gráficos falsos ni estadísticas inventadas.

8. PERSISTENCIA Y PRIVACIDAD
Los datos deben guardarse en el navegador, usando almacenamiento local adecuado.
Al actualizar la página, los datos no deben desaparecer.
Incluye:
* Exportación de datos a JSON.
* Exportación de movimientos a CSV.
* Importación de copias de seguridad JSON.
* Validación del archivo importado.
* Confirmación antes de reemplazar datos.
* Opción de borrar datos con confirmación.

Informa claramente al usuario de que los datos se guardan localmente en su navegador y pueden perderse si borra el almacenamiento.
No envíes sus datos a servidores externos.
No utilices analítica invasiva ni recopiles información personal.

9. DISEÑO VISUAL
Quiero un diseño de calidad profesional.
Estilo:
* Moderno.
* Elegante.
* Tecnológico.
* Fácil de utilizar.
* Pensado principalmente para móviles.

Paleta sugerida:
* Azul oscuro como base.
* Azul eléctrico para acciones principales.
* Amarillo para destacar indicadores.
* Blanco para textos.
* Gris para información secundaria.

Diseña una interfaz que parezca una aplicación comercial de calidad.
Elementos:
* Dashboard con tarjetas.
* Barra de navegación.
* Botón destacado para añadir un gasto.
* Formularios intuitivos.
* Iconos para categorías.
* Gráficos fluidos.
* Animaciones discretas.
* Estados vacíos bien diseñados.
* Mensajes de confirmación y error.

MUY IMPORTANTE: NO DEJES GRANDES ESPACIOS VACÍOS SIN UTILIDAD.
Aprovecha correctamente el espacio disponible, sin saturar la pantalla.
Los botones deben poder pulsarse cómodamente desde el móvil.
Asegura buen contraste, navegación por teclado y etiquetas accesibles.

10. EXPERIENCIA DE USUARIO
Quiero que alguien sin conocimientos tecnológicos pueda entender cómo usar la aplicación inmediatamente.
La primera vez que entre debe encontrar:
* Una bienvenida breve.
* Un botón para registrar su coche.
* Una explicación sencilla de para qué sirve.
* La opción de utilizar datos ficticios de demostración.

Los datos de demostración deben identificarse claramente y no mezclarse con los datos personales reales.
Añadir un gasto debe ser rápido.
Evita formularios innecesariamente largos.
Muestra mensajes claros cuando falten datos.
Los importes deben aparecer en euros con formato español.
Las fechas deben mostrarse en formato español.

11. FUNCIONES ADICIONALES
Si las funciones principales están terminadas y probadas, puedes añadir:
* Recordatorios visuales de ITV, seguro y mantenimiento.
* Indicador de próximo cambio de aceite.
* Comparación entre vehículos.
* Modo claro y oscuro.
* Instalación como aplicación web progresiva (PWA).
* Diseño de un icono propio para Mi Garaje IA.

No sacrifiques la calidad de las funciones principales por incluir funciones secundarias.
No afirmes que existen notificaciones automáticas en segundo plano si no están realmente implementadas.

12. PREPARACIÓN PARA GITHUB PAGES
Quiero poder subir esta aplicación a GitHub y publicarla gratuitamente.
Por tanto:
* Organiza correctamente las carpetas.
* Utiliza rutas compatibles con GitHub Pages.
* No dependas de un servidor propio.
* Prepara las instrucciones de despliegue.
* Incluye un README completo.
* Evita introducir credenciales en el código.

No publiques nada en mi cuenta de GitHub sin mi autorización.
La aplicación debe poder ejecutarse localmente para realizar pruebas.

13. PRUEBAS OBLIGATORIAS
Antes de terminar, comprueba:
1. Que se puede crear un vehículo.
2. Que se pueden añadir gastos.
3. Que los importes se suman correctamente.
4. Que las estadísticas se actualizan.
5. Que el coste por kilómetro es matemáticamente correcto.
6. Que no se divide entre cero.
7. Que editar un movimiento actualiza las estadísticas.
8. Que eliminarlo funciona correctamente.
9. Que los filtros funcionan.
10. Que los gráficos representan datos reales.
11. Que los datos permanecen después de recargar.
12. Que exportar e importar funciona.
13. Que la aplicación se ve correctamente en móvil.
14. Que no existen errores graves en consola.
15. Que puede compilarse y publicarse en GitHub Pages.

Utiliza también pruebas con importes negativos, fechas inválidas, campos vacíos y kilómetros inconsistentes.
Corrige los errores que encuentres.
No declares que una prueba ha pasado sin haberla ejecutado.

14. PREPARACIÓN PARA LOS VÍDEOS
Quiero utilizar la aplicación posteriormente para crear contenido en TikTok y YouTube Shorts.
Por eso:
* Prepara datos ficticios realistas para la demostración.
* Procura que el dashboard resulte visualmente atractivo.
* Permite enseñar claramente cómo cambia una estadística al añadir un gasto.
* Conserva el prompt inicial y el código fuente.
* Documenta brevemente el proceso de creación.
* Guarda capturas del proceso de desarrollo si es posible.
* No fabriques grabaciones del desarrollo haciéndolas pasar por reales.

NO PRODUZCAS LOS VÍDEOS TODAVÍA.
Primero quiero probar personalmente la aplicación.

15. ENTREGA FINAL
Crea un proyecto llamado:
MI_GARAJE_IA
Debe incluir:
* Código fuente completo.
* Aplicación funcional.
* Recursos gráficos.
* Pruebas.
* Datos de demostración.
* README.md.
* Instrucciones para ejecución local.
* Instrucciones para GitHub Pages.

Cuando termines:
1. Explícame cómo abrir la aplicación en mi navegador.
2. Indícame dónde se encuentran los archivos.
3. Resume las funcionalidades implementadas.
4. Indica qué pruebas has realizado.
5. Señala cualquier limitación real.
6. Explícame cómo podría publicarla gratuitamente.

16. INSTRUCCIÓN FINAL
NO QUIERO UNA DEMOSTRACIÓN VISUAL SIN FUNCIONALIDAD.
Quiero una aplicación que cualquier propietario de un coche pueda utilizar para controlar sus gastos.
Toma las decisiones técnicas necesarias para obtener un producto funcional y bien diseñado.
No te detengas a preguntarme por detalles menores de diseño: utiliza tu criterio profesional.
No utilices servicios de pago sin mi autorización.
Escribe el código, ejecuta las pruebas disponibles, corrige los errores y prepara la aplicación para que pueda utilizarla.
EL TRABAJO ESTARÁ TERMINADO CUANDO LA APLICACIÓN FUNCIONE Y PUEDA ABRIRLA EN MI NAVEGADOR.
Empieza ahora con el desarrollo completo de MI GARAJE IA.

*(Junto al texto se adjuntaron dos capturas de apps de referencia de control de gastos de coche, usadas solo como inspiración general de estilo: tarjetas, gráficos y barra inferior con botón central.)*

# SEMAP Perú

**SEMAP Perú** (Selector de mapas del Perú) es una aplicación local para colorear departamentos, provincias y distritos y preparar mapas para informes. Permite combinar distritos de distintas provincias mediante colores, sin necesidad de instalar un sistema de información geográfica.

## Cómo empezar

1. Descarga o clona el repositorio completo.
2. Abre `index.html` en un navegador moderno, por ejemplo Microsoft Edge, Chrome o Firefox.
3. La aplicación funciona localmente: no requiere una cuenta, instalación de paquetes ni conexión a internet para mostrar el mapa.

Los colores se guardan en el almacenamiento local del navegador de esa computadora. Limpiar los datos del navegador puede borrarlos y no se sincronizan con otros dispositivos.

## Cómo usarlo

1. En **Zona del mapa**, selecciona uno o varios departamentos y, opcionalmente, sus provincias. Si no eliges provincias de un departamento seleccionado, se muestra completo. Usa **Mostrar todo el Perú** para quitar los filtros.
2. En **Niveles y límites visibles**, activa los niveles que quieras mostrar. Si activas varios, se colorea el nivel más detallado; el panel indica cuál está activo para pintar.
3. Elige un color y haz clic en un territorio. Haz doble clic para quitar su color, o selecciona **Sin relleno** y haz clic. También puedes usar un color personalizado o borrar todos los colores.
4. Mueve el mapa arrastrándolo y acércalo con la rueda del ratón o los botones de zoom. Los nombres aparecen según el nivel y la escala; algunos se ocultan para evitar superposiciones.
5. Para reducir el contenido del mapa, activa **Ocultar límites y nombres de zonas sin colorear**. Los territorios sin color siguen disponibles para pintar. Los nombres de provincias o departamentos con alguna zona coloreada pueden seguir apareciendo.
6. En el encabezado, elige **Guardar imagen** o **Guardar PDF**. En la vista previa puedes mover y redimensionar el recuadro o usar los campos de porcentaje; después pulsa **Descargar**. La salida contiene el área seleccionada y la atribución. El PDF contiene una imagen en una página con la proporción del área elegida.

Al filtrar solo algunas provincias de un departamento, se oculta su contorno departamental completo para no mostrar límites fuera de la zona filtrada.

## Datos y alcance

Los límites son **referenciales y simplificados**. Su disponibilidad, exactitud y vigencia deben verificarse con las entidades competentes antes de usarlos para fines oficiales o para determinar límites legales.

Las capas incluidas proceden de [Peru-maps](https://github.com/Rodasluis/Peru-maps), consultado el 4 de noviembre de 2026. Ese proyecto identifica al **Instituto Nacional de Estadística e Informática (INEI)** como fuente principal e incorpora geometrías reconstruidas para distritos recientes; consulta la documentación del proyecto para conocer su metodología y advertencias. El [geoportal del INEI](https://ide.inei.gob.pe/) ofrece acceso a cartografía y metadatos.

**Condiciones de los datos:** la licencia de Peru-maps indica que su MIT cubre el código y que los términos de reutilización de las capas de origen del INEI no fueron verificados. Consulta [data/LICENSE.txt](data/LICENSE.txt) y confirma con el INEI las condiciones aplicables antes de redistribuir los datos. La licencia MIT de SEMAP Perú no concede derechos sobre esos datos de terceros.

## Desarrollo

El proyecto utiliza HTML, CSS y JavaScript sin proceso de compilación ni servidor obligatorio:

- `index.html`: estructura, controles y diálogo de exportación.
- `estilos.css`: presentación de la interfaz y etiquetas.
- `app.js`: filtros, selección y coloreado, persistencia local, visualización y exportación PNG/PDF.
- `data/`: capas territoriales GeoJSON y sus versiones JavaScript, preparadas para poder abrir la aplicación directamente desde un archivo local.
- `vendor/`: Leaflet y su licencia, incluidos localmente.

El mapa usa [Leaflet 1.9.4](https://leafletjs.com/) para representar e interactuar con las geometrías. Se emplean capas Canvas y SVG para dibujar el mapa y recibir interacciones; la exportación combina las capas y etiquetas visibles en un lienzo, y el PDF incorpora la imagen generada.

Para modificar el proyecto, edita los archivos y recarga `index.html`. Para comprobar la sintaxis de JavaScript, si tienes Node.js instalado, ejecuta `node --check app.js`.

## Créditos y licencias

- **Cartografía base:** Instituto Nacional de Estadística e Informática del Perú (INEI).
- **Preparación y reconstrucciones cartográficas:** [Luis Rodas, Peru-maps](https://github.com/Rodasluis/Peru-maps). Conservamos su aviso y condiciones en [data/LICENSE.txt](data/LICENSE.txt).
- **Leaflet:** [Vladimir Agafonkin y colaboradores](https://leafletjs.com/), licencia BSD de 2 cláusulas; ver [vendor/LICENSE.txt](vendor/LICENSE.txt).
- **SEMAP Perú:** el código original del proyecto se distribuye bajo la [licencia MIT](LICENSE). Los componentes y datos de terceros conservan sus propios avisos y condiciones.

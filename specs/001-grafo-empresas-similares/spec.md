# Feature Specification: Grafo de empresas similares

**Feature Branch**: `001-grafo-empresas-similares`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Construir una app web simple que muestre un grafo de empresas similares, inspirado en la imagen de referencia adjunta (ResearchRabbit, ver [reference/researchrabbit.webp](reference/researchrabbit.webp)). Permitir explorar visualmente qué empresas se parecen entre sí según lo que ofrecen (productos/servicios), para descubrir empresas relacionadas."

## Clarifications

### Session 2026-10-30

- Q: ¿Quién podrá abrir la app y ver los datos de contacto? → A: Los titulares ya aceptaron el tratamiento de datos; la tarjeta muestra todos los campos con dato, incluido el contacto.
- Q: ¿Qué campos debe mostrar la tarjeta? → A: Todos los que tengan dato, excepto "Descripción" (queda cubierta por "Descripción completa") y los identificadores internos (Eloqua Unique Identifier, Mapped to Contact).
- Q: ¿Cuántas conexiones como máximo por empresa? → A: Hasta 10 (se definió en 5 y se subió a 10 al revisar casos concretos).
- Q: ¿Qué se hace con "Volumen de Ingresos" y "Tamaño Empresa" (códigos como V1, T1)? → A: No se muestran en la tarjeta.
- Q (revisión de la búsqueda): ¿Se puede buscar por palabras de la descripción? → A: Sí, y las empresas con información más completa salen primero. La barra izquierda explica la línea continua y la punteada.
- Q (revisión de conexiones): ¿Cómo se validan las conexiones? → A: Cada conexión por similitud se revisó por significado (ok, dudosa o mala) y el resultado vive en `Conexiones_validadas.csv`, editable. Se quitan las malas y las dudosas entre sectores distintos; las conexiones de respaldo por sector se dibujan punteadas.
- Q (revisión 2026-11-03): ¿Qué pasa con las empresas sin conexiones? → A: Si no hay ninguna, se conectan con las empresas más parecidas de su mismo sector.
- Q (revisión 2026-11-02): ¿Qué se añade? → A: Barra de búsqueda de empresa o sector; leyenda más grande a la izquierda y seleccionable por sector (todas sus empresas coloreadas y, si hay, sus conexiones resaltadas); buscar un sector hace lo mismo; y el grafo se reparte de forma pareja y centrada.
- Q: ¿Qué muestra la tarjeta cuando falta un dato? → A: Nada: ni el campo ni su etiqueta, tampoco cuando el valor es un texto de relleno que indica ausencia (por ejemplo "No", "No informa", "----").

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el mapa general de empresas (Priority: P1)

Una persona del equipo de relacionamiento abre la app y ve de un vistazo todas las empresas (~600) como puntos conectados entre sí por afinidad de oferta. Todo aparece en gris neutro. Las empresas con más información disponible quedan agrupadas en el centro y las de menos información hacia los bordes. Una leyenda en la barra izquierda muestra los 16 sectores con su color.

**Why this priority**: Es la base de todo: sin el grafo cargado y legible no hay nada que explorar. Por sí sola ya permite ver la forma del ecosistema y qué empresas están mejor documentadas.

**Independent Test**: Abrir la app y comprobar que se ven todos los nodos y conexiones en gris, que los nodos más completos están hacia el centro, que la leyenda lista los 16 sectores, y que se puede mover/acercar el grafo con fluidez.

**Acceptance Scenarios**:

1. **Given** la app recién abierta, **When** termina de cargar, **Then** se muestran todos los nodos válidos y sus conexiones, todos en gris.
2. **Given** el grafo cargado, **When** la persona observa la distribución, **Then** las empresas con más campos completos se ubican en el centro y las de menos campos hacia afuera.
3. **Given** el grafo cargado, **When** la persona mira la leyenda, **Then** ve cada uno de los 16 sectores con un color distinto.
4. **Given** el grafo cargado, **When** la persona se desplaza o acerca la vista, **Then** la interacción responde sin retrasos perceptibles.

---

### User Story 2 - Explorar las vecinas de una empresa (Priority: P1)

La persona hace click en una empresa. Esa empresa toma el color de su sector, sus empresas conectadas (las más parecidas) la rodean, cada una con el color de su propio sector, y el resto del grafo queda gris, desenfocado y atenuado al fondo. Así descubre de inmediato qué empresas se relacionan con la que le interesa y de qué sectores son.

**Why this priority**: Es el valor central de la app: descubrir empresas relacionadas. Junto con la historia 1 forma el producto mínimo.

**Independent Test**: Hacer click en cualquier nodo y verificar que el nodo y sus vecinas se colorean según su sector y que el resto queda gris y atenuado.

**Acceptance Scenarios**:

1. **Given** el grafo en estado inicial, **When** la persona hace click en un nodo, **Then** ese nodo se colorea con el color de su sector.
2. **Given** un nodo seleccionado, **When** se observa su entorno, **Then** sus vecinas aparecen alrededor, cada una con el color de su propio sector (que puede ser distinto al del nodo seleccionado).
3. **Given** un nodo seleccionado, **When** se observa el resto del grafo, **Then** todos los demás nodos y conexiones están en gris, desenfocados y atenuados.
4. **Given** un nodo seleccionado, **When** la persona hace click en otro nodo, **Then** la selección pasa al nuevo nodo con las mismas reglas.

---

### User Story 3 - Consultar la ficha completa de una empresa (Priority: P2)

Al seleccionar una empresa se abre una tarjeta con toda la información disponible de ella. Solo aparecen los campos que tienen dato. El borde de la tarjeta tiene el color del sector de la empresa.

**Why this priority**: Convierte el descubrimiento visual en información útil para actuar, pero el grafo ya aporta valor sin la tarjeta.

**Independent Test**: Hacer click en empresas con distinta cantidad de datos y verificar que la tarjeta muestra únicamente los campos con valor, sin etiquetas vacías ni "N/A", y con el borde del color del sector.

**Acceptance Scenarios**:

1. **Given** una empresa con todos los campos completos, **When** se selecciona, **Then** la tarjeta muestra todos sus campos con dato.
2. **Given** una empresa con varios campos vacíos, **When** se selecciona, **Then** la tarjeta no muestra esos campos, ni sus etiquetas ni texto de relleno como "N/A".
3. **Given** cualquier empresa seleccionada, **When** se abre la tarjeta, **Then** su borde tiene el color del sector de esa empresa.

---

### User Story 4 - Volver al estado inicial (Priority: P2)

La persona hace click en el fondo del grafo o en el botón de cerrar de la tarjeta y todo vuelve a gris, listo para explorar otra empresa.

**Why this priority**: Cierra el ciclo de exploración; sin ello habría que recargar la página.

**Independent Test**: Seleccionar un nodo y luego hacer click en el fondo, y repetir con el botón de cerrar; en ambos casos el grafo vuelve al estado inicial.

**Acceptance Scenarios**:

1. **Given** un nodo seleccionado, **When** la persona hace click en el fondo, **Then** la tarjeta se cierra y todo el grafo vuelve a gris.
2. **Given** un nodo seleccionado, **When** la persona hace click en cerrar, **Then** la tarjeta se cierra y todo el grafo vuelve a gris.
3. **Given** un sector seleccionado, **When** la persona hace click en el fondo o vuelve a hacer click en ese sector, **Then** todo el grafo vuelve a gris.

---

### User Story 5 - Seleccionar un sector (Priority: P2)

En la barra de la izquierda, la persona ve la lista de los 16 sectores y hace click en uno. Todas las empresas de ese sector se colorean con el color del sector y, entre ellas, se resaltan las conexiones que existan; el resto del grafo queda gris, desenfocado y atenuado. Así ve de un vistazo cuántas empresas tiene el sector y cómo se relacionan entre sí.

**Why this priority**: Responde a "¿cómo se ve este sector?", que es una pregunta natural del equipo y que la selección de una sola empresa no resuelve.

**Independent Test**: Hacer click en un sector de la barra izquierda y comprobar que todas sus empresas (y solo esas) se colorean, que sus conexiones internas se resaltan y que el resto queda atenuado.

**Acceptance Scenarios**:

1. **Given** el grafo en estado inicial, **When** la persona hace click en un sector de la barra izquierda, **Then** todas las empresas de ese sector se colorean con su color y las demás quedan grises, desenfocadas y atenuadas.
2. **Given** un sector seleccionado, **When** se observa el grafo, **Then** las conexiones entre empresas de ese sector aparecen resaltadas con el color del sector.
3. **Given** un sector seleccionado, **When** la persona hace click en otro sector, **Then** la selección pasa al nuevo sector.
4. **Given** un sector seleccionado, **When** la persona hace click en una empresa, **Then** se abre su tarjeta con las reglas de la historia 2 y el sector deja de estar seleccionado.
5. **Given** un sector seleccionado, **When** se observa la barra izquierda, **Then** ese sector se ve marcado como activo y muestra cuántas empresas tiene.

---

### User Story 6 - Buscar una empresa o un sector (Priority: P2)

La persona escribe en una barra de búsqueda y ve coincidencias de empresas y de sectores. Al elegir una empresa se comporta como hacer click en ella (y el grafo la muestra en pantalla aunque estuviera lejos o muy pequeña); al elegir un sector se comporta como hacer click en ese sector, coloreando todas sus empresas.

**Why this priority**: Con ~600 empresas, encontrar una concreta con el cursor es lento; la búsqueda lleva directo a ella.

**Independent Test**: Escribir parte del nombre de una empresa y elegirla; escribir parte del nombre de un sector y elegirlo; comprobar que cada elección produce la misma vista que hacer click.

**Acceptance Scenarios**:

1. **Given** la barra de búsqueda, **When** la persona escribe parte de un nombre de empresa (sin importar mayúsculas ni tildes), **Then** aparecen las empresas coincidentes.
2. **Given** la barra de búsqueda, **When** la persona escribe parte del nombre de un sector, **Then** aparece el sector coincidente, marcado como sector.
3. **Given** resultados de búsqueda, **When** la persona elige una empresa, **Then** se muestra la misma vista que al hacer click en ella (empresa y vecinas coloreadas, tarjeta abierta) y esa empresa queda visible en la pantalla.
4. **Given** resultados de búsqueda, **When** la persona elige un sector, **Then** se muestra la misma vista que al hacer click en ese sector.
5. **Given** un texto sin coincidencias, **When** la persona termina de escribir, **Then** se le informa de que no hay resultados, sin error.
6. **Given** la barra de búsqueda, **When** la persona escribe una o varias palabras que aparecen en la descripción de algunas empresas (por ejemplo "hamburguesas" o "ropa deportiva"), **Then** aparecen las empresas cuya descripción contiene todas esas palabras, con las de información más completa primero y el fragmento de la descripción donde aparecen, resaltado.

---

### Edge Cases

- Búsqueda vacía o solo con espacios: no muestra resultados.
- Una búsqueda con muchas coincidencias muestra solo las primeras y deja ver cuántas más hay.
- Un sector con una sola empresa: se colorea esa empresa y no hay conexiones internas que resaltar.
- El grafo debe verse centrado y parejo: las empresas muy conectadas no deben amontonarse en una sola zona.

- Empresas con nombre inválido (por ejemplo "No", "." o textos como "no tiene nombre como tal") no deben aparecer como nodos.
- Si un identificador aparece más de una vez, solo se muestra una empresa para ese identificador.
- Una empresa presente en una fuente de datos y ausente en la otra (sin información suficiente para cruzar o sin sector) no debe romper el grafo; el comportamiento queda definido en Supuestos.
- Una empresa que no se parece lo suficiente a ninguna otra se conecta con las más parecidas de su mismo sector (conexión de respaldo), para no quedar aislada. Solo queda sin conexiones si es la única de su sector; en ese caso se colorea sola y la tarjeta se abre igualmente.
- Una empresa con muy pocos campos con dato: la tarjeta sigue siendo legible aunque contenga muy pocos campos.
- Textos muy largos en un campo (por ejemplo descripciones extensas): la tarjeta debe poder leerse completa sin cortar contenido ni salirse de la pantalla.
- Click repetido sobre el mismo nodo ya seleccionado: no genera cambios inesperados.
- Pantallas de distinto tamaño: la tarjeta y la leyenda no deben tapar por completo el grafo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST cargar la información de empresas combinando los datos generales de cada empresa con su sector relacionado, usando el identificador único de cada empresa como llave de cruce.
- **FR-002**: El sistema MUST excluir del grafo las empresas con nombre inválido y MUST conservar una sola empresa por identificador cuando haya duplicados.
- **FR-003**: El sistema MUST mostrar cada empresa válida como un nodo.
- **FR-004**: El sistema MUST conectar dos empresas cuando lo que ofrecen sea parecido, calculando la similitud a partir de los campos de texto que describen su oferta de productos o servicios.
- **FR-005**: El sistema MUST limitar las conexiones de cada empresa a un máximo de 10 (las más parecidas) para que el grafo sea legible. Si una empresa no alcanza la similitud mínima con ninguna otra, el sistema MUST conectarla con las 3 empresas más parecidas de su mismo sector (conexión de respaldo, marcada como tal en los datos), de modo que ninguna empresa que tenga otras de su sector quede sin conexiones.
- **FR-006**: El sistema MUST ubicar hacia el centro del grafo a las empresas con más campos completos y hacia afuera a las de menos campos completos.
- **FR-007**: El sistema MUST mostrar, en el estado inicial, todos los nodos y todas las conexiones en gris.
- **FR-008**: Al hacer click en un nodo, el sistema MUST colorear ese nodo con el color de su sector.
- **FR-009**: Al hacer click en un nodo, el sistema MUST mostrar sus empresas conectadas alrededor de él, cada una con el color de su propio sector.
- **FR-010**: Al hacer click en un nodo, el sistema MUST dejar el resto del grafo (nodos y conexiones no relacionados con la selección) en gris, desenfocado y atenuado al fondo.
- **FR-011**: Al hacer click en un nodo, el sistema MUST abrir una tarjeta con toda la información disponible de esa empresa, incluidos los datos de contacto, con estas excepciones: no se muestra "Descripción" (ya incluida en "Descripción completa"), ni los identificadores internos (Eloqua Unique Identifier, Mapped to Contact), ni "Volumen de Ingresos" ni "Tamaño Empresa".
- **FR-012**: La tarjeta MUST mostrar únicamente los campos que tengan dato; si falta un dato, MUST NOT mostrar nada de ese campo: ni etiqueta vacía, ni guiones, ni textos como "N/A". Un texto de relleno que solo indica ausencia (por ejemplo "No", "No informa", "No hay cargo todavia", "----") cuenta como falta de dato.
- **FR-013**: La tarjeta MUST tener el borde del color del sector de la empresa.
- **FR-014**: El sistema MUST volver al estado inicial (todo gris, tarjeta cerrada) cuando la persona haga click en el fondo o en el botón de cerrar de la tarjeta.
- **FR-015**: El sistema MUST mostrar, en una barra a la izquierda, una leyenda siempre visible y de tamaño cómodo de leer con cada sector, su color y su número de empresas.
- **FR-016**: El sistema MUST usar un color distinto y único para cada uno de los 16 sectores, y ese color MUST ser el mismo en el nodo, en las vecinas, en el borde de la tarjeta y en la leyenda.
- **FR-017**: El sistema MUST funcionar sin inicio de sesión, sin servidor propio y sin permitir la edición de datos.
- **FR-024**: Las conexiones por similitud MUST validarse por significado y el veredicto (ok, dudosa o mala) MUST poder corregirse a mano en un archivo; el sistema MUST NOT mostrar las conexiones malas ni las dudosas entre sectores distintos, ni volver a crearlas como respaldo. Las conexiones de respaldo por sector MUST distinguirse visualmente (punteadas) de las de similitud.
- **FR-018**: El sistema MUST NOT incluir, en esta versión, filtros que oculten empresas, exportación ni vistas de lista.
- **FR-019**: Cada sector de la leyenda MUST poder seleccionarse con un click. Al seleccionarlo, el sistema MUST colorear con el color del sector todas las empresas de ese sector, resaltar las conexiones entre ellas y dejar el resto en gris, desenfocado y atenuado; un nuevo click en el mismo sector, o en el fondo, MUST devolver al estado inicial.
- **FR-020**: El sistema MUST ofrecer una barra de búsqueda que, sin distinguir mayúsculas ni tildes, encuentre empresas por nombre, sectores por nombre y empresas por palabras de su descripción ("Descripción completa" y "Servicio que ofrece"). Una palabra buscada coincide con el comienzo de una palabra de la descripción ("confec" encuentra "confección"; "ropa" no encuentra "Europa"); con varias palabras, la empresa MUST contenerlas todas, en cualquier orden. Las palabras de una sola letra se ignoran en la descripción.
- **FR-025**: Los resultados MUST ordenarse así: sectores, empresas cuyo nombre contiene el texto (las que empiezan por él primero) y empresas que coinciden por su descripción, estas últimas con las de información más completa primero. Cada coincidencia por descripción MUST mostrar el fragmento donde aparece, resaltado.
- **FR-026**: La barra izquierda MUST explicar los dos tipos de línea del grafo: continua (se parecen en lo que ofrecen) y punteada (solo comparten sector).
- **FR-021**: Elegir un sector en la búsqueda MUST producir la misma vista que seleccionarlo en la leyenda; elegir una empresa MUST producir la misma vista que hacerle click, dejándola visible en pantalla.
- **FR-022**: Si la búsqueda no tiene coincidencias, el sistema MUST decirlo sin error; con la búsqueda vacía MUST NOT mostrar resultados.
- **FR-023**: El sistema MUST repartir las empresas de forma pareja alrededor del centro, de modo que ninguna zona concentre muchas más empresas que las demás, manteniendo las más completas hacia el centro (FR-006).

### Key Entities

- **Empresa**: Emprendimiento representado por un nodo. Atributos: identificador único, nombre, datos generales (tipo, descripción, servicio que ofrece, ubicación, contacto, etc.), cantidad de campos completos y sector relacionado. Algunos campos pueden estar vacíos.
- **Sector**: Categoría a la que pertenece cada empresa (16 en total). Atributos: nombre y color asignado. Una empresa pertenece a exactamente un sector.
- **Conexión**: Relación de parecido entre dos empresas, basada en la similitud de lo que ofrecen. Cada empresa tiene pocas conexiones.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con los ~600 nodos, el grafo se muestra completo y listo para usar en menos de 5 segundos tras abrir la app, en un computador de escritorio típico.
- **SC-002**: Al mover, acercar o hacer click, la respuesta es fluida: la persona no percibe retrasos y el cambio de selección se ve en menos de 1 segundo.
- **SC-003**: En el 100% de las empresas probadas, la tarjeta muestra solo campos con dato (cero etiquetas vacías o "N/A").
- **SC-004**: En el 100% de las selecciones, el color del nodo, de sus vecinas, del borde de la tarjeta y de la leyenda coincide con el sector de cada empresa.
- **SC-005**: Al comparar las empresas con más campos completos con las de menos, las primeras se ubican visiblemente más cerca del centro en la gran mayoría de los casos.
- **SC-006**: Una persona nueva logra, sin instrucciones, seleccionar una empresa, identificar a sus vecinas y volver al estado inicial en menos de 1 minuto.
- **SC-007**: Ninguna empresa con nombre inválido ni identificador duplicado aparece en el grafo.
- **SC-008**: Al seleccionar un sector, el 100% de sus empresas (y ninguna de otro sector) aparece con el color del sector, y el cambio se ve en menos de 1 segundo.
- **SC-009**: Al escribir en la búsqueda, los resultados aparecen en menos de 1 segundo, y una persona nueva encuentra una empresa conocida por su nombre en menos de 30 segundos.
- **SC-011**: Ninguna empresa que tenga otras de su sector queda sin conexiones (hoy: 0 de 603; antes del respaldo, 22).
- **SC-012**: En una muestra revisada a mano de las conexiones por similitud que se muestran, ninguna es "mala" (hoy: 1.326 por similitud, de ellas 932 ok y 394 dudosas del mismo sector; se quitaron 201 malas y 113 dudosas entre sectores).
- **SC-010**: Dividido el grafo en 8 zonas iguales alrededor del centro, ninguna tiene más de un 15% de empresas por encima del promedio.

## Assumptions

- Los usuarios son personas internas del equipo de relacionamiento con egresados/emprendedores que exploran el ecosistema; no se requiere inicio de sesión ni roles.
- Los datos son estáticos: se toman de dos archivos CSV incluidos en el proyecto (información general de las empresas y sector relacionado). La actualización de los datos queda fuera de alcance; se hace reemplazando los archivos.
- Los dos archivos se cruzan solo por el identificador único. Las empresas sin sector asignado o presentes en una sola fuente no se muestran en el grafo.
- Los campos que "describen la oferta" para calcular similitud son los textos de descripción, servicio que ofrece, tipo de empresa y sector declarado; la selección exacta se definirá en la planeación.
- "Más información disponible" se mide por la cantidad de campos con dato (no vacíos) de cada empresa.
- Un nombre es inválido cuando está vacío, es un solo símbolo/palabra sin significado como "No" o ".", o una frase que indica que no hay nombre; la lista exacta se refinará con los datos.
- La tarjeta muestra todos los campos con dato tal como están en los datos, incluidos los de contacto (correo, teléfono, persona de contacto). Los titulares de los datos ya aceptaron el tratamiento de sus datos, por lo que no se aplica ninguna restricción de privacidad adicional sobre la tarjeta.
- Las personas usan la app en un navegador de escritorio moderno; el uso en celular es deseable pero no es objetivo de esta versión.
- La imagen de referencia está en [reference/researchrabbit.webp](reference/researchrabbit.webp) y es la guía visual a seguir. De ella se toma: nodos como círculos con su nombre debajo sobre un lienzo claro; la selección resaltada con sus conexiones en un trazo más marcado y sus vecinas en color; el resto del grafo desvanecido; y un panel de detalle a la derecha con botón de cerrar (X). Las demás funciones de la imagen (pestañas, biblioteca, filtros, vistas de lista, notas, métricas) quedan fuera de alcance.
- La app es de solo lectura: no hay edición, exportación, filtros que oculten empresas ni vistas de lista en esta versión. La búsqueda y la selección de sector se añadieron tras la primera revisión (2026-11-02).
- Con un sector seleccionado no se abre tarjeta (la tarjeta es de una empresa); solo la tiene la empresa a la que se hace click después.

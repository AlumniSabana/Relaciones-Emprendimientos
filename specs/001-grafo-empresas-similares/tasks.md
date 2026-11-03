---

description: "Lista de tareas para el grafo de empresas similares"
---

# Tasks: Grafo de empresas similares

**Input**: Documentos de diseño en `/specs/001-grafo-empresas-similares/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/graph-data.md](contracts/graph-data.md), [quickstart.md](quickstart.md)

**Tests**: Incluidas, porque el plan las define (research D9): pytest para el script de datos y Vitest + React Testing Library para la app. Se escriben primero y deben fallar antes de implementar.

**Organization**: Tareas agrupadas por historia de usuario para poder implementar y probar cada una por separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia a la que pertenece (US1 a US4)
- Cada tarea indica la ruta exacta del archivo

## Path Conventions

- Script de datos: `tools/build_graph.py`; pruebas del script: `tests/test_build_graph.py`
- App: `web/` (código en `web/src/`, pruebas en `web/src/__tests__/`)
- Los CSV y `Data_relaciones.ipynb` de la raíz no se mueven ni se modifican

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Estructura inicial del proyecto

- [X] T001 Crear el proyecto de la app en `web/`: `web/package.json` (scripts `dev`, `build`, `preview`, `test`; dependencias `react@18`, `react-dom@18`, `d3-force`, `d3-zoom`, `d3-selection`; de desarrollo `typescript@5`, `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` y los `@types/*` necesarios), `web/tsconfig.json` (modo estricto y `resolveJsonModule`), `web/vite.config.ts` (plugin de React y entorno `jsdom` para Vitest) y `web/index.html` con el contenedor `#root`
- [X] T002 [P] Agregar a `.gitignore` de la raíz (crearlo si no existe) las entradas `web/node_modules/`, `web/dist/`, `__pycache__/` y `.pytest_cache/`
- [X] T003 Instalar las dependencias con `npm install` en `web/` (descarga paquetes: pedir confirmación a la persona usuaria antes de ejecutarlo)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: El script que genera `graph.json`, los tipos y el esqueleto de la app. Ninguna historia puede empezar sin esto.

**⚠️ CRITICAL**: No empezar ninguna historia de usuario hasta completar esta fase

- [X] T004 [P] Crear `web/src/types.ts` con exactamente los tipos del contrato: `Sector { name; color }`, `Company { id; name; sector; rank; fields: [string, string][] }`, `Edge { a; b; w }` y `Graph { generated; sectors; nodes; edges }` (ver [contracts/graph-data.md](contracts/graph-data.md))
- [X] T005 [P] Escribir en `tests/test_build_graph.py` las pruebas de las reglas de datos, que deben fallar antes de implementar: (a) un nombre inválido se excluye: "tras recortar, menos de 3 caracteres, o `no`, o que empiece por `no tiene nombre`" (casos "No", ".", "No Tiene Nombre", "no tiene nombre como tal"); (b) con un `id` repetido solo queda la primera fila; (c) una empresa sin sector se excluye; (d) `fields` no contiene vacíos ni valores de relleno (`no`, `no informa`, `no tiene`, `no hay cargo todavia`, `n/a`, `na`, `ninguno`, `ninguna`, solo guiones o puntos) y nunca incluye `Descripción`, `Eloqua Unique Identifier`, `Mapped to Contact`, `Volumen de Ingresos` ni `Tamaño Empresa`; (e) `fields` respeta el orden de [data-model.md](data-model.md); (f) "Cada empresa participa en como máximo 10 conexiones", sin autoconexiones ni pares repetidos, con `a < b` y `w` entre 0,15 y 1; (g) `rank` entre 0 y 1, menor para quien tiene más campos, con desempate por `id`; (h) 16 sectores con `name` y `color` únicos y ningún color gris; (i) el archivo generado cumple las 5 garantías del contrato
- [X] T006 Crear `tools/build_graph.py` con la carga y validación de datos: leer `Base_emprendedores_2026_2_limpia.csv` y `Sector_relacionado_ia.csv` (codificación UTF-8, todo como texto), cruzar por `Eloqua Unique Identifier`, recortar espacios del nombre, aplicar la regla de nombre inválido de T005(a), conservar la primera fila por `id`, excluir empresas sin sector, e imprimir cuántas se excluyeron y por qué (research D6)
- [X] T007 En `tools/build_graph.py`, construir `fields` por empresa: lista `[etiqueta, valor]` en el orden de [data-model.md](data-model.md) (Servicio que ofrece, Descripción completa, Tipo de Empresa, Sector, Razón Social, ID de Empresa (NIT), Fecha de Fundación, Emprendimiento activo, Empresa propia, Incubado en la Universidad, Tamaño, Volumen, ODS, País, Departamento, Ciudad, Dirección, Página Web, Redes Sociales, Dirección de correo electrónico, Teléfono, Cargo), descartando vacíos y valores de relleno (constante `PLACEHOLDERS`, sin importar mayúsculas ni tildes) e imprimiendo cuántos valores descartó por columna; calcular `rank` entre 0 (más campos) y 1 (menos), desempatando por `id` (research D5, D6b)
- [X] T008 En `tools/build_graph.py`, calcular las conexiones: TF-IDF con similitud coseno sobre "Servicio que ofrece" y "Descripción" (el texto propio de la empresa), normalizado a minúsculas y sin tildes, sin `STOPWORDS` ni `GENERIC_WORDS`, con raíces de 7 letras y pares de raíces dentro de una misma frase (`similarity_tokens`), `min_df=2`, `max_df=0.1`, ponderación sublineal; ordenar los pares de mayor a menor similitud y agregar cada uno solo si `w` ≥ 0,15 (`MIN_SIMILARITY`; 0,30 con `MIN_SIMILARITY_CROSS` si son de sectores distintos) y ninguna de las dos empresas tiene ya 10 conexiones (`MAX_DEGREE`) (research D2b); guardar `a < b` y `w` con 3 decimales (research D2, D3, D4)
- [X] T009 En `tools/build_graph.py`, asignar los colores y escribir el resultado: ordenar los 16 sectores alfabéticamente y tomar en ese orden 16 colores hexadecimales distintos de una paleta categórica fija (constante `PALETTE`; distinguibles entre sí, contra el fondo claro y contra el gris de estado atenuado, que no puede usarse), y escribir `web/src/data/graph.json` con `generated`, `sectors`, `nodes` y `edges` en la forma del contrato; imprimir el resumen (nodos, aristas, nodos sin conexiones)
- [X] T010 Ejecutar `uv run --with pandas --with scikit-learn python tools/build_graph.py` y luego `uv run --with pandas --with scikit-learn --with pytest pytest tests`; comprobar que se genera `web/src/data/graph.json`, que las pruebas de T005 pasan y que el resumen coincide con lo esperado (609 filas de entrada, 6 nombres inválidos, ningún nodo con más de 10 conexiones)
- [X] T011 [P] Crear `web/src/lib/graph.ts` con funciones puras tipadas: `buildAdjacency(edges)` (mapa de `id` a conjunto de ids vecinos) y `sectorColors(sectors)` (mapa de nombre de sector a color), usadas por todas las historias
- [X] T012 [P] Crear `web/src/main.tsx`, el esqueleto de `web/src/App.tsx` (estado `selectedId: string | null`, importa `web/src/data/graph.json` con los tipos de `types.ts`) y `web/src/styles.css` con las variables CSS base (fondo claro y el gris del estado inicial)

**Checkpoint**: `graph.json` generado y validado, la app compila (`npx tsc --noEmit` en `web/`); las historias pueden empezar

---

## Phase 3: User Story 1 - Ver el mapa general de empresas (Priority: P1) 🎯 MVP

**Goal**: Todas las empresas válidas como nodos y conexiones en gris, con las más completas al centro y una leyenda de los 16 sectores.

**Independent Test**: Abrir la app y comprobar que se ven todos los nodos y conexiones en gris, que los más completos quedan hacia el centro, que la leyenda lista 16 sectores y que mover y acercar la vista responde sin retrasos.

### Tests for User Story 1 ⚠️

> Escribirlas primero y comprobar que fallan antes de implementar

- [X] T013 [P] [US1] Prueba de disposición en `web/src/__tests__/layout.test.ts`: con datos sintéticos, el radio medio del 20 % de nodos con menor `rank` es menor que el del 20 % con mayor `rank`, y calcular dos veces con la misma entrada da las mismas posiciones
- [X] T014 [P] [US1] Prueba de la leyenda en `web/src/__tests__/Legend.test.tsx`: se muestra una entrada por sector (16 con los datos reales) con su nombre y su color de `sectors[].color`

### Implementation for User Story 1

- [X] T015 [US1] Crear `web/src/lib/layout.ts` con `computeLayout(nodes, edges)` que devuelve `Map<id, {x, y}>` usando `d3-force`: `forceLink` por conexión, `forceManyBody` débil, `forceCollide` para que no se solapen y `forceRadial` con radio proporcional a `rank` (0 en el centro); correr unos 300 pasos de forma síncrona antes de devolver, con semilla y orden fijos para que sea determinista (research D5, D7)
- [X] T016 [P] [US1] Crear `web/src/components/Legend.tsx`: lista pequeña y siempre visible con un punto de color y el nombre de cada sector (FR-015)
- [X] T017 [US1] Crear `web/src/components/Graph.tsx`: SVG con una capa de aristas y otra de nodos en gris, posiciones de `computeLayout` calculadas una vez con `useMemo`, `<title>` con el nombre en cada nodo (ayuda emergente), y mover/acercar con `d3-zoom` aplicado directamente al grupo SVG mediante una referencia, no con estado de React (research D7); capas memorizadas con `React.memo`; vista inicial ajustada para ver todo el grafo
- [X] T018 [US1] Estilos en `web/src/styles.css`: nodos y aristas en gris, diseño de página (lienzo a pantalla completa, leyenda en una esquina sin tapar el grafo), sin etiquetas visibles en el estado inicial
- [X] T019 [US1] Conectar `web/src/App.tsx` para mostrar `Graph` y `Legend` con los datos de `graph.json`

**Checkpoint**: Con `npm run dev` se ve el mapa completo en gris, con leyenda, y es navegable (US1 funcional y probable por separado)

---

## Phase 4: User Story 2 - Explorar las vecinas de una empresa (Priority: P1)

**Goal**: Al hacer click en un nodo, se colorean él y sus vecinas con el color de su propio sector y el resto queda gris, desenfocado y atenuado.

**Independent Test**: Hacer click en cualquier nodo y verificar que el nodo y sus vecinas toman el color de su sector y que todo lo demás queda gris, desenfocado y atenuado.

### Tests for User Story 2 ⚠️

- [X] T020 [P] [US2] Prueba de selección en `web/src/__tests__/Graph.selection.test.tsx`: al hacer click en un nodo, su relleno es el color de su sector; cada vecina tiene el color de su propio sector (incluyendo una vecina de otro sector); los demás nodos y aristas conservan el gris y la clase de atenuado; una empresa sin conexiones se colorea sola sin error; hacer click en otro nodo mueve la selección

### Implementation for User Story 2

- [X] T021 [US2] Ampliar `web/src/components/Graph.tsx` con las propiedades `selectedId` y `onSelect`: click en un nodo llama a `onSelect(id)` deteniendo la propagación; usando `buildAdjacency` marcar `is-selected`, `is-neighbor` e `is-dim`; el relleno de nodo seleccionado y vecinas sale de `sectorColors` (nunca de un color propio); las aristas del nodo seleccionado se resaltan y se muestra el nombre (`<text>`) del seleccionado y de sus vecinas (FR-008 a FR-010, FR-016)
- [X] T022 [US2] Estilos en `web/src/styles.css` para el estado de selección: lo atenuado queda en gris con `opacity` baja y `filter: blur(...)` ligero, las aristas resaltadas más marcadas, y las etiquetas legibles sobre el lienzo
- [X] T023 [US2] Pasar el estado `selectedId` y `onSelect` desde `web/src/App.tsx` hacia `Graph`

**Checkpoint**: Seleccionar una empresa muestra sus vecinas coloreadas y el resto atenuado (US1 y US2 funcionan: este es el MVP)

---

## Phase 5: User Story 3 - Consultar la ficha completa de una empresa (Priority: P2)

**Goal**: Al seleccionar una empresa se abre una tarjeta con solo los campos que tienen dato y con borde del color del sector.

**Independent Test**: Hacer click en empresas con distinta cantidad de datos y comprobar que la tarjeta muestra únicamente los campos con dato, sin etiquetas vacías, y con el borde del color del sector.

### Tests for User Story 3 ⚠️

- [X] T024 [P] [US3] Prueba de la tarjeta en `web/src/__tests__/Card.test.tsx`: muestra el nombre, el sector y un par etiqueta-valor por cada elemento de `fields`; con una empresa de pocos campos no aparece ninguna etiqueta que no esté en `fields` (ni vacía, ni "N/A", ni guiones); el borde usa el color del sector; con un texto de 1.700 caracteres el contenido sigue accesible (la tarjeta tiene scroll y no desborda)

### Implementation for User Story 3

- [X] T025 [US3] Crear `web/src/components/Card.tsx`: recibe `company` y el color del sector; muestra el nombre y el sector en el encabezado y recorre `company.fields` mostrando cada par etiqueta-valor tal cual, sin filtrar ni completar (el script ya garantiza que no hay vacíos); borde del color del sector (FR-011 a FR-013)
- [X] T026 [US3] Estilos de la tarjeta en `web/src/styles.css`: panel a la derecha como en la imagen de referencia, borde grueso con el color del sector, altura máxima con scroll interno, texto largo que se ajusta, sin tapar por completo el grafo
- [X] T027 [US3] Mostrar `Card` en `web/src/App.tsx` cuando hay una empresa seleccionada, con su color de sector de `sectorColors`

**Checkpoint**: US1, US2 y US3 funcionan; seleccionar una empresa abre su tarjeta correcta

---

## Phase 6: User Story 4 - Volver al estado inicial (Priority: P2)

**Goal**: Click en el fondo o en cerrar devuelve todo a gris con la tarjeta cerrada.

**Independent Test**: Seleccionar un nodo y hacer click en el fondo; repetir con el botón de cerrar; en ambos casos el grafo vuelve al estado inicial.

### Tests for User Story 4 ⚠️

- [X] T028 [P] [US4] Prueba en `web/src/__tests__/reset.test.tsx` renderizando `App`: seleccionar un nodo abre la tarjeta; click en el fondo la cierra y no queda ningún nodo con `is-selected`, `is-neighbor` ni `is-dim`; lo mismo con el botón "Cerrar"; arrastrar o hacer zoom no cierra la selección; click otra vez en el nodo ya seleccionado no cambia nada

### Implementation for User Story 4

- [X] T029 [US4] En `web/src/components/Graph.tsx`, click en el fondo del lienzo llama a `onSelect(null)`, distinguiendo un click de un arrastre de `d3-zoom` para que mover el grafo no cierre la selección (FR-014)
- [X] T030 [US4] Agregar a `web/src/components/Card.tsx` un botón de cerrar (X, con `aria-label="Cerrar"`) que llama a `onClose`, y pasar `onClose={() => setSelectedId(null)}` desde `web/src/App.tsx`

**Checkpoint**: Las cuatro historias funcionan de punta a punta

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verificación final contra la spec y el quickstart

- [X] T031 [P] Ejecutar `npm test` y `npx tsc --noEmit` en `web/`, y `npm run build`; todo debe pasar sin errores ni advertencias de tipos
- [X] T032 Recorrer la tabla manual de [quickstart.md](quickstart.md) (pasos 1 a 11) en `npm run dev`, incluyendo una empresa con pocos datos y una sin conexiones, y anotar cualquier diferencia con la spec
- [X] T033 Medir la fluidez (SC-002) con una empresa seleccionada mientras se mueve y acerca el grafo; si el desenfoque entrecorta, aplicar la alternativa de [research.md](research.md) D7 (capa de fondo estática atenuada sin filtro) en `web/src/components/Graph.tsx` y `web/src/styles.css`
- [X] T034 Revisar el resumen que imprime `tools/build_graph.py` (nombres excluidos, valores de relleno descartados por columna, nodos sin conexiones) y confirmar que `web/src/data/graph.json` no contiene nombres "No", "." ni "no tiene nombre" (SC-007)
- [X] T035 Limpieza final: quitar código sin uso, confirmar que `web/src/data/graph.json` está listo para guardarse en el repositorio y que no se modificaron los CSV ni `Data_relaciones.ipynb`

---

## Phase 8: Revisión 2026-11-02 — centrado, sectores y búsqueda

**Purpose**: Cambios pedidos tras la primera revisión (spec: historias 5 y 6, FR-019 a FR-023, SC-008 a SC-010). Las tareas T037 a T040 y T044 a T047 siguen el mismo orden pruebas → lógica → componentes → conexión.

### Centrado del grafo (FR-023, SC-010)

- [X] T036 [US1] En `web/src/lib/layout.ts`, repartir los ángulos de cada anillo de `rank` (6 anillos) de forma uniforme conservando su orden tras la simulación (`equalizeAngles`), y probarlo en `web/src/__tests__/layout.test.ts` (diferencia entre la zona con más y con menos empresas ≤ 8 y centroide a menos de 25 del origen)

### User Story 5 - Seleccionar un sector (Priority: P2)

**Goal**: Click en un sector de la barra izquierda colorea todas sus empresas y resalta sus conexiones internas.

**Independent Test**: Click en un sector: solo sus empresas se colorean, sus conexiones internas se resaltan y el resto queda atenuado; otro click en el mismo sector lo deselecciona.

- [X] T037 [P] [US5] Pruebas del modo sector en `web/src/__tests__/Graph.selection.test.tsx`: todas las empresas del sector tienen el color del sector y ninguna otra tiene color; el número de aristas resaltadas es el de las que unen dos empresas del sector y su `stroke` es el color del sector; un sector de una sola empresa no resalta aristas; click en una empresa pasa a modo empresa
- [X] T038 [P] [US5] Pruebas de la leyenda en `web/src/__tests__/Legend.test.tsx`: cada sector es un botón con su nombre, color y número de empresas; el activo tiene `aria-pressed="true"`; click llama a `onSelect(nombre)` y, sobre el activo, a `onSelect(null)`
- [X] T039 [US5] Agregar a `web/src/types.ts` el tipo `Selection` (`{ type: "company"; id: string } | { type: "sector"; name: string } | null`) y a `web/src/lib/graph.ts` la función `countBySector(nodes)`
- [X] T040 [US5] En `web/src/components/Graph.tsx`, reemplazar `selectedId` por la propiedad `selection: Selection` y `onSelect(selection)`; en modo sector, enfocar todas las empresas del sector con su color y resaltar las aristas con ambos extremos en el sector (sin etiquetas ni tarjeta)
- [X] T041 [US5] Convertir `web/src/components/Legend.tsx` en lista de botones con el número de empresas y el sector activo marcado, y crear la barra izquierda `aside.sidebar` en `web/src/App.tsx` y `web/src/styles.css` (más ancha, texto de 14 px, el lienzo ocupa el resto)

### User Story 6 - Buscar una empresa o un sector (Priority: P2)

**Goal**: Barra de búsqueda que encuentra empresas y sectores y reproduce el click.

**Independent Test**: Escribir parte de un nombre de empresa y elegirla; escribir parte de un sector y elegirlo; cada elección da la misma vista que el click.

- [X] T042 [P] [US6] Pruebas de `search` en `web/src/__tests__/search.test.ts`: sin distinguir mayúsculas ni tildes; consulta vacía o solo espacios no da resultados; los sectores aparecen antes que las empresas; se limita el número de resultados e informa el total; sin coincidencias devuelve vacío
- [X] T043 [P] [US6] Pruebas del componente en `web/src/__tests__/Search.test.tsx`: escribir muestra resultados con su tipo (sector o empresa); elegir llama a `onSelect` con la selección correcta y cierra la lista; sin coincidencias muestra "Sin resultados"; `Escape` o el botón limpiar vacían el texto
- [X] T044 [US6] Crear `web/src/lib/search.ts` con `search(graph, query, limit)`: normaliza con minúsculas y sin tildes, devuelve `{ results, total }` con sectores primero y luego empresas que contienen el texto
- [X] T045 [US6] Crear `web/src/components/Search.tsx` (campo con `aria-label="Buscar empresa o sector"`, lista de resultados con etiqueta de tipo, mensaje "Sin resultados", `Enter` elige el primero) y colocarlo en la barra izquierda de `web/src/App.tsx`
- [X] T046 [US6] Al elegir una empresa en la búsqueda, centrarla en la parte visible del lienzo (sin cubrirla la tarjeta) mediante la propiedad `focus` de `web/src/components/Graph.tsx` y su conexión en `web/src/App.tsx`
- [X] T047 [US6] Pruebas de integración en `web/src/__tests__/reset.test.tsx`: elegir sector en la búsqueda equivale a elegirlo en la leyenda; elegir empresa abre su tarjeta; click en el fondo vuelve al estado inicial en todos los modos

### Respaldo por sector (revisión 2026-11-03, FR-005, SC-011)

- [X] T049 En `tools/build_graph.py`, unir cada empresa sin conexiones con sus 3 empresas más parecidas del mismo sector (`_link_isolated`, `FALLBACK_LINKS`), preferiendo empresas ya conectadas, respetando `MAX_DEGREE` y desempatando por completitud; marcar esas aristas con `fallback: true` y añadir la columna `Tipo` a `Conexiones_empresas.csv`
- [X] T050 En `tests/test_build_graph.py`, probar el respaldo (solo mismo sector, desempate por completitud, tope de 10, sin islas, sector de una sola empresa, sin respaldo si no se pasan sectores) y los casos reales (ninguna empresa sin conexiones; Viveroonline Sas se une a Agro y medio ambiente)
- [X] T051 En `web/src/types.ts` añadir `fallback?: boolean` a `Edge` y adaptar `web/src/__tests__/Graph.selection.test.tsx`, que ya no encuentra empresas aisladas en los datos reales

### Validación de las conexiones (FR-024, SC-012)

- [X] T052 Revisar por significado las 1.640 conexiones por similitud (8 lotes) y guardar el veredicto de cada una (ok, dudosa o mala, con motivo) en `Conexiones_validadas.csv`; comprobar a mano una muestra
- [X] T053 En `tools/build_graph.py`, leer ese archivo (`load_validation`, `rejected_pairs`) y quitar las malas y las dudosas entre sectores sin reponerlas ni recrearlas en el respaldo (`build_edges(..., rejected)`); añadir la columna Validación a `Conexiones_empresas.csv`
- [X] T054 En `tests/test_build_graph.py`, probar la lectura de veredictos, que lo rechazado no se repone ni vuelve por el respaldo, la columna Validación y los casos reales (ninguna conexión rechazada en el grafo, ninguna empresa aislada, Ecodefense no unida a ikigai)
- [X] T055 En `web/src/components/Graph.tsx` y `web/src/styles.css`, dibujar punteadas las conexiones de respaldo, con prueba en `web/src/__tests__/Graph.selection.test.tsx`

### Búsqueda por descripción y tipos de línea (FR-020, FR-025, FR-026)

- [X] T056 En `web/src/lib/search.ts`, buscar también por palabras de "Descripción completa" y "Servicio que ofrece" (comienzo de palabra, todas las palabras en cualquier orden, sin una letra), con el orden sectores → nombre → descripción por completitud (`rank`) y un fragmento resaltado; pruebas en `web/src/__tests__/search.description.test.ts`
- [X] T057 En `web/src/components/Search.tsx` y `web/src/styles.css`, mostrar el fragmento resaltado bajo cada coincidencia por descripción y el aviso de que hay más resultados; prueba en `web/src/__tests__/Search.test.tsx`
- [X] T058 Crear `web/src/components/LineKey.tsx`, con su estilo y prueba (`web/src/__tests__/LineKey.test.tsx`), y mostrarlo en la barra izquierda de `web/src/App.tsx`

### Verificación de la revisión

- [X] T048 Ejecutar `npm test`, `npx tsc --noEmit` y `npm run build` en `web/` y comprobar en el navegador: grafo centrado, sector seleccionado desde la leyenda y desde la búsqueda, empresa buscada visible, y que el grafo vuelve a gris con el fondo

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias; T003 espera a T001
- **Foundational (Phase 2)**: depende de Setup; bloquea todas las historias
- **User Stories (Phase 3+)**: todas dependen de la fase 2
- **Polish (Phase 7)**: depende de las historias que se quieran entregar

### Dentro de la fase 2

- T005 (pruebas) antes de T006 a T009; T006 → T007 → T008 → T009 (mismo archivo, en orden); T010 después de T009
- T004, T011 y T012 son independientes del script; T011 y T012 necesitan T004; T012 necesita además `graph.json` (T010) para compilar

### User Story Dependencies

- **US1 (P1)**: tras la fase 2; sin dependencias de otras historias
- **US2 (P1)**: tras la fase 2; amplía `Graph.tsx` y `App.tsx` de US1, por lo que va después de US1
- **US3 (P2)**: tras la fase 2; usa la selección de US2 para abrirse
- **US4 (P2)**: usa la selección (US2) y la tarjeta (US3) para poder cerrarse

### Within Each User Story

- Pruebas primero y fallando; luego lógica (`lib/`), componentes, estilos y conexión en `App.tsx`
- Cada historia se valida con su Independent Test antes de pasar a la siguiente

### Parallel Opportunities

- Fase 1: T002 junto con T001
- Fase 2: T004, T005 y T011 a la vez (archivos distintos); T012 en cuanto exista T004
- US1: T013, T014 y T016 a la vez
- Las pruebas de cada historia marcadas [P] se pueden escribir mientras se avanza la anterior

---

## Parallel Example: Phase 2

```bash
# Archivos distintos, sin dependencias entre sí:
Task: "T004 Crear web/src/types.ts"
Task: "T005 Escribir tests/test_build_graph.py"
Task: "T011 Crear web/src/lib/graph.ts"
```

## Parallel Example: User Story 1

```bash
Task: "T013 Prueba de disposición en web/src/__tests__/layout.test.ts"
Task: "T014 Prueba de la leyenda en web/src/__tests__/Legend.test.tsx"
Task: "T016 Crear web/src/components/Legend.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2, ambas P1)

1. Completar Fase 1 (Setup) y Fase 2 (datos y esqueleto)
2. Completar US1 (mapa general) y US2 (selección con vecinas)
3. **DETENERSE y validar**: seleccionar empresas y comprobar colores, vecinas y atenuado
4. Mostrar al equipo antes de seguir

### Incremental Delivery

1. Setup + Foundational → datos listos y app compilando
2. US1 → mapa navegable
3. US2 → descubrimiento de vecinas (MVP)
4. US3 → tarjeta con la información
5. US4 → volver al estado inicial
6. Polish → quickstart, fluidez y revisión de datos

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes
- Las vecinas conservan su posición del grafo: no se recalcula la disposición al seleccionar; la fuerza de enlace del grafo mantiene juntas a las empresas conectadas
- `web/src/data/graph.json` se genera con el script y no se edita a mano
- Las constantes ajustables del script son `MIN_SIMILARITY` (0,15), `MIN_SIMILARITY_CROSS` (0,30), `MAX_DEGREE` (10), `PLACEHOLDERS`, `STOPWORDS`, `GENERIC_WORDS` y `PALETTE`
- Hacer commit después de cada tarea o grupo lógico (solo cuando la persona usuaria lo pida)
- Evitar: tareas vagas, conflictos en el mismo archivo y dependencias entre historias que rompan su independencia

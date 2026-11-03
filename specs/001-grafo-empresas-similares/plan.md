# Implementation Plan: Grafo de empresas similares

**Branch**: `001-grafo-empresas-similares` | **Date**: 2026-10-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-grafo-empresas-similares/spec.md`

## Summary

Una aplicación web de una sola pantalla, hecha con React y TypeScript, muestra ~600 empresas como un grafo. Un script de Python, que se ejecuta antes de levantar la app, cruza los dos CSV, descarta nombres inválidos y duplicados, calcula la similitud de texto entre empresas (TF-IDF y coseno), deja como máximo 10 conexiones por empresa, asigna un color a cada uno de los 16 sectores y escribe todo en `web/src/data/graph.json`. La app dibuja ese archivo en SVG con React, usando `d3-force` solo para calcular posiciones: las empresas con más campos con dato van al centro, todo parte en gris, y al hacer click se colorea la empresa y sus vecinas, el resto se atenúa y se abre una tarjeta solo con los campos que tienen dato. El detalle de cada decisión está en [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 con React 18 (app); Python 3.13, mínimo 3.11 (script de datos); Node 22 para las herramientas de la app

**Primary Dependencies**: Vite (empaquetado y servidor de desarrollo), `react` y `react-dom`, `d3-force` (posiciones) y `d3-zoom` con `d3-selection` (mover y acercar); Vitest y React Testing Library (pruebas). Para los datos: pandas y scikit-learn, solo al generarlos

**Storage**: Archivos: los dos CSV de entrada y `web/src/data/graph.json` generado (se incluye en el repositorio). Sin base de datos

**Testing**: Vitest + React Testing Library para la app (tarjeta, colores, selección); pytest para el script de datos; recorrido manual de [quickstart.md](quickstart.md)

**Target Platform**: Navegador de escritorio moderno. La app compilada es estática y se puede publicar en cualquier hosting de archivos; en local se usa el servidor de Vite

**Project Type**: Aplicación web de una página (React + TypeScript) más un script de generación de datos

**Performance Goals**: Carga completa en menos de 5 s con ~600 nodos (SC-001); mover, acercar y seleccionar sin retrasos perceptibles, cambio de selección en menos de 1 s (SC-002)

**Constraints**: Sin backend, sin login y sin edición; el cálculo de similitud no se hace en el navegador; la tarjeta no muestra campos vacíos ni valores de relleno

**Scale/Scope**: ~600 empresas, ~2.000 conexiones (máximo 10 por empresa), 16 sectores, 1 pantalla

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` sigue siendo la plantilla sin rellenar (`[PRINCIPLE_1_NAME]`, etc.), por lo que el proyecto no define principios ni gates. **Resultado: sin gates que evaluar, sin violaciones.** No es un obstáculo para planear; si se quiere fijar reglas del proyecto (por ejemplo, estilo de pruebas), se hace con `/speckit-constitution` antes de implementar y se vuelve a revisar este plan.

**Re-check tras el diseño de la fase 1**: sin cambios; el diseño no introduce proyectos, capas ni dependencias adicionales a las mínimas.

## Project Structure

### Documentation (this feature)

```text
specs/001-grafo-empresas-similares/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── graph-data.md    # Phase 1 output (/speckit-plan command)
├── reference/
│   └── researchrabbit.webp   # Imagen de referencia
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
tools/
└── build_graph.py       # CSV -> web/src/data/graph.json (limpieza, similitud, conexiones, colores)

tests/
└── test_build_graph.py  # Reglas de datos: nombres inválidos, duplicados, grado <= 10, texto automático, campos, colores

web/
├── package.json, tsconfig.json, vite.config.ts, index.html
└── src/
    ├── main.tsx
    ├── App.tsx              # Estado de selección (ninguna / una empresa / un sector) y barra izquierda
    ├── types.ts             # Tipos de graph.json (Sector, Empresa, Conexión)
    ├── components/
    │   ├── Graph.tsx        # Lienzo SVG: nodos, aristas, zoom, atenuado
    │   ├── Card.tsx         # Tarjeta con borde del color del sector
    │   ├── Legend.tsx       # Leyenda de sectores: botones con número de empresas
    │   └── Search.tsx       # Barra de búsqueda de empresa o sector
    ├── lib/
    │   ├── layout.ts        # Posiciones radiales por completitud (d3-force) y ángulos repartidos
    │   ├── graph.ts         # Vecinas, colores y conteo por sector
    │   └── search.ts        # Búsqueda sin distinguir mayúsculas ni tildes
    ├── data/
    │   └── graph.json       # GENERADO por tools/build_graph.py; no se edita a mano
    ├── styles.css           # Gris, atenuado, desenfoque, tarjeta, leyenda
    └── __tests__/           # Pruebas de Vitest (tarjeta, colores, selección, layout)
```

**Structure Decision**: Proyecto de dos partes sin capas intermedias: `tools/` genera los datos y `web/` los muestra; el contrato entre ambos es `web/src/data/graph.json` y sus tipos en `web/src/types.ts` ([contracts/graph-data.md](contracts/graph-data.md)). La app está en su propia carpeta `web/` para que `package.json` no se mezcle con los CSV; estos y el notebook de la raíz no se mueven ni se modifican.

## Riesgos y puntos abiertos

- **Fluidez del desenfoque (SC-002)**: el filtro de desenfoque sobre ~600 nodos puede entrecortarse al hacer zoom; mitigación definida en research D7 y medición en el quickstart.
- **Valores de relleno (research D6b)**: se tratan como "sin dato", confirmado en la aclaración 5 de la spec. La lista concreta de textos es una constante del script y se puede ampliar.
- **Rendimiento de React**: 603 nodos y ~2.000 aristas son manejables, pero mover y acercar no debe volver a dibujar React en cada movimiento; el zoom se aplica directo al grupo SVG (research D7).
- **Umbral 0,15 (mismo sector) y 0,30 (sectores distintos)**: calibrado con los datos (research D4); ajustable en dos constantes.
- **Instalación de paquetes**: al implementar hay que correr `npm install` en `web/` (descarga las dependencias de la lista de arriba).

## Complexity Tracking

Sin violaciones que justificar.

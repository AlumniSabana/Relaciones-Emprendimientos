# Quickstart: validar el grafo de empresas similares

Guía de verificación de extremo a extremo. Los detalles de datos están en [data-model.md](data-model.md) y de interfaz en [contracts/graph-data.md](contracts/graph-data.md).

## Requisitos

- Python 3.11+ y `uv` (ya instalados).
- Node 22 y npm (disponible en el equipo: v22.20.0).
- Los dos CSV en la raíz del proyecto.

## 1. Generar los datos

```bash
uv run --with pandas --with scikit-learn python tools/build_graph.py
```

Resultado esperado: se crea/actualiza `web/src/data/graph.json` y el script imprime el resumen de qué excluyó (nombres inválidos, duplicados), cuántos valores de relleno descartó, cuántos nodos y aristas generó y cuántos nodos quedaron sin conexiones.

## 2. Pruebas automáticas

```bash
uv run --with pandas --with scikit-learn --with pytest pytest tests
```

Esperado: todas pasan (nombres inválidos y duplicados fuera, grado máximo 10, sin enlaces por texto automático (caso Rachid Style), 16 colores únicos, sin campos vacíos, de relleno ni excluidos en `fields`).

```bash
cd web && npm install && npm test && npx tsc --noEmit
```

Esperado: las pruebas de la app pasan (tarjeta sin etiquetas vacías, colores de sector, selección y cierre, disposición por completitud) y TypeScript compila sin errores.

## 3. Abrir la app

```bash
cd web && npm run dev
```

Abrir la dirección local que imprime Vite (normalmente `http://localhost:5173`). Para probar la versión compilada: `npm run build && npm run preview`.

## 4. Recorrido manual

| # | Qué hacer | Qué debe verse | Requisito |
|---|-----------|----------------|-----------|
| 1 | Cargar la página | ~600 nodos y aristas en gris, en menos de 5 s; leyenda con 16 sectores | FR-007, FR-015, SC-001 |
| 2 | Mirar el centro y los bordes | Las empresas con más campos hacia el centro, las de menos hacia afuera | FR-006, SC-005 |
| 3 | Mover y acercar el grafo | Sin retrasos perceptibles | SC-002 |
| 4 | Clic en un nodo | Nodo y vecinas con su color de sector, resto gris y desenfocado; tarjeta abierta | FR-008 a FR-011 |
| 5 | Comparar colores | Nodo, vecinas, borde de la tarjeta y leyenda coinciden con el sector | FR-013, FR-016, SC-004 |
| 6 | Clic en una empresa con pocos datos (por ejemplo, sin teléfono ni redes, o con "No informa" en el original) | La tarjeta no muestra nada de los campos sin dato: ni etiqueta vacía, ni "No", ni "No informa", ni "N/A", ni guiones | FR-012, SC-003 |
| 7 | Revisar la tarjeta | No aparecen "Descripción", "Eloqua Unique Identifier", "Mapped to Contact", "Volumen de Ingresos" ni "Tamaño Empresa" | FR-011 |
| 8 | Clic en una empresa sin vecinas | Se colorea sola y la tarjeta se abre | Edge case |
| 9 | Clic en otro nodo visible | La selección cambia limpiamente | Historia 2 |
| 10 | Clic en el fondo, y luego repetir con el botón de cerrar | Vuelve todo a gris, tarjeta cerrada | FR-014 |
| 12 | Mirar el grafo completo | Se ve centrado y parejo: sin una zona (por ejemplo, abajo a la izquierda) que concentre muchas más empresas que las demás | FR-023, SC-010 |
| 13 | Clic en un sector de la barra izquierda (por ejemplo "Moda y textiles") | Todas sus empresas (el número junto al nombre) en el color del sector y sus conexiones internas resaltadas; el resto atenuado; sin tarjeta | FR-019, SC-008 |
| 14 | Clic en ese mismo sector otra vez, o en el fondo | Vuelve todo a gris | FR-019 |
| 15 | Escribir "rachid" en la búsqueda y elegir "Rachid Style" | Se abre su tarjeta, la empresa y sus vecinas se colorean y queda centrada a la izquierda de la tarjeta | FR-020, FR-021 |
| 16 | Escribir "turismo" y pulsar Enter | Equivale a seleccionar ese sector en la barra | FR-021 |
| 17 | Escribir "zzzz" | Muestra "Sin resultados" sin error | FR-022 |
| 19 | Escribir "hamburguesas" en la búsqueda | Aparecen las empresas que la mencionan en su descripción, con la palabra resaltada, de más a menos completa | FR-020, FR-025 |
| 20 | Escribir "ropa" y "ropa deportiva" | "ropa" no trae empresas por "Europa"; con dos palabras salen solo las que tienen ambas | FR-020 |
| 21 | Mirar la parte baja de la barra izquierda | Explica la línea continua (se parecen) y la punteada (solo comparten sector) | FR-026 |
| 18 | Pasar el cursor por varios nodos y revisar en `web/src/data/graph.json` que ningún nombre sea "No", "." ni "no tiene nombre" | No existen | FR-002, SC-007 |

## 5. Medición de fluidez (SC-002)

En el navegador, abrir las herramientas de rendimiento, mover y acercar el grafo con una empresa seleccionada y confirmar que se mantiene fluido. Si el desenfoque del fondo entrecorta, aplicar la alternativa indicada en [research.md](research.md) (D7).

# Quickstart: validar el grafo de empresas similares

Guía de verificación de extremo a extremo. Los detalles de datos están en [data-model.md](data-model.md) y de interfaz en [contracts/graph-data.md](contracts/graph-data.md).

## Requisitos

- Python 3.11+ y `uv` (ya instalados).
- Node 22 y npm (disponible en el equipo: v22.20.0).
- Los dos CSV en la raíz del proyecto.

## 1. Generar los datos

Si llegó un Excel de empresas nuevas (por ejemplo `Graduados_participantes_Sem_Inn_2026_2.xlsx`), primero se limpia. El proceso completo para sumar empresas nuevas está en [research.md](research.md) (D2d):

```bash
uv run --with pandas --with openpyxl python tools/clean_new_companies.py
```

Esperado: "Participantes en el Excel: 12 | empresas escritas: 12", con todas con descripción revisada y sector; escribe `Emprendedores_nuevos_2026_2_limpia.csv`. Luego se genera el grafo:

```bash
uv run --with pandas --with scikit-learn python tools/build_graph.py
```

Resultado esperado: se crea/actualiza `web/src/data/graph.json` y el script imprime el resumen de qué excluyó (nombres inválidos, duplicados), cuántos valores de relleno descartó, cuántos nodos y aristas generó y cuántos nodos quedaron sin conexiones.

## 2. Pruebas automáticas

```bash
uv run --with pandas --with scikit-learn --with openpyxl --with pytest pytest tests
```

Esperado: todas pasan (también que las empresas nuevas estén en el grafo y conectadas, y que no quede ninguna conexión por similitud sin revisar; nombres inválidos y duplicados fuera, grado máximo 10, sin enlaces por texto automático (caso Rachid Style), 16 colores únicos, sin campos vacíos, de relleno ni excluidos en `fields`).

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
| 22 | Abrir la página | Arriba, el título "Emprendedores Alumni" centrado, con el logo de La Sabana a la izquierda y el de Alumni a la derecha; el grafo queda debajo, sin tapar el encabezado | FR-028 |
| 23 | Acercar con la rueda | El encabezado se desvanece gradualmente y desaparece; al alejar, reaparece | FR-028 |
| 24 | Elegir un sector (por ejemplo "Moda y textiles") | Aparecen los nombres de las 10 empresas del sector con más información, sin tarjeta; con un sector de menos de 10, aparecen todas | FR-027 |
| 25 | Abrir "Filtrar el grafo" y elegir la ciudad "Chía" | El grafo pasa a tener solo las 55 empresas de Chía, reencuadrado; la leyenda suma 55; "Mostrando 55 de 615 empresas" | FR-029, SC-013 |
| 26 | Elegir el departamento "Cundinamarca" y mirar la lista de ciudades; luego elegir la ciudad "Bogotá, D.C." | Cundinamarca (543) incluye a Bogotá (422), que aparece como ciudad y no como departamento; la lista de ciudades cambia con el departamento | FR-029, FR-032 |
| 27 | Combinar ciudad o departamento con un tamaño ("Mediana") | Quedan solo las empresas que cumplen ambos | FR-029 |
| 28 | Con un filtro activo, mirar las líneas | Las empresas sin conexiones en el grupo se unen con líneas punteadas | FR-030 |
| 29 | Seleccionar una empresa y, en su tarjeta, elegir cercanía "Alta" | "Mostrando N de M conexiones"; solo las de similitud 0,50 o más quedan coloreadas | FR-031, SC-014 |
| 30 | Marcar "Solo del mismo tamaño" | Solo quedan las conexiones de empresas con el mismo tamaño; está desactivado si la empresa no tiene tamaño | FR-031 |
| 18 | Pasar el cursor por varios nodos y revisar en `web/src/data/graph.json` que ningún nombre sea "No", "." ni "no tiene nombre" | No existen | FR-002, SC-007 |

## 5. Medición de fluidez (SC-002)

En el navegador, abrir las herramientas de rendimiento, mover y acercar el grafo con una empresa seleccionada y confirmar que se mantiene fluido. Si el desenfoque del fondo entrecorta, aplicar la alternativa indicada en [research.md](research.md) (D7).

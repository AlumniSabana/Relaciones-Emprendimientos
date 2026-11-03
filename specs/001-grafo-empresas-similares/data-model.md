# Data Model: Grafo de empresas similares

Los datos de entrada son de solo lectura: `Base_emprendedores_2026_2_limpia.csv` y `Sector_relacionado_ia.csv`, cruzados por `Eloqua Unique Identifier`. El script produce los tres objetos de abajo en `web/src/data/graph.json` (formato en [contracts/graph-data.md](contracts/graph-data.md)); la app los usa con los tipos de `web/src/types.ts`.

## Sector

Categoría de la empresa; 16 en total.

| Campo | Descripción |
|-------|-------------|
| `name` | Texto de "Sector relacionado" (clave única) |
| `color` | Color hexadecimal único; asignado al ordenar los nombres alfabéticamente y tomar la paleta en ese orden |

**Reglas**: toda empresa tiene exactamente un sector; no hay dos sectores con el mismo color; el color gris queda reservado para el estado atenuado y no se asigna a ningún sector.

## Empresa (nodo)

| Campo | Origen / regla |
|-------|----------------|
| `id` | `Eloqua Unique Identifier` (único) |
| `name` | `Nombre de empresa` recortado de espacios |
| `sector` | `Sector relacionado` (nombre de un Sector) |
| `rank` | Posición relativa de completitud de 0 (más campos con dato) a 1 (menos); desempate por `id` |
| `fields` | Lista ordenada de pares `[etiqueta, valor]` con los campos de la tarjeta que tienen dato |

**Reglas de validación** (cada una la comprueba una prueba):
- Se excluye la empresa si el nombre es inválido: tras recortar, menos de 3 caracteres, o `no`, o que empiece por `no tiene nombre` (research D6).
- Si un `id` se repite, se conserva la primera fila.
- Una empresa debe estar en ambos CSV; si falta su sector, se excluye y se informa.
- `fields` no contiene vacíos ni valores de relleno (research D6b), y nunca incluye `Descripción`, `Eloqua Unique Identifier`, `Mapped to Contact`, `Volumen de Ingresos` ni `Tamaño Empresa`. Las etiquetas son los nombres de columna del CSV.
- La completitud usada para `rank` es la longitud de `fields`.
- `name` y `sector` no forman parte de `fields` (la tarjeta los muestra en su encabezado).

**Orden de `fields`** (los que no tengan dato simplemente no aparecen): Servicio que ofrece, Descripción completa, Tipo de Empresa, Sector, Razón Social, ID de Empresa (NIT), Fecha de Fundación, Emprendimiento activo, Empresa propia, Incubado en la Universidad, Tamaño, Volumen, ODS, País, Departamento, Ciudad, Dirección, Página Web, Redes Sociales, Dirección de correo electrónico, Teléfono, Cargo.

## Conexión (arista)

| Campo | Descripción |
|-------|-------------|
| `a`, `b` | `id` de las dos empresas (sin dirección; `a < b` para no duplicar) |
| `w` | Similitud coseno redondeada a 3 decimales, entre 0,15 y 1 (0,30 o más si las empresas son de sectores distintos) |

**Reglas**:
- Dos empresas se conectan solo si `w` ≥ 0,15 (≥ 0,30 si son de sectores distintos; research D4).
- Cada empresa participa en como máximo 10 conexiones (research D3).
- **Respaldo por sector** (research D4b): una empresa que quedó sin ninguna conexión se une a sus 3 empresas más parecidas del mismo sector, aunque `w` sea menor que el umbral (puede ser 0); esas conexiones llevan `fallback: true` y solo unen empresas del mismo sector. Solo queda sin conexiones la que sea única en su sector.
- No hay conexiones de una empresa consigo misma ni pares repetidos.

## Relaciones

- Un Sector tiene muchas Empresas; una Empresa tiene un Sector.
- Una Empresa tiene de 0 a 5 Conexiones; cada Conexión une exactamente dos Empresas.

## Estados de la interfaz

| Estado | Condición | Se ve |
|--------|-----------|-------|
| Inicial | Nada seleccionado | Todo en gris, tarjeta cerrada |
| Selección | Una empresa elegida | Esa empresa y sus vecinas (extremos de sus conexiones) con color de sector; sus conexiones resaltadas; el resto gris, desenfocado y atenuado; tarjeta abierta con borde del color del sector |

**Transiciones**: Inicial → Selección (clic en un nodo); Selección → Selección (clic en otro nodo); Selección → Inicial (clic en el fondo o en cerrar).

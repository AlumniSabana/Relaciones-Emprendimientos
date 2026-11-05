# Contrato: `web/src/data/graph.json`

Es el único punto de unión entre el script que calcula (`tools/build_graph.py`) y la app (`web/`). La app no lee los CSV.

## Formato

```json
{
  "generated": "2026-10-30",
  "sectors": [ { "name": "Moda y textiles", "color": "#RRGGBB" } ],
  "nodes": [
    { "id": "DUNID000002657169", "name": "Meuf By Ana Paternina",
      "sector": "Moda y textiles", "rank": 0.42,
      "fields": [ ["Servicio que ofrece", "Venta de ropa"] ] }
  ],
  "edges": [ { "a": "DUNID...", "b": "DUNID...", "w": 0.471 },
             { "a": "DUNID...", "b": "DUNID...", "w": 0, "fallback": true } ]
}
```

Los tipos que la app usa para leerlo (`web/src/types.ts`) deben coincidir con esa forma:

```ts
export interface Sector { name: string; color: string }
export interface Company {
  id: string; name: string; sector: string; rank: number; fields: [string, string][];
  department?: string; city?: string; size?: string; // para los filtros; solo si hay dato
  nolink?: boolean; // la tarjeta muestra su página web como texto, sin enlace (Paginas_sin_enlace.csv)
}
export interface Edge { a: string; b: string; w: number; fallback?: boolean }
export interface Graph { generated: string; sectors: Sector[]; nodes: Company[]; edges: Edge[] }
```

## Garantías que el script cumple y la app puede asumir

1. `sectors` tiene 16 entradas, en orden alfabético, con `name` y `color` únicos; todo `nodes[].sector` aparece en `sectors`.
2. `nodes[].id` es único; `rank` está entre 0 y 1.
3. `nodes[].fields` solo contiene pares con valor de texto no vacío y que no sea de relleno, en el orden definido en el [modelo de datos](../data-model.md), y nunca incluye `Descripción`, `Eloqua Unique Identifier`, `Mapped to Contact`, `Volumen de Ingresos` ni `Tamaño Empresa`. La app los muestra tal cual, sin filtrar ni completar (así una empresa sin dato en un campo simplemente no lo tiene).
4. Cada `edges[]` usa `id` presentes en `nodes`, con `a < b` y sin repetidos; ningún nodo aparece en más de 10 aristas. Las aristas de respaldo por sector llevan `fallback: true`, unen empresas del mismo sector y su `w` puede ser menor que el umbral (incluso 0); el resto tiene `w` ≥ 0,15 (≥ 0,30 entre sectores distintos). Todo nodo con otras empresas de su sector aparece en al menos una arista.
5. El archivo no contiene ningún nodo con nombre inválido ni duplicado.

## Contrato de la interfaz (lo observable)

| Acción | Resultado esperado |
|--------|-------------------|
| Abrir la app | Todos los nodos y aristas en gris; leyenda con los 16 sectores y su color; tarjeta cerrada |
| Clic en un nodo | Nodo y vecinas coloreados con el color de su propio sector; resto gris, desenfocado y atenuado; tarjeta abierta con el nombre, el sector y los `fields`; borde de la tarjeta con el color del sector |
| Clic en otro nodo (visible) | La selección pasa a ese nodo con las mismas reglas |
| Clic en un sector de la barra izquierda | Todas las empresas del sector con el color del sector y sus conexiones internas resaltadas con ese color; el resto gris, desenfocado y atenuado; sin tarjeta; el sector queda marcado (`aria-pressed`). Otro clic en el mismo sector vuelve al estado inicial |
| Escribir en la búsqueda | Hasta 8 resultados, sectores primero, cada uno con su tipo ("Sector" o "Empresa"); sin coincidencias muestra "Sin resultados"; con el texto vacío no hay resultados |
| Elegir un resultado de búsqueda | Un sector equivale a hacer clic en él en la barra; una empresa equivale a hacerle clic y además la deja centrada y acercada en la parte libre del lienzo |
| Clic en el fondo o en cerrar | Estado inicial |
| Conexión de respaldo (`fallback: true`) | Se dibuja punteada, en gris y también al resaltarla, para distinguirla de las conexiones por similitud |
| Elegir departamento, ciudad o tamaño en "Filtrar el grafo" | Grafo nuevo solo con esas empresas, reencuadrado; leyenda y búsqueda limitadas a ellas; "Mostrando N de M empresas"; "Quitar filtros" lo deshace. Las que queden sueltas se unen con línea punteada |
| Cercanía o "solo del mismo tamaño" en la tarjeta de una empresa | Solo las conexiones que cumplen siguen coloreadas y resaltadas; las demás pasan al fondo atenuado; "Mostrando N de M conexiones" |
| Pasar el cursor por un nodo | Su nombre se ve como ayuda emergente (sin cambiar el estado) |
| Arrastrar / rueda | Mover y acercar el grafo; no cambia la selección |

Los colores de nodo, vecina, borde de la tarjeta y leyenda salen siempre de `sectors[].color`.

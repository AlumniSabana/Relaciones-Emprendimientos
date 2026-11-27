# Emprendedores Alumni — grafo de empresas similares

Página web que muestra, como un grafo, unos 600 emprendimientos de graduados de la Universidad de La Sabana: cada punto es una empresa y cada línea une dos empresas que ofrecen cosas parecidas según su descripción. Incluye filtros por ubicación y tamaño, búsqueda, un asistente de IA para preguntar en lenguaje natural y un buscador de *matches* (proveedores, clientes y alianzas).

**Documentación técnica completa: [wiki del repositorio](https://github.com/AlumniSabana/Relaciones-Emprendimientos/wiki)** (arquitectura, datos, API, despliegue, pruebas, recetas para extender y problemas conocidos).

## Uso (resumen)

Al abrir la página aparece una guía; se vuelve a abrir con **¿Cómo usar la herramienta?**, al final de la barra izquierda. Clic en un punto abre la tarjeta de la empresa; clic en un sector de la barra resalta sus empresas; **Filtrar el grafo** arma un grafo con parte de las empresas; **Preguntar al asistente** responde en lenguaje natural y resalta las empresas halladas (es una IA: verifica antes de contactar); **Buscar matches** sugiere con quién hacer negocios.

## Stack

| Parte | Tecnología |
|---|---|
| Página | React 18, TypeScript (estricto), Vite 7, d3-force y d3-zoom (`web/`) |
| Datos | Python con pandas, scikit-learn y openpyxl, ejecutados con [`uv`](https://docs.astral.sh/uv/) (`tools/`) |
| Asistente | Función de servidor `web/api/chat.ts` que llama a Google Gemini |
| Pruebas | pytest (`tests/`) y Vitest + Testing Library (`web/src/__tests__/`) |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |
| Despliegue | Vercel (proyecto con *Root Directory* `web`; configuración en el panel de Vercel) |

## Instalar y correr

Requisitos: Node 22 y npm; Python 3.11+ (probado con 3.13) y `uv`.

```bash
cd web
npm ci
npm run dev        # http://localhost:5173
```

Los datos del grafo ya están generados y versionados (`web/src/data/`). Para regenerarlos o sumar empresas desde un Excel nuevo, desde la raíz del repositorio:

```bash
uv run --with pandas --with scikit-learn --with openpyxl python tools/update_data.py NUEVO_2027_1.xlsx --dry-run   # ver qué haría
uv run --with pandas --with scikit-learn --with openpyxl python tools/update_data.py NUEVO_2027_1.xlsx             # hacerlo
```

Detalle del pipeline, de las reglas y de la certificación de relaciones en la wiki (*Datos y procesamiento*).

## Variables de entorno

Solo nombres (los valores nunca se versionan; `.env*` está en `.gitignore`):

| Variable | Para qué | ¿Obligatoria? |
|---|---|---|
| `GEMINI_API_KEY` | Llave de Google Gemini para el asistente (`web/.env.local` en local; variable de entorno en Vercel) | Solo para el asistente; sin ella `/api/chat` responde 503 |
| `GEMINI_MODEL` | Modelo a probar primero | Opcional |

## Pruebas

```bash
uv run --with pytest --with pandas --with scikit-learn --with openpyxl pytest -q   # desde la raíz: 161 pruebas
uv run --with pandas --with scikit-learn python tools/certify.py                   # 15 comprobaciones de las relaciones
cd web && npm test                                                                  # 210 pruebas
cd web && npm run build                                                             # tipos + compilación
```

## Despliegue

Cada push a `main` despliega en Vercel (según la configuración del proyecto en Vercel). Antes de publicar: regenerar datos si cambiaron, correr `certify.py`, las dos suites de pruebas y `npm run build`. Cómo verificar un despliegue: wiki, *Despliegue*.

## Privacidad

`web/src/data/graph.json` viaja completo al navegador e incluye los datos de contacto de las tarjetas (correo y teléfono). Decide con Alumni qué datos se publican antes de abrir la página al público. Ver *Problemas conocidos* en la wiki.

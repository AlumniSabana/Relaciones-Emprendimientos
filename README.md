# Emprendedores Alumni — grafo de empresas similares

Página web que muestra, como un grafo, los emprendimientos de graduados de la Universidad de La Sabana (unos 600). Cada punto es una empresa y cada línea une dos empresas que ofrecen cosas parecidas, según lo que escribieron en su descripción. Además tiene un asistente de IA para preguntar en lenguaje natural y un buscador de *matches* (proveedores, clientes y alianzas posibles).

- **Manual de usuario**: cómo usar la página → [abajo](#manual-de-usuario).
- **Manual de desarrollador**: cómo funciona, cómo actualizar los datos con un Excel nuevo, pruebas y despliegue → [abajo](#manual-de-desarrollador).

---

## Manual de usuario

Al abrir la página aparece una guía rápida. Se puede volver a abrir en cualquier momento con **¿Cómo usar la herramienta?**, al final de la barra izquierda (y se puede marcar "No mostrar al iniciar").

### Qué se ve

- Cada **punto** es un emprendimiento. Al inicio todo está en gris.
- Una **línea continua** une dos empresas que ofrecen cosas parecidas (similitud revisada). Una **línea punteada** une empresas que solo comparten sector (se usa para que ninguna quede suelta).
- Cada **color** es un sector (16 en total); la leyenda está en la barra izquierda con el número de empresas de cada uno.

### Qué se puede hacer

| Quiero… | Cómo |
|---|---|
| Moverme por el grafo | Arrastrar para mover y rueda del ratón para acercar o alejar. Al acercar mucho se desvanece el encabezado. |
| Ver una empresa | Clic en su punto: se abre su **tarjeta** con todos sus datos (solo los que tienen dato) y se colorean las empresas con las que se parece. La página web de la tarjeta es un enlace que abre en una pestaña nueva (salvo sitios bloqueados por seguridad). Clic en el fondo o en × para volver al inicio. |
| Filtrar las conexiones de una empresa | En su tarjeta: **Cercanía** (todas, media, alta) y **Solo del mismo tamaño**. |
| Ver un sector completo | Clic en el sector en la barra izquierda: se resaltan sus empresas y sus conexiones, con el nombre de las 10 con más información. Otro clic lo quita. |
| Buscar | Caja de búsqueda: por nombre, sector o palabras de la descripción ("pastelería"). Salen primero las empresas con información más completa. |
| Armar un grafo con parte de las empresas | **Filtrar el grafo**: departamento, ciudad y tamaño. Bogotá cuenta como Cundinamarca. "Quitar filtros" lo deshace. |
| Preguntar en lenguaje natural | **Preguntar al asistente**. Ejemplo: *"Dime los emprendimientos de Cajicá que ofrezcan pastelería"*. Responde con un texto y la lista de empresas, que además se resaltan en el grafo; un clic en una empresa de la lista abre su tarjeta. |
| Encontrar con quién hacer negocios | **Buscar matches** (o el botón dentro de la tarjeta): elige tu empresa y te muestra de a una las que encajan —*podría ser tu proveedor / tu cliente / alianza comercial*, con su afinidad, por qué encaja y qué validar antes—. **Me interesa** la guarda en tu lista, **Pasar** pasa a la siguiente, **Ver en el grafo** la abre. Tus decisiones quedan guardadas en tu navegador. |

### Cosas que conviene saber

- El asistente es una **IA**: puede equivocarse o no encontrar a todas. Verifica antes de contactar. Si Google está saturado puede tardar hasta un minuto o decir que no pudo responder; basta volver a preguntar.
- Los **matches** son sugerencias inferidas de las descripciones, no necesidades confirmadas. La tarjeta de cada match dice qué confirmar antes de avanzar.
- Las empresas se conectan por lo que **escribieron** de su oferta; una descripción corta o copiada puede dar conexiones pobres.

---

## Manual de desarrollador

### Requisitos

- **Python 3.11+** y [`uv`](https://docs.astral.sh/uv/) (para los scripts de datos; no hay que instalar nada a mano: `uv run --with …` baja las librerías).
- **Node 22** y npm (para la página).

### Estructura

```
Base_emprendedores_2026_2_limpia.csv   Base principal de empresas (se le agregan filas con update_data.py)
Emprendedores_nuevos_2026_2_limpia.csv Tanda 2026-2 de la Semana de Innovación (también se lee)
Sector_relacionado_ia.csv              Sector de cada empresa (id, nombre, sector)
Conexiones_validadas.csv               Veredicto (ok / dudosa / mala) por conexión; las malas se quitan
Descripciones_corregidas.csv           Descripciones revisadas a mano por id (empresas nuevas)
Datos_adicionales_nuevas.csv           Ciudad, departamento… aportados a mano por id (empresas nuevas)
Paginas_sin_enlace.csv                 Sitios web que se muestran como texto, sin enlace
Empresas clasificadas y matches.xlsx   Clasificación de la oferta y matches complementarios
Conexiones_empresas.csv                SALIDA: una fila por empresa y vecina, para filtrar en Excel
Empresas_en_la_pagina.xlsx             SALIDA: empresas con todos sus datos y sus conexiones
tools/                                 Scripts de datos (Python)
tests/                                 Pruebas de los scripts (pytest)
web/                                   La página (React + TypeScript + Vite) y la función del chat
  src/data/graph.json                  SALIDA de build_graph.py: lo único que lee la página (grafo)
  src/data/matches.json                SALIDA de build_matches.py: matches (carga diferida)
  api/chat.ts                          Función de servidor del asistente (Vercel)
  api/_catalog.ts                      SALIDA de build_matches.py: catálogo que lee el chat
specs/001-grafo-empresas-similares/    Especificación, plan, tareas y decisiones (Spec Kit)
```

Los archivos marcados SALIDA se generan: no se editan a mano.

### Puesta en marcha de la página

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas (Vitest)
npm run build      # revisa tipos y genera web/dist
```

Para que el asistente funcione en local, crea `web/.env.local` (git lo ignora) con:

```
GEMINI_API_KEY=tu_llave_de_google_ai_studio
```

`npm run dev` sirve `/api/chat` con la misma función que usa Vercel. Opcional: `GEMINI_MODEL` para probar primero otro modelo.

### Cómo se calcula el grafo (`tools/build_graph.py`)

1. Lee las bases, descarta nombres inválidos y duplicados y deja las empresas con sector.
2. Compara el texto que cada empresa escribió de su oferta (`Servicio que ofrece` + `Descripción`) con TF-IDF sobre raíces y pares de raíces, sin palabras vacías ni genéricas.
3. Une de mayor a menor similitud, con un máximo de **10 conexiones por empresa** y un umbral de **0,15 en el mismo sector** y **0,30 entre sectores**.
4. Quita las conexiones que `Conexiones_validadas.csv` rechazó (las *malas* y, entre sectores, las *dudosas*).
5. A toda empresa que quede sin conexiones la une, con línea punteada (`fallback`), a hasta 3 de su sector.
6. Escribe `web/src/data/graph.json` (contrato en `specs/001-grafo-empresas-similares/contracts/graph-data.md`) y `Conexiones_empresas.csv`.

Las constantes ajustables están al inicio del script (`MIN_SIMILARITY`, `MIN_SIMILARITY_CROSS`, `MAX_DEGREE`, `STOPWORDS`, `GENERIC_WORDS`, `PALETTE`…). Los detalles y las decisiones están en `specs/001-grafo-empresas-similares/research.md` y `data-model.md`.

### Actualizar la página con un Excel nuevo (un solo comando)

Cuando llega un Excel de emprendedores nuevos (misma forma que `Graduados_participantes_Sem_Inn_2026_2.xlsx`: hoja **"Lista graduados participantes"**, una fila de encabezados con **No.**, **Nombre de emprendimiento**, **Cargo** y **Descripción**):

```bash
# 1. Ver qué haría, sin escribir nada
uv run --with pandas --with scikit-learn --with openpyxl python tools/update_data.py NUEVO_2027_1.xlsx --dry-run

# 2. Hacerlo
uv run --with pandas --with scikit-learn --with openpyxl python tools/update_data.py NUEVO_2027_1.xlsx
```

Qué hace (`tools/update_data.py`):

1. **Limpia** el Excel (texto en una línea, sin emojis ni espacios raros). Los nombres de personas y el programa de grado no se guardan.
2. **Deja fuera** a las empresas que ya están (mismo ID o mismo nombre, sin importar tildes ni mayúsculas) y a las que no traen descripción; lo imprime con el motivo. Por eso se puede correr dos veces con el mismo archivo sin duplicar nada.
3. **Aplica** `Descripciones_corregidas.csv` y `Datos_adicionales_nuevas.csv` (por ID) a las empresas nuevas.
4. **Asigna el sector** por votación de las 5 empresas más parecidas que ya lo tienen; si no hay parecido, "Otros servicios". Las que quedan con poca seguridad se listan con `?`: corrige su sector en `Sector_relacionado_ia.csv` y regenera.
5. **Escribe las filas nuevas al final** de `Base_emprendedores_2026_2_limpia.csv` y de `Sector_relacionado_ia.csv` (no reescribe lo anterior).
6. **Regenera** `graph.json`, `Conexiones_empresas.csv`, `matches.json`, el catálogo del chat y `Empresas_en_la_pagina.xlsx`.
7. **Certifica** las relaciones (ver abajo). Las conexiones nuevas sin veredicto se registran con un veredicto automático y se vuelve a calcular el grafo.

Los IDs son `SIE-AAAA-S-NN` (por ejemplo `SIE-2027-1-03`). El prefijo sale del nombre del archivo (`…_2027_1.xlsx`); si el nombre no lo permite, se da con `--prefix SIE-2027-1-`.

Después, para publicar: `git add` de los archivos que cambiaron, commit y push (Vercel despliega solo).

**Lo que el pipeline no hace** y hay que mirar a mano:

- **Matches de las empresas nuevas.** `Empresas clasificadas y matches.xlsx` se generó aparte (con IA). Las empresas nuevas aparecen en el grafo, el buscador y el chat, pero no tienen matches hasta que se amplíe ese archivo; el resumen del pipeline no las bloquea.
- **Datos que el Excel no trae** (NIT, ciudad, correo…): se agregan en `Datos_adicionales_nuevas.csv` por ID y se vuelve a correr el pipeline… o se editan directo en la base.
- **Excels con otra forma** (por ejemplo la base completa con todas las columnas): no los lee; hay que adaptar `tools/clean_new_companies.py`.
- **Ciudades dudosas.** `build_graph.py` imprime las ciudades declaradas en más de un departamento (hoy Armenia); decide a mano y, si hace falta, añade la ciudad a `CITY_DEPARTMENT`.

### Certificación automática de las relaciones (`tools/certify.py`)

```bash
uv run --with pandas --with scikit-learn python tools/certify.py             # certifica y deja la cola de revisión
uv run --with pandas --with scikit-learn python tools/certify.py --registrar # además registra los veredictos automáticos
```

Termina con código de salida 1 si falla alguna de estas pruebas sobre `graph.json` y `matches.json`:

- Ids únicos; todo sector está en la leyenda; toda conexión une empresas que existen, sin repetir ni consigo misma.
- Ninguna empresa con más de 10 conexiones; similitud mínima (0,15 mismo sector / 0,30 entre sectores); el respaldo solo une empresas del mismo sector.
- Ninguna conexión que la validación rechazó; toda empresa tiene conexiones (salvo la única de su sector).
- Matches: entre empresas del grafo, sin repetir, sin una empresa consigo misma (ni con otra de igual nombre), con relación y afinidad conocidas y con motivo.

Además, toda conexión **por similitud** debe tener veredicto en `Conexiones_validadas.csv`. Las que no (por ejemplo, las de empresas nuevas) van a `Conexiones_por_revisar.csv` con un veredicto automático, que con `--registrar` se guarda en `Conexiones_validadas.csv` marcado **"Automática"** en `Motivo`:

| Caso | Veredicto |
|---|---|
| Textos idénticos entre las dos empresas | dudosa |
| Al menos 2 términos en común | ok |
| Casi sin términos en común | dudosa |

Es una regla simple, no una revisión humana: las *dudosas* entre sectores distintos se quitan del grafo. Para revisar o corregir, filtra por "Automática" en `Conexiones_validadas.csv`, cambia el veredicto (`ok`, `dudosa` o `mala`) y regenera con `build_graph.py`.

### Pruebas

```bash
uv run --with pytest --with pandas --with scikit-learn --with openpyxl pytest -q   # datos: reglas, pipeline, certificación
cd web && npm test                                                                  # página: grafo, filtros, chat, matches, guía
```

`.github/workflows/ci.yml` corre las dos, la certificación y `npm run build` en cada push y pull request. Los tests de certificación también se ejecutan sobre los datos reales: si alguien edita a mano un CSV y rompe una regla, fallan.

### El asistente de IA

- `web/api/chat.ts` es una función de servidor (Vercel). Recibe la conversación, le pasa a Gemini el catálogo de empresas (`web/api/_catalog.ts`, una línea por empresa) y pide una respuesta JSON `{answer, ids}`. Los ids que no existan se descartan en el servidor y de nuevo en la página.
- La **llave nunca va al navegador ni al repositorio**: se lee de `GEMINI_API_KEY`. En Vercel: *Settings → Environment Variables → `GEMINI_API_KEY`* y volver a desplegar.
- Google satura y retira modelos con frecuencia: el servidor prueba varios en orden y reintenta hasta 52 s (ver `MODELS` en `chat.ts`).
- **Pendiente antes de hacerla pública:** no hay límite de uso por visitante; cualquiera con acceso a la página puede gastar la cuota de la llave (agregar un límite, por ejemplo con Upstash o Vercel KV).
- Los textos de las empresas se tratan como datos, no como instrucciones; la respuesta se muestra como texto plano.

### Despliegue (Vercel)

Proyecto con *Root Directory* `web` y preset Vite. Cada push a `main` despliega solo. Variable de entorno requerida para el asistente: `GEMINI_API_KEY`.

### Privacidad y límites conocidos

- `graph.json` y `matches.json` viajan completos al navegador: **correo, teléfono y demás datos de contacto de las tarjetas son públicos** para quien abra la página. Decídelo antes de publicar.
- `Graduados_participantes_Sem_Inn_2026_2.xlsx` trae nombres de personas: no hace falta subirlo al repositorio (los scripts no guardan esos nombres).
- Las conexiones dependen de la calidad de las descripciones; los veredictos de `Conexiones_validadas.csv` son revisiones de apoyo, no una certificación humana de cada par.
- En ventanas muy angostas (~800 px) el panel del asistente o de matches se monta sobre la tarjeta de la empresa.

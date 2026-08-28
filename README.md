# MEDICABILITY

Sitio de difusión semanal sobre **docencia médica y razonamiento clínico**.
Cada lunes busca artículos nuevos en PubMed, selecciona los más relevantes, redacta
un resumen en español con **5 tips accionables**, genera una **infografía PNG** y
despliega el sitio en Netlify. Sin base de datos, sin CMS, sin servidor.

---

## Cómo funciona

```
GitHub Actions (lunes 06:00 Lima)
  1. buscar.mjs      PubMed E-utilities  →  contenido/articulos/*.json   (estado: pendiente)
  2. resumir.mjs     API de Claude       →  título ES + 5 tips           (estado: resumido)
  3. infografia.mjs  Playwright + HTML   →  publico/img/infografias/*.png (estado: publicado)
  4. commit + push
        ↓
Netlify detecta el commit  →  npm run construir  →  publica /sitio
```

El contenido vive en el repositorio como JSON: versionado, revisable en un Pull Request
y editable a mano antes de publicar.

---

## Estructura del proyecto

```
medicability/
├── config/
│   ├── sitio.json               Nombre, lema, colores, URL, artículos por semana
│   └── consultas.json           Las 6 líneas de búsqueda de PubMed y los filtros
├── contenido/
│   └── articulos/               Un JSON por artículo (esto es la base de datos)
├── plantillas/
│   └── infografia.html          Plantilla visual 1080×1350 de la infografía
├── publico/                     Archivos estáticos que se copian tal cual al sitio
│   ├── css/estilo.css
│   ├── js/sitio.js              Menú móvil, buscador y filtros
│   └── img/infografias/         PNG generados (versionados en el repo)
├── scripts/
│   ├── lib/
│   │   ├── util.mjs             Rutas, fechas, slugs, lectura/escritura de JSON
│   │   ├── pubmed.mjs           Cliente de NCBI E-utilities
│   │   ├── claude.mjs           Cliente de la API de Claude
│   │   └── plantillas.mjs       Todo el HTML del sitio
│   ├── buscar.mjs               Paso 1
│   ├── resumir.mjs              Paso 2
│   ├── infografia.mjs           Paso 3
│   ├── construir.mjs            Paso 4 — lo que ejecuta Netlify
│   └── servir.mjs               Vista previa local
├── .github/workflows/
│   ├── publicacion-semanal.yml  Cron semanal
│   └── verificacion.yml         Comprueba que el sitio construye en cada PR
├── netlify.toml
├── package.json
└── .env.ejemplo
```

### Ciclo de vida de un artículo

`pendiente` → `resumido` → `publicado`

Cada paso solo toca los artículos en el estado que le corresponde, así que puedes
volver a ejecutar cualquier script sin duplicar trabajo.

---

## Puesta en marcha

### 1. Local

```bash
npm install
npx playwright install chromium
cp .env.ejemplo .env          # y completa ANTHROPIC_API_KEY y NCBI_EMAIL

npm run buscar                # busca en PubMed
npm run resumir               # redacta los 5 tips
npm run infografias           # genera los PNG
npm run construir             # arma el sitio en /sitio
npm run servir                # http://localhost:8080
```

O todo de una vez: `npm run semanal`.

### 2. GitHub

Sube el repositorio y configura en **Settings → Secrets and variables → Actions**:

| Tipo     | Nombre              | Valor                                   |
|----------|---------------------|-----------------------------------------|
| Secret   | `ANTHROPIC_API_KEY` | Tu clave de la API de Claude            |
| Secret   | `NCBI_EMAIL`        | Tu correo (lo exige NCBI)               |
| Secret   | `NCBI_API_KEY`      | Opcional: sube el límite de peticiones  |
| Variable | `SITIO_URL`         | `https://tu-sitio.netlify.app`          |
| Variable | `MODELO_IA`         | Opcional: `claude-sonnet-4-5`           |

En **Settings → Actions → General → Workflow permissions**, activa
*Read and write permissions* (el flujo hace commit del contenido nuevo).

### 3. Netlify

1. **Add new site → Import an existing project** y elige el repositorio.
2. Netlify lee `netlify.toml`, así que no hay nada que configurar:
   - Build command: `npm run construir`
   - Publish directory: `sitio`
3. En **Site settings → Environment variables**, añade `SITIO_URL` con la URL final
   (para que el RSS y las etiquetas Open Graph apunten bien).
4. Cada `git push` del flujo semanal dispara un despliegue automático.

> Netlify **no** genera infografías: Playwright corre solo en GitHub Actions y los
> PNG llegan ya versionados. Por eso el despliegue tarda segundos.

---

## Personalización

| Quiero cambiar…            | Edita                                       |
|----------------------------|---------------------------------------------|
| Nombre, lema, colores      | `config/sitio.json`                         |
| Qué se busca               | `config/consultas.json`                     |
| Cuántos artículos/semana   | `maximoPorSemana` en `config/sitio.json`    |
| Día y hora de publicación  | `cron` en `publicacion-semanal.yml`         |
| Tono y reglas del resumen  | La constante `SISTEMA` en `scripts/resumir.mjs` |
| Diseño de la infografía    | `plantillas/infografia.html`                |
| Diseño del sitio           | `publico/css/estilo.css` y `scripts/lib/plantillas.mjs` |

El cron está en **UTC**. `0 11 * * 1` = lunes 06:00 en Lima (UTC−5).

---

## Revisión editorial antes de publicar

Si prefieres revisar antes de que algo salga al aire, quita los pasos 3 y 4 del
flujo semanal y deja que abra un Pull Request en su lugar: los JSON con estado
`resumido` son fáciles de leer y corregir. Al aprobar el PR, Netlify despliega.

Solo se publican los artículos con estado `resumido` o `publicado`; los `pendiente`
quedan fuera del sitio.

---

## Advertencias

- Los resúmenes se generan con asistencia de IA bajo instrucciones estrictas de no
  extrapolar. Aun así, **revisa cada tip contra el resumen original** antes de
  difundirlo. El campo `advertencia` de cada JSON registra la limitación principal.
- Respeta el derecho de autor: el sitio publica resúmenes propios y enlaza siempre
  al artículo original. No reproduzcas el texto completo de los artículos.
- NCBI limita a 3 peticiones/segundo sin clave de API y pide identificarse con
  herramienta y correo. Ambas cosas ya están implementadas en `scripts/lib/pubmed.mjs`.

## Licencia

Código: MIT. Contenido editorial: © sus autores.

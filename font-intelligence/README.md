# Font Intelligence Pipeline

Prometheus now has a local font-ingestion workspace rooted here.

## Where To Put Font Zips

- Default live source: `../FONTS`
- Optional staging mirror: `raw-zips/`

The pipeline reads `FONTS/` by default because that is the current source of truth. If you want to point the pipeline somewhere else, override `FONT_INTELLIGENCE_SOURCE_ZIP_DIR`.

## Workspace Layout

```text
font-intelligence/
  raw-zips/
  extracted-fonts/
  specimens/
  outputs/
    font-manifest.json
    font-descriptors.jsonl
    font-embeddings.jsonl
    font-ingestion-report.json
    font-compatibility-graph.json
```

## Commands

Run these from `remotion-app/`:

```bash
npm run ingest-fonts
npm run embed-fonts
npm run build-font-graph
npm run font-pipeline-all
```

Optional Milvus/Zilliz ingestion stays explicit:

```bash
npm run ingest-fonts-to-milvus
```

Use `--dry-run` to inspect the ingestion command without writing to Milvus:

```bash
npm run ingest-fonts-to-milvus -- --dry-run
```

## What Each Step Does

- `ingest-fonts`
  - scans the configured zip source
  - safely extracts only `.ttf`, `.otf`, `.woff`, and `.woff2`
  - ignores junk files such as `__MACOSX`, `.DS_Store`, and `thumbs.db`
  - deduplicates binaries by SHA256
  - probes metadata with `fontTools`
  - generates deterministic editorial descriptors
  - writes per-font HTML specimens

- `embed-fonts`
  - embeds descriptor text only
  - reuses Prometheus local embedding plumbing
  - defaults to `BAAI/bge-small-en-v1.5`
  - writes `outputs/font-embeddings.jsonl`

- `build-font-graph`
  - generates a typed, directed compatibility graph
  - keeps scoring heuristic-first
  - uses embeddings only as a light secondary signal

- `font-pipeline-all`
  - runs ingest, embed, and graph generation in sequence

## Outputs

- `outputs/font-manifest.json`
  - canonical face-level metadata plus inferred roles/personality
- `outputs/font-descriptors.jsonl`
  - one descriptor record per canonical font face
- `outputs/font-embeddings.jsonl`
  - local embedding vectors for descriptor text
- `outputs/font-ingestion-report.json`
  - zip counts, duplicate counts, failures, and warnings
- `outputs/font-compatibility-graph.json`
  - typed directed pairing edges with explainable score breakdowns

## Python Requirements

The metadata step expects:

```bash
python -m pip install fonttools brotli
```

If you use local Hugging Face embeddings, keep the existing Prometheus local embedding runtime available as well:

```bash
python -m pip install sentence-transformers
```

## Milvus / Zilliz

The font vectors are meant for a separate collection, not the existing motion-asset collection.

Default collection:

```text
prometheus_typography_fonts
```

The recommended flow is:

1. inspect local outputs first
2. sanity-check descriptors and graph quality
3. then run `ingest-fonts-to-milvus`

This keeps the typography intelligence pipeline inspectable and avoids polluting the vector store before the local artifacts look right.

# Sherlock Backend Font & Motion Audit (Corrected)

## 1. Executive Verdict (Revised)

- **Is the backend safe to visually test?** NO.
- **Are fonts likely to display correctly?** NO.
- **Is the intelligence actually wired into runtime?** NO. The system is split between a high-sophistication **"Rich Embedded Library"** (577 fonts, metadata-only) and a **"Standard Runtime Path"** (14 placeholder/hardcoded fonts) which are completely disconnected.
- **Is the system premium-grade yet, or still mostly theoretical?** Deeply theoretical. The metadata work is impressive (577 fonts analyzed), but the runtime bridge is missing.
- **Overall readiness percentage score:** 12% (Dropped from 15% due to confirmed disconnection from the rich library).
- **Rectification quality percentage score:** 5%.

## 2. Real Runtime Chain (Revised)

**Route/function -> service -> planner -> selector -> resolver -> generator -> payload field**

* **API Route (`/api/jobs`) -> `processJobPipeline`**
  * **Fake-wired:** Hardcodes `font_family_primary` as `"Anton", "Oswald", sans-serif`.
* **`selectRuntimeFontSelection` (Frontend Selector)**
  * **Fake-wired:** Locked to `TYPOGRAPHY_DOCTRINE_V1`, which only knows about 14 candidates. It ignores the 577-font rich library entirely.
* **Vector Retrieval Service (`/api/assets/vector-retrieve`)**
  * **Dead (for main pipeline):** The service is active and capable of searching the `prometheus_typography_fonts` collection, but it is **not called** by the standard rendering pipeline. It is only accessible via the experimental `CoreJudgmentEngine` (GOD).

---

## Correction: Intended Font Source Is Embedded Font Retrieval, Not Placeholder Font Names

### Where is the embedded font library?
- It exists as a 5MB metadata graph (`font-intelligence/outputs/font-compatibility-graph.json`) and a vector collection (`prometheus_typography_fonts`) containing **577 canonical fonts**.
- **Crucial Discovery:** The physical binary font files for these 577 fonts are **MISSING** from the repository. The ingestion report shows they were processed on a local machine (`C:\Users\HomePC\...`) and only the metadata artifacts were committed.

### Is it accessible from backend runtime?
- Yes, via `AssetRetrievalService` and `VectorRetrievalService`.

### Is it actually queried during preview/render generation?
- **NO.** The standard `processJobPipeline` does not make any calls to the vector retrieval service for font selection. It relies on deterministic metadata synthesis.

### Are old placeholder fonts still contaminating the runtime path?
- YES. Names like `Jugendreisen`, `Louize`, `Sokoli`, `Canela`, and `Satoshi` are hardcoded in `typography-doctrine.ts` and `font-runtime-registry.ts`.
- These placeholders **completely override** the rich 577-font library because the runtime selector only looks at the 14 doctrine candidates.

### Are the rich embedded fonts actually renderable today?
- **NO.** Even if the system selected one of the 577 fonts, there is:
  1. No binary file in the repo.
  2. No public URL mapping for the retrieved metadata.
  3. No `@font-face` generation logic connected to the retrieval results.

---

## 3. Font Display Audit

- **Are selected fonts actually loaded?** No.
- **Are selected fonts available as real font files?** No.
- **Is there fake font synthesis?** YES. The system requests `Jugendreisen` (placeholder), fails to find the file (which is disabled anyway in `house-font-registry.ts`), and the browser falls back.
- **Are weights like 400, 500, 600, 700, 800 mapped?** Only in metadata; physical mapping is impossible without assets.

## 4. Font Intelligence / Graph Audit

- **Is the font compatibility graph meaningful or inflated?** It is **SPLIT**.
  - The **Rich Graph** (577 nodes) is meaningful but **unwired**.
  - The **Runtime Graph** (14 nodes) is meaningful but **crippled** by missing assets and hardcoded bias.
- **Does the graph influence the selected font?** The 14-node runtime graph does, but it's a closed loop of placeholders.

## 5. Caption Editor / Typography Assignment Audit

- **Does it use the retrieved font library?** NO. It uses the `runtime-font-selector.ts`, which is locked to the 14 placeholder candidates.

---

## 11. Interconnection Audit (Updated)

- **Rich Font Library (577 fonts):** **Metadata-only / Dead** (Not used by standard runtime).
- **Typography Doctrine (14 fonts):** **Fully connected but broken** (Missing physical assets).
- **Vector Retrieval Router:** **Called but ignored** (Only used in GOD pre-judgment, not final render).

---

## 13. Previously “Rectified” Issues (Updated)

- **selected fonts not actually loading:** NOT FIXED.
- **rich font library existing but not loading:** **CONFIRMED.** The library exists as metadata (577 fonts), but the binary assets were never uploaded/committed.
- **placeholder-font contamination:** **CONFIRMED.** The system is still addicted to a few hardcoded names that don't exist.

---

## 14. Scoring (Revised)

- **Font retrieval wiring:** 0/100 (Exists but is not used in the rendering path).
- **Font asset renderability:** 0/100 (Rich library has no files; placeholders have no files).
- **Placeholder-font contamination risk:** 100/100 (Total contamination).
- **Runtime typography honesty:** 5/100 (System pretends to be intelligent while using hardcoded fallbacks).
- **Motion musicality:** 0/100.
- **Moment thinking:** 5/100.
- **Overall backend creative intelligence readiness:** 10/100.

## 15. Final Decision

- **SAFE TO BUILD:** NO
- **SAFE TO VISUALLY TEST:** NO
- **BIGGEST BLOCKER:** **Total asset/logic disconnection.** We have a 577-font intelligence system that is completely bypassed by a hardcoded 14-font placeholder system, and neither has actual font files.
- **SECOND BIGGEST BLOCKER:** The motion planner is still a "timestamp slave" using hardcoded array indices (`words[0]`, etc.).
- **MOST DANGEROUS FAKE-WIRED MODULE:** `pipeline.ts` and `metadata-catalog.ts`, which create the illusion of sophisticated typography parameters that are just hardcoded strings.
- **MOST IMPORTANT FILE TO FIX NEXT:** `backend/src/pipeline.ts` (to wire the retrieval service) and `backend/src/motion-plan.ts`.
- **EXACT NEXT PROMPT I SHOULD GIVE YOU:**
  `"Switch to engineering mode. First, fix the font delivery bridge. We need to ensure that when the Vector Retrieval Service finds a font in the 577-font collection, it can actually resolve to a public URL and a renderable @font-face, and that pipeline.ts actually calls this service instead of hardcoding 'Anton'."`

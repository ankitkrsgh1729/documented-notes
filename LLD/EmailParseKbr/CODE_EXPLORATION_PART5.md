## Part 5 — Mark-Complete Logic & Data Rules
Goal: understand how missing/complete status is computed against uploaded docs and metadata.

### 1) Entry points
- HTTP: `app/api/mark_complete/mark_complete_routes.py` → `run_mark_complete` → `mark_complete_service.mark_complete`.
- Scheduler path: `org_scheduler_service.process_pending_organizations` builds `MarkCompleteRequest` per org and calls `mark_complete`.

### 2) Mark-complete orchestration (`app/services/mark_complete_service.py`)
- Fetches inputs:
  - Need-info requirements (AICA) per requestFor: `fetch_requirements_need_info(org_id, request_for, dataTypeList)`.
  - Metadata cache: `fetch_metadata_cache_aica(org_id)` (previously processed docs).
  - Data room metadata: `fetch_metadata_data_room(org_id)` (uploaded docs).
- For each requestFor (BORROWER, LENDER):
  - Calls `mark_complete_func(data_reqs, metadata_cache, metadata_data_room, requestFor)`.
  - Saves responses back via `save_mark_complete_response`.
- Returns combined response: `{"company": borrower_results, "lender": lender_results}`.

### 3) Core evaluation logic (`mark_complete_func`)
- Builds lookup maps: `dataType -> docs in cache`, `dataType -> uploaded docs`.
- Initializes response object per requested doc with defaults (`NO_DATA`, missing ranges/months/as-at placeholders).
- Skips/ignores:
  - `datatype_no_process`, `mark_complete_ignore_datatype` constants (see `app/constants/mark_complete_constants.py`).
- Special handling by dataType:
  - **As-at types** (`datatype_as_at`): uses `as_at_doc_present` to compare as-of dates vs requested.
  - **Bank Statements**:
    - Matches by `identifier`; calculates missing ranges via `diffRangesCalc` against cache and uploaded docs.
    - Handles balance mismatches if present in metadata; sets `COMPLETE`, `PENDING`, or `NO_DATA` accordingly.
  - **Range-based types**: uses `range_based_doc_present` for coverage over date ranges.
  - **Validity-based types** (`datatype_validity_days`): uses `validity_days_doc_present`.
  - **Name-match types** (`datatype_name_match`): uses `name_match_doc_present`.
- Common helpers: `getMissingMonths`, `get_matching_docs_by_identifier`, and balance mismatch handling for bank statements.

### 4) Key helpers & constants
- `app/utils/mark_complete_utils.py`: functions above for range diffing, matching, validity checks.
- `app/constants/mark_complete_constants.py`: categorization of data types (range-based, name-match, validity-days, as-at, ignore lists).

### 5) Data flow with AICA
- Mark-complete reads requirements and metadata from AICA and writes back status per request/doc via `save_mark_complete_response`.
- The mark-complete trigger is invoked after saves in AICA (`DealRunnerServiceImpl` calls `triggerMarkCompleteForDataRequests`), so maintaining the canonical deduped requirements is critical.

### 6) Observability
- Extensive logging in `mark_complete_service` around each doc evaluation step; statuses are per-request entry.
- No Slack hook here; failures surface via logs/HTTP response.

### Next suggested read
- Cross-cutting utilities (Part 6): logging, auth, contextvars, timing, retry decorator, JSON repair.

## Mark-Complete: DB Touchpoints and Save Strategy
- Requirements pulled for evaluation
  - `fetch_requirements_need_info(org_id, request_for, dataTypeList)` → AICA endpoint → returns canonical dedup rows:
    - `request_for=LENDER` → `lender_deal_data_requirements`
    - `request_for=BORROWER` → `company_data_requirements`
  - Shapes mirror the deduped tables; these are the “need-info” rows to be marked complete/pending.
- Metadata sources
  - `fetch_metadata_cache_aica(org_id)` → reads `metadata_cache` (pre-processed doc metadata; identifiers, ranges, as-at, balance mismatches, etc.).
  - `fetch_metadata_data_room(org_id)` → reads uploaded doc metadata (data room / docs store).
- Processing (KubAIr `mark_complete_service.py`)
  - For each of BORROWER and LENDER:
    1) Call `mark_complete_func(requirements, metadata_cache, metadata_data_room, requestFor=...)`.
    2) `mark_complete_func` builds lookups per `dataType`, then applies rule blocks:
       - As-at types → compare requested as-at vs uploaded/cached.
       - Bank Statements → identifier match, missing ranges, balance mismatches.
       - Range-based → coverage over requested date spans.
       - Validity-based → validity window checks.
       - Name-match → name-based presence.
       - Ignore/no-process lists respected.
    3) Sets status per requirement (`COMPLETE`/`PENDING`/`NO_DATA`) plus missing ranges/months/as-at, mnemosyneDocIds, balanceMismatchRanges.
    4) Result arrays (borrower and lender) are persisted via `save_mark_complete_response(org_id, response_array)` → AICA save endpoint.
- Ingestion tie-in / cache refresh
  - AICA side (`DealRunnerServiceImpl.processMetadataCaches`): when ingestion runs (e.g., underwriting data availability), it clears old `metadata_cache` rows for `(orgId, dataType)`, marks them deleted, and inserts fresh cache rows per data range/identifier. KubAIr then consumes these caches via `fetch_metadata_cache_aica` during mark-complete.
- Save strategy and lineage
  - Requirements come from dedup tables (`lender_deal_data_requirements`, `company_data_requirements`); mark-complete does not mutate them—only writes status outputs via the save endpoint.
  - `metadata_cache` is refreshed by ingestion pipelines; KubAIr reads it, never writes it directly.
  - Upload metadata (`fetch_metadata_data_room`) is read-only from KubAIr’s perspective. 


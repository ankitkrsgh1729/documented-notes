## Part 3 — Persistence & Why Two Saves (Segregation vs Dedup)
This section answers:
- Why do we save in `query_segregation_agent` and then again in `run_deduplication_metadata_agent`?
- Why do we run dedup twice (first LENDER, then BORROWER)?
- How AICA handles these `requestFor` stages.

### 1) Two saves = two stages of the same payload
- Segregation save (raw):
  - Location: `app/agent/query_segregation_agent.py` (`save_requirements_to_db_api(res)`).
  - Purpose: persist the **raw, segregated** requirements (typically `requestFor = LENDER_RAW` or `BORROWER_CONFIG_RAW`) as soon as we split/normalize the email. This captures the original asks before dedup and makes them available for downstream review or subsequent runs.
- Dedup save (final):
  - Location: `app/services/deal_running_agent_service.py` inside `run_deduplication_metadata_agent` (`save_requirements_to_db_api(query_deduplication_result)`).
  - Purpose: persist the **deduplicated** requirements after rule-based + LLM dedup per `dataType`. This is the canonical set the business consumes for actioning and for subsequent dedup runs.

### 2) Why two dedup passes (LENDER → BORROWER)
- Sequence in `deal_running_agent_service.py`:
  - After segregation, `requestFor` is mapped via `REQUEST_FOR_MAP` from `LENDER_RAW` → `LENDER` and deduped.
  - The LENDER dedup result then maps `requestFor` from `LENDER` → `BORROWER` and is deduped again.
- Rationale:
  - Lender and borrower tracks can contain overlapping but not identical asks; each side needs its own deduplication and persistence stage.
  - The borrower stage starts from the already-clean lender output, so shared asks don’t reappear with different IDs/metadata.
  - AICA treats these stages differently (see below), so both passes must be persisted.

### 3) How AICA handles the stages (from `aica/.../DealRunnerServiceImpl.saveRequirementsForLenderAndBorrower`)
- Branches by `requestFor`:
  - `LENDER_RAW`: `handleRequirementForLenderRaw(...)` (store raw lender asks).
  - `BORROWER_CONFIG_RAW`: `handleRequirementForClarification(...)` (raw borrower clarifications).
  - `LENDER`: `handleRequirementSaveForLender(...)` (validated, dedup-aware lender save).
  - `BORROWER_CLARIFICATION` / `PNO_PEC`: `handleRequirementSaveForBorrower(...)`.
  - Else (borrower main path): `handleRequirementSaveForBorrower(...)` then `fetchRequirementsForBorrowerForDeduplication(...)`.
- The method finally triggers `triggerMarkCompleteForDataRequests(dataRequest)` to kick mark-complete flows. This is why the post-dedup save is important—the downstream completion logic operates on these records.

### 4) Mental model
- Segregation save = raw snapshot, party-tagged, before dedup.
- Dedup save(s) = cleaned, party-specific canonical sets that drive mark-complete and future dedup comparisons (`fetch_list_b_from_db` pulls from these stores).

### 5) Next read
- AICA service details: `aica/src/main/java/com/fl/aica/service/impl/DealRunnerServiceImpl.java` (see the `requestFor` branches above).
- KubAIr adapters: `app/utils/aica_utils.py`, `app/agent/Tools/deal_running_agent_tools.py`.
- Dedup internals: `run_deduplication_metadata_agent` in `app/services/deal_running_agent_service.py`.


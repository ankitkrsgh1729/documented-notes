## Part 2 — Agent Chain (Deal-Running) Quick Read
Goal: follow how each agent transforms the request; skim code in this order.

### 1) Pipeline coordinator
- `app/services/deal_running_agent_service.py`
  - Entry: `deal_running_agent()` → orchestrates the full lender+borrower path.
  - Key steps: email parse → merge/aggregate → segregation → dedup (LENDER) → dedup (BORROWER) → save to AICA.
  - Helpers: `run_deduplication_metadata_agent()` (rule-based + LLM dedup per dataType), `run_deduplication_for_datatype()`, `run_agent_for_borrower_clarification()` (borrower-specific path).

### 2) Agents (stage by stage)
- `app/agent/email_parsing_agent.py`
  - Model from env `EMAIL_PARSING_AGENT_MODEL`; prompt: `app/agent/Prompts/email_parsing_prompt.py`.
  - Cleans apostrophes via `preprocess_email_content`; ensures JSON via `validate_and_fix_json`.
- `app/agent/merge_and_aggregate_agent.py`
  - Prompt: `Prompts/merge_and_aggregate_prompt.py`; merges overlapping asks; drops `handoff_to` if present.
- `app/agent/query_segregation_agent.py`
  - Prompt: `Prompts/query_segregation_prompt.py`.
  - Tools: `fetch_doc_list_config` (Polus), `get_today_date`.
  - Saves requirements immediately via `save_requirements_to_db_api` and returns saved payload.
- `app/agent/query_deduplication_agent.py`
  - Prompt: `Prompts/query_deduplication_prompt.py`.
  - Tool: `fetch_list_b_from_db` (AICA) to compare against existing requirements.
  - Returns `responseQueryDeduplication` object.

### 3) Tools used by agents
- `app/agent/Tools/deal_running_agent_tools.py`
  - `fetch_list_b_from_db(orgId, lenderDealId, requestFor, dataType)`: pulls prior requirements for dedup.
  - `fetch_doc_list_config(pno_id, request_id)`: fetches document config from Polus (used during segregation).
  - `save_requirements_to_db(...)`: legacy tool; main flow now uses `save_requirements_to_db_api`.
- `app/utils/aica_utils.py`
  - `handle_rule_based_deduplication` (AICA API) then LLM dedup runs per dataType.
  - `save_requirements_to_db_api`: persists deduped requirements; returns error payload on failure.

### 4) Dedup logic path (important)
- In `run_deduplication_metadata_agent`:
  - Runs rule-based dedup (AICA) first.
  - Splits requests: those needing LLM dedup per `dataType` vs. pass-through.
  - Parallel `run_deduplication_for_datatype` tasks → gather → combine → save via `save_requirements_to_db_api`.
  - Two stages: first for `LENDER`, second for `BORROWER` (requestFor transitions via `REQUEST_FOR_MAP`).

### 5) Error/observability
- Retry decorator `retry_agent` wraps each agent (in `agent_utils`).
- Logging of token/model usage via `log_agent_execution_details`.
- Slack alerts on failures are triggered higher up (e.g., queue listener, routes).

### Next suggested read (Part 3)
- Persistence flows + external services: AICA/Polus adapters, error handling shapes, and how saved payloads look. This will also cover how mark-complete consumes stored requirements.


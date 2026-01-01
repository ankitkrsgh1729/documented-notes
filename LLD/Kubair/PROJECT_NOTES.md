## KubAIr — Quick Orientation
- FastAPI service that runs a chain of AI agents to turn messy lender/borrower emails into structured “requirements” that can be saved in AICA (internal services) and deduplicated across parties.
- Primary users: internal deal-team tools that submit emails via HTTP or SQS and consume normalized requirements + completion status.

## High-Level Flow (HLD)
```mermaid
flowchart TD
    Client[Clients / Upstream systems\nHTTP or SQS message] --> API[FastAPI\n/app/main.py]
    API -->|HTTP /agent/run/deal_running_agent\nor /agent/run/stage| Service[deal_running_agent_service]
    API -->|/agent/run/borrower_config_agent| Service
    API -->|/run/mark_complete| MarkComplete[mark_complete_service]
    subgraph Queueing
      SQS[(AWS SQS)] --> QueueListener[queue_listener.py\nsubprocess]
      QueueListener --> Service
    end
    Service --> EP[email_parsing_agent]
    EP --> MA[merge_and_aggregate_agent]
    MA --> QS[query_segregation_agent\nuses fetch_doc_list_config tool]
    QS -->|LENDER requests| QD1[query_deduplication_agent]
    QD1 -->|BORROWER stage| QD2[query_deduplication_agent]
    QD2 --> Save[save_requirements_to_db_api\n(AICA)]
    QS -.-> DBTools[fetch_doc_list_config (Polus)]
    QD1 -.-> DBFetch[fetch_list_b_from_db (AICA)]
    QD2 -.-> DBFetch
    Save --> Slack[[Slack alerts on failures]]
    MarkComplete --> AICA[AICA APIs\nneed info + metadata]
    MarkComplete --> Redis[(Redis queues/cache)]
    Scheduler[[Background scheduler\nprocess_pending_organizations]] --> MarkComplete
```

## Core Business Logic
- Goal: Normalize incoming deal emails into structured “requirements” for lenders/borrowers, deduplicate across stages, and track completion based on uploaded documents.
- Data flows from emails (or staged payloads) through a chain of specialized agents; each step cleans, aggregates, segments by party, and deduplicates before persisting to AICA services.
- Background workers:
  - `queue_listener.py` consumes SQS messages and runs the same agent chain.
  - `org_scheduler_service.py` runs periodically (if enabled) to trigger mark-complete checks for orgs buffered in Redis.
- Completion tracking (`mark_complete_service.py`) compares requested docs vs. cached/uploaded metadata and writes back status to AICA.

## Agentic Pipeline (deal_running_agent_service)
1. **Email Parsing Agent** (`email_parsing_agent.py`): Extracts `data_requests` and `clarifications` from raw email text. Cleans apostrophes first.
2. **Merge & Aggregate Agent** (`merge_and_aggregate_agent.py`): Consolidates overlapping asks from parsing output.
3. **Query Segregation Agent** (`query_segregation_agent.py`): Splits requests by party (lender/borrower variants) and by data type. Uses tool `fetch_doc_list_config` (Polus) and date helper `get_today_date`.
4. **Deduplication Agent (twice)** (`query_deduplication_agent.py`):
   - Stage 1 for `LENDER` requests.
   - Stage 2 for `BORROWER` using output of lender stage and `REQUEST_FOR_MAP` transition.
   - Each stage first runs rule-based dedup (`handle_rule_based_deduplication`), then LLM dedup per dataType (parallelized), then saves requirements via `save_requirements_to_db_api`.
   - Tool `fetch_list_b_from_db` (AICA) supplies historical requirements for comparison.
5. **Persistence & Alerts**: Results saved to AICA. Failures push Slack alerts to the configured channel.

## Other Key Flows
- **Borrower Config Agent**: Shortcut that runs the same parsing/merge/segregate/dedup path with `requestFor` set for borrower config use-cases.
- **Mark Complete**:
  - Fetches need-info requirements plus metadata (cache + data room) from AICA.
  - Per dataType logic (range coverage, identifier matching, validity windows, as-of dates, balance mismatches) to decide `COMPLETE/PENDING/NO_DATA`.
  - Persists results back to AICA; scheduler can invoke periodically based on Redis buffers.

## Entry Points
- HTTP (FastAPI):
  - `POST /agent/run/deal_running_agent` — main pipeline.
  - `POST /agent/run/stage` — run a specific stage from payload.
  - `POST /agent/run/borrower_config_agent` — borrower config shortcut.
  - `POST /run/mark_complete` (auth protected) — mark complete check.
- Queue:
  - SQS listener (separate process) polls `LISTNER_QUEUE_URL`; dispatches by `stage` field or defaults to full pipeline.

## External Dependencies & Configuration
- **LLM**: `agents` SDK using `AsyncOpenAI` client pointed to Anthropic base URL; models configured via env (`EMAIL_PARSING_AGENT_MODEL`, etc.). Tracing disabled.
- **Services**: AICA (requirements, dedup, metadata), Polus (doc list config).
- **Infra**: AWS SQS, Redis (org scheduling/buffering), Slack webhook (alerts).
- Env vars loaded in `app/core/config.py` (see `.env.example`); queue/scheduler toggled by `IS_QUEUE_ENABLED`, `IS_SCHEDULER_ENABLED`.

## Data Contracts (high level)
- Requests carry `emailMetadata` (`orgId`, `pnoId`, `lenderDealId`, etc.) and free-form `query` text.
- Agent outputs revolve around `data_requests` and `clarifications` lists; dedup stages may add `dataType`, `deduplicationType`, `requestFor`.
- Persistence calls expect payloads shaped for AICA endpoints; IDs (`requestFor` transitions via `REQUEST_FOR_MAP`) determine lender vs borrower writes.

## What to Read Next for LLD
- Agent prompts: `app/agent/Prompts/*.py` to see instructions/schema enforced by each agent.
- Tooling: `app/agent/Tools/deal_running_agent_tools.py`, `app/utils/aica_utils.py`.
- Dedup logic paths: `run_deduplication_metadata_agent` in `deal_running_agent_service.py`.
- Mark-complete rules: `app/utils/mark_complete_utils.py` and constants in `app/constants/mark_complete_constants.py`.


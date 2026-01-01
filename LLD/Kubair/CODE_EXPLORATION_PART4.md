## Part 4 — Queue & Scheduler Flows
Goal: understand non-HTTP ingress (SQS) and background scheduling.

### 1) SQS Listener (queue ingress)
- File: `app/queue/queue_listener.py`
- Setup:
  - SQS client with `LISTNER_QUEUE_URL`, `SQS_REGION`, `MAX_MESSAGES_TO_PROCESS` (from env via `app/core/config.py`).
  - Wrapper `consumer_wrapper` sets ContextVars (`request_id`, `org_id`, `pno_id`, `user_id`) per message and cleans them afterward.
- Flow:
  - `listen_to_queue()` polls SQS in a loop → `fetch_message()` → `process_messages()`.
  - `process_messages()` schedules `handle_message()` per message; deletes from queue early, then calls `process_message(body)`.
  - `process_message(body)` dispatches by `stage`:
    - `DEDUPLICATION_AGENT` → `run_deduplication_metadata_agent`
    - `BORROWER_AGENT` → `run_agent_for_borrower_clarification`
    - `LENDER_AGENT` or default → `deal_running_agent`
  - Errors trigger Slack alert (`send_slack_alert`).
- Startup:
  - In `app/main.py` lifespan: if `IS_QUEUE_ENABLED==1` and this worker is the first (`is_first_worker`), a subprocess starts running `start_listener()`.

### 2) Scheduler (mark-complete trigger)
- File: `app/services/org_scheduler_service.py`
- Flow:
  - Constants: `ORG_PROCESSING_QUEUE`, `MAX_ORGS_TO_PROCESS`, `PROCESSING_INTERVAL_SECONDS` (60s).
  - `process_pending_organizations()`:
    - Uses `RedisUtils.get_scheduled_orgs_to_process` to pull org IDs needing processing (not updated in the last minute).
    - For each org: reads buffer set (`org_buffer::<org_id>`), clears it, builds `MarkCompleteRequest`, and awaits `mark_complete()`.
    - If buffer stays empty after processing, removes org from the sorted set queue.
  - Scheduler loop:
    - In `app/main.py`, `run_scheduler()` runs forever (sleep interval = `PROCESSING_INTERVAL_SECONDS`); started if `IS_SCHEDULER_ENABLED==1` and this worker wins the scheduler lock.

### 3) Router wiring (where these become reachable)
- `app/main.py` includes:
  - `/agent/...` routes (HTTP entry).
  - Scheduler/queue are not HTTP-exposed; they start in lifespan based on env toggles.
  - Health routes at `/health`.

### 4) Why this matters
- SQS path uses the same services as HTTP, so behavior is consistent regardless of ingress.
- Early delete from SQS avoids reprocessing but relies on downstream not failing silently—hence Slack alerts.
- Scheduler drives automated mark-complete checks from buffered orgs; without it, only explicit HTTP calls to `/run/mark_complete` would process completion.

### Next suggested read (Part 5)
- Mark-complete logic details and data-type-specific rules (`mark_complete_service.py` and `app/utils/mark_complete_utils.py`).


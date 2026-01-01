## Part 6 — Cross-Cutting Utilities
Goal: understand shared plumbing that affects all flows (logging, auth, context, timing, retries, JSON repair).

### 1) Logging
- `app/utils/logger.py` (factory) + per-module loggers used everywhere.
- Key spots:
  - `app/main.py` middleware logs request start/end, adds timing headers.
  - Agents/services log entry/exit and errors; dedup path logs payloads when failures occur.
- Slack alerts: `app/utils/slack_alert_utils.py` used in queue listener and agent routes on exceptions.

### 2) Auth
- `app/utils/auth.py` — `requires_auth` dependency used by `run_mark_complete` route; basic auth creds from env (`BASIC_AUTH_USERNAME/PASSWORD`).

### 3) Context variables
- `app/utils/context.py` — `request_id_var`, `org_id_var`, `pno_id_var`, `user_id_var`, `request_start_time_var`.
- Set in:
  - HTTP middleware (`app/main.py`) from headers or generated UUID.
  - SQS path (`queue_listener.consumer_wrapper`) from message payload.
- Used for logging/observability and to pass IDs through downstream calls.

### 4) Timing & retries
- `app/utils/timing.py` — `@log_execution_time` decorator around key agent/service functions.
- `app/utils/agent_utils.py` — `@retry_agent` decorator wraps each agent run (default 1 retry).

### 5) JSON repair & preprocessing
- `app/utils/agent_utils.py`:
  - `preprocess_email_content`: strips apostrophes from input to reduce LLM JSON breakage.
  - `validate_and_fix_json`: multi-step JSON repair (strip code fences, comments, fix booleans, quotes, trailing commas, auto-balance braces, replace function calls like `get_today_date()`).
  - `log_agent_execution_details`: logs token/model usage from agent SDK responses.

### 6) Environment/config
- `app/core/config.py`: all env-driven settings (models, URLs, toggles `IS_QUEUE_ENABLED/IS_SCHEDULER_ENABLED`, Redis, Slack, auth).

### 7) Redis utilities
- `app/reddis/redis_utils.py`: wrappers for sorted sets/buffers; used by scheduler to pick orgs and manage buffers.

### Quick mental map
- Requests/messages set ContextVars → logging picks them up → timing wraps major functions → retries wrap agents → JSON repair cleans LLM outputs → Slack alerts on failures (queue/routes) → auth enforced on mark-complete route.


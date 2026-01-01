## How to View the HLD Diagram
- The diagram in `PROJECT_NOTES.md` is a Mermaid code block. You can render it via:
  - GitHub/Bitbucket/GitLab markdown preview (opens automatically when viewing the file in the repo UI).
  - VS Code / Cursor Markdown Preview (`Cmd+Shift+V`) with Mermaid support.
  - Online Mermaid Live Editor: copy the code block into https://mermaid.live/.

## Exploration Roadmap (overview)
- Part 1 (start here): API entry points and service orchestration.
- Part 2: Agent chain details (prompts + tools) for deal-running.
- Part 3: Dedup + persistence flows to AICA/Polus.
+- Part 4: Queue + scheduler paths (SQS, Redis buffers).
-- Part 5: Mark-complete logic and data matching rules.
- Part 6: Cross-cutting utilities (logging, auth, contextvars, timing).
We’ll create each part as a separate short note while walking the code.

## Part 1 — Entry Points to Read First
Goal: see how requests hit the system and how they fan into services/agents.

### 1) FastAPI wiring
- `app/main.py`: app creation, middleware, router inclusion, queue/scheduler startup.
  - Look at `process_pending_organizations()` invocation inside `run_scheduler()` (scheduler loop).
  - Router includes at the bottom (`app.include_router(...)`): health, agent, mark-complete.
- `app/api/agent_routes/deal_running_agent_routes.py`: primary HTTP endpoints for running agents and stage-specific execution.
- `app/api/mark_complete/mark_complete_routes.py`: mark-complete endpoint (auth-protected).

### 2) Service orchestrators
- `app/services/deal_running_agent_service.py`: core pipeline coordinator; shows call order and branching (lender → borrower dedup).
- `app/services/mark_complete_service.py`: high-level mark-complete orchestration.
- `app/services/org_scheduler_service.py`: background scheduler that triggers mark-complete for buffered orgs.

### 3) Background ingress
- `app/queue/queue_listener.py`: SQS listener wrapper; maps messages to the same services as HTTP.
- Feature toggles: `IS_QUEUE_ENABLED`, `IS_SCHEDULER_ENABLED` in `app/core/config.py`.

### 4) Configuration & constants
- `app/core/config.py`: env-driven settings (models, URLs, toggles).
- `app/constants/*.py`: requestFor mappings, headers, mark-complete constants.

### What to skim inside each
- For routes: path → function name → which service they call and what payload shape is expected.
- For services: sequence of agent calls, error handling, and side effects (DB/API writes, Slack alerts).
- For queue/scheduler: how messages are parsed, context set, and which service entry they hit.

### Next step after Part 1
- Move to Part 2: dive into the agent implementations and prompts to see how each stage transforms data (`email_parsing_agent`, `merge_and_aggregate_agent`, `query_segregation_agent`, `query_deduplication_agent`, plus their prompts and tools).


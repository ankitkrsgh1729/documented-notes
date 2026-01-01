## DB Tables (AICA) Used by KubAIr Flows — Tabular View
Goal: visualize keys, relationships, and when each table is touched (raw → dedup → mark-complete).

### Table: `entity_thread_relation`
| Column | Type/Notes |
|---|---|
| `id` (PK) | bigint |
| `lender_deal_id` | unique, used as FK target in lender tables |
| `pno_id` | text |
| `lender_id` | text |
| `org_id` | text |
| `email_thread_id` | text |
| `created_at`, `updated_at` | audit |

Flow/updates: created/updated when mapping an email thread to a deal (`DealRunnerServiceImpl.mapSubjectToDeal`). Required before lender-side saves.

### Table: `lender_raw_requirement` (raw lender asks)
| Column | Type/Notes |
|---|---|
| `id` (PK) | bigint |
| `lender_deal_id` (FK) | → `entity_thread_relation.lender_deal_id` |
| `message_id` | text |
| `data_type` | text |
| `original_query` | text |
| `meta_data` | jsonb |
| `source` | text |
| `created_at`, `updated_at` | audit |

Flow/updates: written by KubAIr segregation save (`requestFor=LENDER_RAW`) via AICA `handleRequirementForLenderRaw`. Linked later via raw↔dedup map.

### Table: `config_raw_requirement` (raw borrower/config)
| Column | Type/Notes |
|---|---|
| `id` (PK) | bigint |
| `org_id` | text |
| `reference_id` | text |
| `pno_id` | text |
| `data_type` | text |
| `products` | jsonb |
| `metadata` | jsonb |
| `original_query` | text |
| `source` | enum/text |
| `is_deleted` | boolean |
| `created_at`, `updated_at` | audit |

Flow/updates: written by KubAIr segregation save (`requestFor=BORROWER_CONFIG_RAW`) or config/manual clarifications. Linked later to borrower dedup via `company_data_config_mapping`.

### Table: `lender_deal_data_requirements` (dedup lender canonical)
| Column | Type/Notes |
|---|---|
| `id` (PK) | bigint |
| `lender_deal_id` (FK) | → `entity_thread_relation.lender_deal_id` |
| `data_type` | text |
| `original_query` | text |
| `meta_data` | jsonb |
| `status` | enum |
| `source` | enum |
| `remark`, `secondary_message` | text |
| `marked_at`, `marked_by`, `updated_by` | timestamps/text |
| `is_deleted`, `is_archived` | boolean |
| `created_at`, `updated_at`, `remark_updated_at/by` | audit |

Flow/updates: written by KubAIr dedup stage 1 (`requestFor=LENDER`) via AICA `handleRequirementSaveForLender`; linked to raw via `lender_deal_requirement_raw_map` and to borrower via `lender_deal_data_requirements_company_data_mapping`.

### Table: `company_data_requirements` (dedup borrower canonical)
| Column | Type/Notes |
|---|---|
| `id` (PK) | bigint |
| `org_id` | text |
| `pno_id` | text |
| `data_type` | text |
| `metadata` | jsonb |
| `status` | enum |
| `remark`, `secondary_message` | text |
| `marked_at`, `marked_by`, `updated_by` | timestamps/text |
| `original_query` | text |
| `source` | enum |
| `is_deleted`, `is_archived` | boolean |
| `created_at`, `updated_at`, `remark_updated_at/by` | audit |

Flow/updates: written by KubAIr dedup stage 2 (`requestFor=BORROWER`/`BORROWER_CLARIFICATION`) via AICA `handleRequirementSaveForBorrower`; linked to lender dedup via `lender_deal_data_requirements_company_data_mapping`; linked to config raw via `company_data_config_mapping`.

### Table: `lender_deal_requirement_raw_map` (raw ↔ lender dedup)
| Column | Type/Notes |
|---|---|
| `id` (PK) | bigint |
| `deal_requirement_id` (FK) | → `lender_deal_data_requirements.id` |
| `raw_requirement_id` (FK) | → `lender_raw_requirement.id` |
| `created_at`, `updated_at` | audit |

Flow/updates: populated when dedupbed lender rows are saved; preserves lineage to raw.

### Table: `lender_deal_data_requirements_company_data_mapping` (lender ↔ borrower)
| Column | Type/Notes |
|---|---|
| `id` (PK) | bigint |
| `deal_requirement_id` (FK) | → `lender_deal_data_requirements.id` |
| `company_data_requirement_id` (FK) | → `company_data_requirements.id` |
| `created_at`, `updated_at` | audit |

Flow/updates: populated when borrower dedup is saved; ties borrower rows to their lender counterparts.

### Table: `company_data_config_mapping` (borrower ↔ config raw)
| Column | Type/Notes |
|---|---|
| `id` (PK) | bigint |
| `company_data_requirement_id` (FK) | → `company_data_requirements.id` |
| `raw_requirement_id` (FK) | → `config_raw_requirement.id` |
| `created_at`, `updated_at` | audit |

Flow/updates: populated when borrower dedup is saved; links back to config/borr raw clarifications.

### Table: `metadata_cache`
| Column | Type/Notes |
|---|---|
| `id` (PK) | bigint |
| `org_id` | text |
| `data_type` | text |
| `meta_data` | jsonb |
| `is_deleted` | boolean |
| `created_at`, `updated_at` | audit |

Flow/updates: written by AICA ingestion/pipelines; read by KubAIr mark-complete to check document presence/metadata.

### Table: `deal_running_audit_log`
| Column | Type/Notes |
|---|---|
| `id` (PK) | bigint |
| `reference_id` | bigint (points to requirement row id) |
| `source_table` | text |
| `update_action` | text |
| `update_made_by` | text |
| `prev_val`, `current_val` | text |
| `metadata` | jsonb |
| `created_at` | audit |

Flow/updates: appended when requirement text/metadata changes; AICA side.

### Table: `follow_up_emails`
| Column | Type/Notes |
|---|---|
| `id` (PK) | bigint |
| `assessee_org_id` | text |
| `schedule_id` | text |
| `created_at`, `updated_at` | audit |

Flow/updates: written by AICA schedulers for follow-up reminders (peripheral to KubAIr).

### How Spring Data method names become SQL (example)
- Repository method: `findAllByDealRequirement_LenderDealIdAndDealRequirement_DataTypeAndDealRequirement_isDeletedFalse(lenderDealId, dataType)`
- Decomposition:
  - `findAll` → SELECT * FROM `lender_deal_requirement_raw_map` (entity `LenderRawDealReqMapping`)
  - `DealRequirement` → navigate the association field `dealRequirement` (entity `LenderDealDataRequirements`, table `lender_deal_data_requirements`)
  - `_LenderDealId` → predicate on `lender_deal_id = :lenderDealId`
  - `And DealRequirement_DataType` → predicate on `data_type = :dataType`
  - `And DealRequirement_isDeletedFalse` → predicate on `is_deleted = false`
- Effective JPQL:
  ```sql
  select m
  from LenderRawDealReqMapping m
  join m.dealRequirement d
  where d.lenderDealId = :lenderDealId
    and d.dataType = :dataType
    and d.isDeleted = false
  ```
- Why table names aren’t in the method: Spring Data uses Java property/association names and JPA annotations (`@Table`, `@Column`) on the associated entities to resolve actual tables/columns.

### When tables are written (KubAIr → AICA)
| Stage | requestFor | Tables written | Notes |
|---|---|---|---|
| Segregation save | `LENDER_RAW` | `lender_raw_requirement` | Raw snapshot from `query_segregation_agent` |
| Segregation save | `BORROWER_CONFIG_RAW` | `config_raw_requirement` | Config/clarification raw snapshot |
| Dedup stage 1 (lender) | `LENDER` | `lender_deal_data_requirements`, mapping to raw via `lender_deal_requirement_raw_map` | Output of `run_deduplication_metadata_agent` (lender) |
| Dedup stage 2 (borrower) | `BORROWER` / `BORROWER_CLARIFICATION` | `company_data_requirements`, mappings via `lender_deal_data_requirements_company_data_mapping`, `company_data_config_mapping` | Output of `run_deduplication_metadata_agent` (borrower) |
| Mark-complete | n/a | Writes responses back via AICA APIs; reads `company_data_requirements` / `lender_deal_data_requirements` + `metadata_cache` | Triggered after requirement saves or via scheduler |

### Data shapes (jsonb fields)
- `meta_data` / `metadata`: date ranges, identifiers, validity, links, as-at dates, etc. (LLM outputs + rule-based adjustments).
- `products` (config raw): product list from config-driven flows.

### Initial state & lineage
- Empty until KubAIr (or manual/config flows) writes raw/dedup rows.
- `entity_thread_relation` must exist for lender paths.
- Mapping tables populate on dedup saves to maintain lineage raw→dedup and lender→borrower/config.


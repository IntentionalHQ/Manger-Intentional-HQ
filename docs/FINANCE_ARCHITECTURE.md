# Finance architecture and database boundary

Intentional HQ owns the accounting system. Scurry remains a separate product
and reporting source.

## Data ownership

| Data | System of record | Access from HQ |
| --- | --- | --- |
| Journal entries, account balances, periods, receipts, projections | Intentional HQ Supabase | Server-side service role |
| Social connections, publishing records, saved operational queries | Intentional HQ Supabase | Server-side service role |
| Scurry users, tasks, and product activity | Scurry Supabase | Read-only reporting path |

Never run an `hq_*.sql` migration in Scurry and never create foreign keys
between the two projects. Cross-product links use stable external identifiers or
aggregate snapshots, not shared tables.

## Accounting controls

- Amounts are stored as integer cents.
- Every posted journal must contain at least two lines and balanced debits and
  credits.
- Posted entries and their lines are immutable. Corrections create a dated,
  linked reversal entry.
- Closed periods reject new or backdated journal entries.
- Period close rejects drafts and unreviewed imported transactions.
- Receipt files live in a private Storage bucket; relational metadata lives in
  `hq_receipts`.
- Database functions allocate journal numbers and post entries atomically.
- Browser clients never receive a service-role key. Owner authorization is
  checked in every finance API route before the server uses it.

This is a strong bookkeeping foundation, but it is not a substitute for a CPA.
Tax filings, payroll, depreciation, inventory, multi-currency accounting, and
formal GAAP adjustments remain outside the basic system.

## Scurry commercial-launch boundary

The current Scurry adapter can use a server-only service-role credential to
preserve the existing dashboard during migration. That credential is broad and
should be replaced before commercial launch.

The preferred production interface is a Scurry-owned reporting endpoint or a
dedicated read-only database role. It should expose only:

- task counts and recent task summaries for the signed-in owner;
- total/new/active user counts by reporting window;
- task created/open/completed counts by reporting window;
- generated-at timestamps and a stable schema version.

The reporting identity must not be able to update tasks, read authentication
secrets, inspect unrelated customer rows, or access Intentional HQ data. Rate
limit requests, log access, rotate the reporting credential independently, and
return aggregates wherever row-level detail is unnecessary.

## Projection relationship

Projection math is pure application code ported from the original app-cost
workbook. Forecast assumptions are stored separately from the ledger. Posted
expense totals feed the actual-versus-forecast view, but forecasts can never
modify accounting records.


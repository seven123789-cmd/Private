# Parallel development

- main: production, verified changes only.
- system-dev: database migrations, RPCs, business logic, attendance reconciliation.
- ui-dev: UI/UX, CSS, layout; preserve DOM IDs and RPC contracts.
- Integrate at milestones via reviewed pull requests; inspect both branches and resolve conflicts before production deployment. Refresh development branches after integration without overwriting unmerged work.
- Never commit employee records, credentials or attendance exports.
- HR master is authoritative; attendance imports are reconciliation inputs, not automatic HR updates.
- Scheduled HR changes remain dry-run until server-side validation, authorization and rollback tests pass. SQL migrations require explicit execution in Supabase; a Git merge does not deploy SQL.

# Email Tags

Tags are structured name/value labels attached at send time. Use tags to group related email activity by campaign, workflow, tenant, product area, or internal object ID.

## Good tag patterns

- `campaign=welcome`
- `workflow=checkout`
- `tenant=acme`
- `source=api`

Tags should be stable and low-cardinality when they are used for reporting. Avoid putting raw user input or secrets in tag values.

## Where tags help

Tags are most useful when support or operations needs to connect a dashboard email to the application event that created it. They complement idempotency keys: the idempotency key prevents duplicate acceptance, while tags help humans understand why a message exists.

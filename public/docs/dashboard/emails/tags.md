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


## Filtering logs and metrics by tag

Email tags can be used in the dashboard Logs and Metrics views.

- Logs accept tag name/value filters and return only request logs linked to emails with matching stored tags.
- Metrics accept tag name/value filters over the supported dashboard date presets: Today, Yesterday, Last 3 days, Last 7 days, Last 15 days, and Last 30 days.
- Metrics also show a bounded top-tag breakdown for the selected date range and tenant.

Tag filters are tenant-scoped and backed by bounded date ranges plus tag indexes. Keep reporting tags low-cardinality so dashboards remain fast.

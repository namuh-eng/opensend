# Pagination

OpenSend collection endpoints use cursor-style pagination where the route supports it. The API keeps pagination deliberately simple so self-hosted deployments and generated clients can share the same contract.

## Query parameters

- `limit`: maximum number of records to return. Use a modest value for dashboard or worker jobs instead of assuming every tenant has a small dataset.
- `after`: cursor returned from a previous page. Pass it back unchanged to retrieve the next page.

## Response shape

Collection responses generally include an array of records and a continuation indicator or cursor when more records are available. Exact field names are documented per endpoint and in `/openapi.json`.

```json
{
  "data": [
    { "id": "resource_123" }
  ],
  "hasMore": false
}
```

## Operational notes

Pagination is tenant-scoped. A cursor from one tenant or environment should never be reused for another tenant. If your worker exports large datasets, process one page at a time and persist progress between runs.

# Pagination

Pagination behavior for list endpoints.

## Pagination

List endpoints use cursor-style pagination where available. Prefer `limit` plus `after` for forward pagination. Responses may include `has_more` and a `data` array depending on the resource.

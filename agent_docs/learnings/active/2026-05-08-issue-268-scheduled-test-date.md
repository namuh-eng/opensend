---
date: 2026-05-08
issue: "#268"
type: mistake
promoted_to: null
---

## Scheduled email tests must not use near-term absolute future dates without freezing time

A PATCH scheduled email test used `2026-05-08T00:00:00.000Z` as a future
`scheduled_at` value. On 2026-05-08 that became past-dated and made
`make test` fail with a 422. If a test is not explicitly using fake timers,
construct scheduled timestamps relative to `Date.now()` so the validation window
stays future-dated across calendar time.

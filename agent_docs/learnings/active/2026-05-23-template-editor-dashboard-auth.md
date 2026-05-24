---
date: 2026-05-23
issue: "template-editor"
type: decision
promoted_to: null
---

## Template editor dashboard auth and React Email starter conversion

The dashboard template editor uses `/api/templates/:id` and `/api/templates/:id/publish`, so those app API routes must accept the same dashboard-session auth as `/api/templates` and `/api/templates/:id/preview`; API-key-only auth leaves authenticated dashboard users with a blank or unusable editor unless they also have `localStorage.api_key`.

When a React Email registry starter template is edited as custom HTML, clear the stored React Email renderer document on save. Otherwise the database `html` changes but preview/send continues rendering the registry template, making the editor appear to save while production output ignores the edited content.

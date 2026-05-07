# E2E testing standards

## Authenticated dashboard tests

Use the real Better Auth fixture instead of mocking `/api/auth/get-session`:

```ts
import { expect, test } from "./fixtures/auth";

test("dashboard flow", async ({ authenticatedPage, e2eUser, e2eDb }) => {
  await authenticatedPage.goto("/domains");
  await expect(authenticatedPage.getByRole("heading", { name: "Domains" })).toBeVisible();
});
```

The fixture creates a real Postgres `user` + `session`, signs the
`better-auth.session_token` cookie the same way Better Auth expects, adds it to
the browser context, and removes the auth rows after the test.

## Rules

- Server-rendered dashboard pages must use `authenticatedPage`; client route
  mocks do not authenticate `getServerSession()`.
- Keep auth backed by real `DATABASE_URL` rows and real browser cookies.
- Do not route-mock `/api/auth/get-session` for tests that need dashboard page
  or app-route authorization.
- Tests that create tenant-owned app rows should delete those rows in their own
  `finally` block using `e2eUser.id`.
- For SES-touching scenarios, run with a HOME that does not contain AWS
  credentials so local development uses the SES dev stub.

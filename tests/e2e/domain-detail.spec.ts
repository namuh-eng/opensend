// E2E category: smoke-only; domain detail tests require an existing domain fixture and skip explicitly when absent.
import { expect, test } from "./fixtures/auth";

test("domain detail page shows metadata and tabs", async ({
  authenticatedPage: page,
}) => {
  await page.goto("/domains");
  const domainLink = page.locator("table tbody tr td a").first();
  const hasDomains = (await domainLink.count()) > 0;

  test.skip(!hasDomains, "Seed a domain to run domain detail smoke E2E.");

  await domainLink.click();
  await expect(page.locator("text=DOMAIN EVENTS")).toBeVisible();
  await expect(page.locator("text=CREATED")).toBeVisible();
  await expect(page.locator("text=STATUS")).toBeVisible();
  await expect(page.locator("text=PROVIDER")).toBeVisible();
  await expect(page.locator("text=REGION")).toBeVisible();
  await expect(page.locator("text=Records")).toBeVisible();
  await expect(page.locator("text=Configuration")).toBeVisible();
});

test("domain detail tabs switch between Records and Configuration", async ({
  authenticatedPage: page,
}) => {
  await page.goto("/domains");
  const domainLink = page.locator("table tbody tr td a").first();
  const hasDomains = (await domainLink.count()) > 0;

  test.skip(!hasDomains, "Seed a domain to run domain detail smoke E2E.");

  await domainLink.click();
  await expect(page.locator("text=DNS Records")).toBeVisible();

  await page.click("text=Configuration");
  await expect(page.locator("text=Click Tracking")).toBeVisible();
  await expect(page.locator("text=Open Tracking")).toBeVisible();

  await page.click("text=Records");
  await expect(page.locator("text=DNS Records")).toBeVisible();
});

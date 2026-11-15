import { signOut } from "./helpers";
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
const fixture = "http://127.0.0.1:3201";
async function submitLogin(page: Page, profile = "operations") {
  const form = page.locator("form:visible");
  await form
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(`${profile}@example.test`);
  await form.locator('input[type="password"]').fill(randomUUID());
  await form.getByRole("button", { name: "Sign in", exact: true }).click();
}
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test("first sign-in from a retained anonymous workspace never redirects back to login", async ({
  page,
}) => {
  let signedIn = false;
  let heldProfileChecks = 0;
  let releaseChecks = () => {};
  const checksReleased = new Promise<void>((resolve) => {
    releaseChecks = resolve;
  });
  const postLoginPaths: string[] = [];
  page.on("response", (response) => {
    if (
      new URL(response.url()).pathname.endsWith("/api/v1/auth/login") &&
      response.status() === 200
    )
      signedIn = true;
  });
  page.on("framenavigated", (frame) => {
    if (signedIn && frame === page.mainFrame())
      postLoginPaths.push(new URL(frame.url()).pathname);
  });
  await page.route("**/api/backend/api/v1/auth/me", async (route) => {
    if (signedIn) {
      heldProfileChecks++;
      await checksReleased;
    }
    await route.continue().catch(() => {}); // A superseded request may already be canceled during cleanup.
  });
  try {
    // Deliberately keep the anonymous workspace in Next's router cache. A page.goto('/login') here hides the bug.
    await page.goto("/companies");
    await expect(page).toHaveURL(/\/login\?next=/);
    await submitLogin(page);
    await expect.poll(() => heldProfileChecks).toBeGreaterThan(0);
    await expect(
      page.getByRole("heading", { name: "Your workspace", exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/companies$/);
    expect(postLoginPaths.filter((path) => path === "/login")).toEqual([]);
  } finally {
    releaseChecks();
    await page.unrouteAll({ behavior: "wait" });
  }
  await expect(
    page.getByRole("link", {
      name: "Open workspace: Synthetic One",
      exact: true,
    }),
  ).toBeVisible();
  expect(postLoginPaths.filter((path) => path === "/login")).toEqual([]);
});

test("logout and a second sign-in use the current identity without reloading", async ({
  page,
}) => {
  await page.goto("/companies");
  await expect(page).toHaveURL(/\/login\?next=/);
  await submitLogin(page);
  await expect(
    page.getByRole("heading", { name: "Your workspace", exact: true }),
  ).toBeVisible();
  await signOut(page);
  await expect(page).toHaveURL(/\/login\?next=/);
  await submitLogin(page, "viewer");
  await expect(
    page.getByRole("heading", { name: "Your workspace", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Open workspace: Synthetic One", exact: true })
    .click();
  await page.goto("/companies/1/customers/new?branch=all");
  await expect(
    page.getByRole("heading", { name: "Access denied", exact: true }),
  ).toBeVisible();
});

import type { Page } from "@playwright/test";
export async function signOut(page: Page) {
  const button = page.getByRole("button", { name: "Sign out", exact: true });
  const menu = page.getByRole("button", { name: "Account menu", exact: true });
  await button.or(menu).first().waitFor({ state: "visible" });
  if (await button.isVisible()) await button.click();
  else {
    await menu.click();
    await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  }
}

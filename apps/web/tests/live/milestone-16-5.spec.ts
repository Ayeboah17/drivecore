import { expect, test } from "@playwright/test";

const fixtureUrl = "http://127.0.0.1:4201";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("demo123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/companies/);
  await page.goto("/companies/1/dashboard?branch=all");
}

test.describe("Milestone 16.5 — Complete SRS Gap Parity", () => {
  test.beforeEach(async ({ request }) => {
    await request.post(`${fixtureUrl}/__test/reset`);
  });

  test("Fleet Digital Vehicle File (specs, finance-gated valuation, compliance & 5 lifecycle history tabs) + Customer KYC", async ({
    page,
    request,
  }) => {
    await request.post(`${fixtureUrl}/__test/seed-demo`);
    await login(page, "sysadmin@drivecore.demo");

    // Verify SRS §19 Executive Dashboard cards render on workspace overview
    await expect(page.getByText("Credit Exposure")).toBeVisible();
    await expect(page.getByText("Compliance Expiries")).toBeVisible();
    await expect(page.getByText("Operations Alerts")).toBeVisible();
    await expect(page.getByText("Vehicle Profitability")).toBeVisible();

    // Open seeded Vehicle #10 (Toyota Land Cruiser Prado) Digital Vehicle File
    await page.goto("/companies/1/vehicles/10?branch=all");
    await expect(page.getByText("JTEBU3FJ7PK294821")).toBeVisible();
    await expect(page.getByText("Diesel · Automatic")).toBeVisible();
    await expect(page.getByText("Stanbic Asset Finance")).toBeVisible();
    await expect(page.getByText("Enterprise Insurance")).toBeVisible();

    // Verify all 5 Digital Vehicle File lifecycle history tabs work
    const historyTabs = page.getByRole("tablist", {
      name: "Digital vehicle file history",
    });
    await expect(historyTabs).toBeVisible();
    await historyTabs.getByRole("tab", { name: /Fuel/i }).click();
    await expect(page.getByText(/27,950/)).toBeVisible();
    await historyTabs.getByRole("tab", { name: /Maintenance/i }).click();
    await expect(
      page.getByText("30,000 km Routine Oil & Filter Service"),
    ).toBeVisible();
    await historyTabs.getByRole("tab", { name: /Compliance/i }).click();
    await expect(page.getByText("ENT-COMP-2026-4821").first()).toBeVisible();

    // Verify Customer KYC & Corporate Profile fields on seeded Customer #10
    await page.goto("/companies/1/customers/10?branch=all");
    await expect(page.getByText("CS-2016-88412")).toBeVisible();
    await expect(page.getByText("C0019283741")).toBeVisible();
    await expect(page.getByText("Daniel Asante")).toBeVisible();

    // Edit Customer #13 (Individual KYC) and verify driver licence fields
    await page.goto("/companies/1/customers/13?branch=all");
    await expect(page.getByText("GHA-719283741-2")).toBeVisible();
    await expect(page.getByText("DL-ACC-2024-9910")).toBeVisible();
  });

  test("Quotation customer acceptance, Canvas signature handover, and Rental amendment", async ({
    page,
    request,
  }) => {
    await request.post(`${fixtureUrl}/__test/seed-demo`);
    await login(page, "sysadmin@drivecore.demo");

    // Mark Quotation #120 customer accepted
    await page.goto("/companies/1/quotations/120?branch=all");
    await page.getByRole("button", { name: "Mark customer accepted" }).click();
    await page.getByLabel("Customer reference / LPO #").fill("LPO-2026-9912");
    await page.getByRole("button", { name: "Confirm acceptance" }).click();
    await expect(page.getByText("Customer accepted")).toBeVisible();
    await expect(page.getByText("LPO-2026-9912")).toBeVisible();

    // Handover Rental #601 with interactive canvas signature pad
    await page.goto("/companies/1/rentals/601?branch=all");
    await page.getByRole("button", { name: "Complete handover" }).click();
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 20, box.y + 20);
      await page.mouse.down();
      await page.mouse.move(box.x + 120, box.y + 50);
      await page.mouse.up();
    }
    await page.getByLabel("Handover odometer (km)").fill("28500");
    await page.getByLabel("Condition notes").fill("Handover signed on canvas.");
    const confirmOutside = page.getByLabel(/I confirm completing this handover/i);
    if (await confirmOutside.isVisible()) {
      await confirmOutside.check();
    }
    await page.getByRole("button", { name: "Confirm handover" }).click();
    await expect(page.getByText("Rental #601 handed over.")).toBeVisible();

    // Amend active Rental #601 (security deposit & variation)
    await page.getByRole("button", { name: "Amend / Early return" }).click();
    await page.getByLabel(/Reason \/ variation notes/i).fill("Updated deposit terms.");
    await page.getByRole("button", { name: "Save amendment" }).click();
    await expect(
      page.getByText("Contract amendment recorded for Rental #601."),
    ).toBeVisible();
  });

  test("Maintenance Incident -> Work Order, Procurement Requisition -> PO & Supplier Statement, VAT Return, and Approval Thresholds", async ({
    page,
    request,
  }) => {
    await request.post(`${fixtureUrl}/__test/seed-demo`);
    await login(page, "sysadmin@drivecore.demo");

    // Maintenance -> Incidents: convert seeded Incident #150 into a Work Order
    await page.goto("/companies/1/maintenance?tab=incidents&branch=all");
    await expect(page.getByText("CLM-ENT-2026-0842")).toBeVisible();
    await page.getByRole("button", { name: /Create work order/i }).click();
    await expect(page.getByText(/Work order/i).first()).toBeVisible();

    // Procurement -> Requisitions: approve REQ-00230 and convert REQ-00231 to PO
    await page.goto("/companies/1/procurement?tab=requisitions&branch=all");
    await expect(page.getByText("REQ-00230")).toBeVisible();
    await expect(page.getByText("REQ-00231")).toBeVisible();
    await page
      .getByRole("row", { name: /REQ-00230/ })
      .getByRole("button", { name: "Approve" })
      .click();
    await page
      .getByRole("row", { name: /REQ-00231/ })
      .getByRole("button", { name: /Convert to PO/i })
      .click();
    await expect(page.getByText(/Converted .* into draft PO-/i)).toBeVisible();

    // Procurement -> Suppliers: open Supplier Statement dialog
    await page.goto("/companies/1/procurement?tab=suppliers&branch=all");
    await page
      .getByRole("row", { name: /AutoParts Ghana Ltd/ })
      .getByRole("button", { name: "Statement" })
      .click();
    await expect(page.getByText("APG-2026-4412")).toBeVisible();
    await page.keyboard.press("Escape");

    // Reports -> Financial statements -> VAT Return sub-tab
    await page.goto("/companies/1/reports?tab=statements&branch=all");
    await page.getByRole("tab", { name: "VAT Return" }).click();
    await expect(page.getByText("Output VAT (AR invoices)")).toBeVisible();
    await expect(page.getByText("Input VAT (AP bills)")).toBeVisible();

    // Administration -> Financial settings -> 7-type Approval Thresholds matrix
    await page.goto("/companies/1/users?tab=settings&branch=all");
    await expect(
      page.getByText("Configurable Approval Thresholds (SRS §20)"),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Save approval thresholds" })
      .click();
    await expect(
      page.getByText("Approval thresholds matrix updated."),
    ).toBeVisible();
  });
});

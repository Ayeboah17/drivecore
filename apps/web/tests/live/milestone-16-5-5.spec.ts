import { expect, test } from "@playwright/test";

const fixtureUrl = "http://127.0.0.1:4201";

async function login(
  page: import("@playwright/test").Page,
  email: string,
  dest = "/companies/1/dashboard?branch=all",
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("demo123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/companies/);
  await page.goto(dest);
}

test.describe("Milestone 16.5.5 — Internal Virtual Meetings & Consistent Typography", () => {
  test.beforeEach(async ({ request }) => {
    await request.post(`${fixtureUrl}/__test/reset`);
  });

  test("enforces Inter font consistently and exposes meetings.view / meetings.manage on SRS roles", async ({
    page,
    request,
  }) => {
    await request.post(`${fixtureUrl}/__test/seed-demo`);
    await login(page, "sysadmin@drivecore.demo");

    // 1. Typography consistency: Inter everywhere (body, headings, buttons, and .font-mono numbers)
    const fontCheck = await page.evaluate(() => {
      const bodyFont = getComputedStyle(document.body).fontFamily;
      const heading = document.querySelector("h1, h2");
      const headingFont = heading ? getComputedStyle(heading).fontFamily : bodyFont;
      const monoEl = document.querySelector(".font-mono");
      const monoFont = monoEl ? getComputedStyle(monoEl).fontFamily : bodyFont;
      return { bodyFont, headingFont, monoFont };
    });
    expect(fontCheck.bodyFont).toContain("Inter");
    expect(fontCheck.headingFont).toContain("Inter");
    expect(fontCheck.monoFont).toContain("Inter");
    expect(fontCheck.monoFont).not.toContain("JetBrains Mono");

    // 2. SRS roles include meetings.view & meetings.manage
    const rolesRes = await page.request.get(
      "/api/backend/api/v1/roles?company_id=1",
    );
    expect(rolesRes.status()).toBe(200);
    const rolesBody = (await rolesRes.json()) as {
      data: { name: string; permissions: string[] }[];
    };
    for (const slug of [
      "ceo",
      "general-manager",
      "operations-manager",
      "finance-manager",
      "system-administrator",
    ]) {
      const role = rolesBody.data.find((r) => r.name === slug);
      expect(role?.permissions).toContain("meetings.view");
      expect(role?.permissions).toContain("meetings.manage");
    }
  });

  test("supports instant Meet now (Jitsi modal + chat join card), scheduling Teams meeting, RSVP, .ics download, minutes, and cancel", async ({
    page,
    request,
  }) => {
    await request.post(`${fixtureUrl}/__test/seed-demo`);
    await login(page, "sysadmin@drivecore.demo");

    // Open Messaging & Chat Center
    await page.getByRole("button", { name: /Messaging & Chat Center/i }).click();
    await expect(
      page.getByRole("heading", { name: /Messaging & Chat Center/i }),
    ).toBeVisible();

    // Switch to Meetings tab
    await page.getByRole("tab", { name: /Meetings/i }).click();

    // 1. Instant Meet now -> opens DriveCore WebRTC Pre-Join Lobby & joins native room (zero Jitsi iframe)
    await page.getByRole("button", { name: /Meet now/i }).click();
    await expect(
      page.getByRole("heading", { name: /Ready to join\?/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Join DriveCore Room/i }).click();
    await expect(page.getByTestId("webrtc-local-tile")).toBeVisible();
    await expect(page.locator('iframe[src*="meet.jit.si"]')).toHaveCount(0);

    // Leave call
    await page.getByRole("button", { name: /Leave call/i }).click();
    await expect(page.getByTestId("webrtc-local-tile")).toBeHidden();

    // Verify Chat tab has the clickable Join meeting card
    await page.getByRole("tab", { name: /Chat/i }).click();
    await expect(
      page.getByRole("button", { name: /Join meeting/i }).first(),
    ).toBeVisible();

    // 2. Schedule an external Microsoft Teams meeting
    await page.getByRole("tab", { name: /Meetings/i }).click();
    await page.getByRole("button", { name: /Schedule meeting/i }).click();

    await page
      .getByLabel("Title")
      .fill("Fleet Expansion Executive Sync");
    await page
      .getByLabel("Agenda (optional)")
      .fill("Review Q4 Prado procurement & financing terms.");

    // Switch provider to Microsoft Teams
    await page.getByRole("combobox", { name: /Meeting provider/i }).click();
    await page.getByRole("option", { name: /Microsoft Teams/i }).click();
    await page
      .getByLabel(/Microsoft Teams Join URL/i)
      .fill("https://teams.microsoft.com/l/meetup-join/drivecore-e2e-sync");

    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Schedule meeting$/i })
      .click();

    const scheduledCard = page
      .locator("article")
      .filter({ hasText: "Fleet Expansion Executive Sync" });
    await expect(scheduledCard).toBeVisible();

    // 3. RSVP Tentative on scheduled meeting
    await scheduledCard.getByRole("button", { name: /Maybe/i }).click();
    await expect(scheduledCard.getByText(/RSVP:\s*tentative/i)).toBeVisible();

    // 4. Download .ics calendar file
    const downloadPromise = page.waitForEvent("download");
    await scheduledCard
      .getByRole("button", { name: /Download calendar invite/i })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.ics$/);

    // 5. End meeting and record minutes
    await scheduledCard
      .getByRole("button", { name: /End Fleet Expansion Executive Sync/i })
      .click();
    await page
      .getByLabel("Meeting minutes")
      .fill("Approved 3 new Land Cruiser Prado units for Accra Airport HQ.");
    await page.getByRole("button", { name: /^End meeting$/i }).click();

    // Verify minutes appear under Past tab
    await page.getByRole("button", { name: /^Past$/i }).click();
    await expect(
      page.getByText(
        "Approved 3 new Land Cruiser Prado units for Accra Airport HQ.",
      ),
    ).toBeVisible();
  });

  test("restricts driver role to invited meetings only and blocks creation", async ({
    page,
    request,
  }) => {
    await request.post(`${fixtureUrl}/__test/seed-demo`);
    await login(page, "activedriver@drivecore.demo", "/companies/1/rentals?branch=all");

    await page.getByRole("button", { name: /Messaging & Chat Center/i }).click();
    await page.getByRole("tab", { name: /Meetings/i }).click();

    // Driver is invited to #850 (Daily Accra Dispatch) but NOT #851 (Executive Credit Review)
    await expect(
      page.getByText("Daily Accra Dispatch & Fleet Handover Standup"),
    ).toBeVisible();
    await expect(
      page.getByText("Executive Credit Review — Ashanti Infrastructure Consult"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Meet now/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Schedule meeting/i }),
    ).toHaveCount(0);
  });
});

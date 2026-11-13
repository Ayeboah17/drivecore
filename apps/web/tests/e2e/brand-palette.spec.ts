import { test, expect, type Page } from "@playwright/test";
import { buttonVariants } from "../../src/components/ui/button";

// Rendered text contrast, including alpha-composited backgrounds and selected states.
async function verifyTextContrast(page: Page) {
  const failures = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    const rgba = (color: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data].map(v => v / 255);
    };
    const blend = (front: number[], back: number[]) => front.slice(0, 3).map((v, i) => v * front[3] + back[i] * (1 - front[3]));
    const luminance = (rgb: number[]) => rgb.slice(0, 3).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const result: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || el.closest("[disabled], [aria-disabled=true], [aria-hidden=true], [data-brand-mark]")) continue;
      const text = [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent?.trim()).join(" ").trim();
      if (!text || !el.getBoundingClientRect().width) continue;
      const ancestors: Element[] = [];
      for (let a: Element | null = el; a; a = a.parentElement) ancestors.unshift(a);
      let bg = [1, 1, 1];
      for (const a of ancestors) bg = blend(rgba(getComputedStyle(a).backgroundColor), bg);
      const style = getComputedStyle(el);
      const fg = blend(rgba(style.color), bg);
      const [low, high] = [luminance(fg), luminance(bg)].sort((a, b) => a - b);
      const ratio = (high + .05) / (low + .05);
      const size = parseFloat(style.fontSize);
      const target = size >= 24 || (size >= 18.67 && parseInt(style.fontWeight) >= 700) ? 3 : 4.5;
      if (ratio < target) result.push(`${text.slice(0, 70)}: ${ratio.toFixed(2)} (${style.color})`);
    }
    return result;
  });
  expect(failures).toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  test(`PDF brand palette and screen contrast: ${theme}`, async ({ page }, testInfo) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.addInitScript((dark) => {
      document.addEventListener("DOMContentLoaded", () => document.documentElement.classList.toggle("dark", dark));
    }, theme === "dark");
    const capture = async (name: string) => {
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(document.getAnimations().filter(animation =>
          animation.effect?.getComputedTiming().iterations !== Infinity,
        ).map(animation => animation.finished.catch(() => undefined)));
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      });
      await verifyTextContrast(page);
      const overlay = await page.getByRole("dialog").count() > 0 || await page.locator("#brand-test-controls").count() > 0;
      // Flush the viewport compositor before Chromium expands a dark table for full-page capture.
      if (!overlay) await page.screenshot({ animations: "disabled" });
      await page.screenshot({ path: testInfo.outputPath(`${name}-${theme}.png`), fullPage: !overlay, animations: "disabled" });
    };
    await page.goto("/companies");
    await expect(page.getByTestId("departure-akwaaba-d01")).toBeVisible();
    await expect(page.locator("html")).toHaveCSS("color-scheme", theme);
    const tokens = await page.locator("html").evaluate(el => {
      const resolve = (token: string) => {
        const probe = document.createElement("span");
        probe.style.color = `var(${token})`;
        el.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      return { primary: resolve("--primary"), foreground: resolve("--primary-foreground") };
    });
    expect(tokens).toEqual({ primary: "rgb(215, 25, 32)", foreground: "rgb(255, 255, 255)" });
    await expect(page.locator("thead").first()).toHaveCSS("background-color", "rgb(40, 50, 58)");
    await expect(page.locator("thead th").first()).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(page.locator("thead tr").first()).toHaveCSS("height", "48px");
    await capture("dashboard");
    // Exercise exported component styles without adding a showcase route to the app.
    const styles = [
      { id: "primary", label: "Primary action", classes: buttonVariants() },
      { id: "compact", label: "Compact", classes: buttonVariants({ size: "sm" }) },
      { id: "icon", label: "+", classes: buttonVariants({ size: "icon" }) },
      { id: "danger", label: "Destructive action", classes: buttonVariants({ variant: "destructive" }) },
    ];
    await page.evaluate(items => {
      const tray = document.createElement("section");
      tray.id = "brand-test-controls";
      Object.assign(tray.style, { position: "fixed", bottom: "16px", right: "16px", zIndex: "100" });
      tray.className = "fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-card border bg-surface p-card";
      for (const item of items) {
        const button = document.createElement("button");
        button.dataset.testid = `brand-${item.id}`;
        button.className = item.classes;
        button.textContent = item.label;
        tray.append(button);
      }
      document.body.append(tray);
    }, styles);
    const primary = page.getByTestId("brand-primary");
    await expect(primary).toHaveCSS("background-color", "rgb(215, 25, 32)");
    await expect(primary).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(primary).toHaveCSS("height", "40px");
    await expect(primary).toHaveCSS("border-radius", "7px");
    await expect(page.getByTestId("brand-compact")).toHaveCSS("height", "28px");
    await expect(page.getByTestId("brand-icon")).toHaveCSS("width", "40px");
    await expect(page.getByTestId("brand-icon")).toHaveCSS("height", "40px");
    await primary.focus();
    await capture("control-focus");
    await primary.hover();
    await expect(primary).toHaveCSS("background-color", "rgb(184, 20, 26)");
    await page.locator("#brand-test-controls").evaluate(el => el.remove());
    await page.getByRole("button", { name: "Global search", exact: true }).click();
    await page.getByRole("dialog").getByRole("combobox").fill("Fleet");
    await expect(page.getByRole("option", { name: /Fleet/ })).toBeVisible();
    await capture("search-selected");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Operational notifications", exact: true }).click();
    await expect(page.getByText("Read-only mock items · Current branch scope", { exact: true })).toBeVisible();
    await capture("notifications");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Development user profile" }).click();
    await expect(page.getByText("Development identity · mock authentication only", { exact: true })).toBeVisible();
    await capture("profile");
    await page.keyboard.press("Escape");
    await page.goto("/companies/akwaaba/departures/akwaaba-d01?branch=all");
    await expect(page.getByRole("heading", { name: "AKW-26-4101", exact: true })).toBeVisible();
    await capture("departure");
    await page.goto("/companies/akwaaba/blockers/akwaaba-d01-b1?branch=all");
    await expect(page.getByRole("heading", { name: "No vehicle allocated", exact: true })).toBeVisible();
    await capture("blocker");
    for (const moduleKey of ["operations", "fleet", "customers", "rentals", "maintenance", "inventory", "finance", "procurement", "reports", "administration"]) {
      await page.goto(`/companies/akwaaba/modules/${moduleKey}?branch=all`);
      await expect(page.getByRole("heading", { name: new RegExp("is planned$") })).toBeVisible();
      await verifyTextContrast(page);
    }
    await capture("planned");
    await page.goto("/companies/akwaaba/dashboard?branch=accra");
    await expect(page.getByTestId("departure-akwaaba-d01")).toBeVisible();
    await capture("branch");
    await page.getByText("Development controls · simulated access", { exact: true }).click();
    await page.getByLabel("Mock scenario", { exact: true }).selectOption("departures-error");
    await expect(page.getByRole("heading", { name: "Departures unavailable" })).toBeVisible();
    const retry = page.getByRole("button", { name: "Try again", exact: true }).first();
    // Retry remains an outline action; verify its keyboard focus in both themes.
    await retry.focus();
    await capture("error-focus");
    await page.getByLabel("Mock scenario", { exact: true }).selectOption("empty");
    await expect(page.getByRole("heading", { name: "No departures today" })).toBeVisible();
    await capture("empty");
    await page.goto("/companies/unknown/dashboard?branch=all");
    await expect(page.getByRole("heading", { name: "Access denied or context unavailable" })).toBeVisible();
    await capture("denied");
    await page.goto("/companies/akwaaba/departures/unknown?branch=all");
    await expect(page.getByRole("heading", { name: "Departure unavailable", exact: true })).toBeVisible();
    await capture("unavailable");
    await page.goto("/companies/akwaaba/dashboard?branch=all");
    await expect(page.getByTestId("departure-akwaaba-d01")).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await capture("mobile");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await capture("mobile-navigation");
  });
}

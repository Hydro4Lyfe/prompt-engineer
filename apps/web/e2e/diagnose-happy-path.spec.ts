import { expect, test } from "@playwright/test";

/**
 * Single E2E happy-path test per decision 3B.
 *
 * Requires:
 *   - DIAGNOSE_ACCESS_TOKEN env var on the server
 *   - PLAYWRIGHT_ACCESS_TOKEN env var matching it (the test pastes it in)
 *   - ANTHROPIC_API_KEY on the server (real network call)
 *
 * Skip unless both envs are present so CI doesn't incur cost.
 */

const accessToken = process.env.PLAYWRIGHT_ACCESS_TOKEN;

test.skip(!accessToken, "PLAYWRIGHT_ACCESS_TOKEN not set");

test("paste → critique → apply → diff renders", async ({ page }) => {
  await page.goto("/diagnose");

  // Paste access token
  const tokenInput = page.locator("#diagnose-token");
  await tokenInput.fill(accessToken!);
  await tokenInput.press("Enter");

  // Paste a mediocre prompt + task
  await page.locator("#diagnose-prompt").fill("Write a function that processes users.");
  await page
    .locator("#diagnose-task")
    .fill(
      "Array of user objects with id, email, lastLoginAt. Return users who haven't logged in 30+ days."
    );

  await page.getByRole("button", { name: "Critique" }).click();

  // Suggestion cards appear
  const firstSuggestion = page.locator(".suggestion-card").first();
  await expect(firstSuggestion).toBeVisible({ timeout: 45_000 });

  // Apply first suggestion
  await firstSuggestion.click();

  // Diff renders — original + new columns both visible
  await expect(page.getByText("Original output")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("New output")).toBeVisible();
  await expect(page.locator(".diff-output").first()).not.toBeEmpty();
});

import { expect, test } from "@playwright/test";

test("watch page stays fail-closed when playback approval is not configured", async ({ page }) => {
  let mediaGrantRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/media/")) {
      mediaGrantRequests += 1;
    }
  });

  await page.goto("/watch/player-contract-test");

  await expect(page.getByText("Playback disabled", { exact: true })).toBeVisible();
  await expect(page.getByText("Secure delivery pending", { exact: true })).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.locator("source")).toHaveCount(0);
  expect(mediaGrantRequests).toBe(0);
  await expect(page.getByRole("link", { name: "Browse licensed catalogue" })).toHaveAttribute("href", "/movies");
});

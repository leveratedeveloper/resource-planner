import { expect, test } from "../support/testFixtures";
import { ResourcePlannerPage } from "../support/pages/resourcePlannerPage";

test.describe("Insights smoke", () => {
  test("@smoke @insights opens/closes panel and resolves a conflict by removing assignment", async ({
    page,
    request,
    dataManager,
  }) => {
    const app = new ResourcePlannerPage(page);
    const seeded = await dataManager.seedOverallocationConflict();

    await app.goto();
    await page.reload();
    await app.waitUntilLoaded();

    await app.openInsights();
    await expect(page.getByTestId("insights-panel")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("insights-panel")).toHaveClass(/translate-x-full/);

    await app.openInsights();
    await page.getByTestId("insights-refresh-button").click();
    await page.getByTestId("insights-tab-conflicts").click();

    const seededConflict = page
      .getByTestId("conflict-alert")
      .filter({ hasText: seeded.employee.fullName })
      .first();

    await expect(seededConflict).toBeVisible({ timeout: 20_000 });

    const beforeResponse = await request.get(`/api/assignments?employeeId=${seeded.employee.id}`);
    expect(beforeResponse.ok()).toBeTruthy();
    const beforeJson = (await beforeResponse.json()) as {
      success: boolean;
      data: Array<{ id: string }>;
    };
    expect(beforeJson.success).toBeTruthy();

    await seededConflict.getByTestId("conflict-remove-assignment").click();

    await expect
      .poll(
        async () => {
          const afterResponse = await request.get(`/api/assignments?employeeId=${seeded.employee.id}`);
          if (!afterResponse.ok()) {
            return -1;
          }

          const afterJson = (await afterResponse.json()) as {
            success: boolean;
            data: Array<{ id: string }>;
          };
          return afterJson.data.length;
        },
        {
          timeout: 15_000,
          intervals: [500, 1000, 2000],
        }
      )
      .toBe(beforeJson.data.length - 1);
  });
});

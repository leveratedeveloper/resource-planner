import { expect, test } from "../support/testFixtures";
import { ResourcePlannerPage } from "../support/pages/resourcePlannerPage";

test.describe("Setup and filters smoke", () => {
  test("@smoke setup dialog tabs and search fields render", async ({ page }) => {
    const app = new ResourcePlannerPage(page);
    await app.goto();

    await app.openSetup();

    await page.getByTestId("setup-tab-brands").click();
    await expect(page.getByTestId("brand-search-input")).toBeVisible();
    await page.getByTestId("brand-search-input").fill("e2e");

    await page.getByTestId("setup-tab-projects").click();
    await expect(page.getByTestId("project-search-input")).toBeVisible();
    await page.getByTestId("project-search-input").fill("e2e");

    await page.getByTestId("setup-tab-resources").click();
    await expect(page.getByTestId("resource-search-input")).toBeVisible();
    await page.getByTestId("resource-search-input").fill("e2e");

    await page.keyboard.press("Escape");
  });

  test("@smoke global search and filters are interactive", async ({ page, dataManager }) => {
    const app = new ResourcePlannerPage(page);
    const seeded = await dataManager.seedEmployeeWithProject();

    await app.goto();
    await page.reload();
    await app.waitUntilLoaded();

    const searchInput = page.getByTestId("filter-search-input");
    await searchInput.fill(seeded.employee.fullName);

    const matchingRow = page.getByTestId("resource-row").filter({ hasText: seeded.employee.fullName }).first();
    await expect(matchingRow).toBeVisible();

    await searchInput.clear();

    await page.getByTestId("filter-brand-trigger").click();
    const brandOptions = page.locator('[data-slot="select-item"]');
    const brandCount = await brandOptions.count();
    let selectedBrandText: string | null = null;
    for (let i = 0; i < brandCount; i += 1) {
      const option = brandOptions.nth(i);
      const text = ((await option.textContent()) ?? "").trim();
      if (!text.toLowerCase().startsWith("all brands")) {
        selectedBrandText = text;
        await option.click();
        break;
      }
    }

    if (selectedBrandText) {
      await expect(page.getByTestId("filter-brand-trigger")).toContainText(selectedBrandText);
    } else {
      await page.keyboard.press("Escape");
    }

    await page.getByTestId("filter-department-trigger").click();
    const deptOptions = page.locator('[data-slot="select-item"]');
    const deptCount = await deptOptions.count();
    let selectedDeptText: string | null = null;
    for (let i = 0; i < deptCount; i += 1) {
      const option = deptOptions.nth(i);
      const text = ((await option.textContent()) ?? "").trim();
      if (!text.toLowerCase().startsWith("all departments")) {
        selectedDeptText = text;
        await option.click();
        break;
      }
    }

    if (selectedDeptText) {
      await expect(page.getByTestId("filter-department-trigger")).toContainText(selectedDeptText);
    } else {
      await page.keyboard.press("Escape");
    }
  });
});

import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "../support/testFixtures";
import { ResourcePlannerPage } from "../support/pages/resourcePlannerPage";

test.describe("Accessibility smoke", () => {
  test("@smoke @a11y home screen has no critical violations", async ({ page }) => {
    const app = new ResourcePlannerPage(page);
    await app.goto();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("@smoke @a11y setup dialog has no critical violations", async ({ page }) => {
    const app = new ResourcePlannerPage(page);
    await app.goto();
    await app.openSetup();

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("@smoke @a11y insights panel has no critical violations", async ({ page }) => {
    const app = new ResourcePlannerPage(page);
    await app.goto();
    await app.openInsights();

    const results = await new AxeBuilder({ page })
      .include('[data-testid="insights-panel"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});

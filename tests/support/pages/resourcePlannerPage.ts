import { expect, type Locator, type Page } from "@playwright/test";

export class ResourcePlannerPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/");
    await this.waitUntilLoaded();
  }

  async waitUntilLoaded() {
    await expect(this.page.getByTestId("filter-bar")).toBeVisible();
    await expect(this.page.getByTestId("timeline-root")).toBeVisible();
  }

  async openSetup() {
    await this.page.getByTestId("open-setup-button").click();
    await expect(this.page.getByTestId("setup-tab-brands")).toBeVisible();
  }

  async openInsights() {
    await this.page.getByTestId("open-insights-button").click();
    await expect(this.page.getByTestId("insights-panel")).toBeVisible();
  }

  async expandResourceRowByName(fullName: string): Promise<Locator> {
    const row = this.page
      .getByTestId("resource-row")
      .filter({ hasText: fullName })
      .first();

    await expect(row).toBeVisible();

    const expandButton = row.getByTestId("resource-row-expand");
    if (await expandButton.count()) {
      await expandButton.click();
    }

    await expect(row.getByTestId("assign-project-button")).toBeVisible();
    return row;
  }

  async dragBetween(start: Locator, end: Locator) {
    const startBox = await start.boundingBox();
    const endBox = await end.boundingBox();

    if (!startBox || !endBox) {
      throw new Error("Unable to drag because one of the target elements has no bounding box.");
    }

    await this.page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, {
      steps: 8,
    });
    await this.page.mouse.up();
  }
}

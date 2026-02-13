import { expect, test } from "../support/testFixtures";
import { ResourcePlannerPage } from "../support/pages/resourcePlannerPage";

test.describe("Timeline flows", () => {
  test("@smoke @timeline create, edit, and delete assignment from drag interaction", async ({
    page,
    request,
    dataManager,
  }) => {
    const app = new ResourcePlannerPage(page);
    const seeded = await dataManager.seedEmployeeWithProject();

    await app.goto();
    await page.reload();
    await app.waitUntilLoaded();

    const row = await app.expandResourceRowByName(seeded.employee.fullName);
    const projectRow = row
      .locator(`[data-testid="project-row"][data-project-id="${seeded.placeholderAssignment.projectId}"]`)
      .first();

    await expect(projectRow).toBeVisible();

    const weekdayCells = projectRow.locator('[data-testid="timeline-project-cell"][data-cell-state="weekday"]');

    const cellCount = await weekdayCells.count();
    expect(cellCount).toBeGreaterThanOrEqual(2);

    await app.dragBetween(weekdayCells.nth(0), weekdayCells.nth(1));

    await expect(page.getByTestId("assignment-popover")).toBeVisible();
    await page.getByTestId("assignment-hours-input").fill("6");
    await page.getByTestId("assignment-workdays-input").fill("2");
    await page.getByTestId("assignment-save-button").click();

    const createdBlock = projectRow.getByTestId("assignment-block").first();
    await expect(createdBlock).toBeVisible();

    await createdBlock.hover();
    await createdBlock.getByTestId("assignment-edit-button").click();
    await expect(page.getByTestId("edit-assignment-dialog")).toBeVisible();

    await page.getByTestId("edit-assignment-hours").fill("7");
    await page.getByTestId("edit-assignment-note").fill("Updated by e2e");
    await page.getByTestId("edit-assignment-save").click({ force: true });
    await expect(page.getByTestId("edit-assignment-dialog")).toBeHidden();

    const assignmentResponse = await request.get(`/api/assignments?employeeId=${seeded.employee.id}`);
    expect(assignmentResponse.ok()).toBeTruthy();
    const assignmentJson = (await assignmentResponse.json()) as {
      success: boolean;
      data: Array<{ id: string; hoursPerDay: string; note: string | null }>;
    };

    expect(assignmentJson.success).toBeTruthy();
    const updatedAssignment = assignmentJson.data.find((assignment) => assignment.note === "Updated by e2e");
    expect(updatedAssignment).toBeTruthy();
    expect(updatedAssignment?.hoursPerDay).toBe("7");

    await createdBlock.hover();
    await createdBlock.getByTestId("assignment-edit-button").click();
    await page.getByTestId("edit-assignment-delete").click();
    await page.getByTestId("edit-assignment-delete-confirm").click();

    await expect(createdBlock).toBeHidden();
  });

  test("@smoke @timeline weekend confirmation and time-off creation", async ({ page, dataManager }) => {
    const app = new ResourcePlannerPage(page);
    const seeded = await dataManager.seedEmployeeWithProject();

    await app.goto();
    await page.reload();
    await app.waitUntilLoaded();

    const row = await app.expandResourceRowByName(seeded.employee.fullName);
    const projectRow = row
      .locator(`[data-testid="project-row"][data-project-id="${seeded.placeholderAssignment.projectId}"]`)
      .first();

    await expect(projectRow).toBeVisible();

    const weekendToggle = page.getByTestId("timeline-weekend-toggle");
    if ((await weekendToggle.textContent())?.includes("Show")) {
      await weekendToggle.click();
      await expect(weekendToggle).toContainText("Hide Weekends");
    }

    const weekendCells = projectRow.locator('[data-testid="timeline-project-cell"][data-cell-state="weekend"]');
    expect(await weekendCells.count()).toBeGreaterThan(0);

    let openedConfirmation = false;
    for (let i = 0; i < (await weekendCells.count()); i += 1) {
      const candidate = weekendCells.nth(i);
      await candidate.hover();
      const box = await candidate.boundingBox();
      if (!box) {
        continue;
      }
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      const confirmButton = page.getByTestId("weekend-schedule-confirm");
      if (await confirmButton.isVisible().catch(() => false)) {
        openedConfirmation = true;
        await confirmButton.click();
        break;
      }
    }

    expect(openedConfirmation).toBeTruthy();
    await expect(page.getByTestId("assignment-popover")).toBeVisible();
    await page.getByTestId("assignment-save-button").click();
    await expect(projectRow.getByTestId("assignment-block")).toBeVisible();

    const timeOffRow = row.getByTestId("timeoff-row");
    await expect(timeOffRow).toBeVisible();
    const timeOffWeekdays = timeOffRow.locator('[data-testid="timeline-timeoff-cell"][data-cell-state="weekday"]');

    expect(await timeOffWeekdays.count()).toBeGreaterThanOrEqual(2);
    await app.dragBetween(timeOffWeekdays.nth(0), timeOffWeekdays.nth(1));

    await expect(timeOffRow.getByTestId("assignment-block")).toBeVisible();
  });

  test("@nightly @timeline toggles timeline view modes and persists weekend preference", async ({ page }) => {
    const app = new ResourcePlannerPage(page);
    await app.goto();

    const dayCellsInWeek = page.getByTestId("timeline-day-cell");
    const weekCount = await dayCellsInWeek.count();
    expect(weekCount).toBeGreaterThan(0);

    await page.getByTestId("timeline-view-month").click();
    await expect(page.getByTestId("timeline-day-cell")).toHaveCount(30);

    await page.getByTestId("timeline-view-quarter").click();
    await expect(page.getByTestId("timeline-day-cell")).toHaveCount(13);

    await page.getByTestId("timeline-view-year").click();
    await expect(page.getByTestId("timeline-day-cell")).toHaveCount(52);

    await page.getByTestId("timeline-view-week").click();

    const weekendToggle = page.getByTestId("timeline-weekend-toggle");
    const initialText = (await weekendToggle.textContent()) ?? "";
    await weekendToggle.click();

    const toggledText = (await weekendToggle.textContent()) ?? "";
    expect(toggledText).not.toBe(initialText);

    await page.reload();
    await app.waitUntilLoaded();
    await expect(page.getByTestId("timeline-weekend-toggle")).toContainText(toggledText.trim());
  });
});

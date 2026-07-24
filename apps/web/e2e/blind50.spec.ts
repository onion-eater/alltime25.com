import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import {
  expect,
  test,
  type Page,
} from "@playwright/test";

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 568, height: 320 },
  { width: 700, height: 900 },
  { width: 701, height: 900 },
  { width: 768, height: 600 },
  { width: 768, height: 1024 },
  { width: 810, height: 1080 },
  { width: 820, height: 1180 },
  { width: 834, height: 1194 },
  { width: 844, height: 390 },
  { width: 1024, height: 600 },
  { width: 1024, height: 768 },
  { width: 1024, height: 1366 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 },
] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("blind50.help_seen", "1");
  });
});

test("comparison stays clean and centered at every required viewport", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("AllTime 25");
  await expect(
    page.getByRole("button", { name: "AllTime 25" }),
  ).toContainText("25ALLTIME");
  await expect(page.getByTestId("comparison-heading")).toBeVisible();

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    const isCompact =
      viewport.height <= 480 && viewport.width > viewport.height;
    const activeComparison = isCompact
      ? page.getByTestId("compact-comparison-matrix")
      : page.getByTestId("center-comparison-ledger");

    await expect(activeComparison).toBeVisible();
    await expect(
      isCompact
        ? page.getByTestId("center-comparison-ledger")
        : page.getByTestId("compact-comparison-matrix"),
    ).toBeHidden();

    const layout = await page.evaluate((compact) => {
      const byTestId = (id: string): HTMLElement => {
        const element = document.querySelector<HTMLElement>(
          `[data-testid="${id}"]`,
        );
        if (!element) throw new Error(`Missing ${id}`);
        return element;
      };
      const visible = (element: HTMLElement): boolean => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && rect.width > 0 && rect.height > 0;
      };
      const rect = (element: HTMLElement): DOMRect =>
        element.getBoundingClientRect();
      const ordered = [
        byTestId("app-header"),
        byTestId("comparison-heading"),
        byTestId(
          compact
            ? "compact-comparison-matrix"
            : "center-comparison-ledger",
        ),
        byTestId("vote-controls"),
        byTestId("comparison-tools"),
        byTestId("app-footer"),
      ].map(rect);
      const overlaps = ordered.slice(0, -1).some((current, index) => {
        const next = ordered[index + 1];
        return current.bottom > next.top + 1;
      });
      const clipped = Array.from(
        document.querySelectorAll<HTMLElement>(
          "button, h1, h2, th, td, strong, p, [role='status']",
        ),
      )
        .filter(visible)
        .filter(
          (element) => {
            const style = getComputedStyle(element);
            const clipsX = ["clip", "hidden"].includes(style.overflowX);
            const clipsY = ["clip", "hidden"].includes(style.overflowY);
            return (
              (clipsX && element.scrollWidth > element.clientWidth + 1) ||
              (clipsY && element.scrollHeight > element.clientHeight + 1)
            );
          },
        )
        .map((element) => element.textContent?.trim() ?? element.tagName);
      return {
        clipped,
        horizontalOverflow:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1,
        overlaps,
        voteBottom: rect(byTestId("vote-controls")).bottom,
        viewportHeight: window.innerHeight,
      };
    }, isCompact);

    expect(layout.horizontalOverflow, JSON.stringify(viewport)).toBe(false);
    expect(layout.overlaps, JSON.stringify(viewport)).toBe(false);
    expect(layout.clipped, JSON.stringify(viewport)).toEqual([]);
    expect(layout.voteBottom, JSON.stringify(viewport)).toBeLessThanOrEqual(
      layout.viewportHeight + 1,
    );

    if (!isCompact) {
      const geometry = await centeredGeometry(page);
      expect(geometry.marginDifference, JSON.stringify(viewport)).toBeLessThanOrEqual(1);
      expect(geometry.halfDifference, JSON.stringify(viewport)).toBeLessThanOrEqual(1);
      expect(geometry.labelCenterDifference, JSON.stringify(viewport)).toBeLessThanOrEqual(1);
      expect(geometry.leftHeaderDifference, JSON.stringify(viewport)).toBeLessThanOrEqual(1);
      expect(geometry.rightHeaderDifference, JSON.stringify(viewport)).toBeLessThanOrEqual(1);
      expect(geometry.voteLeftDifference, JSON.stringify(viewport)).toBeLessThanOrEqual(1);
      expect(geometry.voteWidthDifference, JSON.stringify(viewport)).toBeLessThanOrEqual(1);
    }
  }
});

test("comparison and dialogs pass automated accessibility checks", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const comparisonResults = await new AxeBuilder({ page }).analyze();
  expect(comparisonResults.violations).toEqual([]);

  await page.getByRole("button", { name: "How to play" }).click();
  await expect(page.getByRole("dialog", { name: "How it works" })).toBeVisible();
  const dialogResults = await new AxeBuilder({ page }).analyze();
  expect(dialogResults.violations).toEqual([]);
});

test("all preset and identity combinations switch safely", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Modes" })).toBeVisible();
  await expect(page.locator("main img")).not.toHaveCount(0);

  const combinations = [
    ["Top 10", "Normal", 25, 10],
    ["Top 10", "Blind", 25, 10],
    ["Top 25", "Blind", 50, 25],
    ["Top 25", "Normal", 50, 25],
    ["Top 50", "Normal", 100, 50],
    ["Top 50", "Blind", 100, 50],
  ] as const;
  for (const [preset, identity, poolSize, targetSize] of combinations) {
    const response = await switchMode(page, preset, identity);
    expect(response.pool_size).toBe(poolSize);
    expect(response.target_size).toBe(targetSize);
    expect(response.identity_mode).toBe(identity.toLowerCase());
    if (identity === "Blind") {
      await expect(page.locator("main img")).toHaveCount(0);
      expect(JSON.stringify(response.comparison).toLowerCase()).not.toContain(
        "image",
      );
    } else {
      await expect(page.locator("main img")).not.toHaveCount(0);
    }
  }
});

test("tablet result actions fill the bar in equal columns", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");
  await finishWith(page, "Player B");

  const actionGeometry = await page
    .getByRole("button", { name: "Share" })
    .locator("..")
    .evaluate((actions) => {
      const buttons = Array.from(actions.querySelectorAll("button")).map(
        (button) => button.getBoundingClientRect(),
      );
      const bounds = actions.getBoundingClientRect();
      return {
        leftGap: Math.abs(buttons[0].left - bounds.left),
        rightGap: Math.abs(buttons.at(-1)!.right - bounds.right),
        widthDifference: Math.abs(buttons[0].width - buttons[1].width),
      };
    });
  expect(actionGeometry.leftGap).toBeLessThanOrEqual(2);
  expect(actionGeometry.rightGap).toBeLessThanOrEqual(2);
  expect(
    Math.abs(actionGeometry.leftGap - actionGeometry.rightGap),
  ).toBeLessThanOrEqual(1);
  expect(actionGeometry.widthDifference).toBeLessThanOrEqual(1);
});

test("share downloads a valid 1080 by 1350 PNG", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await switchMode(page, "Top 10", "Normal");
  await finishWith(page, "Player B");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Share" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (path === null) throw new Error("Missing ranking image download.");
  const png = await readFile(path);

  expect(download.suggestedFilename()).toBe("alltime25-top-10.png");
  expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1350);
  await expect(page.getByRole("status")).toHaveText("Image downloaded.");
});

test("a full 100-player workflow survives recovery and cutoff ties", async ({
  context,
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await switchMode(page, "Top 50", "Normal");
  await castVote(page, "Player A");
  await castVote(page, "Player B");
  await castVote(page, "Tie");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith("/undo") && response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Undo" }).click(),
  ]);
  await page.reload();
  await expect(page.getByTestId("center-comparison-ledger")).toBeVisible();

  const secondTab = await context.newPage();
  await secondTab.goto("/");
  await expect(secondTab.getByTestId("center-comparison-ledger")).toBeVisible();
  await Promise.all([
    castVote(page, "Player A"),
    castVote(secondTab, "Player B"),
  ]);
  await secondTab.close();

  await finishWith(page, "Player B");
  await expect(page.getByRole("heading", { name: /Your NBA top 50/i })).toBeVisible();

  const portraits = page.locator("main img");
  expect(await portraits.count()).toBeGreaterThan(0);
  const firstRankingRow = portraits.first().locator("..").locator("..");
  const firstEra = firstRankingRow.locator("span");
  expect(await firstEra.count()).toBe(1);
  await expect(firstEra).toHaveCSS("text-transform", "none");

  await expect(page.getByRole("button", { name: "Export" })).toHaveCount(0);
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByRole("status")).not.toHaveText("");

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith("/sessions") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Start over" }).click(),
  ]);
  await expect(page.getByTestId("center-comparison-ledger")).toBeVisible();

  await finishWith(page, "Tie");
  await expect(page.getByText("1–10 of 100")).toBeVisible();
  await expect(page.getByText("T-1")).toHaveCount(10);
  for (let pageNumber = 1; pageNumber < 10; pageNumber += 1) {
    await page.getByRole("button", { name: "Next ranking page" }).click();
  }
  await expect(page.getByText("91–100 of 100")).toBeVisible();
  await expect(page.getByText("T-1")).toHaveCount(10);

  const portrait = page.locator("img").first();
  await expect(portrait).toBeVisible();
  expect(
    await portrait.evaluate((image) => ({
      fit: getComputedStyle(image).objectFit,
      position: getComputedStyle(image).objectPosition,
      naturalHeight:
        image instanceof HTMLImageElement ? image.naturalHeight : -1,
    })),
  ).toEqual({
    fit: "contain",
    position: "50% 50%",
    naturalHeight: 800,
  });
});

async function castVote(
  page: Page,
  label: "Player A" | "Player B" | "Tie",
): Promise<void> {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/votes") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: label, exact: true }).click(),
  ]);
}

async function switchMode(
  page: Page,
  preset: "Top 10" | "Top 25" | "Top 50",
  identity: "Normal" | "Blind",
): Promise<Record<string, unknown>> {
  await page.getByRole("button", { name: "Modes" }).click();
  const dialog = page.getByRole("dialog", { name: "Modes" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: preset }).check();
  await dialog.getByRole("radio", { name: identity }).check();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/sessions") &&
      response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Start new ranking" }).click();
  const response = await responsePromise;
  await expect(dialog).toBeHidden();
  return response.json() as Promise<Record<string, unknown>>;
}

async function finishWith(
  page: Page,
  label: "Player A" | "Player B" | "Tie",
): Promise<void> {
  for (let vote = 0; vote < 1_000; vote += 1) {
    if (
      await page
        .getByRole("heading", { name: /Your NBA top \d+\./i })
        .isVisible()
    ) {
      return;
    }
    await castVote(page, label);
  }
  throw new Error("Ranking did not complete within 1,000 votes.");
}

async function centeredGeometry(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const get = (testId: string): DOMRect => {
      const element = document.querySelector<HTMLElement>(
        `[data-testid="${testId}"]`,
      );
      if (!element) throw new Error(`Missing ${testId}`);
      return element.getBoundingClientRect();
    };
    const ledger = get("center-comparison-ledger");
    const vote = get("vote-controls");
    const left = get("player-a-header");
    const label = get("stat-header");
    const right = get("player-b-header");
    const firstRow = document.querySelector<HTMLTableRowElement>(
      '[data-testid="center-comparison-ledger"] tbody tr:nth-child(2)',
    );
    if (!firstRow) throw new Error("Missing comparison row");
    const cells = Array.from(firstRow.children).map((cell) =>
      cell.getBoundingClientRect(),
    );
    const center = (box: DOMRect): number => box.left + box.width / 2;
    return {
      marginDifference: Math.abs(
        ledger.left - (window.innerWidth - ledger.right),
      ),
      halfDifference: Math.abs(left.width - right.width),
      labelCenterDifference: Math.abs(center(label) - window.innerWidth / 2),
      leftHeaderDifference: Math.abs(center(left) - center(cells[0])),
      rightHeaderDifference: Math.abs(center(right) - center(cells[2])),
      voteLeftDifference: Math.abs(vote.left - ledger.left),
      voteWidthDifference: Math.abs(vote.width - ledger.width),
    };
  });
}

import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import {
  expect,
  test,
  type Page,
} from "@playwright/test";

interface StoredSession {
  id: string;
  preset: "top_10" | "top_25" | "top_50";
  identityMode: "normal" | "blind";
  playerOrder: string[];
  outcomes: ("better" | "tie" | "worse")[];
  revision: number;
}

const SESSION_KEY = "alltime25.ranking-session.v1";

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

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.tags.includes("@first-run")) return;
  await page.addInitScript(() => {
    localStorage.setItem("alltime25.help_seen", "1");
  });
});

test(
  "first visit chooses a mode before any ranking is created",
  { tag: "@first-run" },
  async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/");

    const dialog = page.getByRole("dialog", { name: "How it works" });
    await expect(dialog).toBeVisible();
    expect(
      await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY),
    ).toBeNull();
    await expect(
      dialog.getByRole("button", { name: "Close instructions" }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("radio", { name: "Top 25" })).toBeChecked();
    await expect(dialog.getByRole("radio", { name: "Normal" })).toBeChecked();

    const onboardingA11y = await new AxeBuilder({ page }).analyze();
    expect(onboardingA11y.violations).toEqual([]);

    await dialog.getByRole("radio", { name: "Top 10" }).check();
    await dialog.getByRole("radio", { name: "Blind" }).check();
    await expect(dialog.getByText("Compare blind résumés")).toBeVisible();
    const start = dialog.getByRole("button", { name: "Start ranking" });
    await start.scrollIntoViewIfNeeded();
    const dialogBounds = await dialog.boundingBox();
    const startBounds = await start.boundingBox();
    if (dialogBounds === null || startBounds === null) {
      throw new Error("Missing onboarding geometry.");
    }
    expect(dialogBounds.y).toBeGreaterThanOrEqual(17);
    expect(dialogBounds.y + dialogBounds.height).toBeLessThanOrEqual(551);
    expect(startBounds.y + startBounds.height).toBeLessThanOrEqual(
      dialogBounds.y + dialogBounds.height,
    );
    await start.click();

    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("center-comparison-ledger")).toBeVisible();
    const created = await storedSession(page);
    expect(created.preset).toBe("top_10");
    expect(created.identityMode).toBe("blind");
    await expect(page.locator("main img")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("Test Player");

    await page.reload();
    await expect(page.getByTestId("center-comparison-ledger")).toBeVisible();
    expect((await storedSession(page)).id).toBe(created.id);
    await expect(page.locator("main img")).toHaveCount(0);

    await page.getByRole("button", { name: "How to play" }).click();
    const laterHelp = page.getByRole("dialog", { name: "How it works" });
    await expect(
      laterHelp.getByRole("button", { name: "Close instructions" }),
    ).toBeVisible();
    await expect(laterHelp.getByRole("radio")).toHaveCount(0);
  },
);

test(
  "onboarding preserves a ranking created in another tab",
  { tag: "@first-run" },
  async ({ context, page }) => {
    await page.goto("/");
    const secondTab = await context.newPage();
    await secondTab.goto("/");

    const firstDialog = page.getByRole("dialog", { name: "How it works" });
    const secondDialog = secondTab.getByRole("dialog", {
      name: "How it works",
    });
    await expect(firstDialog.getByRole("radio")).toHaveCount(5);
    await expect(secondDialog.getByRole("radio")).toHaveCount(5);

    await firstDialog.getByRole("radio", { name: "Top 10" }).check();
    await firstDialog.getByRole("radio", { name: "Blind" }).check();
    await firstDialog
      .getByRole("button", { name: "Start ranking" })
      .click();

    await expect(firstDialog).toBeHidden();
    const created = await storedSession(page);
    await expect(secondDialog.getByRole("radio")).toHaveCount(0);
    await expect(
      secondDialog.getByRole("button", { name: "Close instructions" }),
    ).toBeVisible();
    expect((await storedSession(secondTab)).id).toBe(created.id);

    await secondDialog
      .getByRole("button", { name: "Close instructions" })
      .click();
    await expect(
      secondTab.getByTestId("center-comparison-ledger"),
    ).toBeVisible();
    expect((await storedSession(secondTab)).id).toBe(created.id);
  },
);

test("comparison stays clean and centered at every required viewport", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("AllTime 25");
  await expect(
    page.getByRole("button", { name: "AllTime 25" }),
  ).toContainText("25ALLTIME");
  await expect(page.getByTestId("comparison-heading")).toBeVisible();
  expect(
    await page
      .getByTestId("center-comparison-ledger")
      .locator("tbody > tr:first-child th")
      .allTextContents(),
  ).toEqual(["Career", "Honors", "Regular Season", "Playoffs"]);

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
      const navigation = document.querySelector<HTMLElement>(
        '[aria-label="Main navigation"]',
      );
      if (!navigation) throw new Error("Missing main navigation");
      const voteButton = Array.from(
        navigation.querySelectorAll<HTMLButtonElement>("button"),
      ).find((button) => button.textContent?.trim() === "Vote");
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
      const tools = rect(byTestId("comparison-tools"));
      const footer = rect(byTestId("app-footer"));
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
        navigationOverflow:
          navigation.scrollWidth > navigation.clientWidth + 1,
        overlaps,
        toolsFooterGap: footer.top - tools.bottom,
        voteBottom: rect(byTestId("vote-controls")).bottom,
        voteVisible: voteButton ? visible(voteButton) : false,
        viewportHeight: window.innerHeight,
      };
    }, isCompact);

    expect(layout.horizontalOverflow, JSON.stringify(viewport)).toBe(false);
    expect(layout.navigationOverflow, JSON.stringify(viewport)).toBe(false);
    expect(layout.overlaps, JSON.stringify(viewport)).toBe(false);
    expect(layout.clipped, JSON.stringify(viewport)).toEqual([]);
    expect(layout.toolsFooterGap, JSON.stringify(viewport)).toBeGreaterThanOrEqual(
      12,
    );
    expect(layout.voteBottom, JSON.stringify(viewport)).toBeLessThanOrEqual(
      layout.viewportHeight + 1,
    );
    expect(layout.voteVisible, JSON.stringify(viewport)).toBe(true);

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

test("the branded favicon and minimal footer work without navigation", async ({
  page,
}) => {
  await page.goto("/");

  const iconHref = await page
    .locator('link[rel="icon"]')
    .getAttribute("href");
  expect(iconHref).toBeTruthy();
  const iconResponse = await page.request.get(
    new URL(iconHref!, page.url()).toString(),
  );
  expect(iconResponse.ok()).toBe(true);
  expect(iconResponse.headers()["content-type"]).toContain("image/svg+xml");

  const footer = page.getByTestId("app-footer");
  await expect(footer).toContainText("© 2026 AllTime25");
  await expect(footer).toContainText("Not affiliated with the NBA");
  await expect(footer).not.toContainText("NBA.com data");
  await expect(footer).not.toContainText("Frozen 2026-06-30");

  await footer.getByRole("button", { name: "Data" }).click();
  await expect(page.getByRole("dialog", { name: "Data" })).toBeVisible();
  await page
    .getByRole("dialog", { name: "Data" })
    .getByRole("button", { name: "Close Data" })
    .click();

  await footer.getByRole("button", { name: "Privacy" }).click();
  const privacy = page.getByRole("dialog", { name: "Privacy" });
  await expect(privacy).toContainText(
    "Your ranking stays in this browser and is not uploaded",
  );
  const privacyResults = await new AxeBuilder({ page }).analyze();
  expect(privacyResults.violations).toEqual([]);
});

test("the static runtime never requests an API", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) {
      apiRequests.push(request.url());
    }
  });

  await page.goto("/");
  await expect(page.getByTestId("center-comparison-ledger")).toBeVisible();
  await castVote(page, "Player A");
  await mutateAndWait(
    page,
    () => page.getByRole("button", { name: "Undo" }).click(),
  );
  await switchMode(page, "Top 10", "Blind");

  expect(apiRequests).toEqual([]);
});

test("corrupt progress is preserved until Restart explicitly replaces it", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "{broken");
  }, SESSION_KEY);
  await page.goto("/");

  await expect(page.getByText(/invalid JSON/i)).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY),
  ).toBe("{broken");

  await page.getByRole("button", { name: "Restart" }).click();
  await page
    .getByRole("dialog", { name: "Restart" })
    .getByRole("button", { name: "Restart ranking" })
    .click();

  await expect(page.getByTestId("center-comparison-ledger")).toBeVisible();
  expect((await storedSession(page)).preset).toBe("top_25");
});

test("a rejected storage write leaves the displayed comparison untouched", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("center-comparison-ledger")).toBeVisible();
  const before = await storedSession(page);
  const headingBefore = await page
    .getByTestId("center-comparison-ledger")
    .locator("thead")
    .textContent();
  await page.evaluate((key) => {
    const original = window.localStorage.setItem.bind(
      window.localStorage,
    );
    Storage.prototype.setItem = function setItem(
      name: string,
      value: string,
    ): void {
      if (name === key) {
        throw new DOMException("Full", "QuotaExceededError");
      }
      original.call(this, name, value);
    };
  }, SESSION_KEY);

  await page.getByRole("button", { name: "Player A", exact: true }).click();

  await expect(page.getByRole("status")).toHaveText("Retry");
  expect((await storedSession(page)).revision).toBe(before.revision);
  expect(
    await page
      .getByTestId("center-comparison-ledger")
      .locator("thead")
      .textContent(),
  ).toBe(headingBefore);
});

test("catalog loading failures keep Retry available", async ({ page }) => {
  await page.route("**/data/current.json", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("/");

  await expect(page.getByText(/Unable to load catalog \(503\)/i)).toBeVisible();
  await page.unroute("**/data/current.json");
  await page.getByRole("button", { name: "Retry" }).click();

  await expect(page.getByTestId("center-comparison-ledger")).toBeVisible();
});

test("all preset and identity combinations switch safely", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Restart" })).toBeVisible();
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
    const session = await switchMode(page, preset, identity);
    expect(session.playerOrder).toHaveLength(poolSize);
    expect(targetSizeFor(session.preset)).toBe(targetSize);
    expect(session.identityMode).toBe(identity.toLowerCase());
    if (identity === "Blind") {
      await expect(page.locator("main img")).toHaveCount(0);
      await expect(page.locator("main")).not.toContainText("Test Player");
    } else {
      await expect(page.locator("main img")).not.toHaveCount(0);
    }
  }
});

test("the current ranking can be reviewed and resumed safely", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Ranking" }).click();
  await expect(
    page.getByRole("heading", { name: "Your ranking so far." }),
  ).toBeVisible();
  await expect(page.locator("main img")).not.toHaveCount(0);
  const resume = page.getByRole("button", { name: "Resume" });
  await expect(resume).toHaveCSS("background-color", "rgb(251, 250, 246)");
  expect(
    await resume.evaluate((button) => button.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(48);
  await resume.click();
  await expect(page.getByTestId("center-comparison-ledger")).toBeVisible();
  await castVote(page, "Player A");
  const undo = page.getByRole("button", { name: "Undo" });
  await expect(undo).toBeEnabled();
  await expect(undo).toHaveCSS("border-top-style", "solid");
  expect(
    await undo.evaluate((button) => button.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(24);

  await switchMode(page, "Top 25", "Blind");
  await page.getByRole("button", { name: "Ranking" }).click();
  await expect(page.getByText("#001")).toBeVisible();
  await expect(page.locator("main img")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Test Player");
});

test("tablet result actions fill the bar in equal columns", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");
  await switchMode(page, "Top 10", "Normal");
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

test("share delivers a valid 1080 by 1350 PNG", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: undefined,
    });
  });
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

test("every blind preset completes and reveals its result", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto("/");

  const presets = [
    ["Top 10", 10],
    ["Top 25", 25],
    ["Top 50", 50],
  ] as const;
  for (const [preset, targetSize] of presets) {
    await switchMode(page, preset, "Blind");
    await expect(page.locator("main")).not.toContainText("Test Player");
    await expect(page.locator("main img")).toHaveCount(0);

    await finishWith(page, "Tie");

    await expect(
      page.getByRole("heading", { name: `Your NBA top ${targetSize}.` }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Vote" })).toHaveCount(0);
    expect(await page.locator("main img").count()).toBeGreaterThan(0);
  }
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
  await mutateAndWait(
    page,
    () => page.getByRole("button", { name: "Undo" }).click(),
  );
  await page.reload();
  await expect(page.getByTestId("center-comparison-ledger")).toBeVisible();

  const secondTab = await context.newPage();
  await secondTab.goto("/");
  await expect(secondTab.getByTestId("center-comparison-ledger")).toBeVisible();
  const beforeConflict = await storedSession(page);
  const heldLock = page.evaluate(async () => {
    await navigator.locks.request(
      "alltime25.ranking-session",
      async () => {
        (
          window as typeof window & {
            rankingTestLockHeld?: boolean;
          }
        ).rankingTestLockHeld = true;
        await new Promise<void>((resolve) => {
          (
            window as typeof window & {
              releaseRankingTestLock?: () => void;
            }
          ).releaseRankingTestLock = resolve;
        });
      },
    );
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              rankingTestLockHeld?: boolean;
            }
          ).rankingTestLockHeld === true,
      ),
    )
    .toBe(true);
  await Promise.all([
    page.getByRole("button", { name: "Player A", exact: true }).click(),
    secondTab.getByRole("button", { name: "Player B", exact: true }).click(),
  ]);
  await expect(
    page.getByRole("button", { name: "Player A", exact: true }),
  ).toBeDisabled();
  await expect(
    secondTab.getByRole("button", { name: "Player B", exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => {
    (
      window as typeof window & {
        releaseRankingTestLock?: () => void;
      }
    ).releaseRankingTestLock?.();
  });
  await heldLock;
  await expect
    .poll(async () => (await storedSession(page)).revision)
    .toBe(beforeConflict.revision + 1);
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

  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByRole("dialog", { name: "Restart" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Top 25" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Normal" })).toBeChecked();
  await page.getByRole("radio", { name: "Top 50" }).check();

  const completedId = (await storedSession(page)).id;
  await page.getByRole("button", { name: "Restart ranking" }).click();
  await expect
    .poll(async () => (await storedSession(page)).id)
    .not.toBe(completedId);
  await expect(page.getByTestId("center-comparison-ledger")).toBeVisible();

  await finishWith(page, "Tie");
  const rankingList = page.getByRole("region", { name: "Ranking list" });
  await expect(
    page.getByRole("button", { name: "Next ranking page" }),
  ).toHaveCount(0);
  const tiedRanks = page.getByText("T-1", { exact: true });
  await expect(tiedRanks).toHaveCount(100);
  const scrollMetrics = await rankingList.evaluate((list) => {
    list.scrollTop = list.scrollHeight;
    return {
      clientHeight: list.clientHeight,
      scrollHeight: list.scrollHeight,
      scrollTop: list.scrollTop,
    };
  });
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(
    scrollMetrics.clientHeight,
  );
  expect(scrollMetrics.scrollTop).toBeGreaterThan(0);
  await expect(tiedRanks.last()).toBeVisible();

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
  await mutateAndWait(
    page,
    () => page.getByRole("button", { name: label, exact: true }).click(),
  );
}

async function switchMode(
  page: Page,
  preset: "Top 10" | "Top 25" | "Top 50",
  identity: "Normal" | "Blind",
): Promise<StoredSession> {
  const currentId = (await waitForStoredSession(page)).id;
  await page.getByRole("button", { name: "Restart" }).click();
  const dialog = page.getByRole("dialog", { name: "Restart" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: preset }).check();
  await dialog.getByRole("radio", { name: identity }).check();
  await dialog.getByRole("button", { name: "Restart ranking" }).click();
  await expect(dialog).toBeHidden();
  await expect
    .poll(async () => (await storedSession(page)).id)
    .not.toBe(currentId);
  return storedSession(page);
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

async function mutateAndWait(
  page: Page,
  action: () => Promise<unknown>,
): Promise<void> {
  const before = await storedSession(page);
  await action();
  await expect
    .poll(async () => {
      const after = await storedSession(page);
      return after.id === before.id ? after.revision : -1;
    })
    .toBe(before.revision + 1);
}

async function storedSession(page: Page): Promise<StoredSession> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (raw === null) throw new Error("Missing local ranking session.");
    return JSON.parse(raw) as StoredSession;
  }, SESSION_KEY);
}

async function waitForStoredSession(page: Page): Promise<StoredSession> {
  await expect
    .poll(() =>
      page.evaluate((key) => localStorage.getItem(key) !== null, SESSION_KEY),
    )
    .toBe(true);
  return storedSession(page);
}

function targetSizeFor(
  preset: StoredSession["preset"],
): 10 | 25 | 50 {
  if (preset === "top_10") return 10;
  if (preset === "top_25") return 25;
  return 50;
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

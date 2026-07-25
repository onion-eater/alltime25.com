import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompareScreen } from "@/features/ranking/components/CompareScreen";
import {
  activeSession,
  blindSession,
} from "@/test/sessionFixture";

describe("CompareScreen", () => {
  it("does not render a bordered fill when progress is zero", () => {
    const current = activeSession();
    const session = {
      ...current,
      progress: {
        ...current.progress,
        processed: 0,
      },
    };

    const { container } = render(
      <CompareScreen
        session={session}
        isSubmitting={false}
        onUndo={vi.fn()}
        onVote={vi.fn()}
      />,
    );

    expect(
      container.querySelector('span[style="width: 0%;"]'),
    ).not.toBeInTheDocument();
  });

  it("maps the three buttons to backend vote outcomes", () => {
    const onVote = vi.fn();

    render(
      <CompareScreen
        session={activeSession()}
        isSubmitting={false}
        onUndo={vi.fn()}
        onVote={onVote}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Player A" }));
    fireEvent.click(screen.getByRole("button", { name: "Tie" }));
    fireEvent.click(screen.getByRole("button", { name: "Player B" }));

    expect(onVote.mock.calls).toEqual([
      ["better"],
      ["tie"],
      ["worse"],
    ]);
  });

  it("renders symmetric player identities in normal mode", () => {
    render(
      <CompareScreen
        session={activeSession()}
        isSubmitting={false}
        onUndo={vi.fn()}
        onVote={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Michael Jordan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("LeBron James").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("img", { name: /Michael Jordan/i }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("img", { name: /LeBron James/i }).length,
    ).toBeGreaterThan(0);
  });

  it("does not render player identities in blind mode", () => {
    render(
      <CompareScreen
        session={blindSession()}
        isSubmitting={false}
        onUndo={vi.fn()}
        onVote={vi.fn()}
      />,
    );

    expect(screen.queryByText("Michael Jordan")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getAllByText("Player A").length).toBeGreaterThan(0);
  });

  it("renders the four neutral ledger sections in order", () => {
    render(
      <CompareScreen
        session={activeSession()}
        isSubmitting={false}
        onUndo={vi.fn()}
        onVote={vi.fn()}
      />,
    );
    const ledger = screen.getByTestId("center-comparison-ledger");
    const content = ledger.textContent ?? "";

    expect(content.indexOf("Career")).toBeLessThan(
      content.indexOf("Honors"),
    );
    expect(content.indexOf("Honors")).toBeLessThan(
      content.indexOf("Regular Season"),
    );
    expect(content.indexOf("Regular Season")).toBeLessThan(
      content.indexOf("Playoffs"),
    );
    expect(within(ledger).getAllByText("3PT%")).toHaveLength(2);
    const playerA = within(ledger).getByRole("columnheader", {
      name: /Player A/,
    });
    const playerB = within(ledger).getByRole("columnheader", {
      name: /Player B/,
    });
    expect(playerA.className).toBe(playerB.className);
  });

  it("keeps era and seasons out of the player headers", () => {
    render(
      <CompareScreen
        session={activeSession()}
        isSubmitting={false}
        onUndo={vi.fn()}
        onVote={vi.fn()}
      />,
    );
    const ledger = screen.getByTestId("center-comparison-ledger");
    const playerA = within(ledger).getByRole("columnheader", {
      name: /Player A/,
    });

    expect(within(playerA).queryByText("1990s")).not.toBeInTheDocument();
    expect(
      within(playerA).queryByText(/15 seasons/i),
    ).not.toBeInTheDocument();
  });

  it("renders era above seasons in the Career section", () => {
    render(
      <CompareScreen
        session={activeSession()}
        isSubmitting={false}
        onUndo={vi.fn()}
        onVote={vi.fn()}
      />,
    );
    const career = screen
      .getByTestId("center-comparison-ledger")
      .querySelector("tbody");
    if (career === null) throw new Error("Missing Career section");
    const content = career.textContent ?? "";

    expect(content).toContain("1990s");
    expect(content).toContain("2010s");
    expect(content.indexOf("Era")).toBeLessThan(
      content.indexOf("Seasons"),
    );
  });

  it("renders unavailable statistics and awards as em dashes", () => {
    const current = activeSession();
    if (current.comparison === null) throw new Error("Missing comparison");
    const playerA = current.comparison.playerA;
    const session = {
      ...current,
      comparison: {
        ...current.comparison,
        playerA: {
          ...playerA,
          regularSeason: {
            ...playerA.regularSeason,
            threePct: null,
          },
          playoffs: {
            ...playerA.playoffs,
            threePct: null,
          },
          honors: {
            ...playerA.honors,
            dpoy: null,
            finalsMvp: null,
          },
        },
      },
    };

    render(
      <CompareScreen
        session={session}
        isSubmitting={false}
        onUndo={vi.fn()}
        onVote={vi.fn()}
      />,
    );

    expect(
      within(screen.getByTestId("center-comparison-ledger")).getAllByText(
        "—",
      ),
    ).toHaveLength(4);
  });
});

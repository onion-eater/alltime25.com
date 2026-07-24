import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RankingsScreen } from "@/features/ranking/components/RankingsScreen";
import type { SessionResponse } from "@/features/ranking/api/rankingApi";
import { completedSession } from "@/test/sessionFixture";

describe("RankingsScreen", () => {
  it("reveals player images and preserves skipped ranks after a tie", () => {
    render(
      <RankingsScreen
        session={completedSession()}
        onStartOver={vi.fn()}
      />,
    );

    expect(screen.getByText("Michael Jordan")).toBeInTheDocument();
    expect(screen.getByText("LeBron James")).toBeInTheDocument();
    expect(screen.getAllByText("T-1")).toHaveLength(2);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByAltText("Michael Jordan")).toHaveAttribute(
      "src",
      "/assets/catalogs/development-2024-06-18/players/jordami01.jpg",
    );
  });

  it("does not visually single out the first-ranked player", () => {
    render(
      <RankingsScreen
        session={completedSession()}
        onStartOver={vi.fn()}
      />,
    );

    const firstRow =
      screen.getByText("Michael Jordan").parentElement?.parentElement;
    const secondRow =
      screen.getByText("LeBron James").parentElement?.parentElement;

    expect(firstRow?.className).toBe(secondRow?.className);
  });

  it("keeps a cutoff tie paginated and repeats the tied rank", async () => {
    const user = userEvent.setup();
    render(
      <RankingsScreen
        session={largeTieSession()}
        onStartOver={vi.fn()}
      />,
    );

    expect(screen.getAllByText("T-1")).toHaveLength(10);
    for (let page = 0; page < 5; page += 1) {
      await user.click(
        screen.getByRole("button", { name: "Next ranking page" }),
      );
    }

    expect(screen.getByText("51–51")).toBeInTheDocument();
    expect(screen.getByText("T-1")).toBeInTheDocument();
    expect(screen.getByText("Željko Longname-Williams")).toBeInTheDocument();
  });

  it("uses the neutral local portrait when an image fails", () => {
    render(
      <RankingsScreen
        session={completedSession()}
        onStartOver={vi.fn()}
      />,
    );

    const image = screen.getByAltText("Michael Jordan");
    fireEvent.error(image);

    expect(image).toHaveAttribute("src", "/player-fallback.svg");
  });

  it("announces unavailable sharing without throwing", async () => {
    const user = userEvent.setup();
    const originalShare = navigator.share;
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });

    render(
      <RankingsScreen
        session={completedSession()}
        onStartOver={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Share" }));

    expect(screen.getByRole("status")).toHaveTextContent("Share unavailable.");
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: originalShare,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
  });

  it("uses the AllTime 25 title when sharing", async () => {
    const user = userEvent.setup();
    const originalShare = navigator.share;
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });

    try {
      render(
        <RankingsScreen
          session={completedSession()}
          onStartOver={vi.fn()}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Share" }));

      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({ title: "My AllTime 25" }),
      );
    } finally {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: originalShare,
      });
    }
  });

  it("does not offer a separate text export", () => {
    render(
      <RankingsScreen
        session={completedSession()}
        onStartOver={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Export" }),
    ).not.toBeInTheDocument();
  });

  it("does not offer a close-calls review action", () => {
    render(
      <RankingsScreen
        session={completedSession()}
        onStartOver={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Review close calls/i }),
    ).not.toBeInTheDocument();
  });

  it("does not repeat cutoff-tie methodology beneath the result", () => {
    render(
      <RankingsScreen
        session={completedSession()}
        onStartOver={vi.fn()}
      />,
    );

    expect(
      screen.queryByText("Ties at the cutoff are included."),
    ).not.toBeInTheDocument();
  });

  it("uses the result heading without a redundant ranking eyebrow", () => {
    render(
      <RankingsScreen
        session={completedSession()}
        onStartOver={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Your NBA top 10." })).toBeVisible();
    expect(screen.queryByText("Your ranking")).not.toBeInTheDocument();
  });

  it("announces session operation status without hiding the result", () => {
    render(
      <RankingsScreen
        session={completedSession()}
        statusMessage="Retry"
        onStartOver={vi.fn()}
      />,
    );

    expect(screen.getByText("Michael Jordan")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Retry");
  });
});

function largeTieSession(): SessionResponse {
  const players = Array.from({ length: 51 }, (_, index) => ({
    name: index === 50 ? "Željko Longname-Williams" : `Player ${index + 1}`,
    era: "2000s",
    image_url: `/assets/catalogs/test/players/${index + 1}.webp`,
  }));
  return {
    ...completedSession(),
    target_size: 50,
    pool_size: 100,
    progress: {
      processed: 100,
      total: 100,
      votes: 99,
      ties: 50,
      eliminated: 49,
    },
    ranking: [{ rank: 1, players }],
  };
}

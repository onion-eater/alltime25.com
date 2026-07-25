import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { RankingsScreen } from "@/features/ranking/components/RankingsScreen";
import type { SessionResponse } from "@/features/ranking/api/rankingApi";
import { shareRankingImage } from "@/features/ranking/share/shareRankingImage";
import { completedSession } from "@/test/sessionFixture";

vi.mock("@/features/ranking/share/shareRankingImage", () => ({
  shareRankingImage: vi.fn(),
}));

describe("RankingsScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(shareRankingImage).mockResolvedValue("Image downloaded.");
  });

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

  it("keeps a cutoff tie in one scrollable list and repeats the tied rank", () => {
    render(
      <RankingsScreen
        session={largeTieSession()}
        onStartOver={vi.fn()}
      />,
    );

    expect(screen.getAllByText("T-1")).toHaveLength(51);
    expect(screen.getByText("Željko Longname-Williams")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Ranking list" }),
    ).toHaveAttribute("tabindex", "0");
    expect(
      screen.queryByRole("button", { name: "Next ranking page" }),
    ).not.toBeInTheDocument();
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

  it("generates and delivers an image for the nominal top N", async () => {
    const user = userEvent.setup();
    const session = completedSession();

    render(
      <RankingsScreen
        session={session}
        onStartOver={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Share" }));

    expect(shareRankingImage).toHaveBeenCalledWith(
      session.ranking,
      session.target_size,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Image downloaded.");
  });

  it("announces image generation failures without hiding the result", async () => {
    const user = userEvent.setup();
    vi.mocked(shareRankingImage).mockRejectedValue(
      new Error("Canvas unavailable"),
    );

    render(
      <RankingsScreen
        session={completedSession()}
        onStartOver={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Share" }));

    expect(screen.getByRole("status")).toHaveTextContent("Share failed.");
    expect(screen.getByText("Michael Jordan")).toBeInTheDocument();
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

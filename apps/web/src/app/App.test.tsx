import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { App } from "@/app/App";
import { useRankingSession } from "@/features/ranking/hooks/useRankingSession";
import { activeSession } from "@/test/sessionFixture";

vi.mock("@/features/ranking/hooks/useRankingSession", () => ({
  useRankingSession: vi.fn(),
}));

describe("App dialogs", () => {
  const startNewRanking = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.setItem("blind50.help_seen", "1");
    vi.mocked(useRankingSession).mockReturnValue({
      session: activeSession(),
      isLoading: false,
      isSubmitting: false,
      error: null,
      statusMessage: "Saved",
      vote: vi.fn(),
      undo: vi.fn(),
      startOver: vi.fn(),
      startNewRanking,
      retry: vi.fn(),
    });
  });

  it("keeps Help, Methodology, and Modes mutually exclusive", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Modes" }));
    expect(screen.getByRole("dialog", { name: "Modes" })).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Close modes" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "How to play" }));
    expect(screen.getByRole("dialog", { name: "How it works" })).toBeVisible();
    expect(
      screen.queryByRole("dialog", { name: "Modes" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Close instructions" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Methodology" }));
    expect(
      screen.getByRole("dialog", { name: "Methodology" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("dialog", { name: "How it works" }),
    ).not.toBeInTheDocument();
  });

  it("closes Modes only after a replacement session succeeds", async () => {
    startNewRanking.mockResolvedValue(true);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Modes" }));
    fireEvent.click(screen.getByRole("radio", { name: "Top 50" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Start new ranking" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Modes" }),
      ).not.toBeInTheDocument();
    });
  });

  it("keeps Modes open when replacement creation fails", async () => {
    startNewRanking.mockResolvedValue(false);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Modes" }));
    fireEvent.click(screen.getByRole("radio", { name: "Top 50" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Start new ranking" }),
    );

    await waitFor(() => {
      expect(startNewRanking).toHaveBeenCalled();
    });
    expect(screen.getByRole("dialog", { name: "Modes" })).toBeVisible();
  });
});

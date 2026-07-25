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
import {
  activeSession,
  blindSession,
} from "@/test/sessionFixture";

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

  it("keeps Help, Methodology, and Restart mutually exclusive", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(screen.getByRole("dialog", { name: "Restart" })).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Close restart" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "How to play" }));
    expect(screen.getByRole("dialog", { name: "How it works" })).toBeVisible();
    expect(
      screen.queryByText("50 players · Auto-saves"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Restart" }),
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

  it("restarts with the same settings and closes after creation succeeds", async () => {
    startNewRanking.mockResolvedValue(true);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Restart ranking" }),
    );

    expect(startNewRanking).toHaveBeenCalledWith({
      preset: "top_25",
      identityMode: "normal",
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Restart" }),
      ).not.toBeInTheDocument();
    });
  });

  it("keeps Restart open when replacement creation fails", async () => {
    startNewRanking.mockResolvedValue(false);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    fireEvent.click(screen.getByRole("radio", { name: "Top 50" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Restart ranking" }),
    );

    await waitFor(() => {
      expect(startNewRanking).toHaveBeenCalled();
    });
    expect(screen.getByRole("dialog", { name: "Restart" })).toBeVisible();
  });

  it("shows the current ranking and resumes the comparison", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Ranking" }));

    expect(
      screen.getByRole("heading", { name: "Your ranking so far." }),
    ).toBeVisible();
    expect(screen.getByText("Kareem Abdul-Jabbar")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));

    expect(
      screen.getByRole("heading", { name: "Greater career?" }),
    ).toBeVisible();
  });

  it("keeps identities hidden in a blind ranking preview", () => {
    vi.mocked(useRankingSession).mockReturnValue({
      session: blindSession(),
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
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Ranking" }));

    expect(screen.getByText("#018")).toBeVisible();
    expect(screen.queryByText("Kareem Abdul-Jabbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

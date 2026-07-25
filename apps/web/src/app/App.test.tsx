import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
import { SESSION_STORAGE_KEY } from "@/features/ranking/persistence/persistedSession";
import {
  activeSession,
  blindSession,
  completedSession,
} from "@/test/sessionFixture";

vi.mock("@/features/ranking/hooks/useRankingSession", () => ({
  useRankingSession: vi.fn(),
}));

describe("App dialogs", () => {
  const startNewRanking = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.setItem("alltime25.help_seen", "1");
    vi.mocked(useRankingSession).mockReturnValue({
      session: activeSession(),
      isLoading: false,
      isSubmitting: false,
      error: null,
      statusMessage: "Saved",
      vote: vi.fn(),
      undo: vi.fn(),
      startNewRanking,
      retry: vi.fn(),
    });
  });

  it("keeps Help and Restart mutually exclusive without Methodology", () => {
    render(<App />);

    expect(
      screen.queryByRole("button", { name: "Methodology" }),
    ).not.toBeInTheDocument();
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
    expect(
      screen.queryByRole("button", { name: "Start" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Close instructions" }),
    );
  });

  it("requires a mode choice before creating the first ranking", async () => {
    window.localStorage.removeItem("alltime25.help_seen");
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    startNewRanking.mockResolvedValue(true);
    render(<App />);

    expect(screen.getByRole("dialog", { name: "How it works" })).toBeVisible();
    expect(useRankingSession).toHaveBeenCalledWith({
      deferInitialCreation: true,
    });
    expect(
      screen.queryByRole("button", { name: "Close instructions" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Top 10" }));
    fireEvent.click(screen.getByRole("radio", { name: "Blind" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Start ranking" }),
    );

    await waitFor(() => {
      expect(startNewRanking).toHaveBeenCalledWith({
        preset: "top_10",
        identityMode: "blind",
      });
      expect(
        screen.queryByRole("dialog", { name: "How it works" }),
      ).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem("alltime25.help_seen")).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: "How to play" }));
    expect(
      screen.getByRole("button", { name: "Close instructions" }),
    ).toBeVisible();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("keeps first-run mode selection open when creation fails", async () => {
    window.localStorage.removeItem("alltime25.help_seen");
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    startNewRanking.mockResolvedValue(false);
    render(<App />);

    fireEvent.click(screen.getByRole("radio", { name: "Top 50" }));
    fireEvent.click(screen.getByRole("radio", { name: "Blind" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Start ranking" }),
    );

    await waitFor(() => {
      expect(startNewRanking).toHaveBeenCalled();
    });
    expect(screen.getByRole("dialog", { name: "How it works" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Top 50" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Blind" })).toBeChecked();
    expect(window.localStorage.getItem("alltime25.help_seen")).toBeNull();
  });

  it("preserves an existing ranking when the help preference is absent", () => {
    window.localStorage.removeItem("alltime25.help_seen");
    window.localStorage.setItem(SESSION_STORAGE_KEY, "{}");
    render(<App />);

    expect(useRankingSession).toHaveBeenCalledWith({
      deferInitialCreation: false,
    });
    expect(screen.getByRole("dialog", { name: "How it works" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Close instructions" }),
    ).toBeVisible();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("defaults Restart to Top 25 and Normal", async () => {
    startNewRanking.mockResolvedValue(true);
    vi.mocked(useRankingSession).mockReturnValue({
      session: {
        ...blindSession(),
        preset: "top_50",
      },
      isLoading: false,
      isSubmitting: false,
      error: null,
      statusMessage: "Saved",
      vote: vi.fn(),
      undo: vi.fn(),
      startNewRanking,
      retry: vi.fn(),
    });
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(screen.getByRole("radio", { name: "Top 25" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Normal" })).toBeChecked();
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

  it("asks for a mode before starting over from a completed ranking", async () => {
    startNewRanking.mockResolvedValue(true);
    vi.mocked(useRankingSession).mockReturnValue({
      session: completedSession(),
      isLoading: false,
      isSubmitting: false,
      error: null,
      statusMessage: "Saved",
      vote: vi.fn(),
      undo: vi.fn(),
      startNewRanking,
      retry: vi.fn(),
    });
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start over" }));

    expect(screen.getByRole("dialog", { name: "Restart" })).toBeVisible();
    expect(startNewRanking).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: "Top 10" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Restart ranking" }),
    );

    await waitFor(() => {
      expect(startNewRanking).toHaveBeenCalledWith({
        preset: "top_10",
        identityMode: "normal",
      });
    });
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

  it("shows Vote before Restart and returns to the active comparison", () => {
    render(<App />);

    const navigation = screen.getByRole("navigation", {
      name: "Main navigation",
    });
    const navigationButtons = within(navigation).getAllByRole("button");

    expect(navigationButtons).toHaveLength(4);
    expect(navigationButtons[0]).toHaveAccessibleName("Vote");
    expect(navigationButtons[1]).toHaveAccessibleName("Restart");
    expect(navigationButtons[2]).toHaveAccessibleName("Ranking");
    expect(navigationButtons[3]).toHaveAccessibleName("How to play");

    fireEvent.click(screen.getByRole("button", { name: "Ranking" }));
    expect(
      screen.getByRole("heading", { name: "Your ranking so far." }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Vote" }));
    expect(
      screen.getByRole("heading", { name: "Greater career?" }),
    ).toBeVisible();
  });

  it("hides Vote after the ranking is complete", () => {
    vi.mocked(useRankingSession).mockReturnValue({
      session: completedSession(),
      isLoading: false,
      isSubmitting: false,
      error: null,
      statusMessage: "Saved",
      vote: vi.fn(),
      undo: vi.fn(),
      startNewRanking,
      retry: vi.fn(),
    });
    render(<App />);

    expect(
      screen.queryByRole("button", { name: "Vote" }),
    ).not.toBeInTheDocument();
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

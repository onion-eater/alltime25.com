import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HelpDialog } from "@/features/ranking/components/HelpDialog";

describe("HelpDialog", () => {
  it("shows the three minimal steps without a start action", () => {
    render(
      <HelpDialog
        identityMode="blind"
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Compare blind résumés")).toBeInTheDocument();
    expect(screen.getByText("Pick A, B, or tie")).toBeInTheDocument();
    expect(screen.getByText("Reveal your ranking")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Start" }),
    ).not.toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("selects a ranking mode before starting the first ranking", () => {
    const onStart = vi.fn();
    render(
      <HelpDialog
        isOpen
        mode="onboarding"
        onClose={vi.fn()}
        onStart={onStart}
      />,
    );

    expect(screen.getByRole("radio", { name: "Top 25" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Normal" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "Top 50" }));
    fireEvent.click(screen.getByRole("radio", { name: "Blind" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Start ranking" }),
    );

    expect(onStart).toHaveBeenCalledWith({
      preset: "top_50",
      identityMode: "blind",
    });
  });

  it("does not let first-run onboarding close without starting", () => {
    const onClose = vi.fn();
    render(
      <HelpDialog
        isOpen
        mode="onboarding"
        onClose={onClose}
        onStart={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Close instructions" }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement;
    if (backdrop === null) throw new Error("Missing dialog backdrop.");
    fireEvent.mouseDown(backdrop);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("disables first-run submission while a ranking is starting", () => {
    render(
      <HelpDialog
        isOpen
        isSubmitting
        mode="onboarding"
        onClose={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Start ranking" }),
    ).toBeDisabled();
  });

  it("shows a first-run creation error without hiding the mode controls", () => {
    render(
      <HelpDialog
        error="Progress could not be saved."
        isOpen
        mode="onboarding"
        onClose={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Progress could not be saved.",
    );
    expect(screen.getByRole("radio", { name: "Top 25" })).toBeChecked();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <HelpDialog
        isOpen
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("traps focus and restores it after closing", async () => {
    const user = userEvent.setup();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { rerender } = render(
      <HelpDialog
        isOpen
        onClose={vi.fn()}
      />,
    );

    const close = screen.getByRole("button", { name: "Close instructions" });
    expect(close).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();

    rerender(
      <HelpDialog
        isOpen={false}
        onClose={vi.fn()}
      />,
    );
    expect(opener).toHaveFocus();
    opener.remove();
  });
});

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

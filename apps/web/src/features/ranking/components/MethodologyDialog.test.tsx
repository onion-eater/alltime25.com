import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MethodologyDialog } from "@/features/ranking/components/MethodologyDialog";

describe("MethodologyDialog", () => {
  it("shows only the compact methodology", () => {
    render(
      <MethodologyDialog
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Methodology" })).toBeInTheDocument();
    expect(screen.getByText("100 candidates")).toBeInTheDocument();
    expect(screen.getByText("NBA/BAA career stats")).toBeInTheDocument();
    expect(screen.getByText("Regular season + playoffs")).toBeInTheDocument();
    expect(screen.getByText("Raw, not era-adjusted")).toBeInTheDocument();
    expect(screen.getByText("— means unavailable")).toBeInTheDocument();
    expect(screen.getByText("Ties share a rank")).toBeInTheDocument();
    expect(screen.getByText("Cutoff ties are included")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <MethodologyDialog
        isOpen
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});

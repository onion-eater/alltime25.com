import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RestartDialog } from "@/features/ranking/components/RestartDialog";

describe("RestartDialog", () => {
  it("submits one explicit ranking-size and identity selection", () => {
    const onStart = vi.fn();
    render(
      <RestartDialog
        isOpen
        isSubmitting={false}
        onClose={vi.fn()}
        onStart={onStart}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Top 50" }));
    fireEvent.click(screen.getByRole("radio", { name: "Blind" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Restart ranking" }),
    );

    expect(onStart).toHaveBeenCalledWith({
      preset: "top_50",
      identityMode: "blind",
    });
  });

  it("defaults every restart to Top 25 and Normal", () => {
    const onStart = vi.fn();
    render(
      <RestartDialog
        isOpen
        isSubmitting={false}
        onClose={vi.fn()}
        onStart={onStart}
      />,
    );

    expect(screen.getByRole("radio", { name: "Top 25" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Normal" })).toBeChecked();
    fireEvent.click(
      screen.getByRole("button", { name: "Restart ranking" }),
    );

    expect(onStart).toHaveBeenCalledWith({
      preset: "top_25",
      identityMode: "normal",
    });
  });
});

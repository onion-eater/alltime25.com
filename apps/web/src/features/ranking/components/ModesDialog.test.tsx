import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModesDialog } from "@/features/ranking/components/ModesDialog";

describe("ModesDialog", () => {
  it("submits one explicit ranking-size and identity selection", () => {
    const onStart = vi.fn();
    render(
      <ModesDialog
        currentSelection={{
          preset: "top_25",
          identityMode: "normal",
        }}
        isOpen
        isSubmitting={false}
        onClose={vi.fn()}
        onStart={onStart}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Top 50" }));
    fireEvent.click(screen.getByRole("radio", { name: "Blind" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Start new ranking" }),
    );

    expect(onStart).toHaveBeenCalledWith({
      preset: "top_50",
      identityMode: "blind",
    });
  });

  it("does not restart when the selection is unchanged", () => {
    render(
      <ModesDialog
        currentSelection={{
          preset: "top_25",
          identityMode: "normal",
        }}
        isOpen
        isSubmitting={false}
        onClose={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Start new ranking" }),
    ).toBeDisabled();
  });
});

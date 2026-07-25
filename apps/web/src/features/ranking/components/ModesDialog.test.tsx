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
      screen.getByRole("button", { name: "Restart ranking" }),
    );

    expect(onStart).toHaveBeenCalledWith({
      preset: "top_50",
      identityMode: "blind",
    });
  });

  it("restarts with the current selection when it is unchanged", () => {
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

    fireEvent.click(
      screen.getByRole("button", { name: "Restart ranking" }),
    );

    expect(onStart).toHaveBeenCalledWith({
      preset: "top_25",
      identityMode: "normal",
    });
  });
});

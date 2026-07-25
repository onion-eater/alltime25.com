import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProgressScreen } from "@/features/ranking/components/ProgressScreen";

describe("ProgressScreen", () => {
  it("does not render a bordered fill when progress is zero", () => {
    const { container } = render(
      <ProgressScreen
        error="Unable to start."
        isLoading={false}
        onResume={vi.fn()}
        onRetry={vi.fn()}
        session={null}
      />,
    );

    expect(
      container.querySelector('span[style="width: 0%;"]'),
    ).not.toBeInTheDocument();
  });
});

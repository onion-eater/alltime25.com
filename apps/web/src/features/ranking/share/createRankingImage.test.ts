import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { RankingGroupResponse } from "@/features/ranking/api/rankingApi";
import { createRankingImage } from "@/features/ranking/share/createRankingImage";

const groups: RankingGroupResponse[] = [
  {
    rank: 1,
    players: Array.from({ length: 50 }, (_, index) => ({
      name:
        index === 49
          ? "Željko Longname-Williams"
          : `Player ${index + 1}`,
      era: "2000s",
      image_url: `/players/${index + 1}.webp`,
    })),
  },
];

describe("createRankingImage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates a 1080 by 1350 PNG canvas", async () => {
    mockContext();
    const blob = new Blob(["png"], { type: "image/png" });
    let dimensions = { width: 0, height: 0 };
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function toBlob(
        this: HTMLCanvasElement,
        callback: BlobCallback,
      ) {
        dimensions = { width: this.width, height: this.height };
        callback(blob);
      },
    );

    await expect(createRankingImage(groups, 50)).resolves.toBe(blob);
    expect(dimensions).toEqual({ width: 1080, height: 1350 });
  });

  it("draws the share wordmark as AllTime, the 25 mark, then .com", async () => {
    const context = mockContext();
    const blob = new Blob(["png"], { type: "image/png" });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback) => callback(blob),
    );

    await createRankingImage(groups, 50);

    expect(context.fillText.mock.calls.slice(0, 4)).toEqual([
      ["ALLTIME", 64, 81],
      ["25", 233, 81],
      [".COM", 284, 81],
      ["MY NBA TOP 50", 64, 174],
    ]);
    expect(context.font).toContain("Arial");
  });

  it("rejects when the browser cannot encode the PNG", async () => {
    mockContext();
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback) => callback(null),
    );

    await expect(createRankingImage(groups, 50)).rejects.toThrow(
      "PNG generation failed.",
    );
  });

  it("does not load player portraits for any share size", async () => {
    mockContext();
    const imageConstructor = vi.fn();
    vi.stubGlobal(
      "Image",
      class {
        decoding = "auto";
        onerror: (() => void) | null = null;
        onload: (() => void) | null = null;

        constructor() {
          imageConstructor();
        }

        set src(_source: string) {
          this.onerror?.();
        }
      },
    );
    const blob = new Blob(["png"], { type: "image/png" });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback) => callback(blob),
    );

    for (const targetSize of [10, 25, 50]) {
      await createRankingImage(groups, targetSize);
    }

    expect(imageConstructor).not.toHaveBeenCalled();
  });
});

function mockContext() {
  const context = {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({
      width: text.length * 12,
    })),
    strokeRect: vi.fn(),
    fillStyle: "",
    font: "",
    lineWidth: 1,
    strokeStyle: "",
    textAlign: "left",
    textBaseline: "middle",
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  return context;
}

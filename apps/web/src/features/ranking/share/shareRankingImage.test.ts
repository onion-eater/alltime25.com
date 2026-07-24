import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { RankingGroupResponse } from "@/features/ranking/api/rankingApi";
import { createRankingImage } from "@/features/ranking/share/createRankingImage";
import { shareRankingImage } from "@/features/ranking/share/shareRankingImage";

vi.mock("@/features/ranking/share/createRankingImage", () => ({
  createRankingImage: vi.fn(),
}));

const groups: RankingGroupResponse[] = [
  {
    rank: 1,
    players: [
      {
        name: "Michael Jordan",
        era: "1990s",
        image_url: "/jordan.webp",
      },
    ],
  },
];

describe("shareRankingImage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createRankingImage).mockResolvedValue(
      new Blob(["png"], { type: "image/png" }),
    );
  });

  it("uses native file sharing when the PNG is supported", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });

    const status = await shareRankingImage(groups, 10);

    expect(status).toBe("Shared.");
    expect(share).toHaveBeenCalledWith({
      files: [expect.any(File)],
      title: "MY NBA TOP 10",
    });
  });

  it("downloads when native file sharing is unsupported", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const createObjectURL = vi.fn().mockReturnValue("blob:ranking");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });

    const status = await shareRankingImage(groups, 25);

    expect(status).toBe("Image downloaded.");
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:ranking");
  });

  it("reports cancellation without downloading another copy", async () => {
    const share = vi.fn().mockRejectedValue(
      new DOMException("Cancelled", "AbortError"),
    );
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });

    await expect(shareRankingImage(groups, 50)).resolves.toBe(
      "Share cancelled.",
    );
  });

  it("reports a rejected native share", async () => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error("Share failed")),
    });

    await expect(shareRankingImage(groups, 10)).resolves.toBe(
      "Share failed.",
    );
  });

  it("reports a failed download without leaking an object URL", async () => {
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn().mockImplementation(() => {
        throw new Error("Object URLs unavailable");
      }),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });

    await expect(shareRankingImage(groups, 25)).resolves.toBe(
      "Download failed.",
    );
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";

import {
  flattenRanking,
  rowsForShare,
} from "@/features/ranking/model/rankingRows";
import type { RevealedRankingGroup } from "@/features/ranking/session/sessionView";

describe("ranking rows", () => {
  it("preserves tie labels while limiting a share to exactly nominal N", () => {
    const players = Array.from({ length: 51 }, (_, index) => ({
      name: `Player ${index + 1}`,
      era: "2000s",
      imageUrl: `/players/${index + 1}.webp`,
    }));
    const groups: RevealedRankingGroup[] = [{ rank: 1, players }];

    const rows = rowsForShare(flattenRanking(groups), 50);

    expect(rows).toHaveLength(50);
    expect(rows.every((row) => row.rankLabel === "T-1")).toBe(true);
    expect(rows.at(-1)?.player.name).toBe("Player 50");
  });

  it("does not attach portrait display instructions to share rows", () => {
    const groups: RevealedRankingGroup[] = [
      {
        rank: 1,
        players: Array.from({ length: 50 }, (_, index) => ({
          name: `Player ${index + 1}`,
          era: "2000s",
          imageUrl: `/players/${index + 1}.webp`,
        })),
      },
    ];

    expect(rowsForShare(flattenRanking(groups), 10)[0]).not.toHaveProperty(
      "showPortrait",
    );
  });
});

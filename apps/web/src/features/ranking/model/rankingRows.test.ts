import { describe, expect, it } from "vitest";

import type { RankingGroupResponse } from "@/features/ranking/api/rankingApi";
import {
  flattenRanking,
  rowsForShare,
} from "@/features/ranking/model/rankingRows";

describe("ranking rows", () => {
  it("preserves tie labels while limiting a share to exactly nominal N", () => {
    const players = Array.from({ length: 51 }, (_, index) => ({
      name: `Player ${index + 1}`,
      era: "2000s",
      image_url: `/players/${index + 1}.webp`,
    }));
    const groups: RankingGroupResponse[] = [{ rank: 1, players }];

    const rows = rowsForShare(flattenRanking(groups), 50);

    expect(rows).toHaveLength(50);
    expect(rows.every((row) => row.rankLabel === "T-1")).toBe(true);
    expect(rows.at(-1)?.player.name).toBe("Player 50");
  });

  it("selects portrait layouts only for Top 10 and Top 25", () => {
    const groups: RankingGroupResponse[] = [
      {
        rank: 1,
        players: Array.from({ length: 50 }, (_, index) => ({
          name: `Player ${index + 1}`,
          era: "2000s",
          image_url: `/players/${index + 1}.webp`,
        })),
      },
    ];

    expect(rowsForShare(flattenRanking(groups), 10)[0].showPortrait).toBe(
      true,
    );
    expect(rowsForShare(flattenRanking(groups), 25)[0].showPortrait).toBe(
      true,
    );
    expect(rowsForShare(flattenRanking(groups), 50)[0].showPortrait).toBe(
      false,
    );
  });
});

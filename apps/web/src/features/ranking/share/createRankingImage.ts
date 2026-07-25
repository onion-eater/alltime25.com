import {
  flattenRanking,
  rowsForShare,
  type ShareRow,
} from "@/features/ranking/model/rankingRows";
import type { RevealedRankingGroup } from "@/features/ranking/session/sessionView";

const WIDTH = 1080;
const HEIGHT = 1350;
const COLORS = {
  paper: "#f4f0e7",
  surface: "#fbfaf6",
  ink: "#101820",
  navy: "#15324a",
  orange: "#c84616",
  line: "#1b2227",
  softLine: "#cec8bc",
} as const;

interface ShareLayout {
  columns: number;
  contentTop: number;
  columnGap: number;
  rowHeight: number;
  rowsPerColumn: number;
}

export async function createRankingImage(
  groups: readonly RevealedRankingGroup[],
  targetSize: number,
): Promise<Blob> {
  const rows = rowsForShare(flattenRanking(groups), targetSize);
  const layout = layoutFor(targetSize);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("Canvas is unavailable.");

  drawBackground(context);
  drawHeader(context, targetSize);
  rows.forEach((row, index) => {
    drawRow(context, row, index, layout);
  });
  drawFooter(context);

  return canvasBlob(canvas);
}

function layoutFor(targetSize: number): ShareLayout {
  if (targetSize === 10) {
    return {
      columns: 1,
      contentTop: 240,
      columnGap: 0,
      rowHeight: 94,
      rowsPerColumn: 10,
    };
  }
  if (targetSize === 25) {
    return {
      columns: 2,
      contentTop: 240,
      columnGap: 28,
      rowHeight: 72,
      rowsPerColumn: 13,
    };
  }
  return {
    columns: 2,
    contentTop: 240,
    columnGap: 28,
    rowHeight: 38,
    rowsPerColumn: 25,
  };
}

function drawBackground(context: CanvasRenderingContext2D): void {
  context.fillStyle = COLORS.paper;
  context.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawHeader(
  context: CanvasRenderingContext2D,
  targetSize: number,
): void {
  drawText(context, "ALLTIME", 64, 81, {
    color: COLORS.ink,
    size: 25,
    weight: 900,
  });
  context.fillStyle = COLORS.orange;
  context.fillRect(200, 48, 66, 66);
  drawText(context, "25", 233, 81, {
    align: "center",
    color: COLORS.surface,
    size: 27,
    weight: 900,
  });
  drawText(context, ".COM", 284, 81, {
    color: COLORS.ink,
    size: 25,
    weight: 900,
  });
  drawText(context, `MY NBA TOP ${targetSize}`, 64, 174, {
    color: COLORS.ink,
    size: 52,
    weight: 900,
  });
  context.fillStyle = COLORS.ink;
  context.fillRect(64, 214, WIDTH - 128, 3);
}

function drawRow(
  context: CanvasRenderingContext2D,
  row: ShareRow,
  index: number,
  layout: ShareLayout,
): void {
  const outerWidth = WIDTH - 128;
  const columnWidth =
    (outerWidth - layout.columnGap * (layout.columns - 1)) /
    layout.columns;
  const column = Math.floor(index / layout.rowsPerColumn);
  const rowIndex = index % layout.rowsPerColumn;
  const x = 64 + column * (columnWidth + layout.columnGap);
  const y = layout.contentTop + rowIndex * layout.rowHeight;

  context.fillStyle = COLORS.surface;
  context.fillRect(x, y, columnWidth, layout.rowHeight - 2);
  context.fillStyle = COLORS.softLine;
  context.fillRect(
    x,
    y + layout.rowHeight - 2,
    columnWidth,
    2,
  );

  const rankWidth = layout.columns === 1 ? 74 : 58;
  context.fillStyle = COLORS.line;
  context.fillRect(x + rankWidth, y, 2, layout.rowHeight - 2);
  drawText(
    context,
    row.rankLabel,
    x + rankWidth / 2,
    y + layout.rowHeight / 2,
    {
      align: "center",
      color: COLORS.ink,
      size: layout.columns === 1 ? 27 : 20,
      weight: 900,
    },
  );

  drawFittedText(
    context,
    row.player.name,
    x + rankWidth + 18,
    y + layout.rowHeight / 2,
    columnWidth - rankWidth - 34,
    layout.columns === 1 ? 28 : 19,
  );
}

function drawFooter(context: CanvasRenderingContext2D): void {
  context.fillStyle = COLORS.ink;
  context.fillRect(64, 1272, WIDTH - 128, 2);
  drawText(context, "alltime25.com", WIDTH / 2, 1310, {
    align: "center",
    color: COLORS.ink,
    size: 17,
    weight: 700,
  });
}

function drawFittedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  initialSize: number,
): void {
  let size = initialSize;
  do {
    context.font = font(size, 900);
    if (context.measureText(text).width <= maxWidth) break;
    size -= 1;
  } while (size > 12);
  drawText(context, text, x, y, {
    color: COLORS.ink,
    size,
    weight: 900,
  });
}

function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    align?: CanvasTextAlign;
    color: string;
    size: number;
    weight: number;
  },
): void {
  context.fillStyle = options.color;
  context.font = font(options.size, options.weight);
  context.textAlign = options.align ?? "left";
  context.textBaseline = "middle";
  context.fillText(text, x, y);
}

function font(size: number, weight: number): string {
  return `${weight} ${size}px Arial, Helvetica, sans-serif`;
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error("PNG generation failed."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

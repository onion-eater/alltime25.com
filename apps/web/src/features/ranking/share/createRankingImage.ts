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
  muted: "#676b69",
  softLine: "#cec8bc",
} as const;

interface ShareLayout {
  columns: number;
  contentTop: number;
  columnGap: number;
  rowHeight: number;
  rowsPerColumn: number;
  rankWidth: number;
  rankSize: number;
  nameSize: number;
  lineHeight: number;
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
      contentTop: 310,
      columnGap: 0,
      rowHeight: 96,
      rowsPerColumn: 10,
      rankWidth: 62,
      rankSize: 28,
      nameSize: 30,
      lineHeight: 2,
    };
  }
  if (targetSize === 25) {
    return {
      columns: 2,
      contentTop: 310,
      columnGap: 42,
      rowHeight: 72,
      rowsPerColumn: 13,
      rankWidth: 52,
      rankSize: 21,
      nameSize: 22,
      lineHeight: 2,
    };
  }
  return {
    columns: 3,
    contentTop: 310,
    columnGap: 28,
    rowHeight: 55,
    rowsPerColumn: 17,
    rankWidth: 44,
    rankSize: 16,
    nameSize: 18,
    lineHeight: 1,
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
  const wordmarkX = 64;
  const wordmarkY = 94;
  const wordmarkSize = 27;
  const wordmarkWeight = 900;
  const markSize = 64;
  const wordmarkGap = 18;

  drawText(context, "ALLTIME", wordmarkX, wordmarkY, {
    color: COLORS.ink,
    size: wordmarkSize,
    weight: wordmarkWeight,
  });
  const markX =
    wordmarkX + context.measureText("ALLTIME").width + wordmarkGap;
  context.fillStyle = COLORS.orange;
  context.fillRect(markX, 62, markSize, markSize);
  drawText(context, "25", markX + markSize / 2, wordmarkY, {
    align: "center",
    color: COLORS.surface,
    size: 28,
    weight: 900,
  });
  drawText(
    context,
    ".COM",
    markX + markSize + wordmarkGap,
    wordmarkY,
    {
      color: COLORS.ink,
      size: wordmarkSize,
      weight: wordmarkWeight,
    },
  );
  drawText(context, `MY NBA TOP ${targetSize}`, 64, 218, {
    color: COLORS.ink,
    size: 66,
    weight: 900,
  });
  context.fillStyle = COLORS.ink;
  context.fillRect(64, 280, WIDTH - 128, 4);
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

  context.fillStyle = COLORS.softLine;
  context.fillRect(
    x,
    y + layout.rowHeight - layout.lineHeight,
    columnWidth,
    layout.lineHeight,
  );

  drawText(
    context,
    row.rankLabel,
    x,
    y + layout.rowHeight / 2,
    {
      color: COLORS.navy,
      size: layout.rankSize,
      weight: 900,
    },
  );

  drawFittedText(
    context,
    row.player.name,
    x + layout.rankWidth,
    y + layout.rowHeight / 2,
    columnWidth - layout.rankWidth,
    layout.nameSize,
  );
}

function drawFooter(context: CanvasRenderingContext2D): void {
  drawText(context, "alltime25.com", WIDTH - 64, 1301, {
    align: "right",
    color: COLORS.muted,
    size: 18,
    weight: 800,
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

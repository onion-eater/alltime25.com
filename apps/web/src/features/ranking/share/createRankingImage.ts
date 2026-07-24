import type { RankingGroupResponse } from "@/features/ranking/api/rankingApi";
import {
  flattenRanking,
  rowsForShare,
  type ShareRow,
} from "@/features/ranking/model/rankingRows";

const WIDTH = 1080;
const HEIGHT = 1350;
const FALLBACK_IMAGE = "/player-fallback.svg";
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
  portraitHeight: number;
  portraitWidth: number;
  rowHeight: number;
  rowsPerColumn: number;
}

export async function createRankingImage(
  groups: readonly RankingGroupResponse[],
  targetSize: number,
): Promise<Blob> {
  const rows = rowsForShare(flattenRanking(groups), targetSize);
  const layout = layoutFor(targetSize);
  const portraits = rows[0]?.showPortrait
    ? await Promise.all(
        rows.map((row) => loadPortrait(row.player.image_url)),
      )
    : rows.map(() => null);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("Canvas is unavailable.");

  drawBackground(context);
  drawHeader(context, targetSize);
  rows.forEach((row, index) => {
    drawRow(context, row, portraits[index], index, layout);
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
      portraitHeight: 72,
      portraitWidth: 54,
      rowHeight: 94,
      rowsPerColumn: 10,
    };
  }
  if (targetSize === 25) {
    return {
      columns: 2,
      contentTop: 240,
      columnGap: 28,
      portraitHeight: 48,
      portraitWidth: 36,
      rowHeight: 72,
      rowsPerColumn: 13,
    };
  }
  return {
    columns: 2,
    contentTop: 240,
    columnGap: 28,
    portraitHeight: 0,
    portraitWidth: 0,
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
  context.fillStyle = COLORS.orange;
  context.fillRect(64, 48, 66, 66);
  drawText(context, "25", 97, 81, {
    align: "center",
    color: COLORS.surface,
    size: 27,
    weight: 900,
  });
  drawText(context, "ALLTIME", 148, 81, {
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
  portrait: HTMLImageElement | null,
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

  let nameX = x + rankWidth + 18;
  let nameWidth = columnWidth - rankWidth - 34;
  if (row.showPortrait) {
    const portraitX = nameX;
    const portraitY =
      y + (layout.rowHeight - layout.portraitHeight) / 2 - 1;
    drawPortrait(
      context,
      portrait,
      portraitX,
      portraitY,
      layout.portraitWidth,
      layout.portraitHeight,
    );
    nameX += layout.portraitWidth + 16;
    nameWidth -= layout.portraitWidth + 16;
  }

  drawFittedText(
    context,
    row.player.name,
    nameX,
    y + layout.rowHeight / 2,
    nameWidth,
    layout.columns === 1 ? 28 : targetFontSize(layout),
  );
}

function targetFontSize(layout: ShareLayout): number {
  return layout.portraitWidth > 0 ? 20 : 19;
}

function drawPortrait(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  context.fillStyle = COLORS.paper;
  context.fillRect(x, y, width, height);
  if (image !== null) {
    const scale = Math.min(
      width / image.naturalWidth,
      height / image.naturalHeight,
    );
    const drawnWidth = image.naturalWidth * scale;
    const drawnHeight = image.naturalHeight * scale;
    context.drawImage(
      image,
      x + (width - drawnWidth) / 2,
      y + (height - drawnHeight) / 2,
      drawnWidth,
      drawnHeight,
    );
  }
  context.strokeStyle = COLORS.softLine;
  context.lineWidth = 1;
  context.strokeRect(x, y, width, height);
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

async function loadPortrait(source: string): Promise<HTMLImageElement | null> {
  const image = await loadImage(source);
  return image ?? loadImage(FALLBACK_IMAGE);
}

function loadImage(source: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
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

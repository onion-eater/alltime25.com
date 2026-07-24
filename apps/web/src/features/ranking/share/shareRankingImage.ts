import type { RankingGroupResponse } from "@/features/ranking/api/rankingApi";
import { createRankingImage } from "@/features/ranking/share/createRankingImage";

export async function shareRankingImage(
  groups: readonly RankingGroupResponse[],
  targetSize: number,
): Promise<string> {
  const blob = await createRankingImage(groups, targetSize);
  const title = `MY NBA TOP ${targetSize}`;
  const filename = `alltime25-top-${targetSize}.png`;

  if (supportsFileShare(blob, filename, title)) {
    const file = new File([blob], filename, { type: "image/png" });
    try {
      await navigator.share({ files: [file], title });
      return "Shared.";
    } catch (error) {
      return error instanceof DOMException && error.name === "AbortError"
        ? "Share cancelled."
        : "Share failed.";
    }
  }

  return downloadImage(blob, filename);
}

function supportsFileShare(
  blob: Blob,
  filename: string,
  title: string,
): boolean {
  if (
    typeof File === "undefined" ||
    typeof navigator.share !== "function" ||
    typeof navigator.canShare !== "function"
  ) {
    return false;
  }
  try {
    const file = new File([blob], filename, { type: "image/png" });
    return navigator.canShare({ files: [file], title });
  } catch {
    return false;
  }
}

function downloadImage(blob: Blob, filename: string): string {
  let objectUrl: string | null = null;
  try {
    objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = filename;
    link.href = objectUrl;
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
    return "Image downloaded.";
  } catch {
    return "Download failed.";
  } finally {
    if (objectUrl !== null) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // The download has already started.
      }
    }
  }
}

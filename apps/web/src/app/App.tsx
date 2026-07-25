import { useCallback, useState } from "react";

import styles from "@/app/App.module.css";
import { CompareScreen } from "@/features/ranking/components/CompareScreen";
import { HelpDialog } from "@/features/ranking/components/HelpDialog";
import { MethodologyDialog } from "@/features/ranking/components/MethodologyDialog";
import { ModesDialog } from "@/features/ranking/components/ModesDialog";
import { ProgressScreen } from "@/features/ranking/components/ProgressScreen";
import { RankingsScreen } from "@/features/ranking/components/RankingsScreen";
import { useRankingSession } from "@/features/ranking/hooks/useRankingSession";
import { AppHeader } from "@/shared/components/AppHeader";
import { Footer } from "@/shared/components/Footer";
import {
  storageGet,
  storageSet,
} from "@/shared/browser/safeStorage";

const HELP_KEY = "blind50.help_seen";
type OpenDialog = "help" | "methodology" | "modes" | null;
type ReviewView = "progress" | "ranking" | null;

export function App(): React.JSX.Element {
  const {
    session,
    isLoading,
    isSubmitting,
    error,
    statusMessage,
    vote,
    undo,
    startOver,
    startNewRanking,
    retry,
  } = useRankingSession();
  const [openDialog, setOpenDialog] = useState<OpenDialog>(
    () => (storageGet(HELP_KEY) !== "1" ? "help" : null),
  );
  const [reviewView, setReviewView] = useState<ReviewView>(null);

  const closeDialog = useCallback(() => setOpenDialog(null), []);

  const start = useCallback(() => {
    storageSet(HELP_KEY, "1");
    setOpenDialog(null);
  }, []);

  function showMain(): void {
    setReviewView(null);
  }

  function showRanking(): void {
    if (session?.status !== "complete") {
      setReviewView("ranking");
    }
  }

  const hasOpenDialog = openDialog !== null;
  const currentSelection = {
    preset: session?.preset ?? "top_25",
    identityMode: session?.identity_mode ?? "normal",
  } as const;

  let content: React.JSX.Element;
  if (isLoading || session === null) {
    content = (
      <ProgressScreen
        error={error}
        isLoading={isLoading}
        onResume={showMain}
        onRetry={retry}
        session={session}
      />
    );
  } else if (session.status === "complete") {
    content = (
      <RankingsScreen
        isSubmitting={isSubmitting}
        onStartOver={startOver}
        session={session}
        statusMessage={statusMessage}
      />
    );
  } else if (reviewView === "progress") {
    content = (
      <ProgressScreen
        onResume={showMain}
        session={session}
      />
    );
  } else if (reviewView === "ranking") {
    content = (
      <RankingsScreen
        onResume={showMain}
        session={session}
        statusMessage={statusMessage}
      />
    );
  } else {
    content = (
      <CompareScreen
        isSubmitting={isSubmitting}
        statusMessage={statusMessage}
        onShowProgress={() => setReviewView("progress")}
        onUndo={undo}
        onVote={vote}
        session={session}
      />
    );
  }

  return (
    <div className={styles.app}>
      <div
        aria-hidden={hasOpenDialog}
        className={styles.appContent}
        inert={hasOpenDialog}
      >
        <AppHeader
          onBrand={showMain}
          onHelp={() => setOpenDialog("help")}
          onMethodology={() => setOpenDialog("methodology")}
          onModes={() => setOpenDialog("modes")}
          onRanking={showRanking}
        />
        <main className={styles.viewport}>{content}</main>
        <Footer />
      </div>
      <HelpDialog
        identityMode={currentSelection.identityMode}
        isOpen={openDialog === "help"}
        onClose={closeDialog}
        onStart={start}
      />
      <MethodologyDialog
        candidateCount={session?.pool_size}
        isOpen={openDialog === "methodology"}
        onClose={closeDialog}
      />
      <ModesDialog
        currentSelection={currentSelection}
        isOpen={openDialog === "modes"}
        isSubmitting={isSubmitting}
        onClose={closeDialog}
        onStart={async (selection) => {
          const created = await startNewRanking(selection);
          if (created) {
            setOpenDialog(null);
            setReviewView(null);
          }
        }}
      />
    </div>
  );
}

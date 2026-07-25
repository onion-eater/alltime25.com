import { useCallback, useState } from "react";

import styles from "@/app/App.module.css";
import { CompareScreen } from "@/features/ranking/components/CompareScreen";
import { HelpDialog } from "@/features/ranking/components/HelpDialog";
import { ProgressScreen } from "@/features/ranking/components/ProgressScreen";
import { RankingsScreen } from "@/features/ranking/components/RankingsScreen";
import { RestartDialog } from "@/features/ranking/components/RestartDialog";
import { useRankingSession } from "@/features/ranking/hooks/useRankingSession";
import { DEFAULT_RANKING_SELECTION } from "@/features/ranking/model/rankingSelection";
import { SESSION_STORAGE_KEY } from "@/features/ranking/persistence/persistedSession";
import { AppHeader } from "@/shared/components/AppHeader";
import { Footer } from "@/shared/components/Footer";
import {
  SiteInfoDialog,
  type SiteInfoTopic,
} from "@/shared/components/SiteInfoDialog";
import {
  storageGet,
  storageSet,
} from "@/shared/browser/safeStorage";

const HELP_KEY = "alltime25.help_seen";
type OpenDialog = "help" | "restart" | SiteInfoTopic | null;
type ReviewView = "progress" | "ranking" | null;

export function App(): React.JSX.Element {
  const [deferInitialCreation] = useState(
    () =>
      storageGet(HELP_KEY) !== "1" &&
      storageGet(SESSION_STORAGE_KEY) === null,
  );
  const [requiresOnboarding, setRequiresOnboarding] =
    useState(deferInitialCreation);
  const {
    session,
    isLoading,
    isSubmitting,
    error,
    statusMessage,
    vote,
    undo,
    startNewRanking,
    retry,
  } = useRankingSession({
    deferInitialCreation,
  });
  const [openDialog, setOpenDialog] = useState<OpenDialog>(
    () => (storageGet(HELP_KEY) !== "1" ? "help" : null),
  );
  const [reviewView, setReviewView] = useState<ReviewView>(null);
  const isOnboarding = requiresOnboarding && session === null;

  const closeDialog = useCallback(() => setOpenDialog(null), []);
  const openRestartDialog = useCallback(
    () => setOpenDialog("restart"),
    [],
  );

  const dismissHelp = useCallback(() => {
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
        onStartOver={openRestartDialog}
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
          onRestart={openRestartDialog}
          onRanking={showRanking}
          onVote={session?.status === "active" ? showMain : null}
        />
        <main className={styles.viewport}>{content}</main>
        <Footer
          onData={() => setOpenDialog("data")}
          onPrivacy={() => setOpenDialog("privacy")}
        />
      </div>
      {isOnboarding ? (
        <HelpDialog
          error={error}
          isOpen={openDialog === "help"}
          isSubmitting={isSubmitting}
          mode="onboarding"
          onClose={dismissHelp}
          onStart={async (selection) => {
            const created = await startNewRanking(selection);
            if (created) {
              storageSet(HELP_KEY, "1");
              setOpenDialog(null);
              setRequiresOnboarding(false);
              setReviewView(null);
            }
          }}
        />
      ) : (
        <HelpDialog
          identityMode={
            session?.identityMode ??
            DEFAULT_RANKING_SELECTION.identityMode
          }
          isOpen={openDialog === "help"}
          onClose={dismissHelp}
        />
      )}
      <RestartDialog
        isOpen={openDialog === "restart"}
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
      <SiteInfoDialog
        onClose={closeDialog}
        topic={
          openDialog === "data" || openDialog === "privacy"
            ? openDialog
            : null
        }
      />
    </div>
  );
}

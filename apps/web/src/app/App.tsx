import { useCallback, useState } from "react";

import styles from "@/app/App.module.css";
import { CompareScreen } from "@/features/ranking/components/CompareScreen";
import { HelpDialog } from "@/features/ranking/components/HelpDialog";
import { MethodologyDialog } from "@/features/ranking/components/MethodologyDialog";
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
    retry,
  } = useRankingSession();
  const [isHelpOpen, setIsHelpOpen] = useState(
    () => storageGet(HELP_KEY) !== "1",
  );
  const [showProgress, setShowProgress] = useState(false);
  const [isMethodologyOpen, setIsMethodologyOpen] = useState(false);

  const closeHelp = useCallback(() => setIsHelpOpen(false), []);
  const closeMethodology = useCallback(
    () => setIsMethodologyOpen(false),
    [],
  );

  const start = useCallback(() => {
    storageSet(HELP_KEY, "1");
    setIsHelpOpen(false);
  }, []);

  function showMain(): void {
    setShowProgress(false);
  }

  function showRankingOrProgress(): void {
    setShowProgress(session?.status !== "complete");
  }

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
  } else if (showProgress) {
    content = (
      <ProgressScreen
        onResume={showMain}
        session={session}
      />
    );
  } else {
    content = (
      <CompareScreen
        isSubmitting={isSubmitting}
        statusMessage={statusMessage}
        onShowProgress={() => setShowProgress(true)}
        onUndo={undo}
        onVote={vote}
        session={session}
      />
    );
  }

  return (
    <div className={styles.app}>
      <div
        aria-hidden={isHelpOpen || isMethodologyOpen}
        className={styles.appContent}
        inert={isHelpOpen || isMethodologyOpen}
      >
        <AppHeader
          onBrand={showMain}
          onHelp={() => {
            setIsMethodologyOpen(false);
            setIsHelpOpen(true);
          }}
          onMethodology={() => {
            setIsHelpOpen(false);
            setIsMethodologyOpen(true);
          }}
          onRanking={showRankingOrProgress}
        />
        <main className={styles.viewport}>{content}</main>
        <Footer />
      </div>
      <HelpDialog
        isOpen={isHelpOpen}
        onClose={closeHelp}
        onStart={start}
        playerCount={session?.pool_size}
      />
      <MethodologyDialog
        isOpen={isMethodologyOpen}
        onClose={closeMethodology}
      />
    </div>
  );
}

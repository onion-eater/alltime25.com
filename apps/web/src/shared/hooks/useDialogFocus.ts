import {
  type RefObject,
  useEffect,
  useRef,
} from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useDialogFocus(
  isOpen: boolean,
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>,
): RefObject<HTMLElement | null> {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = dialogRef.current;
    const focusable = (): HTMLElement[] =>
      dialog
        ? Array.from(
            dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
          )
        : [];

    (initialFocusRef?.current ?? focusable()[0])?.focus();

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = focusable();
      if (controls.length === 0) {
        event.preventDefault();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialog?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [initialFocusRef, isOpen, onClose]);

  return dialogRef;
}

import { useEffect } from "react";

// Typing targets and anything inside a modal or popup keep their own keys.
const EXCLUDED_TARGET =
  "input,textarea,select,[role=textbox],[role=dialog],[role=alertdialog],[role=menu],[role=listbox],[inert]";
// Open modal dialogs, menus and listboxes block page shortcuts even when focus is elsewhere.
// Base UI keeps a closed Select list mounted inside a [hidden] wrapper, so hidden layers don't count.
const OPEN_BLOCKING_LAYER = [
  "[data-slot=dialog-content]",
  "[data-slot=alert-dialog-content]",
  "[role=menu]",
  "[role=listbox]",
]
  .map((layer) => `${layer}:not([hidden],[hidden] *)`)
  .join(",");

export function useDeckEditorShortcuts(
  compareMode: boolean,
  undoEditorChange: () => void,
  redoEditorChange: () => void,
) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (
        compareMode ||
        event.defaultPrevented ||
        !(event.metaKey || event.ctrlKey) ||
        target?.closest(EXCLUDED_TARGET) ||
        (target instanceof HTMLElement && target.isContentEditable) ||
        document.querySelector(OPEN_BLOCKING_LAYER)
      ) {
        return;
      }

      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redoEditorChange();
        } else {
          undoEditorChange();
        }
      }

      if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoEditorChange();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [compareMode, redoEditorChange, undoEditorChange]);
}

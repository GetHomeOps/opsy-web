import {useCallback, useMemo, useState} from "react";
import {
  canUploadDocumentsOnDemo,
  canUseAiOnDemo,
  DEMO_AI_UNAVAILABLE_MESSAGE,
  DEMO_AI_UNAVAILABLE_TITLE,
  DEMO_UPLOAD_UNAVAILABLE_MESSAGE,
  DEMO_UPLOAD_UNAVAILABLE_TITLE,
} from "../utils/demoSite";

const FEATURE_CONFIG = {
  upload: {
    blocked: () => !canUploadDocumentsOnDemo(),
    title: DEMO_UPLOAD_UNAVAILABLE_TITLE,
    message: DEMO_UPLOAD_UNAVAILABLE_MESSAGE,
  },
  ai: {
    blocked: () => !canUseAiOnDemo(),
    title: DEMO_AI_UNAVAILABLE_TITLE,
    message: DEMO_AI_UNAVAILABLE_MESSAGE,
  },
};

/**
 * Gate demo-only restrictions with a shared modal.
 * @param {"upload" | "ai"} feature
 */
export default function useDemoFeatureGate(feature) {
  const config = FEATURE_CONFIG[feature];
  const blocked = config.blocked();
  const [open, setOpen] = useState(false);

  const showModal = useCallback(() => {
    if (blocked) setOpen(true);
  }, [blocked]);

  const guardAction = useCallback(
    (action) => {
      if (blocked) {
        setOpen(true);
        return false;
      }
      if (typeof action === "function") action();
      return true;
    },
    [blocked],
  );

  const modalProps = useMemo(
    () => ({
      open,
      onClose: () => setOpen(false),
      title: config.title,
      message: config.message,
    }),
    [open, config.title, config.message],
  );

  return {blocked, showModal, guardAction, modalProps};
}

import { useEffect } from "react";

/**
 * Custom hook for automatically closing a banner after a specified timeout.
 *
 * @param {boolean} bannerOpen - Whether the banner is currently open
 * @param {string} bannerMessage - The message displayed in the banner
 * @param {Function} onClose - Function to call when closing the banner
 * @param {number} timeout - Time in milliseconds before the banner closes (default: 2500ms)
 */
export function useAutoCloseBanner(bannerOpen, bannerMessage, onClose, timeout = 2500) {
  useEffect(() => {
    if (bannerOpen && bannerMessage) {
      const timer = setTimeout(() => {
        onClose();
      }, timeout);
      return () => clearTimeout(timer);
    }
  }, [bannerOpen, bannerMessage, onClose, timeout]);
}
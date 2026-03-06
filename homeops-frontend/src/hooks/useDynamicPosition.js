import { useCallback, useEffect, useState } from "react";

const VIEWPORT_PADDING = 8;
const DEFAULT_GAP = 8;

/**
 * Computes position for a floating element (tooltip, popover) to avoid viewport clipping.
 * Uses collision detection: flips above/below and constrains horizontally.
 *
 * @param {Object} opts
 * @param {React.RefObject} opts.triggerRef - Ref to the trigger element
 * @param {React.RefObject} opts.floatingRef - Ref to the floating element (for measuring)
 * @param {boolean} opts.isVisible - Whether the floating element is visible (enables updates)
 * @param {string} opts.preferredPosition - "top" | "bottom" | "left" | "right"
 * @param {number} opts.gap - Gap between trigger and floating element
 * @returns {{ top: number, left: number, effectivePosition: string, updatePosition: function }}
 */
export function useDynamicPosition({
  triggerRef,
  floatingRef,
  isVisible,
  preferredPosition = "bottom",
  gap = DEFAULT_GAP,
}) {
  const [state, setState] = useState({
    top: 0,
    left: 0,
    effectivePosition: preferredPosition,
  });

  const isVertical =
    preferredPosition === "top" ||
    preferredPosition === "bottom" ||
    !["left", "right"].includes(preferredPosition);

  const updatePosition = useCallback(() => {
    if (!triggerRef?.current || !isVisible) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Use measured dimensions when available; otherwise approximate for first pass
    let floatingWidth = 0;
    let floatingHeight = 0;
    if (floatingRef?.current) {
      const br = floatingRef.current.getBoundingClientRect();
      floatingWidth = br.width;
      floatingHeight = br.height;
    }

    // Fallback estimates when floating isn't rendered yet (e.g. initial open)
    if (floatingHeight <= 0) floatingHeight = 48;
    if (floatingWidth <= 0) floatingWidth = 200;

    let top = 0;
    let left = 0;
    let effectivePosition = preferredPosition;

    if (isVertical) {
      const spaceBelow = viewportHeight - triggerRect.bottom - VIEWPORT_PADDING;
      const spaceAbove = triggerRect.top - VIEWPORT_PADDING;

      const preferAbove = preferredPosition === "top";
      let placeAbove;
      if (preferAbove) {
        placeAbove = spaceAbove >= floatingHeight || spaceBelow < floatingHeight;
      } else {
        placeAbove =
          (spaceBelow < floatingHeight && spaceAbove >= floatingHeight) ||
          (spaceBelow < floatingHeight && spaceAbove > spaceBelow);
      }

      if (placeAbove) {
        top = triggerRect.top - floatingHeight - gap;
        effectivePosition = "top";
      } else {
        top = triggerRect.bottom + gap;
        effectivePosition = "bottom";
      }

      // Horizontal: center on trigger, then constrain to viewport
      left = triggerRect.left + triggerRect.width / 2;
      const minLeft = VIEWPORT_PADDING + floatingWidth / 2;
      const maxLeft = viewportWidth - VIEWPORT_PADDING - floatingWidth / 2;
      left = Math.max(minLeft, Math.min(maxLeft, left));

      // Vertical clamping to ensure we never clip
      const minTop = VIEWPORT_PADDING;
      const maxTop = viewportHeight - floatingHeight - VIEWPORT_PADDING;
      top = Math.max(minTop, Math.min(maxTop, top));
    } else {
      // Horizontal placement (left/right)
      const spaceRight =
        viewportWidth - triggerRect.right - VIEWPORT_PADDING;
      const spaceLeft = triggerRect.left - VIEWPORT_PADDING;

      const preferLeft = preferredPosition === "left";
      let placeLeft;
      if (preferLeft) {
        placeLeft = spaceLeft >= floatingWidth || spaceRight < floatingWidth;
      } else {
        placeLeft =
          (spaceRight < floatingWidth && spaceLeft >= floatingWidth) ||
          (spaceRight < floatingWidth && spaceLeft > spaceRight);
      }

      top = triggerRect.top + triggerRect.height / 2;
      const minTop = VIEWPORT_PADDING;
      const maxTop = viewportHeight - floatingHeight - VIEWPORT_PADDING;
      top = Math.max(minTop, Math.min(maxTop, top - floatingHeight / 2));

      if (placeLeft) {
        left = triggerRect.left - floatingWidth - gap;
        effectivePosition = "left";
      } else {
        left = triggerRect.right + gap;
        effectivePosition = "right";
      }

      const minLeft = VIEWPORT_PADDING;
      const maxLeft = viewportWidth - floatingWidth - VIEWPORT_PADDING;
      left = Math.max(minLeft, Math.min(maxLeft, left));
    }

    setState({ top, left, effectivePosition });
  }, [
    triggerRef,
    floatingRef,
    isVisible,
    preferredPosition,
    gap,
    isVertical,
  ]);

  // Run on visibility, and subscribe to resize + scroll
  useEffect(() => {
    if (!isVisible) return;

    updatePosition();

    // Re-run after paint when tooltip gets dimensions (handles first render)
    let raf2Id;
    const raf1 = requestAnimationFrame(() => {
      raf2Id = requestAnimationFrame(updatePosition);
    });

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener("resize", handleResize);
    document.addEventListener("scroll", handleScroll, true);

    const el = floatingRef?.current;
    const ro = el
      ? new ResizeObserver(() => {
          updatePosition();
        })
      : null;
    if (el && ro) ro.observe(el);

    return () => {
      cancelAnimationFrame(raf1);
      if (raf2Id != null) cancelAnimationFrame(raf2Id);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("scroll", handleScroll, true);
      ro?.disconnect();
    };
  }, [isVisible, updatePosition, floatingRef]);

  return { ...state, updatePosition };
}

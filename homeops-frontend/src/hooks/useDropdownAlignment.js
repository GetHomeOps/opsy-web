import {useState, useLayoutEffect} from "react";

/**
 * Decides whether a popover/dropdown should align to the left or right edge
 * of its trigger button so it stays within the viewport.
 *
 * Strategy: when opened, measure the trigger button's horizontal midpoint.
 * - If the midpoint is in the right half of the viewport, anchor the dropdown
 *   to the trigger's right edge (so it grows leftwards into available space).
 * - Otherwise, anchor to the trigger's left edge (so it grows rightwards).
 *
 * On resize while open, the alignment is re-evaluated.
 *
 * @param {React.RefObject<HTMLElement>} triggerRef - ref to the trigger button
 * @param {boolean} open - whether the dropdown is currently open
 * @returns {"left" | "right"} which side of the trigger to anchor to
 */
export default function useDropdownAlignment(triggerRef, open) {
  const [align, setAlign] = useState("right");

  useLayoutEffect(() => {
    if (!open) return undefined;

    function compute() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      const viewportWidth =
        window.innerWidth || document.documentElement.clientWidth;
      setAlign(midpoint > viewportWidth / 2 ? "right" : "left");
    }

    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [open, triggerRef]);

  return align;
}

import React, {useLayoutEffect, useState} from "react";
import {createPortal} from "react-dom";
import Transition from "../utils/Transition";

const VIEWPORT_PAD = 8;
const GAP = 4;
const DEFAULT_PANEL_MAX = 360;

/**
 * Renders a header dropdown in a portal with fixed positioning so it is not
 * clipped by ancestors using overflow-x-hidden (common on dashboard shells).
 */
function NavbarDropdownPortal({
  open,
  triggerRef,
  panelRef,
  children,
  zClass = "z-[100]",
  panelClassName = "",
  panelMaxWidth = DEFAULT_PANEL_MAX,
}) {
  const [coords, setCoords] = useState(null);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    const update = () => {
      const t = triggerRef.current;
      if (!t) return;
      const tr = t.getBoundingClientRect();
      const vw = window.innerWidth;
      const panelW = Math.min(panelMaxWidth, vw - VIEWPORT_PAD * 2);
      let left = tr.right - panelW;
      left = Math.max(VIEWPORT_PAD, Math.min(left, vw - VIEWPORT_PAD - panelW));
      const top = tr.bottom + GAP;
      setCoords({top, left, width: panelW});
    };

    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, triggerRef, panelMaxWidth]);

  if (typeof document === "undefined") return null;

  const portal = (
    <Transition
      show={open}
      unmountOnExit
      tag="div"
      className={zClass}
      enter="transition ease-out duration-200"
      enterStart="opacity-0"
      enterEnd="opacity-100"
      leave="transition ease-out duration-200"
      leaveStart="opacity-100"
      leaveEnd="opacity-0"
    >
      <div
        ref={panelRef}
        style={
          coords
            ? {
                position: "fixed",
                top: coords.top,
                left: coords.left,
                width: coords.width,
                maxWidth: coords.width,
              }
            : {
                position: "fixed",
                top: 0,
                left: 0,
                visibility: "hidden",
                pointerEvents: "none",
                width: Math.min(
                  panelMaxWidth,
                  (typeof window !== "undefined" ? window.innerWidth : 400) - VIEWPORT_PAD * 2,
                ),
              }
        }
        className={panelClassName}
      >
        {children}
      </div>
    </Transition>
  );

  return createPortal(portal, document.body);
}

export default NavbarDropdownPortal;

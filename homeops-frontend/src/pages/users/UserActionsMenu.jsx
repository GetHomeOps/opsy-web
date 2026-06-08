import React, {useState, useRef, useEffect} from "react";
import {MoreHorizontal, UserRound, CreditCard} from "lucide-react";
import NavbarDropdownPortal from "../../components/NavbarDropdownPortal";

function isSuperAdminUserRole(role) {
  const r = String(role || "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
  return r === "super_admin" || r === "superadmin";
}

export default function UserActionsMenu({
  user,
  currentUserId,
  isSuperAdmin = false,
  isImpersonating = false,
  onImpersonate,
  onReconcileBilling,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e) {
      if (
        !wrapRef.current?.contains(e.target) &&
        !panelRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  if (!isSuperAdmin) {
    return <span className="text-gray-400">-</span>;
  }

  const canImpersonate =
    !isImpersonating &&
    user?.id !== currentUserId &&
    !isSuperAdminUserRole(user?.role) &&
    typeof onImpersonate === "function";

  const canReconcile =
    user?.paidRequired &&
    !user?.hasActivePaidSubscription &&
    typeof onReconcileBilling === "function";

  if (!canImpersonate && !canReconcile) {
    return <span className="text-gray-400">-</span>;
  }

  return (
    <div
      className="relative inline-flex shrink-0"
      ref={wrapRef}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        className="btn px-2 py-1.5 bg-white dark:bg-gray-800 border-gray-200 hover:border-gray-300 dark:border-gray-700/60 dark:hover:border-gray-600 text-gray-500 dark:text-gray-400"
        aria-label="User actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <MoreHorizontal className="w-4 h-4 shrink-0" />
      </button>
      <NavbarDropdownPortal
        open={open}
        triggerRef={triggerRef}
        panelRef={panelRef}
        panelMaxWidth={224}
        panelClassName="min-w-[12rem] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-lg shadow-black/10"
      >
        <div onClick={(e) => e.stopPropagation()}>
          <ul className="py-1">
            {canImpersonate && (
              <li>
                <button
                  type="button"
                  className="w-full flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 text-left"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    onImpersonate(user);
                  }}
                >
                  <UserRound className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-medium ml-2 text-gray-800 dark:text-gray-100">
                    Impersonate
                  </span>
                </button>
              </li>
            )}
            {canReconcile && (
              <li>
                <button
                  type="button"
                  className="w-full flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 text-left"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    onReconcileBilling(user);
                  }}
                >
                  <CreditCard className="w-4 h-4 shrink-0 text-violet-600 dark:text-violet-400" />
                  <span className="text-sm font-medium ml-2 text-gray-800 dark:text-gray-100">
                    Reconcile billing
                  </span>
                </button>
              </li>
            )}
          </ul>
        </div>
      </NavbarDropdownPortal>
    </div>
  );
}

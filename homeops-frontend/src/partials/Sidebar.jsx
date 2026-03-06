import React, {useState, useEffect, useRef, useCallback} from "react";
import {createPortal} from "react-dom";
import {NavLink, useLocation} from "react-router-dom";
import {ChevronDown, ChevronLeft, ChevronRight} from "lucide-react";

import Logo from "../images/logo-no-bg.png";
import useCurrentAccount from "../hooks/useCurrentAccount";
import {useAuth} from "../context/AuthContext";
import Transition from "../utils/Transition";
import {
  SIDEBAR_CONFIG,
  PROFESSIONALS_SAMPLE,
  SETTINGS_CONFIG,
} from "./sidebarConfig";

/**
 * Stripe-style submenu flyout — when sidebar is collapsed, hovering over an expandable
 * menu item shows this flyout panel to the right with submenu links.
 */
function SubmenuFlyout({
  show,
  title,
  flyoutContent,
  children,
  alignTop = false,
  alignBottom = false,
  layoutShiftKey,
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({top: 0, left: 0});
  const triggerRef = useRef(null);
  const flyoutRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  useEffect(() => {
    if (!show) setOpen(false);
  }, [show]);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => setOpen(false), 150);
  }, [clearCloseTimeout]);

  const aligned = alignTop || alignBottom;
  const [centered, setCentered] = useState(!aligned);
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const flyoutGap = 8;
    const left = rect.right + flyoutGap;
    let top;
    if (alignBottom) {
      const flyoutHeight = flyoutRef.current?.offsetHeight || 180;
      top = rect.bottom - flyoutHeight;
    } else if (alignTop) {
      top = rect.top;
    } else {
      top = rect.top + rect.height / 2;
    }
    setCoords({top, left});
    setCentered(!aligned);
  }, [alignTop, alignBottom, aligned]);

  useEffect(() => {
    if (!open || !triggerRef.current || !flyoutRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const flyoutHeight = flyoutRef.current.offsetHeight;
    const viewportHeight = window.innerHeight;
    const minTop = 8;
    const maxTop = viewportHeight - flyoutHeight - 8;
    const flyoutGap = 8;
    const left = rect.right + flyoutGap;
    let top;
    if (alignBottom) {
      top = rect.bottom - flyoutHeight;
      top = Math.max(minTop, Math.min(maxTop, top));
    } else if (alignTop) {
      top = rect.top;
      if (top + flyoutHeight > viewportHeight - 8) {
        top = Math.max(minTop, rect.top - flyoutHeight);
      } else {
        top = Math.max(minTop, Math.min(maxTop, top));
      }
    } else {
      top = rect.top + rect.height / 2 - flyoutHeight / 2;
      if (top < minTop || top > maxTop) {
        top = Math.max(minTop, Math.min(maxTop, top));
        setCentered(false);
      }
    }
    setCoords({top, left});
  }, [open, alignTop, alignBottom, layoutShiftKey]);

  const handleTriggerEnter = () => {
    clearCloseTimeout();
    updatePosition();
    setOpen(true);
  };

  const handleFlyoutEnter = () => {
    clearCloseTimeout();
    setOpen(true);
  };

  if (!show) return children;

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleTriggerEnter}
        onMouseLeave={scheduleClose}
        onFocus={handleTriggerEnter}
        onBlur={scheduleClose}
      >
        {children}
      </div>
      {createPortal(
        <div
          className="fixed z-[9999] min-w-[180px]"
          style={{
            top: coords.top,
            left: coords.left,
            transform: !aligned && centered ? "translateY(-50%)" : "none",
          }}
        >
          <Transition
            show={open}
            tag="div"
            enter="transition ease-out duration-150"
            enterStart="opacity-0"
            enterEnd="opacity-100"
            leave="transition ease-out duration-100"
            leaveStart="opacity-100"
            leaveEnd="opacity-0"
          >
            <div
              ref={flyoutRef}
              data-sidebar-flyout
              onMouseEnter={handleFlyoutEnter}
              onMouseLeave={scheduleClose}
              className="rounded-lg border border-gray-700/60 shadow-xl bg-gray-800 py-2 overflow-hidden"
            >
              {title && (
                <div className="px-2 py-1.5 text-xs font-bold text-gray-100">
                  {title}
                </div>
              )}
              {flyoutContent}
            </div>
          </Transition>
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * Sidebar tooltip — when sidebar is collapsed, shows label on hover.
 */
function SidebarTooltip({show, label, children, layoutShiftKey}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({top: 0, left: 0});
  const triggerRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      top: rect.top,
      left: rect.right + 12,
    });
  }, []);

  useEffect(() => {
    if (!show) setOpen(false);
  }, [show]);

  // Re-position when layout shifts (e.g. resize handle hover causes sidebar translate)
  useEffect(() => {
    if (show && open) updatePosition();
  }, [show, open, layoutShiftKey, updatePosition]);

  const handleEnter = () => {
    updatePosition();
    setOpen(true);
  };

  if (!show) return children;

  return (
    <div
      ref={triggerRef}
      className="flex w-full items-center"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setOpen(false)}
      onFocus={handleEnter}
      onBlur={() => setOpen(false)}
    >
      {children}
      {createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: coords.top,
            left: coords.left,
          }}
        >
          <Transition
            show={open}
            tag="div"
            className="rounded-lg border border-gray-700/60 overflow-hidden shadow-lg bg-gray-800 text-gray-100 px-3 py-2 text-sm whitespace-nowrap"
            enter="transition ease-out duration-200 transform"
            enterStart="opacity-0 -translate-x-2"
            enterEnd="opacity-100 translate-x-0"
            leave="transition ease-out duration-200"
            leaveStart="opacity-100"
            leaveEnd="opacity-0"
          >
            {label}
          </Transition>
        </div>,
        document.body,
      )}
    </div>
  );
}

// Shared link/collapsed classes for Stripe-style nav
// Collapsed: py-1.5 for tighter icon spacing; expanded: py-2
const linkBase =
  "flex items-center pl-4 pr-3 py-2 rounded-lg transition-all duration-200 lg:justify-center lg:px-3 lg:py-1.5 lg:sidebar-expanded:pl-4 lg:sidebar-expanded:pr-3 lg:sidebar-expanded:py-2 lg:sidebar-expanded:justify-start 2xl:justify-start 2xl:pl-4 2xl:pr-3 2xl:py-2";
const linkActive = "bg-white/15 text-white [&_svg]:text-white";
const linkInactive = "text-white/90 hover:bg-white/[0.08] hover:text-white [&_svg]:text-white/70";
const linkChildActive = "text-white [&_svg]:text-white";
const linkChildInactive = "text-white/70 hover:text-white [&_svg]:text-white/50";
const spanCollapse =
  "text-sm font-medium ml-4 min-w-0 whitespace-nowrap lg:ml-0 lg:w-0 lg:min-w-0 lg:max-w-0 lg:overflow-hidden lg:opacity-0 lg:sidebar-expanded:ml-4 lg:sidebar-expanded:w-auto lg:sidebar-expanded:min-w-0 lg:sidebar-expanded:max-w-none lg:sidebar-expanded:overflow-visible lg:sidebar-expanded:opacity-100 2xl:ml-4 2xl:max-w-none 2xl:overflow-visible 2xl:opacity-100 duration-200";

function Sidebar({sidebarOpen, setSidebarOpen, variant = "default"}) {
  const {pathname} = useLocation();
  const {currentAccount} = useCurrentAccount();
  const {currentUser} = useAuth();
  const accountUrl = currentAccount?.url || "";
  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin = currentUser?.role === "admin";
  const isAgent = currentUser?.role === "agent";
  const canManageUsers = isSuperAdmin || isAdmin;

  const trigger = useRef(null);
  const sidebar = useRef(null);

  const storedSidebarExpanded = localStorage.getItem("sidebar-expanded");
  const [sidebarExpanded, setSidebarExpanded] = useState(
    storedSidebarExpanded === null ? false : storedSidebarExpanded === "true",
  );
  const [is2xlViewport, setIs2xlViewport] = useState(false);
  const [isExpandableViewport, setIsExpandableViewport] = useState(false);

  const groupForPath = (path) => {
    if (/\/professionals(\/|$)/.test(path) || /\/my-professionals(\/|$)/.test(path)) return "directory";
    if (/\/support-management(\/|$)/.test(path) || /\/feedback-management(\/|$)/.test(path)) return "operations";
    if (/\/subscriptions(\/|$)/.test(path) || /\/subscription-products(\/|$)/.test(path)) return "subscriptions";
    if (/\/dashboard(\/|$)/.test(path)) return "dashboard";
    if (path.includes("settings/") || path.includes("users")) return "settings";
    return null;
  };

  // Single open collapsible — only one can be expanded at a time
  const [openCollapsible, setOpenCollapsible] = useState(() => groupForPath(pathname));

  // Sync open collapsible with pathname during render (no intermediate state, no flicker).
  // React's recommended pattern for derived state — runs synchronously before commit.
  const prevPathnameRef = useRef(pathname);
  if (prevPathnameRef.current !== pathname) {
    prevPathnameRef.current = pathname;
    const target = groupForPath(pathname);
    if (target !== null && target !== openCollapsible) {
      setOpenCollapsible(target);
    }
  }

  useEffect(() => {
    const mqExpandable = window.matchMedia("(min-width: 1024px) and (max-width: 1535px)");
    const mq2xl = window.matchMedia("(min-width: 1536px)");
    const handler = () => {
      setIsExpandableViewport(mqExpandable.matches);
      setIs2xlViewport(mq2xl.matches);
    };
    handler();
    mqExpandable.addEventListener("change", handler);
    mq2xl.addEventListener("change", handler);
    return () => {
      mqExpandable.removeEventListener("change", handler);
      mq2xl.removeEventListener("change", handler);
    };
  }, []);

  const isCollapsed = !sidebarExpanded && !is2xlViewport;
  const showTooltip = isCollapsed && isExpandableViewport;

  const toPath = useCallback(
    (path) => (accountUrl ? `/${accountUrl}/${path}` : `/${path}`),
    [accountUrl],
  );

  const isPathActive = useCallback(
    (path, activePaths, excludeFromActive) => {
      if (excludeFromActive?.some((excl) => new RegExp(`\\/${excl}(\\/|$)`).test(pathname)))
        return false;
      const segments = activePaths || [path];
      return segments.some((seg) => new RegExp(`\\/${seg}(\\/|$)`).test(pathname));
    },
    [pathname],
  );

  useEffect(() => {
    const clickHandler = ({target}) => {
      if (!sidebar.current || !trigger.current) return;
      if (
        !sidebarOpen ||
        sidebar.current.contains(target) ||
        trigger.current.contains(target) ||
        target.closest("[data-sidebar-flyout]")
      )
        return;
      setSidebarOpen(false);
    };
    document.addEventListener("click", clickHandler);
    return () => document.removeEventListener("click", clickHandler);
  });

  useEffect(() => {
    const keyHandler = ({keyCode}) => {
      if (!sidebarOpen || keyCode !== 27) return;
      setSidebarOpen(false);
    };
    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  });

  useEffect(() => {
    localStorage.setItem("sidebar-expanded", sidebarExpanded);
    if (sidebarExpanded) {
      document.querySelector("body").classList.add("sidebar-expanded");
    } else {
      document.querySelector("body").classList.remove("sidebar-expanded");
    }
  }, [sidebarExpanded]);

  const visible = (item) => {
    if (item.roles === "superAdminOnly") return isSuperAdmin;
    if (item.roles === "adminOnly") return canManageUsers;
    if (item.roles === "adminOrAgent") return canManageUsers || isAgent;
    if (item.hideForSuperAdmin && isSuperAdmin) return false;
    return true;
  };

  const renderNavLink = (item, isChild = false) => {
    const path = toPath(item.path);
    const active = isPathActive(item.path, item.activePaths, item.excludeFromActive);
    const Icon = item.icon;
    const classes = isChild
      ? active
        ? `${linkBase} ${linkChildActive}`
        : `${linkBase} ${linkChildInactive}`
      : active
        ? `${linkBase} ${linkActive}`
        : `${linkBase} ${linkInactive}`;

    return (
        <SidebarTooltip key={item.id} show={showTooltip} label={item.label} layoutShiftKey={0}>
        <NavLink
          end
          to={path}
          aria-label={item.label}
          className={({isActive}) =>
            isActive || active
              ? isChild
                ? `${linkBase} ${linkChildActive}`
                : `${linkBase} ${linkActive}`
              : isChild
                ? `${linkBase} ${linkChildInactive}`
                : `${linkBase} ${linkInactive}`
          }
        >
          {Icon && <Icon className="shrink-0" />}
          <span className={spanCollapse}>{item.label}</span>
        </NavLink>
      </SidebarTooltip>
    );
  };

  const renderCollapsible = (group, open, setOpen, flyoutContent) => {
    const children = group.children.filter(visible);
    if (children.length === 0) return null;

    const isGroupActive = children.some((c) =>
      isPathActive(c.path, c.activePaths, c.excludeFromActive),
    );
    const Icon = group.icon;

    const button = (
      <button
        type="button"
        onClick={(e) => {
          if (e.target.closest("a")) return;
          if (showTooltip) return; // Collapsed: flyout shows submenu, don't expand (avoids layout shift / flyover drop)
          setOpen(!open);
        }}
        aria-label={group.label}
        className={`flex items-center w-full pl-4 pr-3 py-2 rounded-lg transition-all duration-200 lg:justify-center lg:px-3 lg:py-1.5 lg:sidebar-expanded:pl-4 lg:sidebar-expanded:pr-3 lg:sidebar-expanded:py-2 lg:sidebar-expanded:justify-start 2xl:justify-start 2xl:pl-4 2xl:pr-3 2xl:py-2 ${
          isGroupActive ? "text-white [&_svg]:text-white" : "text-white/90 hover:text-white [&_svg]:text-white/70"
        }`}
      >
        {Icon && <Icon className="shrink-0" />}
        <span className={spanCollapse}>{group.label}</span>
        <span
          className={`ml-auto shrink-0 transition-transform duration-300 ease-out lg:opacity-0 lg:w-0 lg:min-w-0 lg:overflow-hidden lg:sidebar-expanded:opacity-100 lg:sidebar-expanded:w-auto lg:sidebar-expanded:min-w-0 lg:sidebar-expanded:overflow-visible 2xl:opacity-100 2xl:w-auto 2xl:min-w-0 2xl:overflow-visible ${
            open ? "rotate-0" : "-rotate-90"
          }`}
        >
          <ChevronDown className="w-4 h-4 text-white/70" strokeWidth={2} />
        </span>
      </button>
    );

    const content = (
      <ul
        className={`py-1 ${isCollapsed && !sidebarOpen ? "" : "ml-4"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children.map((child) => (
          <li key={child.id}>{renderNavLink(child, true)}</li>
        ))}
      </ul>
    );

    const wrapped = flyoutContent ? (
      <SubmenuFlyout show={showTooltip} title={group.label} flyoutContent={flyoutContent} alignBottom={group.id === "settings"} alignTop={group.id !== "settings"} layoutShiftKey={0}>
        {button}
      </SubmenuFlyout>
    ) : (
      button
    );

    return (
      <div key={group.id} className={`rounded-lg ${isGroupActive ? "bg-white/15" : ""}`}>
        {wrapped}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            open && (!isCollapsed || sidebarOpen) ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">{content}</div>
        </div>
      </div>
    );
  };

  const renderSection = (section) => {
    if (section.roles === "adminOnly" && !canManageUsers) return null;

    const items = section.items || [];
    const visibleItems = items.filter((item) => {
      if (item.type === "collapsible") {
        const children = (item.children || []).filter(visible);
        return children.length > 0;
      }
      return visible(item);
    });
    if (visibleItems.length === 0) return null;

    return (
      <div key={section.id} className={`${isCollapsed ? "mt-5" : "mt-4 first:mt-2"}`}>
        {!isCollapsed && (
          <div className="px-4 py-1 mb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
              {section.label}
            </span>
          </div>
        )}
        <ul className={`flex flex-col ${isCollapsed ? "gap-0" : "gap-0.5"}`}>
          {visibleItems.map((item) => {
            if (item.type === "collapsible") {
              const open = openCollapsible === item.id;
              const setOpen = (isOpen) => setOpenCollapsible(isOpen ? item.id : null);
              const flyoutContent = (
                <ul className="py-1">
                  {item.children
                    .filter(visible)
                    .map((child) => (
                      <li key={child.id}>
                        <NavLink
                          end
                          to={toPath(child.path)}
                          className={({isActive}) =>
                            `flex items-center px-2 py-1.5 rounded mx-1 text-xs transition-colors ${
                              isActive ? "text-white bg-white/10" : "text-gray-100 hover:bg-gray-700"
                            }`
                          }
                        >
                          {child.label}
                        </NavLink>
                      </li>
                    ))}
                </ul>
              );
              return (
                <li key={item.id} className={isCollapsed ? "mb-0 last:mb-0" : "mb-0.5 last:mb-0"}>
                  {renderCollapsible(item, open, setOpen, flyoutContent)}
                </li>
              );
            }
            return (
              <li key={item.id} className={isCollapsed ? "mb-0 last:mb-0" : "mb-0.5 last:mb-0"}>
                {renderNavLink(item)}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div className="w-0 shrink-0 lg:w-auto lg:min-w-fit">
      <div
        className={`fixed inset-0 bg-gray-900/30 z-40 lg:hidden lg:z-auto transition-opacity duration-200 ${
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
        onClick={() => setSidebarOpen(false)}
      />

      <div className="relative">
        <div
          id="sidebar"
          ref={sidebar}
          className={`flex lg:flex! flex-col absolute z-40 left-0 top-0 lg:static lg:left-auto lg:top-auto lg:translate-x-0 h-[100dvh] overflow-y-scroll lg:overflow-y-auto no-scrollbar w-64 lg:w-20 lg:sidebar-expanded:!w-64 2xl:w-64! shrink-0 bg-[#456564] p-4 transition-all duration-200 ease-in-out relative ${
            sidebarOpen ? "translate-x-0" : "-translate-x-64"
          } ${variant === "v2" ? "border-r border-white/10" : "shadow-xs"}`}
        >
          <div className="flex flex-col flex-1 min-h-0">
          <div className="flex justify-between lg:justify-center lg:sidebar-expanded:justify-between mb-10 pr-3 sm:px-2 lg:px-0">
            <button
              ref={trigger}
              className="lg:hidden text-white hover:text-white/80"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-controls="sidebar"
              aria-expanded={sidebarOpen}
            >
              <span className="sr-only">Close sidebar</span>
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.7 18.7l1.4-1.4L7.8 13H20v-2H7.8l4.3-4.3-1.4-1.4L4 12z" />
              </svg>
            </button>
            <NavLink end to={toPath("home")} className="block">
              <img src={Logo} alt="Logo" className="w-12 h-12 rounded-full object-contain flex-shrink-0" />
            </NavLink>
          </div>

          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1">
              <ul className={`mt-3 flex flex-col ${isCollapsed ? "gap-0" : "gap-0.5"}`}>
                {/* Home (standalone) */}
                {SIDEBAR_CONFIG.filter((s) => s.type === "link").map((item) => (
                  <li key={item.id} className={isCollapsed ? "mb-0 last:mb-0" : "mb-0.5 last:mb-0"}>
                    {renderNavLink(item)}
                  </li>
                ))}
              </ul>

              {/* Sections: PROPERTY, NETWORK, ADMIN */}
              {SIDEBAR_CONFIG.filter((s) => s.type === "section").map(renderSection)}

              {/* Professionals (Sample) — spacing when collapsed, divider when expanded */}
              <div className={`${isCollapsed ? "mt-5" : "mt-4 pt-3 border-t border-white/10"}`}>
                <ul className={`flex flex-col ${isCollapsed ? "gap-0" : "gap-0.5"}`}>
                  <li className={isCollapsed ? "mb-0 last:mb-0" : "mb-0.5 last:mb-0"}>
                    {renderNavLink(PROFESSIONALS_SAMPLE)}
                  </li>
                </ul>
              </div>
            </div>

            {/* Settings (bottom) — spacing when collapsed, divider when expanded */}
            <div className={`pt-4 mt-auto ${isCollapsed ? "" : "border-t border-white/10"}`}>
              {renderCollapsible(
                SETTINGS_CONFIG,
                openCollapsible === "settings",
                (isOpen) => setOpenCollapsible(isOpen ? "settings" : null),
                <ul className="py-1">
                  {SETTINGS_CONFIG.children
                    .filter(visible)
                    .map((child) => (
                      <li key={child.id}>
                        <NavLink
                          end
                          to={toPath(child.path)}
                          className={({isActive}) =>
                            `flex items-center px-2 py-1.5 rounded mx-1 text-xs transition-colors ${
                              isActive ? "text-white bg-white/10" : "text-gray-100 hover:bg-gray-700"
                            }`
                          }
                        >
                          {child.label}
                        </NavLink>
                      </li>
                    ))}
                </ul>,
              )}
            </div>
          </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          aria-label={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
          className="group/handle absolute right-0 top-1/2 h-16 w-7 -translate-y-1/2 translate-x-[80%] z-50 hidden lg:flex 2xl:hidden items-center justify-center cursor-col-resize focus:outline-none"
        >
          <span className="block h-8 w-[3.5px] rounded-full bg-gray-400/60 transition-all duration-150 group-hover/handle:opacity-0 group-focus-visible/handle:opacity-0" />
          <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover/handle:opacity-100 group-focus-visible/handle:opacity-100">
            {sidebarExpanded ? (
              <ChevronLeft className="h-6 w-6 text-gray-500 transition-colors duration-150 group-hover/handle:text-gray-600 group-active/handle:text-gray-600" strokeWidth={2} />
            ) : (
              <ChevronRight className="h-6 w-6 text-gray-500 transition-colors duration-150 group-hover/handle:text-gray-600 group-active/handle:text-gray-600" strokeWidth={2} />
            )}
          </span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;

import React, {useContext, useMemo} from "react";
import {Plus, Loader2} from "lucide-react";
import UserContext from "../../../context/UserContext";
import {useAuth} from "../../../context/AuthContext";

function HomeOpsTeam({
  teamMembers = [],
  onOpenShareModal,
  onMemberClick,
  hideAddButton,
  isLoadingTeam = false,
  compact = false,
}) {
  const {users = []} = useContext(UserContext);
  const {currentUser} = useAuth();

  const teamSectionTitle = useMemo(() => {
    const firstName =
      (currentUser?.name || "").trim().split(/\s+/)[0] ||
      currentUser?.firstName ||
      "";
    if (!firstName) return "Your Opsy team";
    const possessive = firstName.endsWith("s")
      ? `${firstName}'`
      : `${firstName}'s`;
    return `${possessive} Opsy Team`;
  }, [currentUser]);

  const isPropertyOwner = (m) =>
    !m?._pending && (m.property_role ?? "").toLowerCase() === "owner";

  /* HomeOps internal staff (platform role admin / super_admin) should only be
     visible to other admins/super_admins. Agents and homeowners viewing the
     property never see HomeOps staff in the team list. */
  const viewerIsAdmin = ["admin", "super_admin"].includes(
    (currentUser?.role ?? "").toLowerCase(),
  );
  const visibleMembers = useMemo(() => {
    const all = teamMembers ?? [];
    if (viewerIsAdmin) return all;
    return all.filter((m) => {
      if (m._pending) return true;
      const r = (m?.role ?? "").toLowerCase();
      return r !== "admin" && r !== "super_admin";
    });
  }, [teamMembers, viewerIsAdmin]);

  /* Sort so owner(s) appear first, then pending, then others */
  const sortedMembers = useMemo(() => {
    const list = [...visibleMembers];
    return list.sort((a, b) => {
      const aPending = a._pending === true;
      const bPending = b._pending === true;
      if (aPending && !bPending) return 1;
      if (!aPending && bPending) return -1;
      if (isPropertyOwner(a) && !isPropertyOwner(b)) return -1;
      if (!isPropertyOwner(a) && isPropertyOwner(b)) return 1;
      return 0;
    });
  }, [visibleMembers]);

  const owner = useMemo(
    () => sortedMembers.find(isPropertyOwner),
    [sortedMembers],
  );

  return (
    <section
      className={`rounded-2xl overflow-hidden border border-neutral-200/80 dark:border-neutral-700/50 bg-white dark:bg-neutral-900 ${
        compact ? "" : ""
      }`}
      style={
        compact
          ? undefined
          : {
              boxShadow:
                "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
            }
      }
    >
      <div
        className={`flex items-center justify-between ${
          compact
            ? "px-4 pt-4 pb-2"
            : "px-6 md:px-8 pt-6 md:pt-8 pb-3 md:pb-4"
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2
              className={`font-semibold text-neutral-900 dark:text-white mb-0.5 truncate ${
                compact ? "text-sm" : "text-xl md:text-2xl font-bold"
              }`}
            >
              {teamSectionTitle}
            </h2>
            {compact && !isLoadingTeam && (
              <button
                type="button"
                onClick={() => onOpenShareModal?.()}
                className="text-xs font-semibold text-[#456564] dark:text-[#7fa3a1] hover:underline shrink-0"
              >
                Manage
              </button>
            )}
          </div>
          {!compact && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              People with access to this property
            </p>
          )}
        </div>
      </div>

      <div
        className={`pt-0 ${
          compact ? "px-4 pb-4" : "px-6 md:px-8 pb-6 md:pb-8"
        }`}
      >
        {!compact && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.12em] opacity-70">
              Team members
            </span>
          </div>
        )}
        <div
          className={`flex min-h-0 ${
            compact
              ? "flex-col gap-2"
              : "items-center gap-4 flex-wrap min-h-[4.5rem]"
          }`}
          aria-busy={isLoadingTeam}
        >
        {isLoadingTeam ? (
          <div
            className="flex items-center gap-3 py-4 text-neutral-500 dark:text-neutral-400"
            role="status"
            aria-live="polite"
          >
            <Loader2
              className="w-5 h-5 shrink-0 animate-spin text-[#456564] dark:text-[#5a7a78]"
              aria-hidden
            />
            <span className="text-sm">Loading team members…</span>
          </div>
        ) : (
          sortedMembers?.map((member) => {
            const isOwner = member === owner;
            const isPending = member._pending === true;
            const initials = member.name
              ? member.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) || "?"
              : member.email?.charAt(0)?.toUpperCase() || "?";
            const userFromContext = users?.find(
              (u) =>
                u && member?.id != null && Number(u.id) === Number(member.id),
            );
            const photoUrl =
              member.image_url ??
              member.image ??
              member.avatar_url ??
              userFromContext?.image_url ??
              userFromContext?.image ??
              userFromContext?.avatarUrl ??
              userFromContext?.avatar;

            /* Platform role (agent, homeowner) — do not use property_role (owner/editor/viewer) here */
            const platformLower = (
              member.role ??
              userFromContext?.role ??
              ""
            ).toLowerCase();
            const propLower = (member.property_role ?? "").toLowerCase();
            const isInternalStaff =
              platformLower === "admin" || platformLower === "super_admin";
            const memberTab = (() => {
              const platform = platformLower;
              const prop = propLower;
              /* HomeOps internal staff open the "All" tab, never homeowner/agent. */
              if (platform === "admin" || platform === "super_admin")
                return "owner";
              if (platform === "agent") return "agent";
              if (platform === "homeowner" || platform === "owner")
                return "homeowner";
              if (
                ["insurer", "insurance", "insurance agent"].includes(platform)
              )
                return "insurance";
              if (
                ["mortgage partner", "mortgage", "mortgage agent"].includes(
                  platform,
                )
              )
                return "mortgage";
              if (prop === "owner") return "homeowner";
              if (["insurer", "insurance", "insurance agent"].includes(prop))
                return "insurance";
              if (
                ["mortgage partner", "mortgage", "mortgage agent"].includes(prop)
              )
                return "mortgage";
              return "homeowner";
            })();

            const isClickable = Boolean(onMemberClick);
            const handleMemberClick = isClickable
              ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMemberClick(memberTab);
                }
              : undefined;

            const roleLabel = (() => {
              const r = platformLower;
              if (r === "agent") return "Agent";
              if (r === "homeowner" || r === "owner") return "Homeowner";
              if (["insurer", "insurance", "insurance agent"].includes(r))
                return "Insurance";
              if (
                ["mortgage partner", "mortgage", "mortgage agent"].includes(r)
              )
                return "Mortgage";
              if (propLower === "viewer") return "Viewer";
              if (propLower === "owner") return "Homeowner";
              return "Editor";
            })();

            return (
              <div
                key={member.id ?? `pending-${member.email}`}
                role={isClickable ? "button" : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onClick={handleMemberClick}
                onKeyDown={
                  isClickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onMemberClick(memberTab);
                        }
                      }
                    : undefined
                }
                className={`flex items-center transition-colors duration-150 ${
                  compact
                    ? "gap-3 py-2.5 px-2.5 rounded-lg w-full"
                    : "gap-3 py-3 pl-3 pr-5 rounded-xl"
                } ${
                  isClickable ? "cursor-pointer" : "cursor-default"
                } ${
                  isPending
                    ? isClickable
                      ? "bg-neutral-100/80 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-600/60 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 hover:border-neutral-300 dark:hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#456564]/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
                      : "bg-neutral-100/80 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-600/60 opacity-75"
                    : "bg-neutral-50/80 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 border border-neutral-200/60 dark:border-neutral-700/50"
                }`}
              >
                <div
                  className={`rounded-full flex items-center justify-center text-white font-semibold overflow-hidden flex-shrink-0 ${
                    compact ? "w-10 h-10 text-sm" : "w-12 h-12 text-sm"
                  } ${
                    isPending
                      ? "bg-neutral-400 dark:bg-neutral-500"
                      : "bg-[#456564] dark:bg-[#5a7a78]"
                  }`}
                >
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={member.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className="font-semibold text-neutral-900 dark:text-white truncate leading-tight text-sm"
                    >
                      {member.name || member.email}
                    </p>
                    {isOwner && (
                      <span
                        className={`inline-flex items-center rounded-md bg-[#456564]/15 dark:bg-[#5a7a78]/25 text-[#456564] dark:text-[#5a7a78] font-semibold shrink-0 ${
                          compact
                            ? "px-2 py-0.5 text-[11px]"
                            : "px-2 py-0.5 text-xs"
                        }`}
                      >
                        Owner
                      </span>
                    )}
                    {!isOwner && !isPending && !isInternalStaff && compact && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[11px] font-medium text-neutral-600 dark:text-neutral-300 shrink-0">
                        {roleLabel}
                      </span>
                    )}
                    {isPending && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-neutral-200/80 dark:bg-neutral-700 text-[11px] font-medium text-neutral-600 dark:text-neutral-300 shrink-0">
                        Pending Invite
                      </span>
                    )}
                  </div>
                  {!isPending && (
                    <p
                      className={`text-neutral-500 dark:text-neutral-400 truncate leading-tight ${
                        compact ? "text-xs mt-0.5" : "text-xs"
                      }`}
                    >
                      {compact
                        ? member.email
                        : !isInternalStaff
                          ? roleLabel
                          : null}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}

        {!isLoadingTeam && !hideAddButton && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenShareModal?.();
          }}
          className={`border-2 border-dashed border-neutral-200 dark:border-neutral-600 flex items-center justify-center text-neutral-400 dark:text-neutral-500 hover:border-[#456564]/50 hover:text-[#456564] dark:hover:border-[#5a7a78]/50 dark:hover:text-[#5a7a78] hover:bg-[#456564]/5 transition-all duration-200 flex-shrink-0 ${
            compact
              ? "w-full rounded-lg py-2.5 gap-1.5 text-[13px] font-semibold text-neutral-600 dark:text-neutral-400"
              : "w-14 h-14 rounded-xl"
          }`}
          aria-label="Add team member"
          title="Add team member"
        >
          <Plus className={compact ? "w-4 h-4" : "w-6 h-6"} />
          {compact && <span>Add Member</span>}
        </button>
        )}
        </div>
      </div>
    </section>
  );
}

export default HomeOpsTeam;

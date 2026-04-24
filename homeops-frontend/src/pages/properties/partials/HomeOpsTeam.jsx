import React, {useContext, useMemo} from "react";
import {Plus, Mail, Loader2} from "lucide-react";
import UserContext from "../../../context/UserContext";
import {useAuth} from "../../../context/AuthContext";

function HomeOpsTeam({
  teamMembers = [],
  onOpenShareModal,
  onMemberClick,
  hideAddButton,
  isLoadingTeam = false,
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
      className="rounded-2xl overflow-hidden border border-neutral-200/80 dark:border-neutral-700/50 bg-white dark:bg-neutral-900"
      style={{
        boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-center justify-between px-6 md:px-8 pt-6 md:pt-8 pb-3 md:pb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-white mb-0.5">
            {teamSectionTitle}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            People with access to this property
          </p>
        </div>
      </div>

      <div className="px-6 md:px-8 pb-6 md:pb-8 pt-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.12em] opacity-70">
            Team members
          </span>
        </div>
        <div
          className="flex items-center gap-4 flex-wrap min-h-[4.5rem]"
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
            const memberTab = (() => {
              const platform = platformLower;
              const prop = propLower;
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
                className={`flex items-center gap-3 py-3 pl-3 pr-5 rounded-xl transition-colors duration-150 ${
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
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-semibold overflow-hidden flex-shrink-0 ${
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
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate leading-tight">
                      {member.name || member.email}
                    </p>
                    {isOwner && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#456564]/15 dark:bg-[#5a7a78]/25 text-[#456564] dark:text-[#5a7a78] text-xs font-semibold shrink-0">
                        Owner
                      </span>
                    )}
                    {isPending && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-200/60 dark:bg-neutral-600/40 text-neutral-600 dark:text-neutral-400 text-xs font-semibold shrink-0">
                        <Mail className="w-3 h-3" />
                        Pending
                      </span>
                    )}
                  </div>
                  {!isPending && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate leading-tight">
                      {(() => {
                        const r = platformLower;
                        if (r === "agent") return "Agent";
                        if (r === "homeowner" || r === "owner")
                          return "Homeowner";
                        if (
                          ["insurer", "insurance", "insurance agent"].includes(r)
                        )
                          return "Insurance";
                        if (
                          [
                            "mortgage partner",
                            "mortgage",
                            "mortgage agent",
                          ].includes(r)
                        )
                          return "Mortgage";
                        if (propLower === "viewer") return "Viewer";
                        if (propLower === "owner") return "Homeowner";
                        return "Editor";
                      })()}
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
          className="w-14 h-14 rounded-xl border-2 border-dashed border-neutral-200 dark:border-neutral-600 flex items-center justify-center text-neutral-400 dark:text-neutral-500 hover:border-[#456564]/50 hover:text-[#456564] dark:hover:border-[#5a7a78]/50 dark:hover:text-[#5a7a78] hover:bg-[#456564]/5 transition-all duration-200 flex-shrink-0"
          aria-label="Add team member"
          title="Add team member"
        >
          <Plus className="w-6 h-6" />
        </button>
        )}
        </div>
      </div>
    </section>
  );
}

export default HomeOpsTeam;

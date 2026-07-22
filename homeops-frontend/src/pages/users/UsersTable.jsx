import React, {useMemo} from "react";
import {useTranslation} from "react-i18next";
import {Info} from "lucide-react";
import DataTable from "../../components/DataTable";
import DataTableItem from "../../components/DataTableItem";
import {Popover, PopoverContent, PopoverTrigger} from "../../components/ui/popover";
import UserActionsMenu from "./UserActionsMenu";
import {getUserAccountStatus, isDemoExpiryPast} from "./userSort";

function StatusColumnHelp({showDemoExpiry}) {
  const {t} = useTranslation();

  const statuses = [
    {
      key: "active",
      label: t("active") || "Active",
      description: t("users.statusHelpActive", {
        defaultValue:
          "Account is activated and onboarding is complete. The user can sign in and use the product.",
      }),
      badgeClass:
        "bg-[#d3f4e3] dark:bg-[#173c36] text-[#2a9f52] dark:text-[#258c4d]",
    },
    {
      key: "onboarding",
      label: t("users.statusOnboarding", {defaultValue: "Onboarding"}),
      description: t("users.statusHelpOnboarding", {
        defaultValue:
          "Account is activated (can sign in), but product setup is not finished yet.",
      }),
      badgeClass:
        "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
    },
    {
      key: "pending",
      label: t("pending") || "Pending",
      description: t("users.statusHelpPending", {
        defaultValue:
          "Account exists but is not activated yet — typically waiting for the invite to be accepted or a password to be set.",
      }),
      badgeClass:
        "bg-[#fddddd] dark:bg-[#402431] text-[#e63939] dark:text-[#c23437]",
    },
  ];

  if (showDemoExpiry) {
    statuses.push({
      key: "expired",
      label: t("demoAccountExpiredBadge") || "Expired",
      description: t("users.statusHelpExpired", {
        defaultValue:
          "Demo access window has ended. The user can no longer sign in on the demo site.",
      }),
      badgeClass:
        "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200",
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#456564]/40"
          aria-label={t("users.statusHelpAria", {
            defaultValue: "What status means",
          })}
        >
          <Info className="h-3 w-3" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-80 p-3"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 mb-2">
          {t("users.statusHelpTitle", {defaultValue: "Status meanings"})}
        </p>
        <ul className="space-y-2.5">
          {statuses.map((status) => (
            <li key={status.key} className="flex gap-2 items-start">
              <span
                className={`mt-0.5 shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.badgeClass}`}
              >
                {status.label}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-300 leading-snug">
                {status.description}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

function formatDemoExpiryDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatDemoExpiryRemaining(iso, t) {
  if (!iso) return null;
  const expiresMs = new Date(iso).getTime();
  if (Number.isNaN(expiresMs)) return null;

  const diffMs = expiresMs - Date.now();
  if (diffMs <= 0) {
    return t("demoExpiryRemainingExpired", {defaultValue: "Expired"});
  }

  const days = Math.floor(diffMs / MS_PER_DAY);
  const hours = Math.floor((diffMs % MS_PER_DAY) / MS_PER_HOUR);
  const minutes = Math.floor((diffMs % MS_PER_HOUR) / MS_PER_MINUTE);

  if (days >= 1) {
    return t("demoExpiryRemainingDays", {
      count: days,
      defaultValue: "{{count}} day remaining",
      defaultValue_plural: "{{count}} days remaining",
    });
  }
  if (hours >= 1) {
    return t("demoExpiryRemainingHours", {
      count: hours,
      defaultValue: "{{count}} hour remaining",
      defaultValue_plural: "{{count}} hours remaining",
    });
  }
  return t("demoExpiryRemainingMinutes", {
    count: Math.max(1, minutes),
    defaultValue: "{{count}} minute remaining",
    defaultValue_plural: "{{count}} minutes remaining",
  });
}

function UsersTable({
  users,
  loading = false,
  onToggleSelect,
  selectedItems,
  totalUsers,
  currentPage,
  itemsPerPage,
  sortConfig,
  onSort,
  onUserClick,
  isSuperAdmin = false,
  isImpersonating = false,
  currentUserId,
  onImpersonate,
  onReconcileBilling,
  onResendInvitation,
  resendingInvitationUserId,
  showDemoExpiry = false,
}) {
  const {t} = useTranslation();

  // Get current page items
  const currentUsers = useMemo(() => {
    if (!users) return [];
    const indexOfLastContact = currentPage * itemsPerPage;
    const indexOfFirstContact = indexOfLastContact - itemsPerPage;
    return users.slice(indexOfFirstContact, indexOfLastContact);
  }, [currentPage, itemsPerPage, users]);

  // Check if all current page items are selected
  const allSelected = useMemo(() => {
    return (
      currentUsers.length > 0 &&
      currentUsers.every((user) => selectedItems.includes(user.id))
    );
  }, [currentUsers, selectedItems]);

  // Role pill colors (matching filter dropdown style)
  const getRolePillStyles = (role) => {
    const r = (role || "").toLowerCase();
    const styles = {
      admin:
        "bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400",
      agent:
        "bg-[#3b82f6]/20 dark:bg-[#3b82f6]/20 text-[#1d4ed8] dark:text-[#93c5fd]",
      homeowner:
        "bg-[#22c55e]/20 dark:bg-[#22c55e]/20 text-[#15803d] dark:text-[#86efac]",
      super_admin:
        "bg-[#9333ea]/20 dark:bg-[#9333ea]/20 text-[#7c3aed] dark:text-[#d8b4fe]",
      superadmin:
        "bg-[#9333ea]/20 dark:bg-[#9333ea]/20 text-[#7c3aed] dark:text-[#d8b4fe]",
    };
    return (
      styles[r] ||
      "bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300"
    );
  };

  const getRoleLabel = (role) => {
    const r = (role || "").toLowerCase();
    const labels = {
      admin: "Admin",
      agent: t("subscriptionProducts.agent") || "Agent",
      homeowner: t("subscriptionProducts.homeowner") || "Homeowner",
      super_admin: "Super Admin",
      superadmin: "Super Admin",
    };
    return (
      labels[r] || (role ? role.charAt(0).toUpperCase() + role.slice(1) : "—")
    );
  };

  // Define columns configuration
  const columns = useMemo(() => {
    const cols = [
      {
        key: "name",
        label: t("name"),
        sortable: true,
      },
      {
        key: "email",
        label: t("email"),
        sortable: true,
      },
      {
        key: "accountUrl",
        label: t("users.accountUrl", {defaultValue: "Account URL"}),
        sortable: true,
        render: (value) => {
          const url = (value || "").replace(/^\/+/, "");
          if (!url) {
            return <span className="text-gray-400 dark:text-gray-500">—</span>;
          }
          return (
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[12rem] inline-block align-bottom">
              {url}
            </span>
          );
        },
      },
      {
        key: "role",
        label: t("role"),
        sortable: true,
        render: (value) => (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getRolePillStyles(
              value,
            )}`}
          >
            {getRoleLabel(value)}
          </span>
        ),
      },
      {
        key: "status",
        label: t("status") || "Status",
        sortable: true,
        headerExtra: <StatusColumnHelp showDemoExpiry={showDemoExpiry} />,
        render: (value, item) => {
          const accountStatus = getUserAccountStatus(item, {
            considerDemoExpiry: showDemoExpiry,
          });

          if (accountStatus === "expired") {
            return (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                {t("demoAccountExpiredBadge") || "Expired"}
              </span>
            );
          }

          if (accountStatus === "onboarding") {
            return (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">
                {t("users.statusOnboarding", {defaultValue: "Onboarding"})}
              </span>
            );
          }

          return (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                accountStatus === "active"
                  ? "bg-[#d3f4e3] dark:bg-[#173c36] text-[#2a9f52] dark:text-[#258c4d]"
                  : "bg-[#fddddd] dark:bg-[#402431] text-[#e63939] dark:text-[#c23437]"
              }`}
            >
              {accountStatus === "active"
                ? t("active") || "Active"
                : t("pending") || "Pending"}
            </span>
          );
        },
      },
    ];

    if (showDemoExpiry) {
      cols.push({
        key: "demoExpiresAt",
        label: t("demoExpiryColumn", {defaultValue: "Expires"}),
        sortable: true,
        render: (value, item) => {
          const demoExpiresAt = item.demoExpiresAt;
          if (!demoExpiresAt) {
            return <span className="text-gray-400 dark:text-gray-500">—</span>;
          }
          const expired = isDemoExpiryPast(demoExpiresAt);
          const dateLabel = formatDemoExpiryDate(demoExpiresAt);
          const remainingLabel = formatDemoExpiryRemaining(demoExpiresAt, t);
          return (
            <div className="flex flex-col gap-0.5 min-w-0">
              <span
                className={`text-sm tabular-nums ${
                  expired
                    ? "text-amber-800 dark:text-amber-200"
                    : "text-gray-800 dark:text-gray-100"
                }`}
              >
                {dateLabel}
              </span>
              <span
                className={`text-xs ${
                  expired
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {remainingLabel}
              </span>
            </div>
          );
        },
      });
    }

    cols.push(
      {
        key: "billingState",
        label: t("users.billing", {defaultValue: "Billing"}),
        sortable: true,
        render: (value, item) => {
          const badge = (classes, label) => (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${classes}`}
            >
              {label}
            </span>
          );
          const gray =
            "bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300";
          const green =
            "bg-[#d3f4e3] dark:bg-[#173c36] text-[#2a9f52] dark:text-[#258c4d]";
          const blue =
            "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
          const sky =
            "bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300";
          const amber =
            "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400";
          const red =
            "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400";

          const role = (item.role || "").toLowerCase();
          if (
            role === "super_admin" ||
            role === "admin" ||
            role === "superadmin"
          ) {
            return badge(
              gray,
              t("users.billingExemptStaff", {defaultValue: "Exempt (staff)"}),
            );
          }

          /* Account-scoped listings don't include billing fields; avoid guessing. */
          if (item.paidRequired === undefined) {
            return <span className="text-gray-400 dark:text-gray-500">—</span>;
          }

          /* Onboarding lives in Status; billing is N/A until setup finishes. */
          if (item.onboardingCompleted === false) {
            return <span className="text-gray-400 dark:text-gray-500">—</span>;
          }

          const latestStatus = item.latestSubscriptionStatus;
          const isStripe = item.latestSubscriptionIsStripe === true;
          const hasCurrentSub =
            latestStatus === "active" || latestStatus === "trialing";
          const planCode = item.latestSubscriptionPlanCode || "";
          const planPrice = Number(item.latestSubscriptionPlanPrice);
          const freeTiers = ["free", "agent_beta", "homeowner_beta", "beta_homeowner"];
          const isFreeAccount =
            ["agent_free", "homeowner_free"].includes(planCode) ||
            planCode.endsWith("_free") ||
            (Number.isFinite(planPrice) && planPrice === 0) ||
            freeTiers.includes(item.subscriptionTier);

          if (item.paidRequired) {
            if (hasCurrentSub && isStripe && latestStatus === "trialing") {
              const ends = item.latestSubscriptionPeriodEnd
                ? new Date(item.latestSubscriptionPeriodEnd).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                    },
                  )
                : null;
              return badge(
                blue,
                ends
                  ? t("users.billingTrialEnds", {
                      date: ends,
                      defaultValue: "Trial ends {{date}}",
                    })
                  : t("users.billingTrialing", {defaultValue: "Trialing"}),
              );
            }
            if (hasCurrentSub && isStripe) {
              return badge(
                green,
                t("users.billingActivePaid", {defaultValue: "Active (paid)"}),
              );
            }
            if (hasCurrentSub && !isStripe) {
              if (isFreeAccount) {
                return badge(
                  sky,
                  t("users.billingFreeAccount", {
                    defaultValue: "Free account",
                  }),
                );
              }
              return badge(
                amber,
                t("users.billingComped", {defaultValue: "No payment on file"}),
              );
            }
            if (latestStatus === "past_due") {
              return badge(
                red,
                t("users.billingPastDue", {defaultValue: "Past due"}),
              );
            }
            return badge(
              red,
              t("users.billingAwaitingPayment", {
                defaultValue: "Awaiting payment",
              }),
            );
          }

          return badge(
            sky,
            t("users.billingFreeAccount", {defaultValue: "Free account"}),
          );
        },
      },
      {
        key: "billingActions",
        label: "Actions",
        sortable: false,
        render: (value, item) => (
          <UserActionsMenu
            user={item}
            currentUserId={currentUserId}
            isSuperAdmin={isSuperAdmin}
            isImpersonating={isImpersonating}
            onImpersonate={onImpersonate}
            onReconcileBilling={onReconcileBilling}
            onResendInvitation={onResendInvitation}
            resendingInvitation={resendingInvitationUserId === item.id}
          />
        ),
      },
    );

    return cols;
  }, [
    t,
    showDemoExpiry,
    currentUserId,
    isSuperAdmin,
    isImpersonating,
    onImpersonate,
    onReconcileBilling,
    onResendInvitation,
    resendingInvitationUserId,
  ]);

  // Custom item renderer
  const renderItem = (item, handleSelect, selectedItems, onItemClick) => (
    <DataTableItem
      item={item}
      columns={columns}
      onSelect={handleSelect}
      isSelected={selectedItems.includes(item.id)}
      onItemClick={onItemClick}
    />
  );

  return (
    <DataTable
      items={currentUsers}
      columns={columns}
      onItemClick={onUserClick}
      onSelect={onToggleSelect}
      selectedItems={selectedItems}
      totalItems={totalUsers}
      title="allUsers"
      sortConfig={sortConfig}
      onSort={onSort}
      emptyMessage="noUsersFound"
      loading={loading}
      renderItem={renderItem}
      allSelected={allSelected}
    />
  );
}

export default UsersTable;

import React, {useMemo} from "react";
import {useTranslation} from "react-i18next";
import DataTable from "../../components/DataTable";
import DataTableItem from "../../components/DataTableItem";
import UserActionsMenu from "./UserActionsMenu";

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

  function formatDemoExpiryBadge(iso) {
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

  function isDemoExpiryPast(iso) {
    if (!iso) return false;
    const tMs = new Date(iso).getTime();
    return !Number.isNaN(tMs) && tMs <= Date.now();
  }

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
      admin: "bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400",
      agent: "bg-[#3b82f6]/20 dark:bg-[#3b82f6]/20 text-[#1d4ed8] dark:text-[#93c5fd]",
      homeowner: "bg-[#22c55e]/20 dark:bg-[#22c55e]/20 text-[#15803d] dark:text-[#86efac]",
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
    return labels[r] || (role ? role.charAt(0).toUpperCase() + role.slice(1) : "—");
  };

  // Define columns configuration
  const columns = [
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
      render: (value, item) => {
        const isActive = item.isActive || item.is_active;
        const demoExpiresAt = item.demoExpiresAt;
        const showExpiryBadge = showDemoExpiry && demoExpiresAt;
        const expired = showExpiryBadge && isDemoExpiryPast(demoExpiresAt);
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isActive
                  ? "bg-[#d3f4e3] dark:bg-[#173c36] text-[#2a9f52] dark:text-[#258c4d]"
                  : "bg-[#fddddd] dark:bg-[#402431] text-[#e63939] dark:text-[#c23437]"
              }`}
            >
              {isActive ? t("active") || "Active" : t("pending") || "Pending"}
            </span>
            {showExpiryBadge ? (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  expired
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
                    : "bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300"
                }`}
              >
                {expired
                  ? t("demoAccountExpiredBadge") || "Expired"
                  : t("demoAccountExpiresBadge", {
                      time: formatDemoExpiryBadge(demoExpiresAt),
                      defaultValue: "Expires {{time}}",
                    })}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "billingState",
      label: t("users.billing", {defaultValue: "Billing"}),
      sortable: false,
      render: (value, item) => {
        const badge = (classes, label) => (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${classes}`}
          >
            {label}
          </span>
        );
        const gray = "bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300";
        const green = "bg-[#d3f4e3] dark:bg-[#173c36] text-[#2a9f52] dark:text-[#258c4d]";
        const blue = "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
        const amber = "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400";
        const red = "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400";

        const role = (item.role || "").toLowerCase();
        if (role === "super_admin" || role === "admin" || role === "superadmin") {
          return badge(gray, t("users.billingExemptStaff", {defaultValue: "Exempt (staff)"}));
        }

        /* Account-scoped listings don't include billing fields; avoid guessing. */
        if (item.paidRequired === undefined) {
          return <span className="text-gray-400 dark:text-gray-500">—</span>;
        }

        if (item.onboardingCompleted === false) {
          return badge(
            gray,
            t("users.billingOnboardingIncomplete", {defaultValue: "Onboarding incomplete"}),
          );
        }

        const latestStatus = item.latestSubscriptionStatus;
        const isStripe = item.latestSubscriptionIsStripe === true;
        const hasCurrentSub = latestStatus === "active" || latestStatus === "trialing";

        if (item.paidRequired) {
          if (hasCurrentSub && isStripe && latestStatus === "trialing") {
            const ends = item.latestSubscriptionPeriodEnd
              ? new Date(item.latestSubscriptionPeriodEnd).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : null;
            return badge(
              blue,
              ends
                ? t("users.billingTrialEnds", {date: ends, defaultValue: "Trial ends {{date}}"})
                : t("users.billingTrialing", {defaultValue: "Trialing"}),
            );
          }
          if (hasCurrentSub && isStripe) {
            return badge(green, t("users.billingActivePaid", {defaultValue: "Active (paid)"}));
          }
          if (hasCurrentSub && !isStripe) {
            return badge(amber, t("users.billingComped", {defaultValue: "No payment on file"}));
          }
          if (latestStatus === "past_due") {
            return badge(red, t("users.billingPastDue", {defaultValue: "Past due"}));
          }
          return badge(red, t("users.billingAwaitingPayment", {defaultValue: "Awaiting payment"}));
        }

        return badge(gray, t("users.billingFreePlan", {defaultValue: "Free plan"}));
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
  ];

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

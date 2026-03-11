import React, {useMemo} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams} from "react-router-dom";
import DataTable from "../../components/DataTable";
import DataTableItem from "../../components/DataTableItem";

function UsersTable({
  users,
  onToggleSelect,
  selectedItems,
  totalUsers,
  currentPage,
  itemsPerPage,
  sortConfig,
  onSort,
  onUserClick,
}) {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {accountUrl} = useParams();

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
      admin: "bg-[#6366f1] dark:bg-[#4f46e5]/30 text-[#4338ca] dark:text-[#a5b4fc]",
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
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isActive
                ? "bg-[#d3f4e3] dark:bg-[#173c36] text-[#2a9f52] dark:text-[#258c4d]"
                : "bg-[#fddddd] dark:bg-[#402431] text-[#e63939] dark:text-[#c23437]"
            }`}
          >
            {isActive ? t("active") || "Active" : t("pending") || "Pending"}
          </span>
        );
      },
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
      renderItem={renderItem}
      allSelected={allSelected}
    />
  );
}

export default UsersTable;

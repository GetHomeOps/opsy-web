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

  console.log("Current users from DataTable: ", currentUsers);
  console.log("Users from UsersTable: ", users);


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

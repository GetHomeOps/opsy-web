import React from "react";
import {useTranslation} from "react-i18next";
import DataTableItem from "../../components/DataTableItem";

function ContactsTableItem({
  contact,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
}) {
  const {t} = useTranslation();

  const columns = [
    {
      key: "name",
      label: t("name"),
      className: "font-medium text-gray-800 dark:text-gray-100",
    },
    {
      key: "type_id",
      label: t("type"),
      render: (value) => (value === 1 ? t("individual") : t("company")),
      className: "text-gray-600 dark:text-gray-300",
    },
    {
      key: "email",
      label: t("email"),
      className: "text-gray-600 dark:text-gray-300",
    },
    {
      key: "phone",
      label: t("phone"),
      className: "text-gray-600 dark:text-gray-300",
    },
    {
      key: "job_position",
      label: t("jobPosition"),
      className: "text-gray-600 dark:text-gray-300",
    },
  ];

  return (
    <DataTableItem
      item={contact}
      columns={columns}
      isSelected={isSelected}
      onSelect={onToggleSelect}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}

export default ContactsTableItem;

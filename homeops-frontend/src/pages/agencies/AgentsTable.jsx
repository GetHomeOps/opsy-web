import React from "react";
import {useTranslation} from "react-i18next";
import DataTable from "../../components/DataTable";
import DataTableItem from "../../components/DataTableItem";

function AgentsTable({
  agents,
  loading = false,
  totalAgents,
  sortConfig,
  onSort,
}) {
  const {t} = useTranslation();
  const rowItems = agents ?? [];

  const columns = [
    {
      key: "name",
      label: "name",
      sortable: true,
      render: (value) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {value || <span className="text-gray-400">&mdash;</span>}
        </span>
      ),
    },
    {
      key: "email",
      label: "email",
      sortable: true,
      render: (value) => (
        <span className="text-gray-700 dark:text-gray-300">
          {value || <span className="text-gray-400">&mdash;</span>}
        </span>
      ),
    },
    {
      key: "agency",
      label: "agency",
      sortable: true,
      render: (value) => (
        <span className="text-gray-700 dark:text-gray-300">
          {value || <span className="text-gray-400">&mdash;</span>}
        </span>
      ),
    },
    {
      key: "office",
      label: "Office",
      sortable: true,
      render: (value) => (
        <span className="text-gray-700 dark:text-gray-300">
          {value || <span className="text-gray-400">&mdash;</span>}
        </span>
      ),
    },
    {
      key: "team",
      label: "Team",
      sortable: true,
      render: (value) => (
        <span className="text-gray-700 dark:text-gray-300">
          {value || <span className="text-gray-400">&mdash;</span>}
        </span>
      ),
    },
    {
      key: "status",
      label: "status",
      sortable: true,
      render: (value) =>
        value === "affiliated" ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#d3f4e3] dark:bg-[#173c36] text-[#2a9f52] dark:text-[#258c4d]">
            {t("affiliated") || "Affiliated"}
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300">
            {t("unaffiliated") || "Unaffiliated"}
          </span>
        ),
    },
  ];

  const renderItem = (item) => (
    <DataTableItem item={item} columns={columns} selectable={false} />
  );

  return (
    <DataTable
      items={rowItems}
      columns={columns}
      totalItems={totalAgents}
      title="agents"
      sortConfig={sortConfig}
      onSort={onSort}
      renderItem={renderItem}
      loading={loading}
      emptyMessage="No agents found"
      selectable={false}
    />
  );
}

export default AgentsTable;

import React, {useMemo} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams} from "react-router-dom";
import DataTable from "../../components/DataTable";
import DataTableItem from "../../components/DataTableItem";

function ContactsTable({
  contacts,
  onToggleSelect,
  selectedItems,
  totalContacts,
  currentPage,
  itemsPerPage,
  sortConfig,
  onSort,
}) {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {accountUrl} = useParams();

  // Get current page items
  const currentContacts = useMemo(() => {
    if (!contacts) return [];
    const indexOfLastContact = currentPage * itemsPerPage;
    const indexOfFirstContact = indexOfLastContact - itemsPerPage;
    return contacts.slice(indexOfFirstContact, indexOfLastContact);
  }, [currentPage, itemsPerPage, contacts]);

  // Check if all current page items are selected
  const allSelected = useMemo(() => {
    return (
      currentContacts.length > 0 &&
      currentContacts.every((contact) => selectedItems.includes(contact.id))
    );
  }, [currentContacts, selectedItems]);

  // Define columns configuration
  const columns = [
    {
      key: "name",
      label: t("name"),
      sortable: true,
    },
    {
      key: "type_id",
      label: t("type"),
      sortable: true,
      render: (value) => (value === 1 ? t("individual") : t("company")),
    },
    {
      key: "email",
      label: t("email"),
      sortable: true,
    },
    {
      key: "phone",
      label: t("phone"),
      sortable: true,
    },
    {
      key: "job_position",
      label: t("jobPosition"),
      sortable: true,
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
      items={currentContacts}
      columns={columns}
      onItemClick={(contact) => {
        const currentIndex = contacts.findIndex((c) => c.id === contact.id);
        navigate(`/${accountUrl}/contacts/${contact.id}`, {
          state: {
            currentIndex: currentIndex + 1,
            totalItems: contacts.length,
            visibleContactIds: contacts.map((contact) => contact.id),
          },
        });
      }}
      onSelect={onToggleSelect}
      selectedItems={selectedItems}
      totalItems={totalContacts}
      title="allContacts"
      sortConfig={sortConfig}
      onSort={onSort}
      emptyMessage="contacts.emptyState"
      renderItem={renderItem}
      allSelected={allSelected}
    />
  );
}

export default ContactsTable;

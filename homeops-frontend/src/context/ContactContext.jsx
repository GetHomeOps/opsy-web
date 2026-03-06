import React, {
  createContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useContext,
} from "react";
import {useTableSort} from "../hooks/useTableSort";
import AppApi from "../api/api";
import {useAuth} from "./AuthContext";
import {useTranslation} from "react-i18next";
import useUniqueIdentifiers from "../hooks/useUniqueIdentifiers";
import useLocalStorage from "../hooks/useLocalStorage";
import useCurrentAccount from "../hooks/useCurrentAccount";

const ContactContext = createContext();

/*
Context for Contacts

State:
- contacts: All contacts from backend
- selectedItems: Items selected from the list
- viewMode: View mode selected (e.g. list, group by, etc.)
- currentUser: Current logged-in user
*/
export function ContactProvider({children}) {
  const [contacts, setContacts] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [viewMode, setViewMode] = useLocalStorage("contacts-view-mode", "list");
  const {currentUser, isLoading} = useAuth();
  const {t} = useTranslation();

  const [testVariable, setTestVariable] = useState([]);

  const {generateUniqueName} = useUniqueIdentifiers({
    items: contacts,
    nameKey: "name",
    itemType: "contact",
  });

  const {currentAccount} = useCurrentAccount();

  const customListComparators = {
    // Generic comparator that works for any field
    default: (a, b, direction, key) => {
      const valueA = (a[key] || "").toString().toLowerCase();
      const valueB = (b[key] || "").toString().toLowerCase();
      return direction === "asc"
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    },
  };

  const {
    sortedItems: listSortedItems,
    sortConfig: listSortConfig,
    handleSort: handleListSort,
  } = useTableSort(contacts, "name", false, {
    storageKey: "contacts-sort",
    customComparators: customListComparators,
  });

  const fetchContacts = useCallback(async () => {
    if (isLoading || !currentUser) return;

    try {
      let fetchedContacts = [];

      if (currentAccount?.id) {
        fetchedContacts = await AppApi.getContactsByAccountId(currentAccount.id);
      }

      setContacts(fetchedContacts || []);
    } catch (err) {
      console.error("There was an error retrieving contacts:", err);
      setContacts([]);
    }
  }, [isLoading, currentUser, currentAccount?.id]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const refreshContacts = useCallback(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Function to get the current view's contacts
  const getCurrentViewContacts = useCallback(() => {
    return contacts;
  }, [contacts]);

  // Function to get the list view contacts
  const getListViewContacts = useCallback(() => {
    return contacts;
  }, [contacts]);

  // Function to get the group view contacts
  const getGroupViewContacts = useCallback(() => {
    return contacts;
  }, [contacts]);

  // Add contact to account
  const addContactToAccount = async (data) => {
    try {
      await AppApi.addContactToAccount(data);
      console.log(
        `Contact ${data.contactId} successfully added to account ${data.accountId}`,
      );
    } catch (error) {
      console.error("Error adding contact to account:", error);
      // Don't throw error here - allow caller to handle it if needed
      throw error;
    }
  };

  // Create a new contact
  const createContact = async (contactData) => {
    try {
      // Include accountId in the request so backend can handle both operations atomically
      const dataWithAccount = currentAccount?.id
        ? {...contactData, accountId: currentAccount.id}
        : contactData;

      const res = await AppApi.createContact(dataWithAccount);
      if (res) {
        setContacts((prevContacts) => [...prevContacts, res]);
        return res;
      }
    } catch (error) {
      console.error("Error creating contact:", error);
      throw error;
    }
  };

  // Update an existing contact
  const updateContact = async (id, contactData) => {
    try {
      const res = await AppApi.updateContact(id, contactData);
      if (res) {
        setContacts((prevContacts) =>
          prevContacts.map((contact) =>
            contact.id === Number(id) ? res : contact,
          ),
        );
        return res;
      }
    } catch (error) {
      console.error("Error updating contact:", error);
      throw error;
    }
  };

  // Delete a contact
  const deleteContact = async (id) => {
    try {
      let res = await AppApi.deleteContact(id);

      if (res) {
        setContacts((prevContacts) =>
          prevContacts.filter((contact) => contact.id !== Number(id)),
        );
        return res;
      }
    } catch (error) {
      console.error("Error deleting contact:", error);
      throw error;
    }
  };

  /* Duplicate Contact */
  async function duplicateContact(contactToDuplicate) {
    if (!contactToDuplicate) return null;

    try {
      const uniqueName = generateUniqueName(contactToDuplicate.name);

      const contactData = {
        name: uniqueName,
        image: contactToDuplicate.image || "",
        street1: contactToDuplicate.street1 || "",
        street2: contactToDuplicate.street2 || "",
        city: contactToDuplicate.city || "",
        state: contactToDuplicate.state || "",
        zip_code: contactToDuplicate.zip_code || contactToDuplicate.zip || "",
        country: contactToDuplicate.country || "",
        country_code: contactToDuplicate.country_code || "",
        job_position: contactToDuplicate.job_position || "",
        phone: contactToDuplicate.phone || "",
        email: contactToDuplicate.email || "",
        website: contactToDuplicate.website || "",
        tagIds: Array.isArray(contactToDuplicate.tags)
          ? contactToDuplicate.tags.map((t) =>
              typeof t === "object" && t?.id != null ? t.id : t,
            )
          : [],
      };

      const res = await createContact(contactData);

      //Get the current view's contacts after sorting
      const currentViewContacts = getCurrentViewContacts();
      const newIndex = currentViewContacts.findIndex(
        (contact) => contact.id === res.id,
      );

      return {...res, _index: newIndex + 1};
    } catch (error) {
      throw error;
    }
  }

  /* Handles bulk duplication of selected contacts */
  async function bulkDuplicateContacts(selectedContactsIds) {
    if (!selectedContactsIds || selectedContactsIds.length === 0) return [];

    const results = [];

    try {
      // Duplicate each selected contact
      for (const contactId of selectedContactsIds) {
        const contactToDuplicate = contacts.find(
          (contact) => contact.id === contactId,
        );
        if (contactToDuplicate) {
          const result = await duplicateContact(contactToDuplicate);
          if (result) {
            results.push(result);
          }
        }
      }
      return results;
    } catch (error) {
      throw error;
    }
  }

  /* Handle selection state */
  const handleToggleSelection = (ids, isSelected) => {
    if (Array.isArray(ids)) {
      if (typeof isSelected === "boolean") {
        setSelectedItems((prev) => {
          if (isSelected) {
            return [...new Set([...prev, ...ids])];
          } else {
            return prev.filter((id) => !ids.includes(id));
          }
        });
      } else {
        setSelectedItems(ids);
      }
    } else {
      setSelectedItems((prev) => {
        if (prev.includes(ids)) {
          return prev.filter((id) => id !== ids);
        } else {
          return [...prev, ids];
        }
      });
    }
  };

  function handleTestVariableChange(testVar) {
    setTestVariable((prev) => [...prev, testVar]);
  }

  const contextValue = useMemo(
    () => ({
      contacts,
      selectedItems,
      setSelectedItems,
      sortConfig: listSortConfig,
      handleSort: handleListSort,
      viewMode,
      setViewMode,
      createContact,
      updateContact,
      deleteContact,
      duplicateContact,
      bulkDuplicateContacts,
      refreshContacts,
      getCurrentViewContacts,
      getListViewContacts,
      getGroupViewContacts,
      handleToggleSelection,
      listSortedItems: listSortedItems || [],
      currentAccount,
      testVariable,
      handleTestVariableChange,
    }),
    [
      contacts,
      selectedItems,
      listSortConfig,
      listSortedItems,
      viewMode,
      currentAccount,
      handleListSort,
      refreshContacts,
      testVariable,
      handleTestVariableChange,
    ],
  );

  return (
    <ContactContext.Provider value={contextValue}>
      {children}
    </ContactContext.Provider>
  );
}

export default ContactContext;

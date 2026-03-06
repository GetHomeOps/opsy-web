import React, {
  useReducer,
  useEffect,
  useContext,
  useState,
  useRef,
  useCallback,
} from "react";
import {useNavigate, useParams, useLocation, NavLink} from "react-router-dom";
import {
  AlertCircle,
  Phone,
  Mail,
  User,
  Briefcase,
  Globe,
  MapPin,
  Building,
  CreditCard,
  FileText,
  X,
  ChevronDown,
} from "lucide-react";
import Banner from "../../partials/containers/Banner";
import ModalBlank from "../../components/ModalBlank";
import {useTranslation} from "react-i18next";
import DropdownFilter from "../../components/DropdownFilter";
import contactContext from "../../context/ContactContext";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {useAutoCloseBanner} from "../../hooks/useAutoCloseBanner";
import {countries} from "../../data/countries";
import {usStates} from "../../data/states";
import {motion, AnimatePresence, useAnimationControls} from "framer-motion";
import SelectDropdown from "./SelectDropdown";
import {
  mapBackendToFrontend,
  mapFrontendToBackend,
  initialFormData,
} from "./helpers/contactFormMapping";
import AppApi from "../../api/api";
import useImageUpload from "../../hooks/useImageUpload";
import ImageUploadField from "../../components/ImageUploadField";
import UpgradePrompt from "../../components/UpgradePrompt";

const initialState = {
  formData: initialFormData,
  errors: {},
  isSubmitting: false,
  contact: null,
  activeTab: 1,
  isNew: false,
  bannerOpen: false,
  dangerModalOpen: false,
  currentContactIndex: 0,
  bannerType: "success",
  bannerAction: "",
  bannerMessage: "",
  imageMenuOpen: false,
  imageUrlModalOpen: false,
  showUrlInput: false,
  formDataChanged: false,
  isInitialLoad: true,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_FORM_DATA":
      return {
        ...state,
        formData: {...state.formData, ...action.payload},
        formDataChanged: !state.isInitialLoad,
      };
    case "SET_ERRORS":
      return {...state, errors: action.payload};
    case "SET_SUBMITTING":
      return {...state, isSubmitting: action.payload};
    case "SET_CONTACT":
      return {
        ...state,
        contact: action.payload,
        isNew: !action.payload,
        formData: action.payload
          ? mapBackendToFrontend(action.payload)
          : initialFormData,
        formDataChanged: false,
        isInitialLoad: true,
      };
    case "SET_ACTIVE_TAB":
      return {...state, activeTab: action.payload};
    case "SET_BANNER":
      return {
        ...state,
        bannerOpen: action.payload.open,
        bannerType: action.payload.type,
        bannerMessage: action.payload.message,
      };
    case "SET_DANGER_MODAL":
      return {...state, dangerModalOpen: action.payload};
    case "SET_CURRENT_CONTACT_INDEX":
      return {...state, currentContactIndex: action.payload};
    case "SET_IMAGE_MENU_OPEN":
      return {...state, imageMenuOpen: action.payload};
    case "SET_IMAGE_URL_MODAL_OPEN":
      return {...state, imageUrlModalOpen: action.payload};
    case "SET_SHOW_URL_INPUT":
      return {...state, showUrlInput: action.payload};
    case "SET_FORM_CHANGED":
      return {
        ...state,
        formDataChanged: action.payload,
        isInitialLoad: false,
      };
    default:
      return state;
  }
}

/* Form for 1 single contact

Props:

State:
- formData: {
  name: "",
  email: "",
  phone: "",
  website: "",
}
- errors:
- isSubmitting: false
- contact: null
- activeTab:
- isEditing: false
- bannerOpen: false
- bannerType: "success"
- bannerMessage: ""
- imageMenuOpen: false
- imageUrlModalOpen: false
- showUrlInput: false

ContactFormContainer

*/
function ContactsFormContainer() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const fileInputRef = useRef(null);
  const {id} = useParams();
  const {t} = useTranslation();
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [upgradePromptMsg, setUpgradePromptMsg] = useState("");
  const [createTagsModalOpen, setCreateTagsModalOpen] = useState(false);
  const createTagsButtonRef = useRef(null);
  const [accountTags, setAccountTags] = useState([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(null);
  const [creatingTag, setCreatingTag] = useState(false);
  const [deletingTagId, setDeletingTagId] = useState(null);

  const TAG_COLOR_OPTIONS = [
    { value: "#3b82f6", classes: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300" },
    { value: "#22c55e", classes: "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-300" },
    { value: "#a855f7", classes: "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300" },
    { value: "#f97316", classes: "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-300" },
    { value: "#ef4444", classes: "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300" },
    { value: "#14b8a6", classes: "bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300" },
    { value: "#f59e0b", classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300" },
    { value: "#ec4899", classes: "bg-pink-100 text-pink-800 dark:bg-pink-900/60 dark:text-pink-300" },
  ];

  const DEFAULT_TAG_CLASSES = "bg-gray-100 text-gray-800 dark:bg-gray-900/60 dark:text-gray-300";
  const hexToTagClasses = (hex) =>
    TAG_COLOR_OPTIONS.find((o) => o.value === hex)?.classes || DEFAULT_TAG_CLASSES;

  const {
    uploadImage,
    imagePreviewUrl,
    uploadedImageUrl,
    imageUploading,
    imageUploadError,
    setImageUploadError,
    clearPreview,
    clearUploadedUrl,
  } = useImageUpload({
    onSuccess: (key) => {
      dispatch({type: "SET_FORM_DATA", payload: {image: key}});
      if (state.isInitialLoad) {
        dispatch({type: "SET_FORM_CHANGED", payload: true});
      }
    },
  });
  const navigate = useNavigate();
  const location = useLocation();
  const controls = useAnimationControls();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  // Define tabs here where t is available
  const tabs = [
    {id: 1, label: t("general")},
    {id: 2, label: t("notes")},
  ];

  const {
    createContact,
    updateContact,
    duplicateContact,
    deleteContact,
    contacts,
    viewMode,
    getCurrentViewContacts,
  } = useContext(contactContext);

  // Fetch tags when account is available (for dropdown) and when modal opens (refresh)
  const fetchTags = useCallback(() => {
    if (!currentAccount?.id) return;
    AppApi.getTagsByAccountId(currentAccount.id)
      .then((tags) => setAccountTags(tags || []))
      .catch(() => setAccountTags([]));
  }, [currentAccount?.id]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags, createTagsModalOpen]);

  // Fetch contact based on URL's contact id
  useEffect(() => {
    async function fetchContact() {
      if (id && id !== "new") {
        try {
          const currentViewContacts = getCurrentViewContacts();
          const existingContact = currentViewContacts.find(
            (contact) => Number(contact.id) === Number(id),
          );
          if (existingContact) {
            dispatch({type: "SET_CONTACT", payload: existingContact});
            // Only clear banner if it's not a success message from contact creation or update
            if (
              state.bannerType !== "success" ||
              (!state.bannerMessage.includes(
                t("contactCreatedSuccessfullyMessage"),
              ) &&
                !state.bannerMessage.includes(
                  t("contactUpdatedSuccessfullyMessage"),
                ))
            ) {
              dispatch({
                type: "SET_BANNER",
                payload: {
                  open: false,
                  type: state.bannerType,
                  message: state.bannerMessage,
                },
              });
            }
          } else {
            throw new Error(t("contactNotFoundErrorMessage"));
          }
        } catch (err) {
          dispatch({
            type: "SET_BANNER",
            payload: {
              open: true,
              type: "error",
              message: `Error finding contact: ${err}`,
            },
          });
        }
      } else {
        dispatch({type: "SET_CONTACT", payload: null});
      }
    }
    fetchContact();
  }, [id, contacts, viewMode]);

  // Banner timeout useEffect with the custom hook
  useAutoCloseBanner(state.bannerOpen, state.bannerMessage, () =>
    dispatch({
      type: "SET_BANNER",
      payload: {
        open: false,
        type: state.bannerType,
        message: state.bannerMessage,
      },
    }),
  );

  // Clear local preview and uploaded URL when switching to a different contact (not when updating the same one)
  const prevContactIdRef = useRef(null);
  useEffect(() => {
    const currentId = state.contact?.id != null ? Number(state.contact.id) : null;
    const switchedContact = prevContactIdRef.current != null && currentId !== prevContactIdRef.current;
    const clearedContact = prevContactIdRef.current != null && currentId == null;
    prevContactIdRef.current = currentId;

    if (switchedContact || clearedContact) {
      clearPreview();
      clearUploadedUrl();
    }
  }, [state.contact, clearPreview, clearUploadedUrl]);

  // Populate form data when contact changes
  useEffect(() => {
    if (state.contact) {
      // Map backend data to frontend format
      const contactData = mapBackendToFrontend(state.contact);
      dispatch({
        type: "SET_FORM_DATA",
        payload: contactData,
      });
    } else {
      dispatch({type: "SET_FORM_DATA", payload: initialFormData});
    }
  }, [state.contact]);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  /* Handles form change */
  const handleChange = (e) => {
    const {id, value} = e.target;

    // Handle clearing of dependent fields when parent field changes
    if (id === "contactType" && value !== "individual") {
      dispatch({
        type: "SET_FORM_DATA",
        payload: {[id]: value, jobPosition: "", linkedCompany: ""},
      });
    } else {
      dispatch({type: "SET_FORM_DATA", payload: {[id]: value}});
    }

    // Clear error when field is being edited
    if (state.errors[id]) {
      dispatch({type: "SET_ERRORS", payload: {...state.errors, [id]: null}});
    }

    // Mark form as changed after initial load
    if (state.isInitialLoad) {
      dispatch({type: "SET_FORM_CHANGED", payload: true});
    }
  };

  /** Remove contact photo */
  function handleRemovePhoto() {
    clearPreview();
    clearUploadedUrl();
    dispatch({type: "SET_FORM_DATA", payload: {image: ""}});
    dispatch({type: "SET_IMAGE_MENU_OPEN", payload: false});
    setImageUploadError(null);
    if (state.isInitialLoad) {
      dispatch({type: "SET_FORM_CHANGED", payload: true});
    }
  }

  /* Handles submit button */
  async function handleSubmit(evt) {
    evt.preventDefault();

    if (!validateForm()) return;

    // Map frontend form data to backend format
    const contactData = mapFrontendToBackend(state.formData);

    dispatch({type: "SET_SUBMITTING", payload: true});

    try {
      const res = await createContact(contactData);

      if (res && res.id) {
        // Update state with new contact
        dispatch({type: "SET_CONTACT", payload: res});

        // Get the current view's sorted contacts
        const currentViewContacts = getCurrentViewContacts();
        const updatedContacts = [...currentViewContacts, res];

        // Sort the updated contacts using the same sorting logic
        const sortedContacts = updatedContacts.sort((a, b) => {
          if (viewMode === "list") {
            return a.name.localeCompare(b.name);
          } else {
            // For group view, sort by type first, then name
            if (a.type_id !== b.type_id) {
              return a.type_id - b.type_id;
            }
            return a.name.localeCompare(b.name);
          }
        });

        // Find the index of the new contact in the sorted list
        const newContactIndex =
          sortedContacts.findIndex((contact) => contact.id === res.id) + 1;

        // Navigate to the new contact with navigation state
        navigate(`/${accountUrl}/contacts/${res.id}`, {
          state: {
            currentIndex: newContactIndex,
            totalItems: sortedContacts.length,
            visibleContactIds: sortedContacts.map((contact) => contact.id),
          },
        });

        // Show success banner
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "success",
            message: t("contactCreatedSuccessfullyMessage"),
          },
        });
      }
    } catch (err) {
      console.error("Error creating contact:", err);
      if (err?.status === 403 && err?.message?.toLowerCase().includes("limit")) {
        setUpgradePromptMsg(err.message);
        setUpgradePromptOpen(true);
      } else {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message: `Error creating contact: ${err.message || err}`,
          },
        });
      }
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

  /* Handles update button */
  async function handleUpdate(evt) {
    evt.preventDefault();

    if (!validateForm()) return;

    // Map frontend form data to backend format
    const contactData = {
      ...mapFrontendToBackend(state.formData),
      id: Number(id),
    };

    dispatch({type: "SET_SUBMITTING", payload: true});

    try {
      const res = await updateContact(id, contactData);
      if (res) {
        // Update the contact with the response from the backend
        dispatch({
          type: "SET_CONTACT",
          payload: res,
        });

        // Show success banner
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "success",
            message: t("contactUpdatedSuccessfullyMessage"),
          },
        });
      }
    } catch (err) {
      console.error("Error updating contact:", err);
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: `${t("updateErrorMessage")} ${err.message || err}`,
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

  /* Validation Errors */
  const validateForm = () => {
    const newErrors = {};

    // Only name is required
    if (!state.formData.name || state.formData.name.trim() === "") {
      newErrors.name = t("nameValidationErrorMessage");
    }

    // Optional email validation (only if provided)
    if (state.formData.email && !isValidEmail(state.formData.email)) {
      newErrors.email = t("emailValidationErrorMessage");
    }

    // Optional website validation (only if provided)
    if (state.formData.website && !isValidUrl(state.formData.website)) {
      newErrors.website = t("websiteValidationErrorMessage");
    }

    dispatch({type: "SET_ERRORS", payload: newErrors});
    return Object.keys(newErrors).length === 0;
  };

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  /* Navigates to contacts list */
  function handleBackClick() {
    navigate(`/${accountUrl}/contacts`);
  }

  /* If editing a contact -> return the contact's name
  If new -> return 'New Contact' */
  function getPageTitle() {
    if (state.contact) {
      return `${state.contact.name}`;
    }
    return t("newContact");
  }

  /* Changes active tab */
  function handleTabChange(tabId) {
    dispatch({type: "SET_ACTIVE_TAB", payload: tabId});
  }

  /* Handles tab click */
  const handleTabClick = (tabId) => async (e) => {
    e.preventDefault();
    const currentIndex = tabs.findIndex((tab) => tab.id === state.activeTab);
    const newIndex = tabs.findIndex((tab) => tab.id === tabId);

    await controls.start({
      x: `${newIndex * 100}%`,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 25,
      },
    });

    handleTabChange(tabId);
  };

  /* Handles New Contact button click */
  function handleNewContact() {
    // Store current contact info in navigation state if we're viewing a contact
    const navigationState = state.contact
      ? {
          previousContactId: state.contact.id,
          previousState: location.state,
        }
      : undefined;

    dispatch({type: "SET_CONTACT", payload: null});
    dispatch({type: "SET_FORM_DATA", payload: initialFormData});
    dispatch({type: "SET_ERRORS", payload: {}});
    navigate(`/${accountUrl}/contacts/new`, {state: navigationState});
  }

  /* Handles delete button */
  function handleDelete() {
    dispatch({type: "SET_DANGER_MODAL", payload: true});
  }

  /* Handles duplicate button */
  async function handleDuplicate() {
    if (!state.contact) return;

    dispatch({type: "SET_SUBMITTING", payload: true});

    try {
      const res = await duplicateContact(state.contact);

      if (res && res.id) {
        // Get the current view's sorted contacts including the new duplicate
        const currentViewContacts = getCurrentViewContacts();
        const updatedContacts = [...currentViewContacts, res];

        // Sort the updated contacts using the same sorting logic
        const sortedContacts = updatedContacts.sort((a, b) => {
          if (viewMode === "list") {
            return a.name.localeCompare(b.name);
          } else {
            // For group view, sort by type first, then name
            if (a.type_id !== b.type_id) {
              return a.type_id - b.type_id;
            }
            return a.name.localeCompare(b.name);
          }
        });

        // Find the index of the duplicated contact in the sorted list
        const newContactIndex =
          sortedContacts.findIndex((contact) => contact.id === res.id) + 1;

        // Navigate to the duplicated contact with navigation state
        navigate(`/${accountUrl}/contacts/${res.id}`, {
          state: {
            currentIndex: newContactIndex,
            totalItems: sortedContacts.length,
            visibleContactIds: sortedContacts.map((contact) => contact.id),
          },
        });

        // Show banner
        setTimeout(() => {
          dispatch({
            type: "SET_BANNER",
            payload: {
              open: true,
              type: "success",
              message: t("contactDuplicatedSuccessfully"),
            },
          });
        }, 100);
      }
    } catch (err) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: `${t("contactDuplicationError: ")} ${err}`,
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

  /* Handles delete confirmation on modal */
  async function confirmDelete() {
    try {
      // Close modal immediately when Accept is clicked
      dispatch({type: "SET_DANGER_MODAL", payload: false});

      //Find the current contact index in the sorted items
      const contactIndex = contacts.findIndex(
        (contact) => contact.id === Number(id),
      );

      //Delete the contact
      await deleteContact(id);

      // Navigate first based on remaining contacts
      if (contacts.length <= 1) {
        // If this was the last contact, go to contacts list
        navigate(`/${accountUrl}/contacts`);
      } else if (contactIndex === contacts.length - 1) {
        // If this was the last contact in the list, go to previous contact
        const prevId = contacts[contactIndex - 1].id;
        navigate(`/${accountUrl}/contacts/${prevId}`, {
          state: {
            currentIndex: contactIndex,
            totalItems: contacts.length - 1,
            visibleContactIds: contacts
              .filter((contact) => contact.id !== Number(id))
              .map((contact) => contact.id),
          },
        });
      } else {
        // Otherwise go to next contact
        const nextId = contacts[contactIndex + 1].id;
        navigate(`/${accountUrl}/contacts/${nextId}`, {
          state: {
            currentIndex: contactIndex + 1,
            totalItems: contacts.length - 1,
            visibleContactIds: contacts
              .filter((contact) => contact.id !== Number(id))
              .map((contact) => contact.id),
          },
        });
      }

      // Then show success banner
      setTimeout(() => {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "success",
            message: t("contactDeletedSuccessfullyMessage"),
          },
        });
      }, 100);
    } catch (error) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: `Error deleting contact: ${error}`,
        },
      });
    }
  }

  // Add a helper function for label classes
  const getLabelClasses = () => {
    return "block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400";
  };

  // Add a helper function for input field classes
  const getInputClasses = (fieldName) => {
    const baseClasses = "form-input w-full";
    const errorClasses = state.errors[fieldName]
      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
      : "";
    return `${baseClasses} ${errorClasses}`;
  };

  // Add a helper function for select field classes
  const getSelectClasses = () => {
    return "form-select w-full";
  };

  // Add a helper function for the country select classes
  const getCountrySelectClasses = () => {
    return "form-select w-12 pl-8";
  };

  // Add a helper function to handle country change (for country code/phone extension)
  const handleCountryChange = (e) => {
    const {value} = e.target;
    const country = countries.find((c) => c.countryCode === value);

    // Update the country code and sync the country name if it matches
    const updates = {countryCode: value};
    if (country) {
      updates.country = country.name;
    }

    dispatch({type: "SET_FORM_DATA", payload: updates});

    // If there's a phone number, update it with the new country code
    if (state.formData.phone) {
      // Remove any existing country code
      const phoneWithoutCode = state.formData.phone.replace(/^\+\d+\s*/, "");
      // Add the new country code
      const newPhone = phoneWithoutCode;
      dispatch({type: "SET_FORM_DATA", payload: {phone: newPhone}});
    }

    // Mark form as changed after initial load
    if (state.isInitialLoad) {
      dispatch({type: "SET_FORM_CHANGED", payload: true});
    }
  };

  // Handle country dropdown change (full country name)
  const handleCountryDropdownChange = (e) => {
    const {value} = e.target;
    const country = countries.find(
      (c) => c.countryCode === value || c.name === value,
    );

    if (country) {
      // Update both countryCode and country name
      dispatch({
        type: "SET_FORM_DATA",
        payload: {
          countryCode: country.countryCode,
          country: country.name,
          // Clear state if country is not USA
          state: country.countryCode !== "USA" ? "" : state.formData.state,
        },
      });
    } else {
      // Fallback if country not found
      dispatch({
        type: "SET_FORM_DATA",
        payload: {country: value},
      });
    }

    // Mark form as changed after initial load
    if (state.isInitialLoad) {
      dispatch({type: "SET_FORM_CHANGED", payload: true});
    }
  };

  // Add a helper function to handle phone change
  const handlePhoneChange = (e) => {
    const {value} = e.target;
    // Remove any non-numeric characters
    const phoneWithoutFormat = value.replace(/[^\d]/g, "");

    // Format the phone number as XXX-XXX-XXXX
    let formattedPhone = "";
    if (phoneWithoutFormat.length > 0) {
      formattedPhone = phoneWithoutFormat.slice(0, 10); // Limit to 10 digits
      if (formattedPhone.length > 6) {
        formattedPhone = `${formattedPhone.slice(0, 3)}-${formattedPhone.slice(
          3,
          6,
        )}-${formattedPhone.slice(6)}`;
      } else if (formattedPhone.length > 3) {
        formattedPhone = `${formattedPhone.slice(0, 3)}-${formattedPhone.slice(
          3,
        )}`;
      }
    }

    // Update form data and trigger form changed state
    dispatch({
      type: "SET_FORM_DATA",
      payload: {phone: formattedPhone},
    });

    // Mark form as changed after initial load
    if (state.isInitialLoad) {
      dispatch({type: "SET_FORM_CHANGED", payload: true});
    }
  };

  // Add these handlers near the other handlers
  const handleFormFocus = () => {
    dispatch({type: "SET_FORM_FOCUS", payload: true});
  };

  const handleFormBlur = () => {
    dispatch({type: "SET_FORM_FOCUS", payload: false});
  };

  function handleCancel() {
    if (state.contact) {
      // For existing contacts, reset to original contact data (map from backend format)
      const originalData = mapBackendToFrontend(state.contact);

      // Reset form data to original values
      dispatch({
        type: "SET_FORM_DATA",
        payload: originalData,
      });

      // Reset form changed state
      dispatch({type: "SET_FORM_CHANGED", payload: false});
      dispatch({type: "SET_ERRORS", payload: {}}); // Also clear any errors
    } else {
      // For new contacts, reset to initial form data
      dispatch({
        type: "SET_FORM_DATA",
        payload: initialFormData,
      });
      dispatch({type: "SET_FORM_CHANGED", payload: false});
      dispatch({type: "SET_ERRORS", payload: {}});
      navigate(`/${accountUrl}/contacts`);
    }
  }

  // Helper function to build navigation state from contacts
  const buildNavigationState = (contactId) => {
    const currentViewContacts = getCurrentViewContacts();

    // Sort contacts using the same logic as handleSubmit
    const sortedContacts = [...currentViewContacts].sort((a, b) => {
      if (viewMode === "list") {
        return a.name.localeCompare(b.name);
      } else {
        // For group view, sort by type first, then name
        if (a.type_id !== b.type_id) {
          return a.type_id - b.type_id;
        }
        return a.name.localeCompare(b.name);
      }
    });

    const contactIndex = sortedContacts.findIndex(
      (contact) => Number(contact.id) === Number(contactId),
    );

    if (contactIndex === -1) {
      // If contact not found, return null
      return null;
    }

    return {
      currentIndex: contactIndex + 1,
      totalItems: sortedContacts.length,
      visibleContactIds: sortedContacts.map((contact) => contact.id),
    };
  };

  // Add a helper function to add link options to arrays
  const addLinkOptions = (options, linkOptions) => {
    return [
      ...options,
      ...(Array.isArray(linkOptions) ? linkOptions : [linkOptions]),
    ];
  };

  // Handler for linked company selection
  function handleLinkedCompanyChange(value) {
    dispatch({
      type: "SET_FORM_DATA",
      payload: {linkedCompany: value},
    });

    // Clear error when field is being edited
    if (state.errors.linkedCompany) {
      dispatch({
        type: "SET_ERRORS",
        payload: {...state.errors, linkedCompany: null},
      });
    }

    // Mark form as changed after initial load
    if (state.isInitialLoad) {
      dispatch({type: "SET_FORM_CHANGED", payload: true});
    }
  }

  // Handler for adding tags
  function handleAddTag(tagId) {
    const ids = state.formData.tags || [];
    const idNum = Number(tagId);
    if (!ids.some((id) => Number(id) === idNum)) {
      dispatch({
        type: "SET_FORM_DATA",
        payload: {tags: [...ids, idNum]},
      });

      // Mark form as changed after initial load
      if (state.isInitialLoad) {
        dispatch({type: "SET_FORM_CHANGED", payload: true});
      }
    }
  }

  // Handler for removing tags
  function handleRemoveTag(tagIdToRemove) {
    dispatch({
      type: "SET_FORM_DATA",
      payload: {
        tags: state.formData.tags.filter(
          (tagId) => Number(tagId) !== Number(tagIdToRemove),
        ),
      },
    });

    // Mark form as changed after initial load
    if (state.isInitialLoad) {
      dispatch({type: "SET_FORM_CHANGED", payload: true});
    }
  }

  // Delete tag permanently (removes from account, no longer in dropdown)
  async function handleDeleteTag(tagId) {
    if (!currentAccount?.id || deletingTagId) return;
    setDeletingTagId(tagId);
    try {
      await AppApi.deleteTag(currentAccount.id, tagId);
      setAccountTags((prev) => prev.filter((t) => Number(t.id) !== Number(tagId)));
      handleRemoveTag(tagId);
    } catch (err) {
      console.error("Error deleting tag:", err);
      const msg = err?.message || err?.messages?.[0] || "Failed to delete tag.";
      dispatch({ type: "SET_BANNER", payload: { open: true, type: "error", message: msg } });
    } finally {
      setDeletingTagId(null);
    }
  }

  // Create new tag and optionally assign to contact
  async function handleCreateTag() {
    const name = newTagName.trim();
    if (!name || !currentAccount?.id) {
      if (!currentAccount?.id) {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message: t("noAccountSelected") || "Please select an account first.",
          },
        });
      }
      return;
    }
    setCreatingTag(true);
    try {
      const tag = await AppApi.createTag(currentAccount.id, {
        name,
        color: newTagColor || TAG_COLOR_OPTIONS[0].value,
      });
      if (!tag || tag.id == null) {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message: t("tagCreateFailed") || "Failed to create tag. Please try again.",
          },
        });
        return;
      }
      setAccountTags((prev) => [...prev, tag]);
      setNewTagName("");
      setNewTagColor(null);
      handleAddTag(tag.id);
    } catch (err) {
      console.error("Error creating tag:", err);
      const msg = err?.message || err?.messages?.[0] || "Failed to create tag.";
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: msg,
        },
      });
    } finally {
      setCreatingTag(false);
    }
  }

  const availableTags = accountTags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: hexToTagClasses(tag.color),
  }));

  // Get company contacts for the dropdown
  const companyContacts = contacts.filter(
    (contact) => contact.contactType === "company" || contact.type_id === 2,
  );

  // TagsDropdown component for multi-select tags
  function TagsDropdown({
    options = [],
    selectedValues = [],
    onAdd,
    onRemove,
    placeholder = "Select tags",
    className = "",
    disabled = false,
    name = "",
    id = "",
  }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
      function handleClickOutside(event) {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target)
        ) {
          setIsOpen(false);
        }
      }

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, []);

    const handleOptionClick = (option) => {
      onAdd?.(option.id);
      setIsOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setIsOpen(!isOpen);
      } else if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    // Get available options (not already selected)
    const selectedSet = new Set(
      selectedValues.map((v) => (typeof v === "number" ? v : Number(v))),
    );
    const availableOptions = options.filter(
      (option) => !selectedSet.has(Number(option.id)),
    );

    // Match exact height of native select elements
    const baseClasses = "form-select w-full relative cursor-pointer py-2 px-3";
    const disabledClasses = disabled
      ? "bg-gray-100 dark:bg-gray-700/50 cursor-not-allowed opacity-75"
      : "";
    const focusClasses = isOpen ? "border-gray-300 dark:border-gray-600" : "";

    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <div
          className={`${baseClasses} ${disabledClasses} ${focusClasses}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          tabIndex={disabled ? -1 : 0}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-labelledby={id}
        >
          <div className="flex items-center justify-between h-full">
            <div className="flex-1 min-w-0">
              {selectedValues.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {selectedValues.map((value) => {
                    const option = options.find(
                      (opt) => Number(opt.id) === Number(value),
                    );
                    return (
                      <span
                        key={value}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          option?.color ||
                          "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
                        }`}
                      >
                        {option?.name || value}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemove?.(value);
                          }}
                          className="ml-1 inline-flex items-center justify-center w-3 h-3 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span className="text-gray-400 dark:text-gray-500 text-sm">
                  {placeholder}
                </span>
              )}
            </div>
          </div>

          {/* Arrow positioned exactly like native select */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </div>
        </div>

        {/* Hidden select for form compatibility */}
        <select
          name={name}
          id={id}
          value={selectedValues}
          className="sr-only"
          disabled={disabled}
          multiple
          onChange={() => {}} // No-op handler to satisfy React's controlled component requirement
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-lg shadow-2xl max-h-35 overflow-auto">
            <ul className="py-1" role="listbox">
              {availableOptions.length > 0 ? (
                availableOptions.map((option) => (
                  <li
                    key={option.id}
                    className="relative cursor-pointer select-none py-2 px-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm text-gray-900 dark:text-gray-100"
                    onClick={() => handleOptionClick(option)}
                    role="option"
                  >
                    <span className="block truncate">{option.name}</span>
                  </li>
                ))
              ) : (
                <li className="py-2 px-4 text-sm text-gray-500 dark:text-gray-400">
                  {t("noMoreTagsAvailable")}
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[var(--color-gray-50)] dark:bg-gray-900">
      <div className="fixed top-18 right-0 w-auto sm:w-full z-50">
        <Banner
          type={state.bannerType}
          open={state.bannerOpen}
          setOpen={(open) =>
            dispatch({
              type: "SET_BANNER",
              payload: {
                open,
                type: state.bannerType,
                message: state.bannerMessage,
              },
            })
          }
          className="transition-opacity duration-300"
        >
          {state.bannerMessage}
        </Banner>
      </div>

      <div className="m-1.5">
        <ModalBlank
          id="create-tags-modal"
          modalOpen={createTagsModalOpen}
          setModalOpen={setCreateTagsModalOpen}
          ignoreClickRef={createTagsButtonRef}
        >
          <div className="p-5">
            <div className="mb-4">
              <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                {t("createTags") || "Create tags"}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t("createTagsDescription") ||
                  "Create new tags. Use the tags field to assign them to this contact."}
              </p>
            </div>

            {/* Create new tag */}
            <div className="space-y-3 mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="form-input flex-1"
                  placeholder={t("tagNamePlaceholder") || "Tag name"}
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateTag();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-sm bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || creatingTag}
                >
                  {creatingTag ? t("saving") || "..." : t("add") || "Add"}
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {t("tagColor") || "Color"}:
                </span>
                {TAG_COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setNewTagColor((c) =>
                        c === opt.value ? null : opt.value,
                      )
                    }
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      newTagColor === opt.value
                        ? "border-gray-700 dark:border-gray-300 scale-110"
                        : "border-gray-200 dark:border-gray-600 hover:border-gray-400"
                    }`}
                    style={{ backgroundColor: opt.value }}
                    aria-label={t("selectColor") || "Select color"}
                  />
                ))}
              </div>
            </div>

            {/* List of existing tags */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {availableTags.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                  {t("noTagsYet") || "No tags yet. Create one above."}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <span
                      key={tag.id}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-medium ${tag.color}`}
                    >
                      {tag.name}
                      <button
                        type="button"
                        onClick={() => handleDeleteTag(tag.id)}
                        disabled={deletingTagId === tag.id}
                        className="opacity-70 hover:opacity-100 focus:opacity-100 rounded p-0.5 disabled:opacity-50"
                        aria-label={t("deleteTag") || "Delete tag"}
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                type="button"
                className="btn-sm bg-[#456564] hover:bg-[#34514f] text-white"
                onClick={() => {
                  setNewTagName("");
                  setNewTagColor(null);
                  setCreateTagsModalOpen(false);
                }}
              >
                {t("close") || "Close"}
              </button>
            </div>
          </div>
        </ModalBlank>

        <ModalBlank
          id="danger-modal"
          modalOpen={state.dangerModalOpen}
          setModalOpen={(open) =>
            dispatch({type: "SET_DANGER_MODAL", payload: open})
          }
        >
          <div className="p-5 flex space-x-4 ">
            {/* Icon */}
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-100 dark:bg-gray-700">
              <svg
                className="shrink-0 fill-current text-red-500"
                width="16"
                height="16"
                viewBox="0 0 16 16"
              >
                <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 12c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm1-3H7V4h2v5z" />
              </svg>
            </div>
            {/* Content */}
            <div>
              {/* Modal header */}
              <div className="mb-2">
                <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {state.contact
                    ? `Delete ${state.contact.name}?`
                    : "Delete Contact?"}
                </div>
              </div>
              {/* Modal content */}
              <div className="text-sm mb-10">
                <div className="space-y-2">
                  <p>
                    {t("contactDeleteConfirmationMessage")}?{" "}
                    {t("actionCantBeUndone")}
                  </p>
                </div>
              </div>
              {/* Modal footer */}
              <div className="flex flex-wrap justify-end space-x-2">
                <button
                  className="btn-sm border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({type: "SET_DANGER_MODAL", payload: false});
                  }}
                >
                  {t("cancel")}
                </button>
                <button
                  className="btn-sm bg-red-500 hover:bg-red-600 text-white"
                  onClick={confirmDelete}
                >
                  {t("accept")}
                </button>
              </div>
            </div>
          </div>
        </ModalBlank>
      </div>

      <div>
        {/* Navigation and Actions */}
        <div className="flex justify-between items-center mb-2">
          <button
            className="btn text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-600 mb-2 pl-0 focus:outline-none shadow-none"
            onClick={handleBackClick}
          >
            <svg
              className="fill-current shrink-0 mr-1"
              width="18"
              height="18"
              viewBox="0 0 18 18"
            >
              <path d="M9.4 13.4l1.4-1.4-4-4 4-4-1.4-1.4L4 8z"></path>
            </svg>
            <span className="text-lg">{t("contacts")}</span>
          </button>

          <div className="flex items-center gap-3">
            {state.contact && (
              <DropdownFilter
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                align="right"
              />
            )}
            <button
              className="btn bg-[#456564] hover:bg-[#34514f] text-white transition-colors duration-200 shadow-sm"
              onClick={handleNewContact}
            >
              {t("new")}
            </button>
          </div>
        </div>

        <div className="flex justify-end mb-2">
          {/* Contact Navigation */}
          <div className="flex items-center">
            {state.contact &&
              (() => {
                // Use location.state if available, otherwise build from contacts
                const navState =
                  location.state || buildNavigationState(state.contact.id);

                if (!navState) return null;

                return (
                  <>
                    <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                      {navState.currentIndex || 1} / {navState.totalItems || 1}
                    </span>
                    <button
                      className="btn shadow-none p-1"
                      title="Previous"
                      onClick={() => {
                        if (
                          navState.visibleContactIds &&
                          navState.currentIndex > 1
                        ) {
                          const prevIndex = navState.currentIndex - 2;
                          const prevContactId =
                            navState.visibleContactIds[prevIndex];
                          const prevNavState =
                            buildNavigationState(prevContactId);
                          navigate(`/${accountUrl}/contacts/${prevContactId}`, {
                            state: prevNavState || {
                              ...navState,
                              currentIndex: navState.currentIndex - 1,
                            },
                          });
                        }
                      }}
                      disabled={
                        !navState.currentIndex || navState.currentIndex <= 1
                      }
                    >
                      <svg
                        className={`fill-current shrink-0 ${
                          !navState.currentIndex || navState.currentIndex <= 1
                            ? "text-gray-200 dark:text-gray-700"
                            : "text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-600"
                        }`}
                        width="24"
                        height="24"
                        viewBox="0 0 18 18"
                      >
                        <path d="M9.4 13.4l1.4-1.4-4-4 4-4-1.4-1.4L4 8z"></path>
                      </svg>
                    </button>

                    <button
                      className="btn shadow-none p-1"
                      title="Next"
                      onClick={() => {
                        if (
                          navState.visibleContactIds &&
                          navState.currentIndex < navState.totalItems
                        ) {
                          const nextIndex = navState.currentIndex;
                          const nextContactId =
                            navState.visibleContactIds[nextIndex];
                          const nextNavState =
                            buildNavigationState(nextContactId);
                          navigate(`/${accountUrl}/contacts/${nextContactId}`, {
                            state: nextNavState || {
                              ...navState,
                              currentIndex: navState.currentIndex + 1,
                            },
                          });
                        }
                      }}
                      disabled={
                        !navState.currentIndex ||
                        !navState.totalItems ||
                        navState.currentIndex >= navState.totalItems
                      }
                    >
                      <svg
                        className={`fill-current shrink-0 ${
                          !navState.currentIndex ||
                          !navState.totalItems ||
                          navState.currentIndex >= navState.totalItems
                            ? "text-gray-200 dark:text-gray-700"
                            : "text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-600"
                        }`}
                        width="24"
                        height="24"
                        viewBox="0 0 18 18"
                      >
                        <path d="M6.6 13.4L5.2 12l4-4-4-4 1.4-1.4L12 8z"></path>
                      </svg>
                    </button>
                  </>
                );
              })()}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              {/* Image and Name with Info */}
              <div className="flex items-start gap-4">
                {/* Photo Section - using shared ImageUploadField */}
                <ImageUploadField
                  imageSrc={
                    imagePreviewUrl ||
                    state.contact?.image_url ||
                    uploadedImageUrl ||
                    (state.formData.image?.startsWith?.("http") ? state.formData.image : null)
                  }
                  hasImage={!!state.formData.image}
                  imageUploading={imageUploading}
                  onUpload={uploadImage}
                  onRemove={handleRemovePhoto}
                  onPasteUrl={() => dispatch({type: "SET_SHOW_URL_INPUT", payload: true})}
                  showRemove={!!state.formData.image}
                  imageUploadError={imageUploadError}
                  onDismissError={() => setImageUploadError(null)}
                  size="md"
                  placeholder="avatar"
                  alt="Contact"
                  uploadLabel={t("uploadImage") || "Upload photo"}
                  removeLabel={t("removePhoto") || "Remove photo"}
                  pasteUrlLabel={t("pasteUrl") || "Paste URL"}
                  fileInputRef={fileInputRef}
                  menuOpen={state.imageMenuOpen}
                  onMenuToggle={(open) => dispatch({type: "SET_IMAGE_MENU_OPEN", payload: open})}
                />

                {/* Contact Name, Type and Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                      {state.contact ? state.contact.name : getPageTitle()}
                    </h1>
                    {state.contact?.contactType && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                        {state.contact.contactType === "individual"
                          ? t("individual")
                          : t("company")}
                      </span>
                    )}
                  </div>

                  {/* Contact Details */}
                  <div className="space-y-2">
                    {state.contact?.phone && (
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <Phone className="w-4 h-4 mr-2 text-[#6E8276] shrink-0" />
                        <span className="truncate">
                          {
                            countries.find(
                              (c) =>
                                c.countryCode === state.contact.countryCode,
                            )?.phoneCode
                          }{" "}
                          {state.contact.phone}
                        </span>
                      </div>
                    )}
                    {state.contact?.email && (
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <Mail className="w-4 h-4 mr-2 text-[#6E8276] shrink-0" />
                        <span className="truncate">{state.contact.email}</span>
                      </div>
                    )}
                    {state.contact?.website && (
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <Globe className="w-4 h-4 mr-2 text-[#6E8276] shrink-0" />
                        <span className="truncate">
                          {state.contact.website}
                        </span>
                      </div>
                    )}
                    {state.contact?.jobPosition && (
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <Briefcase className="w-4 h-4 mr-2 text-[#6E8276] shrink-0" />
                        <span className="truncate">
                          {state.contact.jobPosition}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {state.showUrlInput && (
              <div className="mt-4 max-w-md">
                <input
                  type="text"
                  id="image"
                  className="form-input w-full"
                  placeholder={t("imageUrlPlaceholder")}
                  value={state.formData.image}
                  onChange={handleChange}
                  onBlur={() =>
                    dispatch({type: "SET_SHOW_URL_INPUT", payload: false})
                  }
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <form
            onSubmit={state.isNew ? handleSubmit : handleUpdate}
            onFocus={handleFormFocus}
            onBlur={handleFormBlur}
          >
            <div className="border-b border-gray-200 dark:border-gray-700">
              <div className="px-6">
                <nav className="flex space-x-8" aria-label="Tabs">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={handleTabClick(tab.id)}
                      className={`
                        relative py-4 px-1 text-sm font-medium border-b-2 transition-colors duration-200
                        ${
                          state.activeTab === tab.id
                            ? "border-[#6E8276] text-[#6E8276]"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600"
                        }
                      `}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            <div className="p-6">
              {state.activeTab === 1 && (
                <div className="space-y-8">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <User className="h-5 w-5 text-[#6E8276]" />
                        {t("basicInformation")}
                      </h3>
                      {/* Contact Type Segmented Control - stacked to the right */}
                      <div className="flex justify-end">
                        <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 overflow-hidden">
                          <button
                            type="button"
                            role="radio"
                            aria-checked={state.formData.contactType === "individual"}
                            onClick={() => {
                              dispatch({
                                type: "SET_FORM_DATA",
                                payload: {
                                  contactType: "individual",
                                  jobPosition: "",
                                  linkedCompany: "",
                                },
                              });
                              if (state.isInitialLoad) {
                                dispatch({type: "SET_FORM_CHANGED", payload: true});
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                              state.formData.contactType === "individual"
                                ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            }`}
                          >
                            <User
                              className={`h-3.5 w-3.5 shrink-0 ${
                                state.formData.contactType === "individual"
                                  ? "text-gray-700 dark:text-gray-300"
                                  : "text-gray-400 dark:text-gray-500"
                              }`}
                            />
                            {t("individual")}
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={state.formData.contactType === "company"}
                            onClick={() => {
                              dispatch({
                                type: "SET_FORM_DATA",
                                payload: {
                                  contactType: "company",
                                  jobPosition: "",
                                  linkedCompany: "",
                                },
                              });
                              if (state.isInitialLoad) {
                                dispatch({type: "SET_FORM_CHANGED", payload: true});
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-200 dark:border-gray-600 ${
                              state.formData.contactType === "company"
                                ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            }`}
                          >
                            <Building
                              className={`h-3.5 w-3.5 shrink-0 ${
                                state.formData.contactType === "company"
                                  ? "text-gray-700 dark:text-gray-300"
                                  : "text-gray-400 dark:text-gray-500"
                              }`}
                            />
                            {t("company")}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className={getLabelClasses()} htmlFor="name">
                          {t("name")} <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="name"
                          className={getInputClasses("name")}
                          type="text"
                          value={state.formData.name}
                          onChange={handleChange}
                          placeholder={t("namePlaceholder")}
                        />
                        {state.errors.name && (
                          <div className="mt-1 flex items-center text-sm text-red-500">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            <span>{state.errors.name}</span>
                          </div>
                        )}
                      </div>

                      {state.formData.contactType === "individual" && (
                        <div>
                          <label
                            className={getLabelClasses()}
                            htmlFor="jobPosition"
                          >
                            {t("jobPosition")}
                          </label>
                          <input
                            id="jobPosition"
                            className={getInputClasses("jobPosition")}
                            type="text"
                            value={state.formData.jobPosition}
                            onChange={handleChange}
                            placeholder={t("jobPositionPlaceholder")}
                          />
                        </div>
                      )}

                      {/* Linked Company Field - Only show for individuals */}
                      {state.formData.contactType === "individual" && (
                        <div>
                          <label
                            className={getLabelClasses()}
                            htmlFor="linkedCompany"
                          >
                            {t("linkedCompany")}
                          </label>
                          <SelectDropdown
                            options={companyContacts.map((contact) => ({
                              id: contact.id,
                              name: contact.name,
                            }))}
                            value={state.formData.linkedCompany}
                            onChange={handleLinkedCompanyChange}
                            placeholder={t("selectLinkedCompany")}
                            name="linkedCompany"
                            id="linkedCompany"
                            clearable={true}
                          />
                        </div>
                      )}

                      <div>
                        <label className={getLabelClasses()} htmlFor="phone">
                          {t("mobilePhone")}
                        </label>
                        <div className="flex gap-2">
                          <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              {
                                countries.find(
                                  (c) =>
                                    c.countryCode ===
                                    state.formData.countryCode,
                                )?.flag
                              }
                            </div>
                            <select
                              id="countryCode"
                              className={`${getCountrySelectClasses()} text-gray-400 dark:text-gray-500`}
                              value={state.formData.countryCode}
                              onChange={handleCountryChange}
                            >
                              {countries.map((country) => (
                                <option
                                  key={country.id}
                                  value={country.countryCode}
                                >
                                  {country.flag} {country.name} (
                                  {country.phoneCode})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="relative flex-1">
                            <input
                              id="phone"
                              className={`${getInputClasses("phone")}`}
                              type="tel"
                              value={state.formData.phone}
                              onChange={handlePhoneChange}
                              placeholder={t("phonePlaceholder")}
                              style={{
                                paddingLeft: `${
                                  (countries.find(
                                    (c) =>
                                      c.countryCode ===
                                      state.formData.countryCode,
                                  )?.phoneCode?.length || 1) *
                                    0.65 +
                                  0.65
                                }rem`,
                              }}
                            />
                            <div
                              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400 text-sm"
                              style={{
                                paddingRight: "0.2rem",
                              }}
                            >
                              {
                                countries.find(
                                  (c) =>
                                    c.countryCode ===
                                    state.formData.countryCode,
                                )?.phoneCode
                              }
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className={getLabelClasses()} htmlFor="email">
                          {t("email")}
                        </label>
                        <input
                          id="email"
                          className={getInputClasses("email")}
                          type="email"
                          value={state.formData.email}
                          onChange={handleChange}
                          placeholder={t("emailPlaceholder")}
                        />
                        {state.errors.email && (
                          <div className="mt-1 flex items-center text-sm text-red-500">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            <span>{state.errors.email}</span>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className={getLabelClasses()} htmlFor="website">
                          {t("website")}
                        </label>
                        <input
                          id="website"
                          className={getInputClasses("website")}
                          type="url"
                          value={state.formData.website}
                          onChange={handleChange}
                          placeholder={t("websitePlaceholder")}
                        />
                        {state.errors.website && (
                          <div className="mt-1 flex items-center text-sm text-red-500">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            <span>{state.errors.website}</span>
                          </div>
                        )}
                      </div>

                      {/* Tags Field */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className={getLabelClasses()} htmlFor="tags">
                            {t("tags")}
                          </label>
                          <button
                            ref={createTagsButtonRef}
                            type="button"
                            onClick={() => setCreateTagsModalOpen(true)}
                            className="text-sm text-[#6E8276] hover:text-[#456564] dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                          >
                            {t("createTags") || "Create tags"}
                          </button>
                        </div>
                        <TagsDropdown
                          options={availableTags}
                          selectedValues={state.formData.tags}
                          onAdd={handleAddTag}
                          onRemove={handleRemoveTag}
                          placeholder={t("selectTags")}
                          name="tags"
                          id="tags"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-[#6E8276]" />
                      {t("address")}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="md:col-span-3">
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label
                              className={getLabelClasses()}
                              htmlFor="street1"
                            >
                              {t("street1")}
                            </label>
                            <input
                              id="street1"
                              className={getInputClasses("street1")}
                              type="text"
                              value={state.formData.street1}
                              onChange={handleChange}
                              placeholder={t("street1Placeholder")}
                            />
                          </div>

                          <div>
                            <label
                              className={getLabelClasses()}
                              htmlFor="street2"
                            >
                              {t("street2")}
                            </label>
                            <input
                              id="street2"
                              className={getInputClasses("street2")}
                              type="text"
                              value={state.formData.street2}
                              onChange={handleChange}
                              placeholder={t("street2Placeholder")}
                            />
                          </div>

                          <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-5">
                              <label
                                className={getLabelClasses()}
                                htmlFor="city"
                              >
                                {t("city")}
                              </label>
                              <input
                                id="city"
                                className={getInputClasses("city")}
                                type="text"
                                value={state.formData.city}
                                onChange={handleChange}
                                placeholder={t("cityPlaceholder")}
                              />
                            </div>

                            <div className="col-span-4">
                              <label
                                className={getLabelClasses()}
                                htmlFor="state"
                              >
                                {t("state")}
                              </label>
                              <select
                                id="state"
                                className={getSelectClasses()}
                                value={state.formData.state}
                                onChange={handleChange}
                                disabled={state.formData.countryCode !== "USA"}
                              >
                                {state.formData.countryCode === "USA" ? (
                                  <>
                                    <option value="">Select State</option>
                                    {usStates.map((state) => (
                                      <option
                                        key={state.code}
                                        value={state.code}
                                      >
                                        {state.code}
                                      </option>
                                    ))}
                                  </>
                                ) : (
                                  <option value="international">
                                    International
                                  </option>
                                )}
                              </select>
                            </div>

                            <div className="col-span-3">
                              <label
                                className={getLabelClasses()}
                                htmlFor="zip"
                              >
                                {t("zip")}
                              </label>
                              <input
                                id="zip"
                                className={getInputClasses("zip")}
                                type="text"
                                value={state.formData.zip}
                                onChange={handleChange}
                                placeholder={t("zipPlaceholder")}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-2">
                              <label
                                className={getLabelClasses()}
                                htmlFor="country"
                              >
                                {t("country")}
                              </label>
                              <select
                                id="country"
                                className={getSelectClasses()}
                                value={state.formData.country}
                                onChange={handleCountryDropdownChange}
                              >
                                {countries.map((country) => (
                                  <option key={country.id} value={country.name}>
                                    {country.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {state.activeTab === 2 && (
                <div className="space-y-8">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-[#6E8276]" />
                      {t("notes")}
                    </h3>
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <textarea
                          id="notes"
                          className={`${getInputClasses(
                            "notes",
                          )} min-h-[100px]`}
                          value={state.formData.notes}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div
              className={`${
                state.formDataChanged || state.isNew ? "sticky" : "hidden"
              } bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 rounded-b-lg transition-all duration-200`}
            >
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300 transition-colors duration-200 shadow-sm"
                  onClick={handleCancel}
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className={`btn text-white transition-colors duration-200 shadow-sm min-w-[100px] ${
                    state.isNew
                      ? "bg-[#456564] hover:bg-[#34514f]"
                      : "bg-[#456564] hover:bg-[#34514f]"
                  }`}
                  disabled={state.isSubmitting}
                >
                  {state.isSubmitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      {t("saving")}
                    </div>
                  ) : state.isNew ? (
                    t("save")
                  ) : (
                    t("update")
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      <UpgradePrompt
        open={upgradePromptOpen}
        onClose={() => setUpgradePromptOpen(false)}
        title="Contact limit reached"
        message={upgradePromptMsg || "You've reached the maximum number of contacts for your current plan. Upgrade to add more."}
      />
    </div>
  );
}

export default ContactsFormContainer;

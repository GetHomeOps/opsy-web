import React, {
  useReducer,
  useEffect,
  useContext,
  useRef,
  useMemo,
  useState,
} from "react";
import {useNavigate, useParams, useLocation, Link} from "react-router-dom";
import {AlertCircle, Mail, User, UserCircle, ExternalLink} from "lucide-react";
import Banner from "../../partials/containers/Banner";
import ModalBlank from "../../components/ModalBlank";
import {useTranslation} from "react-i18next";
import DropdownFilter from "../../components/DropdownFilter";
import UserContext from "../../context/UserContext";
import contactContext from "../../context/ContactContext";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {useAutoCloseBanner} from "../../hooks/useAutoCloseBanner";
import {useAuth} from "../../context/AuthContext";
import AppApi from "../../api/api";
import SelectDropdown from "../contacts/SelectDropdown";
import useImageUpload from "../../hooks/useImageUpload";
import usePresignedPreview from "../../hooks/usePresignedPreview";
import ImageUploadField from "../../components/ImageUploadField";

const initialFormData = {
  name: "",
  email: "",
  phone: "",
  role: "",
  contact: "",
  image: "",
};

const initialState = {
  formData: initialFormData,
  errors: {},
  isSubmitting: false,
  user: null,
  isNew: false,
  bannerOpen: false,
  dangerModalOpen: false,
  bannerType: "success",
  bannerMessage: "",
  formDataChanged: false,
  isInitialLoad: true,
  isActive: false,
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
    case "SET_USER":
      return {
        ...state,
        user: action.payload,
        isNew: !action.payload,
        formData: action.payload
          ? {
              name: action.payload.name || "",
              email: action.payload.email || "",
              phone: action.payload.phone || "",
              role:
                action.payload.role === "super_admin"
                  ? "Super Admin"
                  : action.payload.role || "",
              contact: action.payload.contact || "",
              isActive: action.payload.isActive || false,
              image: action.payload.image ?? "",
            }
          : initialFormData,
        formDataChanged: false,
        isInitialLoad: true,
      };
    case "SET_BANNER":
      return {
        ...state,
        bannerOpen: action.payload.open,
        bannerType: action.payload.type,
        bannerMessage: action.payload.message,
      };
    case "SET_DANGER_MODAL":
      return {...state, dangerModalOpen: action.payload};
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

function UsersFormContainer() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const {id} = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {t} = useTranslation();
  const {users, createUser, deleteUser, createUserInvitation, setUsers} =
    useContext(UserContext);
  const {contacts} = useContext(contactContext);
  const {currentUser} = useAuth();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";
  const userPhotoInputRef = useRef(null);

  const {
    uploadImage: uploadUserPhoto,
    imagePreviewUrl: userPhotoPreviewUrl,
    uploadedImageUrl: userPhotoUploadedUrl,
    imageUploading: userPhotoUploading,
    imageUploadError: userPhotoUploadError,
    setImageUploadError: setUserPhotoUploadError,
    clearPreview: clearUserPhotoPreview,
    clearUploadedUrl: clearUserPhotoUploadedUrl,
  } = useImageUpload({
    onSuccess: (key) => {
      dispatch({type: "SET_FORM_DATA", payload: {image: key}});
      if (state.isInitialLoad) {
        dispatch({type: "SET_FORM_CHANGED", payload: true});
      }
    },
  });

  const userImageKey = state.user?.image ?? state.formData?.image ?? "";
  const userImageKeyNeedsPresigned =
    userImageKey &&
    !userImageKey.startsWith("blob:") &&
    !userImageKey.startsWith("http");
  const {
    url: userPhotoPresignedUrl,
    fetchPreview: fetchUserPhotoPresigned,
    clearUrl: clearUserPhotoPresignedUrl,
    currentKey: userPhotoPresignedKey,
  } = usePresignedPreview();

  useEffect(() => {
    if (userImageKeyNeedsPresigned && userImageKey) {
      fetchUserPhotoPresigned(userImageKey);
    }
  }, [userImageKeyNeedsPresigned, userImageKey, fetchUserPhotoPresigned]);

  function handleRemoveUserPhoto() {
    clearUserPhotoPreview();
    clearUserPhotoUploadedUrl();
    clearUserPhotoPresignedUrl();
    dispatch({type: "SET_FORM_DATA", payload: {image: ""}});
    if (state.isInitialLoad) {
      dispatch({type: "SET_FORM_CHANGED", payload: true});
    }
  }

  // Fetch user based on URL's user id
  useEffect(() => {
    async function fetchUser() {
      if (id && id !== "new") {
        try {
          // Find user in context (users come from UserContext)
          const existingUser = users.find(
            (user) => Number(user.id) === Number(id),
          );
          if (existingUser) {
            dispatch({type: "SET_USER", payload: existingUser});
          } else if (users.length > 0) {
            // If users array is populated but user not found, show error
            dispatch({
              type: "SET_BANNER",
              payload: {
                open: true,
                type: "error",
                message: t("userNotFoundErrorMessage") || "User not found",
              },
            });
          }
          // If users array is empty, wait for UserContext to load users
        } catch (err) {
          dispatch({
            type: "SET_BANNER",
            payload: {
              open: true,
              type: "error",
              message: `Error finding user: ${err.message || err}`,
            },
          });
        }
      } else {
        dispatch({type: "SET_USER", payload: null});
      }
    }
    fetchUser();
  }, [id, users]);

  // Clear user photo preview/presigned when switching to a different user
  useEffect(() => {
    return () => {
      clearUserPhotoPreview();
      clearUserPhotoUploadedUrl();
      clearUserPhotoPresignedUrl();
    };
  }, [
    state.user?.id,
    clearUserPhotoPreview,
    clearUserPhotoUploadedUrl,
    clearUserPhotoPresignedUrl,
  ]);

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

  // Populate form data when user changes
  useEffect(() => {
    if (state.user) {
      const userData = {
        name: state.user.name || "",
        email: state.user.email || "",
        role:
          state.user.role === "super_admin" || state.user.role === "superAdmin"
            ? "Super Admin"
            : state.user.role || "",
        phone: state.user.phone || "",
        contact: state.user.contact || "",
      };
      dispatch({
        type: "SET_FORM_DATA",
        payload: userData,
      });
      // Reset contact selection tracking when user changes
      setContactSelectedByUser(false);
    } else {
      dispatch({type: "SET_FORM_DATA", payload: initialFormData});
      // Reset contact selection tracking for new users
      setContactSelectedByUser(false);
    }
  }, [state.user]);

  /* Handles form change */
  const handleChange = (e) => {
    const {id, value} = e.target;
    dispatch({type: "SET_FORM_DATA", payload: {[id]: value}});

    // Clear error when field is being edited
    if (state.errors[id]) {
      dispatch({type: "SET_ERRORS", payload: {...state.errors, [id]: null}});
    }

    // Mark form as changed after initial load
    if (state.isInitialLoad) {
      dispatch({type: "SET_FORM_CHANGED", payload: true});
    }
  };

  async function sendUserInvitation(user) {
    try {
      const result = await createUserInvitation({
        inviteeEmail: user?.email || state.user?.email || state.formData?.email,
        accountId: currentAccount?.id,
        intendedRole: 'member',
        type: 'account',
      });

      if (result?.invitation) {
        const email = user?.email || state.user?.email || state.formData?.email || "";
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "success",
            message: t("confirmationEmailMessage")?.replace("{{email}}", email) || `Invitation email sent to ${email}. Please check your email for the confirmation link.`,
          },
        });
        return result;
      }
    } catch (error) {
      console.error("Error sending user invitation:", error);
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: error?.message || "Failed to send invitation email",
        },
      });
      return null;
    }
  }

  // Generate a random password
  function generateRandomPassword() {
    const length = 16;
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  /* Handles submit button */
  async function handleSubmit(evt) {
    evt.preventDefault();

    if (!validateForm()) return;

    // Generate a random password
    const randomPassword = generateRandomPassword();

    const userData = {
      name: state.formData.name || "",
      email: state.formData.email || "",
      phone: state.formData.phone || "",
      role: state.formData.role || "",
      contact: state.formData.contact || 0,
      password: randomPassword,
      is_active: false,
      image: state.formData.image || undefined,
    };

    dispatch({type: "SET_SUBMITTING", payload: true});

    try {
      const res = await createUser(userData);

      if (res && res.id) {
        // Update state with new user
        dispatch({type: "SET_USER", payload: res});

        // Navigate to the new user with navigation state
        navigate(`/${accountUrl}/users/${res.id}`, {
          state: {
            currentIndex: users.length + 1,
            totalItems: users.length + 1,
            visibleContactIds: [...users.map((u) => u.id), res.id],
          },
        });

        // Show success banner
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "success",
            message:
              t("userCreatedSuccessfullyMessage") ||
              "User created successfully",
          },
        });
      }
    } catch (err) {
      console.error("Error creating user:", err);
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: `Error creating user: ${err.message || err}`,
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

  /* Handles update button */
  async function handleUpdate(evt) {
    evt.preventDefault();

    if (!validateForm()) return;

    const userData = {
      ...state.formData,
      contact: Number(state.formData.contact),
      isActive: state.formData.isActive,
      image: state.formData.image || null,
    };

    dispatch({type: "SET_SUBMITTING", payload: true});

    try {
      const res = await AppApi.updateUser(id, userData);

      console.log("res:", res);

      if (res) {
        // Update the user in the state
        dispatch({
          type: "SET_USER",
          payload: res,
        });

        // Update the users in the context
        const updatedUsers = users.map((u) =>
          u.id === Number(id) ? {...res, id: Number(id)} : u,
        );
        setUsers(updatedUsers);

        // Show success banner
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "success",
            message:
              t("userUpdatedSuccessfullyMessage") ||
              "User updated successfully",
          },
        });
      }
    } catch (err) {
      console.error("Error updating user:", err);
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: `Error updating user: ${err.message || err}`,
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

  /* Validation Errors */
  const validateForm = () => {
    const newErrors = {};

    if (!state.formData.name) {
      newErrors.name = t("nameValidationErrorMessage") || "Name is required";
    }

    if (!state.formData.email) {
      newErrors.email = t("emailValidationErrorMessage") || "Email is required";
    } else if (!isValidEmail(state.formData.email)) {
      newErrors.email =
        t("emailValidationErrorMessage") || "Invalid email format";
    }

    if (!state.formData.role) {
      newErrors.role = t("roleValidationErrorMessage") || "Role is required";
    }

    dispatch({type: "SET_ERRORS", payload: newErrors});
    return Object.keys(newErrors).length === 0;
  };

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  /* Navigates to users list */
  function handleBackClick() {
    navigate(`/${accountUrl}/users`);
  }

  /* If editing a user -> return the user's name
  If new -> return 'New User' */
  function getPageTitle() {
    if (state.user) {
      return state.user.name || "";
    }
    return t("newUser") || "New User";
  }

  const displayName = state.user?.name || getPageTitle();
  const displayEmail = state.user?.email || "";

  const userPhotoDisplayUrl =
    userPhotoPreviewUrl ||
    state.user?.image_url ||
    userPhotoUploadedUrl ||
    (state.formData.image?.startsWith?.("blob:") ||
    state.formData.image?.startsWith?.("http")
      ? state.formData.image
      : null) ||
    (userPhotoPresignedKey === userImageKey ? userPhotoPresignedUrl : null) ||
    null;

  const userInitial = displayName?.trim()?.charAt(0)?.toUpperCase() || "U";

  /* Handles New User button click */
  function handleNewUser() {
    dispatch({type: "SET_USER", payload: null});
    dispatch({type: "SET_FORM_DATA", payload: initialFormData});
    dispatch({type: "SET_ERRORS", payload: {}});
    navigate(`/${accountUrl}/users/new`);
  }

  /* Handles delete button */
  function handleDelete() {
    dispatch({type: "SET_DANGER_MODAL", payload: true});
  }

  /* Handles delete confirmation on modal */
  async function confirmDelete() {
    try {
      // Close modal immediately when Accept is clicked
      dispatch({type: "SET_DANGER_MODAL", payload: false});

      // Find the current user index in the users array (before deletion)
      const userIndex = users.findIndex((user) => user.id === Number(id));

      // Delete the user (this updates the context)
      await deleteUser(id);

      // Navigate first based on remaining users
      // Calculate remaining users by filtering out the deleted one from the current users array
      const remainingUsers = users.filter((user) => user.id !== Number(id));

      if (remainingUsers.length === 0) {
        // If this was the last user, go to users list
        navigate(`/${accountUrl}/users`);
      } else if (userIndex === users.length - 1) {
        // If this was the last user in the list, go to previous user
        const prevId = remainingUsers[remainingUsers.length - 1].id;
        navigate(`/${accountUrl}/users/${prevId}`, {
          state: {
            currentIndex: remainingUsers.length,
            totalItems: remainingUsers.length,
            visibleContactIds: remainingUsers.map((user) => user.id),
          },
        });
      } else {
        // Go to the previous user (userIndex - 1)
        // For example, if deleting user 9/10 (userIndex=8, which is position 9), go to user at position 8 (which becomes 8/9)
        const prevId =
          remainingUsers[userIndex - 1]?.id || remainingUsers[0].id;
        const prevIndex = userIndex; // The previous user will be at the same index after deletion
        navigate(`/${accountUrl}/users/${prevId}`, {
          state: {
            currentIndex: prevIndex,
            totalItems: remainingUsers.length,
            visibleContactIds: remainingUsers.map((user) => user.id),
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
            message:
              t("userDeletedSuccessfullyMessage") ||
              "User deleted successfully",
          },
        });
      }, 100);
    } catch (error) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: `Error deleting user: ${error.message || error}`,
        },
      });
    }
  }

  /* Handles cancel button */
  function handleCancel() {
    if (state.user) {
      // For existing users, reset to original user data
      const originalData = {
        name: state.user.name || "",
        email: state.user.email || "",
        phone: state.user.phone || "",
        role:
          state.user.role === "super_admin" || state.user.role === "superAdmin"
            ? "Super Admin"
            : state.user.role || "",
        contact: state.user.contact || "",
      };

      dispatch({
        type: "SET_FORM_DATA",
        payload: originalData,
      });

      dispatch({type: "SET_FORM_CHANGED", payload: false});
      dispatch({type: "SET_ERRORS", payload: {}});
    } else {
      // For new users, reset to initial form data and navigate to new user form
      dispatch({
        type: "SET_FORM_DATA",
        payload: initialFormData,
      });
      dispatch({type: "SET_FORM_CHANGED", payload: false});
      dispatch({type: "SET_ERRORS", payload: {}});
      navigate(`/${accountUrl}/users/new`);
    }
  }

  // Check if the user being edited is a super_admin
  const isSuperAdminUser =
    state.user?.role === "super_admin" || state.user?.role === "superAdmin";

  // Role options for the select dropdown based on current user's role
  const roleOptions = useMemo(() => {
    // If the user being edited is super_admin, show only Super Admin option
    if (isSuperAdminUser) {
      return [{id: "Super Admin", name: "Super Admin"}];
    }

    // If current user is super_admin, they can see: admin, agent, homeowner
    if (
      currentUser?.role === "superAdmin" ||
      currentUser?.role === "super_admin"
    ) {
      return [
        {id: "admin", name: "Admin"},
        {id: "agent", name: "Agent"},
        {id: "homeowner", name: "Homeowner"},
      ];
    }
    // If current user is agent, they can only add: homeowner
    if (currentUser?.role === "agent") {
      return [{id: "homeowner", name: "Homeowner"}];
    }
    // Default: return all options (fallback)
    return [
      {id: "super_admin", name: "Super Admin"},
      {id: "admin", name: "Admin"},
      {id: "agent", name: "Agent"},
      {id: "homeowner", name: "Homeowner"},
    ];
  }, [currentUser?.role, isSuperAdminUser]);

  // Handler for role change
  function handleRoleChange(value) {
    dispatch({
      type: "SET_FORM_DATA",
      payload: {role: value},
    });

    // Clear error when field is being edited
    if (state.errors.role) {
      dispatch({
        type: "SET_ERRORS",
        payload: {...state.errors, role: null},
      });
    }

    // Mark form as changed after initial load
    if (state.isInitialLoad) {
      dispatch({type: "SET_FORM_CHANGED", payload: true});
    }
  }

  // Track if contact has been selected by user
  const [contactSelectedByUser, setContactSelectedByUser] = useState(false);

  // Handler for contact change
  function handleContactChange(value) {
    dispatch({
      type: "SET_FORM_DATA",
      payload: {contact: value},
    });

    // Mark that contact was selected by user
    setContactSelectedByUser(true);

    // Clear error when field is being edited
    if (state.errors.contact) {
      dispatch({
        type: "SET_ERRORS",
        payload: {...state.errors, contact: null},
      });
    }

    // Mark form as changed after initial load
    if (state.isInitialLoad) {
      dispatch({type: "SET_FORM_CHANGED", payload: true});
    }
  }

  // Get contact options from contacts
  const contactOptions = contacts.map((contact) => ({
    id: contact.id,
    name: contact.name,
  }));

  // Get selected contact details from form (for editing)
  const selectedContact = useMemo(() => {
    if (!state.formData.contact) return null;
    return contacts.find(
      (contact) => contact.id === Number(state.formData.contact),
    );
  }, [contacts, state.formData.contact]);

  // Get saved contact from user data (only shows after save)
  const savedContact = useMemo(() => {
    if (!state.user?.contact) return null;
    return contacts.find(
      (contact) => contact.id === Number(state.user.contact),
    );
  }, [contacts, state.user?.contact]);

  // Handler for navigating to contact (for saved contact only)
  const handleNavigateToSavedContact = () => {
    if (savedContact) {
      navigate(`/${accountUrl}/contacts/${savedContact.id}`);
    }
  };

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
          id="danger-modal"
          modalOpen={state.dangerModalOpen}
          setModalOpen={(open) =>
            dispatch({type: "SET_DANGER_MODAL", payload: open})
          }
        >
          <div className="p-5 flex space-x-4">
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
                  {state.user ? `Delete ${state.user.name}?` : "Delete User?"}
                </div>
              </div>
              {/* Modal content */}
              <div className="text-sm mb-10">
                <div className="space-y-2">
                  <p>
                    {t("userDeleteConfirmationMessage") ||
                      "Are you sure you want to delete this user?"}{" "}
                    {t("actionCantBeUndone") || "This action cannot be undone."}
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
                  {t("cancel") || "Cancel"}
                </button>
                <button
                  className="btn-sm bg-red-500 hover:bg-red-600 text-white"
                  onClick={confirmDelete}
                >
                  {t("accept") || "Accept"}
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
            <span className="text-lg">{t("users") || "Users"}</span>
          </button>

          <div className="flex items-center gap-3">
            {state.user && (
              <DropdownFilter onDelete={handleDelete} align="right" />
            )}
            <button
              className="btn bg-[#456564] hover:bg-[#34514f] text-white transition-colors duration-200 shadow-sm"
              onClick={handleNewUser}
            >
              {t("new") || "New"}
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center mb-2">
          {/* Contact Link Button and Status - Left aligned */}
          <div className="flex items-center gap-3">
            {/* Contact Link Button - Only shows saved contact from database */}
            {savedContact ? (
              <button
                onClick={handleNavigateToSavedContact}
                className="flex items-center gap-2 px-3 py-2 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 transition-all duration-200 ml-4"
              >
                <UserCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-semibold">
                  Contact <span className="font-normal">1</span>
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 ml-4">
                <UserCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">
                  Contact <span className="font-normal">0</span>
                </span>
              </div>
            )}

            {/* Activated/Pending Status Button */}
            {state.user &&
              (!state.user.isActive && !state.user.is_active ? (
                <a
                  onClick={(e) => {
                    e.preventDefault();
                    sendUserInvitation(state.user);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md bg-[#fddddd] dark:bg-[#402431] text-[#e63939] dark:text-[#c23437] hover:bg-[#fccccc] dark:hover:bg-[#4d2a3a] cursor-pointer"
                >
                  <span>Pending</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm bg-[#d3f4e3] dark:bg-[#173c36] text-[#2a9f52] dark:text-[#258c4d]">
                  <span>Active</span>
                </div>
              ))}
          </div>

          {/* User Navigation */}
          <div className="flex items-center">
            {state.user && location.state && (
              <>
                <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                  {location.state.currentIndex || 1} /{" "}
                  {location.state.totalItems || 1}
                </span>
                <button
                  className="btn shadow-none p-1"
                  title="Previous"
                  onClick={() => {
                    if (
                      location.state?.visibleContactIds &&
                      location.state.currentIndex > 1
                    ) {
                      const prevIndex = location.state.currentIndex - 2;
                      const prevUserId =
                        location.state.visibleContactIds[prevIndex];
                      navigate(`/${accountUrl}/users/${prevUserId}`, {
                        state: {
                          ...location.state,
                          currentIndex: location.state.currentIndex - 1,
                        },
                      });
                    }
                  }}
                  disabled={
                    !location.state ||
                    !location.state.currentIndex ||
                    location.state.currentIndex <= 1
                  }
                >
                  <svg
                    className={`fill-current shrink-0 ${
                      !location.state ||
                      !location.state.currentIndex ||
                      location.state.currentIndex <= 1
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
                      location.state?.visibleContactIds &&
                      location.state.currentIndex < location.state.totalItems
                    ) {
                      const nextIndex = location.state.currentIndex;
                      const nextUserId =
                        location.state.visibleContactIds[nextIndex];
                      navigate(`/${accountUrl}/users/${nextUserId}`, {
                        state: {
                          ...location.state,
                          currentIndex: location.state.currentIndex + 1,
                        },
                      });
                    }
                  }}
                  disabled={
                    !location.state ||
                    !location.state.currentIndex ||
                    !location.state.totalItems ||
                    location.state.currentIndex >= location.state.totalItems
                  }
                >
                  <svg
                    className={`fill-current shrink-0 ${
                      !location.state ||
                      !location.state.currentIndex ||
                      !location.state.totalItems ||
                      location.state.currentIndex >= location.state.totalItems
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
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              {/* User Name and Info */}
              <div className="flex items-start gap-4">
                <ImageUploadField
                  imageSrc={userPhotoDisplayUrl}
                  hasImage={!!(state.formData.image || state.user?.image)}
                  imageUploading={userPhotoUploading}
                  onUpload={uploadUserPhoto}
                  onRemove={handleRemoveUserPhoto}
                  onPasteUrl={null}
                  showRemove={!!(state.formData.image || state.user?.image)}
                  imageUploadError={userPhotoUploadError}
                  onDismissError={() => setUserPhotoUploadError(null)}
                  size="md"
                  placeholder="avatar"
                  alt={displayName}
                  uploadLabel={t("uploadImage") || "Upload photo"}
                  removeLabel={t("removePhoto") || "Remove photo"}
                  fileInputRef={userPhotoInputRef}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                      {displayName}
                    </h1>
                    {state.user?.role ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f7d46b] text-[#594500] dark:bg-[#f7d46b]/80 dark:text-[#3a3000]">
                        {state.user.role}
                      </span>
                    ) : null}
                  </div>

                  {/* User Details */}
                  <div className="space-y-2">
                    {displayEmail && (
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <Mail className="w-4 h-4 mr-2 text-[#456564] shrink-0" />
                        <span className="truncate">{displayEmail}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Information Form - Always Visible */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <form onSubmit={state.isNew ? handleSubmit : handleUpdate}>
            <div className="p-6">
              <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                    <User className="h-5 w-5 text-[#456564]" />
                    {t("userInformation") || "User Information"}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Name */}
                    <div>
                      <label className={getLabelClasses()} htmlFor="name">
                        {t("name") || "Name"}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="name"
                        className={getInputClasses("name")}
                        type="text"
                        value={state.formData.name || ""}
                        onChange={handleChange}
                        placeholder={t("namePlaceholder") || "Enter name"}
                      />
                      {state.errors.name && (
                        <div className="mt-1 flex items-center text-sm text-red-500">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          <span>{state.errors.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label className={getLabelClasses()} htmlFor="email">
                        {t("email") || "Email"}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="email"
                        className={`${getInputClasses("email")} ${
                          !state.isNew
                            ? "bg-gray-50 dark:bg-gray-700/50 cursor-not-allowed"
                            : ""
                        }`}
                        type="email"
                        value={state.formData.email || ""}
                        readOnly={!state.isNew}
                        onChange={handleChange}
                        placeholder={t("emailPlaceholder") || "Enter email"}
                      />
                      {state.errors.email && (
                        <div className="mt-1 flex items-center text-sm text-red-500">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          <span>{state.errors.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Phone */}
                    <div>
                      <label className={getLabelClasses()} htmlFor="phone">
                        {t("phone") || "Phone"}
                      </label>
                      <input
                        id="phone"
                        className={getInputClasses("phone")}
                        type="tel"
                        value={state.formData.phone || ""}
                        onChange={handleChange}
                        placeholder={
                          t("phonePlaceholder") || "Enter phone number"
                        }
                      />
                    </div>

                    {/* Role */}
                    <div>
                      <label className={getLabelClasses()} htmlFor="role">
                        {t("role") || "Role"}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <SelectDropdown
                        options={roleOptions}
                        value={state.formData.role || ""}
                        onChange={handleRoleChange}
                        placeholder={t("selectRole") || "Select role"}
                        name="role"
                        id="role"
                        clearable={!isSuperAdminUser}
                        disabled={isSuperAdminUser}
                        error={!!state.errors.role}
                        required={true}
                      />
                      {state.errors.role && (
                        <div className="mt-1 flex items-center text-sm text-red-500">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          <span>{state.errors.role}</span>
                        </div>
                      )}
                    </div>

                    {/* Contact */}
                    <div>
                      <label className={getLabelClasses()} htmlFor="contact">
                        {t("contact") || "Contact"}
                      </label>
                      <SelectDropdown
                        options={contactOptions}
                        value={state.formData.contact || ""}
                        onChange={handleContactChange}
                        placeholder={t("selectContact") || "Select contact"}
                        name="contact"
                        id="contact"
                        clearable={true}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`${
                state.formDataChanged || state.isNew ? "sticky" : "hidden"
              } bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 rounded-b-lg transition-all duration-200`}
            >
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-[#8fa3a2] dark:hover:border-[#8fa3a2] text-gray-800 dark:text-gray-300 transition-colors duration-200 shadow-sm"
                  onClick={handleCancel}
                >
                  {t("cancel") || "Cancel"}
                </button>
                <button
                  type="submit"
                  className="btn bg-[#456564] hover:bg-[#34514f] text-white transition-colors duration-200 shadow-sm min-w-[100px]"
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
                      {t("saving") || "Saving"}
                    </div>
                  ) : state.isNew ? (
                    t("save") || "Save"
                  ) : (
                    t("update") || "Update"
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default UsersFormContainer;

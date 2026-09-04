import React, {
  useReducer,
  useEffect,
  useContext,
  useRef,
  useMemo,
  useState,
} from "react";
import {useNavigate, useParams, useLocation, Link} from "react-router-dom";
import {
  AlertCircle,
  Briefcase,
  Building2,
  CreditCard,
  Eye,
  EyeOff,
  Copy,
  Mail,
  MailOpen,
  User,
  UserCircle,
} from "lucide-react";
import Banner from "../../partials/containers/Banner";
import ModalBlank from "../../components/ModalBlank";
import {useTranslation} from "react-i18next";
import DropdownFilter from "../../components/DropdownFilter";
import UserContext from "../../context/UserContext";
import contactContext from "../../context/ContactContext";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {useAutoCloseBanner} from "../../hooks/useAutoCloseBanner";
import {useAuth} from "../../context/AuthContext";
import AppApi, {API_ERROR_CODES, getApiErrorMessage, getUserDeleteErrorMessage} from "../../api/api";
import SelectDropdown from "../contacts/SelectDropdown";
import useImageUpload from "../../hooks/useImageUpload";
import {S3_UPLOAD_FOLDER} from "../../constants/s3UploadFolders";
import usePresignedPreview from "../../hooks/usePresignedPreview";
import ImageUploadField from "../../components/ImageUploadField";
import {isDemoSite, canCreateUsersOnDemo} from "../../utils/demoSite";
import {buildPropertyDetailPath} from "../properties/helpers/pendingInvitation";
import {INVITED_USER_FILTER_TYPE} from "../properties/helpers/invitedUserFilter";

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

async function copyTextToClipboard(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function formatDemoExpiresAt(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

const DEFAULT_DEMO_EXPIRY_HOURS = 72;

function getDefaultDemoExpiresAtDate() {
  return new Date(Date.now() + DEFAULT_DEMO_EXPIRY_HOURS * 60 * 60 * 1000);
}

function toDatetimeLocalValue(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isDemoExpiresAtPast(iso) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t <= Date.now();
}

const initialFormData = {
  name: "",
  email: "",
  phone: "",
  role: "",
  contact: "",
  image: "",
  agencyId: "",
  officeId: "",
  teamId: "",
  opsyScoutOverrideEnabled: false,
  opsyScoutFreeAnalysesLimit: "",
  aiFeaturesOverrideEnabled: false,
  aiFeaturesTokenMonthlyQuota: "",
};

function getDuplicateFormData(duplicateFrom) {
  if (!duplicateFrom || typeof duplicateFrom !== "object") return null;
  return {
    name: duplicateFrom.name || "",
    email: "",
    phone: duplicateFrom.phone || "",
    role: duplicateFrom.role || "",
    contact: duplicateFrom.contact || "",
    image: duplicateFrom.image || "",
    agencyId: duplicateFrom.agencyId || "",
    officeId: duplicateFrom.officeId || "",
    teamId: duplicateFrom.teamId || "",
    opsyScoutOverrideEnabled: duplicateFrom.opsyScoutOverrideEnabled === true,
    opsyScoutFreeAnalysesLimit: duplicateFrom.opsyScoutFreeAnalysesLimit || "",
    aiFeaturesOverrideEnabled: duplicateFrom.aiFeaturesOverrideEnabled === true,
    aiFeaturesTokenMonthlyQuota:
      duplicateFrom.aiFeaturesTokenMonthlyQuota || "",
  };
}

function isAgentRole(role) {
  return String(role || "")
    .toLowerCase()
    .replace(/\s+/g, "_") === "agent";
}

function isHomeownerRole(role) {
  return String(role || "")
    .toLowerCase()
    .replace(/\s+/g, "_") === "homeowner";
}

function canReceiveAiComplimentary(role) {
  return isAgentRole(role) || isHomeownerRole(role);
}

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
  ownershipTransferModalOpen: false,
  accountHasPropertiesModalOpen: false,
  sendInviteOnCreate: false,
  provisionDemoOnCreate: false,
  includePairedHomeownerLogin: true,
  demoPassword: "",
  demoExpiresAt: "",
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
      if (!action.payload && !state.user && state.isNew) {
        return state;
      }
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
              agencyId: action.payload.affiliation?.agencyId
                ? String(action.payload.affiliation.agencyId)
                : "",
              officeId: action.payload.affiliation?.officeId
                ? String(action.payload.affiliation.officeId)
                : "",
              teamId: action.payload.affiliation?.teamId
                ? String(action.payload.affiliation.teamId)
                : action.payload.affiliation?.team?.id
                  ? String(action.payload.affiliation.team.id)
                  : "",
              opsyScoutOverrideEnabled:
                action.payload.opsyScoutOverrideEnabled === true,
              opsyScoutFreeAnalysesLimit:
                action.payload.opsyScoutFreeAnalysesLimit != null
                  ? String(action.payload.opsyScoutFreeAnalysesLimit)
                  : "",
              aiFeaturesOverrideEnabled:
                action.payload.aiFeaturesOverrideEnabled === true,
              aiFeaturesTokenMonthlyQuota:
                action.payload.aiFeaturesTokenMonthlyQuota != null
                  ? String(action.payload.aiFeaturesTokenMonthlyQuota)
                  : "",
            }
          : initialFormData,
        demoPassword: action.payload?.demoLoginPassword || "",
        demoExpiresAt:
          action.payload?.demoLoginPassword && action.payload?.demoExpiresAt
            ? toDatetimeLocalValue(action.payload.demoExpiresAt)
            : "",
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
    case "SET_OWNERSHIP_TRANSFER_MODAL":
      return {...state, ownershipTransferModalOpen: action.payload};
    case "SET_ACCOUNT_HAS_PROPERTIES_MODAL":
      return {...state, accountHasPropertiesModalOpen: action.payload};
    case "SET_FORM_CHANGED":
      return {
        ...state,
        formDataChanged: action.payload,
        isInitialLoad: false,
      };
    case "SET_SEND_INVITE_ON_CREATE":
      return {...state, sendInviteOnCreate: !!action.payload};
    case "SET_PROVISION_DEMO_ON_CREATE":
      return {
        ...state,
        provisionDemoOnCreate: !!action.payload,
        sendInviteOnCreate: action.payload ? false : state.sendInviteOnCreate,
        demoPassword: action.payload ? generateRandomPassword() : "",
        demoExpiresAt: action.payload
          ? toDatetimeLocalValue(getDefaultDemoExpiresAtDate())
          : "",
        includePairedHomeownerLogin: action.payload ? true : state.includePairedHomeownerLogin,
      };
    case "SET_INCLUDE_PAIRED_HOMEOWNER_LOGIN":
      return {...state, includePairedHomeownerLogin: !!action.payload};
    case "SET_DEMO_PASSWORD":
      return {
        ...state,
        demoPassword: action.payload,
        formDataChanged: state.isNew ? state.formDataChanged : true,
        isInitialLoad: false,
      };
    case "SET_DEMO_EXPIRES_AT":
      return {
        ...state,
        demoExpiresAt: action.payload,
        formDataChanged: state.isNew ? state.formDataChanged : true,
        isInitialLoad: false,
      };
    default:
      return state;
  }
}

function UsersFormContainer() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [showDemoPassword, setShowDemoPassword] = useState(false);
  const [provisionPolling, setProvisionPolling] = useState(null);
  const [provisionCredentials, setProvisionCredentials] = useState(null);
  const [credentialCopyMessage, setCredentialCopyMessage] = useState("");
  const {id} = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const duplicateFrom = location.state?.duplicateFrom;
  const isDuplicating = Boolean(duplicateFrom);
  const {t} = useTranslation();
  const {
    users,
    usersLoading,
    createUser,
    deleteUser,
    createUserInvitation,
    setUsers,
    refetchUsers,
  } = useContext(UserContext);
  const {contacts} = useContext(contactContext);
  const {currentUser} = useAuth();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";
  const isDemoSuperAdmin = isDemoSite() && canCreateUsersOnDemo(currentUser);
  const canCreateUser = canCreateUsersOnDemo(currentUser);
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
    uploadFolder: S3_UPLOAD_FOLDER.USER_PHOTOS,
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
  } = usePresignedPreview({forImage: true});

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

  // Demo super admin: load full user (incl. demo credentials) by id only — avoid resetting edits when users context changes.
  useEffect(() => {
    if (!isDemoSuperAdmin || !id) return;

    if (id === "new") {
      dispatch({type: "SET_USER", payload: null});
      return;
    }

    let cancelled = false;
    async function fetchDemoUser() {
      try {
        const user = await AppApi.getUserById(id);
        if (!cancelled && user) {
          dispatch({type: "SET_USER", payload: user});
        }
      } catch (err) {
        if (!cancelled) {
          dispatch({type: "SET_USER", payload: null});
          dispatch({
            type: "SET_BANNER",
            payload: {
              open: true,
              type: "error",
              message: `Error finding user: ${err.message || err}`,
            },
          });
        }
      }
    }
    fetchDemoUser();
    return () => {
      cancelled = true;
    };
  }, [id, isDemoSuperAdmin]);

  // Non-demo: prefer cached list, then fetch by id once the list has finished loading.
  useEffect(() => {
    if (isDemoSuperAdmin) return;

    if (!id || id === "new") {
      dispatch({type: "SET_USER", payload: null});
      return;
    }

    let cancelled = false;

    async function resolveUser() {
      const existingUser = users.find(
        (user) => Number(user.id) === Number(id),
      );
      if (existingUser) {
        if (!cancelled) {
          dispatch({type: "SET_USER", payload: existingUser});
        }
        // List cache omits affiliation — enrich agents from by-id endpoint
        if (
          isAgentRole(existingUser.role) &&
          existingUser.affiliation === undefined
        ) {
          try {
            const full = await AppApi.getUserById(id);
            if (!cancelled && full) {
              dispatch({type: "SET_USER", payload: full});
            }
          } catch {
            /* keep list payload */
          }
        }
        return;
      }

      if (usersLoading) return;

      try {
        const user = await AppApi.getUserById(id);
        if (cancelled) return;
        if (user) {
          dispatch({type: "SET_USER", payload: user});
        } else {
          dispatch({type: "SET_USER", payload: null});
          dispatch({
            type: "SET_BANNER",
            payload: {
              open: true,
              type: "error",
              message: t("userNotFoundErrorMessage") || "User not found",
            },
          });
        }
      } catch (err) {
        if (cancelled) return;
        dispatch({type: "SET_USER", payload: null});
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message: getApiErrorMessage(
              err,
              t("userNotFoundErrorMessage") || "User not found",
            ),
          },
        });
      }
    }

    resolveUser();
    return () => {
      cancelled = true;
    };
  }, [id, users, usersLoading, t, isDemoSuperAdmin]);

  useEffect(() => {
    if (id !== "new") return;
    const prefill = getDuplicateFormData(duplicateFrom);
    if (!prefill) return;
    dispatch({type: "SET_FORM_DATA", payload: prefill});
    const sourceName = duplicateFrom.sourceName || prefill.name || "";
    dispatch({
      type: "SET_BANNER",
      payload: {
        open: true,
        type: "warning",
        message: t("userDuplicatedPrefillMessage", {
          name: sourceName,
          defaultValue:
            "Duplicated from {{name}}. Enter a new email to create this user.",
        }),
      },
    });
  }, [id, duplicateFrom, t]);

  useEffect(() => {
    if (id === "new" && !canCreateUser) {
      navigate(`/${accountUrl}/users`, {replace: true});
    }
  }, [id, canCreateUser, accountUrl, navigate]);

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

  useEffect(() => {
    let cancelled = false;
    async function loadPropertySummary() {
      if (!id || id === "new" || !state.user?.id) {
        setOwnerPropertyCount(0);
        setOwnerPropertyUids([]);
        setInvitedPropertyCount(0);
        setInvitedPropertyUids([]);
        setInvitedPropertyRows([]);
        setAgentPropertyCount(0);
        setAgentPropertyUids([]);
        setPropertySummaryLoading(false);
        return;
      }
      if (Number(state.user.id) !== Number(id)) {
        setOwnerPropertyCount(0);
        setOwnerPropertyUids([]);
        setInvitedPropertyCount(0);
        setInvitedPropertyUids([]);
        setInvitedPropertyRows([]);
        setAgentPropertyCount(0);
        setAgentPropertyUids([]);
        setPropertySummaryLoading(true);
        return;
      }
      setPropertySummaryLoading(true);
      try {
        const list = await AppApi.getPropertiesByUserId(state.user.id);
        if (cancelled) return;
        const rows = list || [];
        const ownerRows = rows.filter(
          (p) =>
            !p._pendingInvitation &&
            (p.property_role === "owner" || p.propertyRole === "owner"),
        );
        const invitedRows = rows.filter((p) => p._pendingInvitation);
        const agentRows = rows.filter((p) => {
          if (p._pendingInvitation) return false;
          const pr = (p.property_role || p.propertyRole || "").toLowerCase();
          return pr === "editor" || pr === "viewer";
        });
        const toUids = (collection) =>
          collection
            .map((p) => p.property_uid ?? p.propertyUid)
            .filter(Boolean)
            .map(String);
        setOwnerPropertyCount(ownerRows.length);
        setOwnerPropertyUids(toUids(ownerRows));
        setInvitedPropertyCount(invitedRows.length);
        setInvitedPropertyUids(toUids(invitedRows));
        setInvitedPropertyRows(invitedRows);
        setAgentPropertyCount(agentRows.length);
        setAgentPropertyUids(toUids(agentRows));
      } catch {
        if (!cancelled) {
          setOwnerPropertyCount(0);
          setOwnerPropertyUids([]);
          setInvitedPropertyCount(0);
          setInvitedPropertyUids([]);
          setInvitedPropertyRows([]);
          setAgentPropertyCount(0);
          setAgentPropertyUids([]);
        }
      } finally {
        if (!cancelled) setPropertySummaryLoading(false);
      }
    }
    loadPropertySummary();
    return () => {
      cancelled = true;
    };
  }, [id, state.user?.id]);

  useEffect(() => {
    if (!provisionPolling?.userId) return undefined;

    let cancelled = false;
    let intervalId = null;

    async function pollProvisionStatus() {
      try {
        const statusRes = await AppApi.getUserProvisionStatus(
          provisionPolling.userId,
        );
        if (cancelled) return;

        if (statusRes?.status === "complete" && statusRes.demoSummary) {
          setProvisionPolling(null);
          const demoSummary = statusRes.demoSummary;
          setProvisionCredentials({
            agentEmail:
              provisionPolling.agentEmail ||
              state.formData.email ||
              state.user?.email ||
              "",
            agentPassword: provisionPolling.password || "",
            pairedHomeowner: demoSummary.pairedHomeowner || null,
            demoExpiresAt: demoSummary.demoExpiresAt || null,
          });
          const successBase = t("userCreatedSuccessfullyMessage", {
            defaultValue: "User created successfully",
          });
          const suffix = ` ${t("demoAccountProvisionedSuffix", {
            defaultValue:
              "Active {{plan}} plan applied. {{count}} sample propert{{countSuffix}} ready. Login password: {{password}}",
            plan: demoSummary.planLabel || demoSummary.planCode,
            count: demoSummary.propertyCount || 0,
            countSuffix: demoSummary.propertyCount === 1 ? "y" : "ies",
            password: provisionPolling.password || "",
          })}`;
          if (demoSummary.pairedHomeowner) {
            const pairedSuffix = ` ${t("demoPairedHomeownerReadySuffix", {
              defaultValue:
                " Paired homeowner login: {{email}} (same password).",
              email: demoSummary.pairedHomeowner.email,
            })}`;
            dispatch({
              type: "SET_BANNER",
              payload: {
                open: true,
                type: "success",
                message: `${successBase}.${suffix}${pairedSuffix}`,
              },
            });
          } else {
            dispatch({
              type: "SET_BANNER",
              payload: {
                open: true,
                type: "success",
                message: `${successBase}.${suffix}`,
              },
            });
          }
        } else if (statusRes?.status === "failed") {
          const failedUserId = provisionPolling.userId;
          setProvisionPolling(null);
          setUsers((prev) =>
            prev.filter((user) => user.id !== Number(failedUserId)),
          );
          refetchUsers?.();
          dispatch({
            type: "SET_BANNER",
            payload: {
              open: true,
              type: "error",
              message: `Demo account setup failed: ${statusRes.error || "Unknown error"}`,
            },
          });
        }
      } catch (pollErr) {
        console.error("Error polling demo provision status:", pollErr);
      }
    }

    pollProvisionStatus();
    intervalId = setInterval(pollProvisionStatus, 1500);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [provisionPolling, t, refetchUsers, setUsers]);

  // Banner timeout useEffect with the custom hook
  useAutoCloseBanner(
    state.bannerOpen,
    state.bannerMessage,
    () =>
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: false,
          type: state.bannerType,
          message: state.bannerMessage,
        },
      }),
    provisionPolling ? 0 : 2500,
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
        image: state.user.image || "",
      };
      dispatch({
        type: "SET_FORM_DATA",
        payload: userData,
      });
      // Reset contact selection tracking when user changes
      setContactSelectedByUser(false);
    } else {
      const prefill = getDuplicateFormData(duplicateFrom);
      dispatch({
        type: "SET_FORM_DATA",
        payload: prefill || initialFormData,
      });
      // Reset contact selection tracking for new users
      setContactSelectedByUser(false);
    }
  }, [state.user, duplicateFrom]);

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
    const email = (
      user?.email ||
      state.user?.email ||
      state.formData?.email ||
      ""
    ).trim();
    if (!email) return null;

    setResendingInvitation(true);
    try {
      const existingInvitationId =
        state.user?.invitation?.id || state.user?.pendingInvitationId || null;

      let invitationId = existingInvitationId;
      if (!invitationId && currentAccount?.id) {
        const pendingInvitations = await AppApi.getAccountInvitations(
          currentAccount.id,
          {status: "pending"},
        );
        const match = (pendingInvitations || []).find(
          (inv) =>
            inv.type === "account" &&
            String(inv.inviteeEmail || "")
              .trim()
              .toLowerCase() === email.toLowerCase(),
        );
        invitationId = match?.id || null;
      }

      if (invitationId) {
        await AppApi.resendInvitation(invitationId);
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "success",
            message:
              t("confirmationEmailMessage")?.replace("{{email}}", email) ||
              `Invitation email sent to ${email}. Please check your email for the confirmation link.`,
          },
        });
        return {invitation: {id: invitationId}};
      }

      const result = await createUserInvitation({
        inviteeEmail: email,
        accountId: currentAccount?.id,
        intendedRole: "member",
        type: "account",
      });

      if (result?.invitation) {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "success",
            message:
              t("confirmationEmailMessage")?.replace("{{email}}", email) ||
              `Invitation email sent to ${email}. Please check your email for the confirmation link.`,
          },
        });
        if (state.user) {
          dispatch({
            type: "SET_USER",
            payload: {
              ...state.user,
              invitation: result.invitation,
              pendingInvitationId: result.invitation.id,
            },
          });
        }
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
    } finally {
      setResendingInvitation(false);
    }
  }

  async function sendUserPasswordReset(user) {
    const userId = user?.id || state.user?.id;
    const email = (
      user?.email ||
      state.user?.email ||
      state.formData?.email ||
      ""
    ).trim();
    if (!userId) return;

    setResendingPasswordReset(true);
    try {
      const result = await AppApi.sendUserPasswordReset(userId);
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "success",
          message:
            result?.message ||
            (email
              ? `Password reset email sent to ${email}.`
              : "Password reset email sent."),
        },
      });
    } catch (error) {
      console.error("Error sending password reset:", error);
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message:
            getApiErrorMessage(error, "Failed to send password reset email") ||
            error?.message ||
            "Failed to send password reset email",
        },
      });
    } finally {
      setResendingPasswordReset(false);
    }
  }

  const isPendingUser =
    state.user && !(state.user.isActive || state.user.is_active);

  // Prefer live user ids from context; fall back to route state only when still valid.
  const navigableUserIds = useMemo(() => {
    const routeIds = location.state?.visibleContactIds;
    if (Array.isArray(routeIds) && routeIds.length > 0 && users.length > 0) {
      const validRouteIds = routeIds.filter((routeId) =>
        users.some((user) => Number(user.id) === Number(routeId)),
      );
      if (validRouteIds.length > 0) return validRouteIds;
    }
    if (users.length > 0) return users.map((user) => user.id);
    return Array.isArray(routeIds) ? routeIds : [];
  }, [location.state?.visibleContactIds, users]);

  const navigableUserIndex =
    id && id !== "new"
      ? navigableUserIds.findIndex((userId) => Number(userId) === Number(id))
      : -1;

  /* Handles submit button */
  async function handleSubmit(evt) {
    evt.preventDefault();

    if (!validateForm()) return;

    // Password for new user (random unless provisioning a demo account)
    const password = state.provisionDemoOnCreate
      ? state.demoPassword
      : generateRandomPassword();

    const userData = {
      name: state.formData.name || "",
      email: state.formData.email || "",
      phone: state.formData.phone || "",
      role: state.formData.role || "",
      contact: state.formData.contact || 0,
      password,
      is_active: state.provisionDemoOnCreate ? true : false,
      image: state.formData.image || undefined,
      accountId: currentAccount?.id,
      sendInvite: state.provisionDemoOnCreate
        ? false
        : isDemoSite()
          ? false
          : state.sendInviteOnCreate,
      ...(state.provisionDemoOnCreate ? {provisionDemoAccount: true} : {}),
      ...(state.provisionDemoOnCreate &&
      (state.formData.role || "").toLowerCase() === "agent" &&
      state.includePairedHomeownerLogin
        ? {includePairedHomeownerLogin: true}
        : {}),
      ...(state.provisionDemoOnCreate && state.demoExpiresAt
        ? {demoExpiresAt: fromDatetimeLocalValue(state.demoExpiresAt)}
        : {}),
    };

    dispatch({type: "SET_SUBMITTING", payload: true});

    try {
      const res = await createUser(userData);

      const invitationEmailSent = res?.invitationEmailSent === true;
      const invitationEmailQueued = res?.invitationEmailQueued === true;
      const invitationSkipped = res?.invitationSkipped === true;
      const provisioned = res?.provisioned === true;
      const provisionStatus = res?.provisionStatus;
      const demoSummary = res?.demoSummary;

      if (res && res.id) {
        try {
          await saveAgentAffiliation(res.id);
        } catch (affErr) {
          console.error("Error assigning agency:", affErr);
        }

        let complimentaryFields = {};
        try {
          complimentaryFields =
            (await applyComplimentaryOverrides(res.id)) || {};
        } catch (overrideErr) {
          console.error("Error applying complimentary overrides:", overrideErr);
        }

        if (Object.keys(complimentaryFields).length > 0) {
          setUsers((prev) =>
            prev.map((u) =>
              Number(u.id) === Number(res.id)
                ? {...u, ...complimentaryFields}
                : u,
            ),
          );
        }

        dispatch({
          type: "SET_USER",
          payload: {
            ...res,
            ...complimentaryFields,
            ...(res.invitation
              ? {
                  invitation: res.invitation,
                  pendingInvitationId: res.invitation.id,
                }
              : {}),
          },
        });

        navigate(`/${accountUrl}/users/${res.id}`, {
          state: {
            currentIndex: users.length + 1,
            totalItems: users.length + 1,
            visibleContactIds: [...users.map((u) => u.id), res.id],
          },
        });

        const successBase = t("userCreatedSuccessfullyMessage", {
          defaultValue: "User created successfully",
        });
        let inviteSuffix;
        let bannerType;

        if (provisionStatus === "pending") {
          setProvisionPolling({
            userId: res.id,
            password,
            agentEmail: res.email || state.formData.email || "",
          });
          inviteSuffix = ` ${t("demoAccountProvisioningSuffix", {
            defaultValue:
              "Sample data is being set up — this usually takes a few seconds.",
          })}`;
          bannerType = "success";
        } else if (provisioned && demoSummary) {
          inviteSuffix = ` ${t("demoAccountProvisionedSuffix", {
            defaultValue:
              "Active {{plan}} plan applied. {{count}} sample propert{{countSuffix}} ready. Login password: {{password}}",
            plan: demoSummary.planLabel || demoSummary.planCode,
            count: demoSummary.propertyCount || 0,
            countSuffix: demoSummary.propertyCount === 1 ? "y" : "ies",
            password: password,
          })}`;
          bannerType = "success";
        } else if (invitationSkipped) {
          inviteSuffix = ` ${t("invitationEmailSkippedSuffix", {
            defaultValue:
              "No invitation email was sent. Use Actions → Send pending invitations when you're ready.",
          })}`;
          bannerType = "success";
        } else if (invitationEmailQueued || res?.invitation) {
          inviteSuffix = ` ${t("invitationEmailQueuedSuffix", {
            defaultValue:
              "An invitation email is being sent to set up their account.",
          })}`;
          bannerType = "success";
        } else if (invitationEmailSent) {
          inviteSuffix = ` ${t("invitationEmailSentSuffix", {
            defaultValue:
              "An invitation email has been sent to set up their account.",
          })}`;
          bannerType = "success";
        } else {
          inviteSuffix = ` ${t("invitationEmailNotSentSuffix", {
            defaultValue:
              "Invitation email could not be sent — use “Resend invitation email” to retry.",
          })}`;
          bannerType = "warning";
        }

        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: bannerType,
            message: `${successBase}.${inviteSuffix}`,
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

    const {
      agencyId: _agencyId,
      officeId: _officeId,
      teamId: _teamId,
      opsyScoutOverrideEnabled,
      opsyScoutFreeAnalysesLimit,
      aiFeaturesOverrideEnabled,
      aiFeaturesTokenMonthlyQuota,
      ...formFields
    } = state.formData;
    const userData = {
      ...formFields,
      contact: Number(state.formData.contact),
      isActive: state.formData.isActive,
      image: state.formData.image || null,
    };

    if (isAgentRole(state.formData.role)) {
      userData.opsyScoutOverrideEnabled = !!opsyScoutOverrideEnabled;
      userData.opsyScoutFreeAnalysesLimit = opsyScoutOverrideEnabled
        ? Number(opsyScoutFreeAnalysesLimit)
        : null;
    } else {
      userData.opsyScoutOverrideEnabled = false;
      userData.opsyScoutFreeAnalysesLimit = null;
    }

    if (canReceiveAiComplimentary(state.formData.role)) {
      userData.aiFeaturesOverrideEnabled = !!aiFeaturesOverrideEnabled;
      userData.aiFeaturesTokenMonthlyQuota = aiFeaturesOverrideEnabled
        ? Number(aiFeaturesTokenMonthlyQuota)
        : null;
    } else {
      userData.aiFeaturesOverrideEnabled = false;
      userData.aiFeaturesTokenMonthlyQuota = null;
    }

    const demoPasswordChanged =
      isDemoSuperAdmin &&
      state.demoPassword?.trim() &&
      state.demoPassword !== (state.user?.demoLoginPassword || "");
    if (demoPasswordChanged) {
      userData.password = state.demoPassword;
    }

    if (
      isDemoSuperAdmin &&
      state.user?.demoLoginPassword &&
      state.demoExpiresAt
    ) {
      userData.demoExpiresAt = fromDatetimeLocalValue(state.demoExpiresAt);
    }

    dispatch({type: "SET_SUBMITTING", payload: true});

    try {
      await AppApi.updateUser(id, userData);

      let affiliation = null;
      try {
        affiliation = await saveAgentAffiliation(id);
      } catch (affErr) {
        console.error("Error assigning agency:", affErr);
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message: `User updated, but agency assignment failed: ${affErr.message || affErr}`,
          },
        });
        dispatch({type: "SET_SUBMITTING", payload: false});
        return;
      }

      const refreshed = await AppApi.getUserById(id);
      const updatedUser = {
        ...refreshed,
        ...(affiliation
          ? {affiliation}
          : isAgentRole(state.formData.role)
            ? {
                affiliation:
                  refreshed?.affiliation ?? state.user?.affiliation ?? null,
              }
            : {}),
      };

      if (updatedUser) {
        dispatch({
          type: "SET_USER",
          payload: updatedUser,
        });

        const updatedUsers = users.map((u) =>
          u.id === Number(id) ? {...updatedUser, id: Number(id)} : u,
        );
        setUsers(updatedUsers);
        dispatch({type: "SET_FORM_CHANGED", payload: false});

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
    } else if (
      state.provisionDemoOnCreate &&
      state.formData.role !== "agent" &&
      state.formData.role !== "homeowner"
    ) {
      newErrors.role =
        t("demoProvisionRoleError") ||
        "Demo provisioning supports Agent and Homeowner roles only.";
    }

    if (state.provisionDemoOnCreate && !state.demoPassword?.trim()) {
      newErrors.demoPassword =
        t("demoAccountPasswordRequired") || "Login password is required.";
    }

    if (showDemoExpiresAtField && state.demoExpiresAt) {
      const expiresIso = fromDatetimeLocalValue(state.demoExpiresAt);
      if (!expiresIso) {
        newErrors.demoExpiresAt =
          t("demoAccessExpiresInvalid") || "Enter a valid date and time.";
      } else if (state.isNew && isDemoExpiresAtPast(expiresIso)) {
        newErrors.demoExpiresAt =
          t("demoAccessExpiresFutureRequired") ||
          "Demo access expiry must be in the future.";
      }
    }

    if (
      (!state.isNew || isDuplicating) &&
      isAgentRole(state.formData.role) &&
      state.formData.opsyScoutOverrideEnabled
    ) {
      const limit = Number(state.formData.opsyScoutFreeAnalysesLimit);
      if (!Number.isInteger(limit) || limit < 1) {
        newErrors.opsyScoutFreeAnalysesLimit =
          t("opsyScoutFreeAnalysesLimitRequired") ||
          "Enter a positive number of free analyses.";
      }
    }

    if (
      (!state.isNew || isDuplicating) &&
      canReceiveAiComplimentary(state.formData.role) &&
      state.formData.aiFeaturesOverrideEnabled
    ) {
      const quota = Number(state.formData.aiFeaturesTokenMonthlyQuota);
      if (!Number.isInteger(quota) || quota < 1) {
        newErrors.aiFeaturesTokenMonthlyQuota =
          t("aiFeaturesTokenMonthlyQuotaRequired") ||
          "Enter a positive monthly AI token limit.";
      }
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
    (isDuplicating ? duplicateFrom?.image_url : null) ||
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
    navigate(`/${accountUrl}/users/new`, {state: {}});
  }

  function handleDuplicate() {
    if (!state.user || !canCreateUser) return;
    if (
      state.user.role === "super_admin" ||
      state.user.role === "superAdmin"
    ) {
      return;
    }
    navigate(`/${accountUrl}/users/new`, {
      state: {
        duplicateFrom: {
          name: state.formData.name || "",
          phone: state.formData.phone || "",
          role: state.formData.role || "",
          contact: state.formData.contact || "",
          image: state.formData.image || state.user.image || "",
          image_url: userPhotoDisplayUrl || state.user.image_url || "",
          agencyId: state.formData.agencyId || "",
          officeId: state.formData.officeId || "",
          teamId: state.formData.teamId || "",
          opsyScoutOverrideEnabled: !!state.formData.opsyScoutOverrideEnabled,
          opsyScoutFreeAnalysesLimit:
            state.formData.opsyScoutFreeAnalysesLimit || "",
          aiFeaturesOverrideEnabled: !!state.formData.aiFeaturesOverrideEnabled,
          aiFeaturesTokenMonthlyQuota:
            state.formData.aiFeaturesTokenMonthlyQuota || "",
          sourceName: state.user.name || state.formData.name || "",
        },
      },
    });
  }

  /* Handles delete button */
  function handleDelete() {
    if (state.user?.role === "super_admin") {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message:
            t("userDeleteSuperAdminBlocked") ||
            "Super admin accounts cannot be deleted.",
        },
      });
      return;
    }
    dispatch({type: "SET_DANGER_MODAL", payload: true});
  }

  /* Handles delete confirmation on modal */
  async function confirmDelete() {
    try {
      // Close modal immediately when Accept is clicked
      dispatch({type: "SET_DANGER_MODAL", payload: false});

      const userIdToDelete = state.user?.id;
      if (!userIdToDelete) {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message: t("userNotFoundErrorMessage") || "User not found",
          },
        });
        return;
      }

      if (Number(userIdToDelete) !== Number(id)) {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message:
              t("userDeletePageOutOfSync") ||
              "This page is out of date. Refresh the users list and try again.",
          },
        });
        return;
      }

      // Find the current user index in the users array (before deletion)
      const userIndex = users.findIndex(
        (user) => user.id === Number(userIdToDelete),
      );

      // Delete the user (this updates the context)
      const deleteResult = await deleteUser(userIdToDelete);

      if (deleteResult?.alreadyDeleted) {
        await refetchUsers?.();
        navigate(`/${accountUrl}/users`);
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "warning",
            message:
              t("userDeleteStaleRecordMessage") ||
              "This user no longer exists. The list has been refreshed.",
          },
        });
        return;
      }

      // Navigate first based on remaining users
      // Calculate remaining users by filtering out the deleted one from the current users array
      const remainingUsers = users.filter(
        (user) => user.id !== Number(userIdToDelete),
      );

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
      if (error?.code === API_ERROR_CODES.PROPERTY_OWNER) {
        dispatch({type: "SET_OWNERSHIP_TRANSFER_MODAL", payload: true});
        return;
      }
      if (error?.code === API_ERROR_CODES.ACCOUNT_HAS_PROPERTIES) {
        dispatch({type: "SET_ACCOUNT_HAS_PROPERTIES_MODAL", payload: true});
        return;
      }
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: getUserDeleteErrorMessage(
            error,
            t("userDeleteFailed") || "Could not delete user.",
          ),
        },
      });
    }
  }

  /* Handles cancel button */
  function handleCancel() {
    if (state.user) {
      dispatch({type: "SET_USER", payload: state.user});
      dispatch({type: "SET_ERRORS", payload: {}});
    } else {
      // For new users, reset to initial form data and navigate to new user form
      dispatch({
        type: "SET_FORM_DATA",
        payload: initialFormData,
      });
      dispatch({type: "SET_FORM_CHANGED", payload: false});
      dispatch({type: "SET_ERRORS", payload: {}});
      navigate(`/${accountUrl}/users/new`, {state: {}});
    }
  }

  // Check if the user being edited is a super_admin
  const isSuperAdminUser =
    state.user?.role === "super_admin" || state.user?.role === "superAdmin";
  const isAssistantUser =
    !state.isNew && (state.user?.role || "").toLowerCase() === "assistant";
  const roleSelectLocked = isSuperAdminUser || isAssistantUser;

  // Role options for the select dropdown based on current user's role
  const roleOptions = useMemo(() => {
    // If the user being edited is super_admin, show only Super Admin option
    if (isSuperAdminUser) {
      return [{id: "Super Admin", name: "Super Admin"}];
    }

    /* Assistants are created via the Assistants page — keep role locked here. */
    if (isAssistantUser) {
      return [{id: "assistant", name: "Assistant"}];
    }

    // If current user is super_admin, they can see: admin, agent, homeowner
    if (
      currentUser?.role === "superAdmin" ||
      currentUser?.role === "super_admin"
    ) {
      if (state.isNew && state.provisionDemoOnCreate && isDemoSuperAdmin) {
        return [
          {id: "agent", name: "Agent"},
          {id: "homeowner", name: "Homeowner"},
        ];
      }
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
  }, [
    currentUser?.role,
    isSuperAdminUser,
    isAssistantUser,
    state.isNew,
    state.provisionDemoOnCreate,
    isDemoSuperAdmin,
  ]);

  const isDemoManagedUser =
    !state.isNew &&
    (state.user?.role === "agent" || state.user?.role === "homeowner");

  const showDemoPasswordField =
    isDemoSuperAdmin &&
    ((state.isNew && state.provisionDemoOnCreate) || isDemoManagedUser);

  const showDemoExpiresAtField =
    isDemoSuperAdmin &&
    ((state.isNew && state.provisionDemoOnCreate) ||
      (!state.isNew && !!state.user?.demoLoginPassword));

  const demoExpiresAtIso =
    state.demoExpiresAt
      ? fromDatetimeLocalValue(state.demoExpiresAt)
      : state.user?.demoExpiresAt || null;

  const demoAccessExpired = isDemoExpiresAtPast(demoExpiresAtIso);

  const demoCredentialBundle = useMemo(() => {
    if (provisionCredentials) return provisionCredentials;
    if (!isDemoManagedUser || state.user?.role !== "agent") return null;
    if (!state.user?.demoLoginPassword && !state.user?.pairedHomeowner) return null;
    return {
      agentEmail: state.user.email,
      agentPassword: state.demoPassword || state.user.demoLoginPassword || "",
      pairedHomeowner: state.user.pairedHomeowner || null,
      demoExpiresAt: demoExpiresAtIso,
    };
  }, [
    provisionCredentials,
    isDemoManagedUser,
    state.user,
    state.demoPassword,
    state.demoExpiresAt,
  ]);

  const showPairedHomeownerToggle =
    state.isNew &&
    isDemoSuperAdmin &&
    state.provisionDemoOnCreate &&
    (state.formData.role === "agent" || state.formData.role === "Agent");

  const hasPairedHomeownerContext =
    (showPairedHomeownerToggle && state.includePairedHomeownerLogin) ||
    (!state.isNew && !!state.user?.pairedHomeowner) ||
    !!demoCredentialBundle?.pairedHomeowner;

  const demoPasswordHelperText = useMemo(() => {
    if (state.isNew) {
      if (hasPairedHomeownerContext) {
        return (
          t("demoAccountPasswordHelperWithPaired") ||
          "Share this password with the prospect. The same password is used for both the agent and paired homeowner logins."
        );
      }
      return (
        t("demoAccountPasswordHelper") ||
        "Share this password with the prospect so they can sign in immediately."
      );
    }
    if (hasPairedHomeownerContext) {
      return (
        t("demoAccountPasswordEditHelperWithPaired") ||
        "Updates the agent login password. The paired homeowner login uses the same password shown here."
      );
    }
    return (
      t("demoAccountPasswordEditHelper") ||
      "Copy or update the login password shared with this demo prospect. Saving updates their sign-in credentials."
    );
  }, [state.isNew, hasPairedHomeownerContext, t]);

  async function handleCopyCredential(label, text) {
    const ok = await copyTextToClipboard(text);
    setCredentialCopyMessage(
      ok
        ? t("demoCredentialCopied", {defaultValue: "{{label}} copied", label})
        : t("demoCredentialCopyFailed", {defaultValue: "Copy failed"}),
    );
    window.setTimeout(() => setCredentialCopyMessage(""), 2500);
  }

  // Handler for role change
  function handleRoleChange(value) {
    const payload = {role: value};
    if (!isAgentRole(value)) {
      payload.agencyId = "";
      payload.officeId = "";
      payload.teamId = "";
      payload.opsyScoutOverrideEnabled = false;
      payload.opsyScoutFreeAnalysesLimit = "";
    }
    if (!canReceiveAiComplimentary(value)) {
      payload.aiFeaturesOverrideEnabled = false;
      payload.aiFeaturesTokenMonthlyQuota = "";
    }
    dispatch({
      type: "SET_FORM_DATA",
      payload,
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
  const [subscriptionNavigating, setSubscriptionNavigating] = useState(false);
  const [propertySummaryLoading, setPropertySummaryLoading] = useState(false);
  const [ownerPropertyCount, setOwnerPropertyCount] = useState(0);
  const [ownerPropertyUids, setOwnerPropertyUids] = useState([]);
  const [invitedPropertyCount, setInvitedPropertyCount] = useState(0);
  const [invitedPropertyUids, setInvitedPropertyUids] = useState([]);
  const [invitedPropertyRows, setInvitedPropertyRows] = useState([]);
  const [agentPropertyCount, setAgentPropertyCount] = useState(0);
  const [agentPropertyUids, setAgentPropertyUids] = useState([]);
  const [resendingInvitation, setResendingInvitation] = useState(false);
  const [resendingPasswordReset, setResendingPasswordReset] = useState(false);
  const [agencyOptions, setAgencyOptions] = useState([]);
  const [officeOptions, setOfficeOptions] = useState([]);
  const [teamOptions, setTeamOptions] = useState([]);
  const [agenciesLoading, setAgenciesLoading] = useState(false);
  const [officesLoading, setOfficesLoading] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(false);

  const showAgentAffiliationFields = isAgentRole(state.formData.role);
  const showComplimentaryFields = !state.isNew || isDuplicating;

  useEffect(() => {
    if (!showAgentAffiliationFields) {
      setAgencyOptions([]);
      setOfficeOptions([]);
      setTeamOptions([]);
      return;
    }
    let cancelled = false;
    async function loadAgencies() {
      setAgenciesLoading(true);
      try {
        const list = await AppApi.searchAffiliationAgencies("", 100);
        if (cancelled) return;
        setAgencyOptions(
          (list || []).map((a) => ({
            id: String(a.id),
            name: a.name,
          })),
        );
      } catch {
        if (!cancelled) setAgencyOptions([]);
      } finally {
        if (!cancelled) setAgenciesLoading(false);
      }
    }
    loadAgencies();
    return () => {
      cancelled = true;
    };
  }, [showAgentAffiliationFields]);

  useEffect(() => {
    if (!showAgentAffiliationFields || !state.formData.agencyId) {
      setOfficeOptions([]);
      return;
    }
    let cancelled = false;
    async function loadOffices() {
      setOfficesLoading(true);
      try {
        const list = await AppApi.searchAffiliationOffices(
          state.formData.agencyId,
          "",
          100,
        );
        if (cancelled) return;
        setOfficeOptions(
          (list || []).map((o) => ({
            id: String(o.id),
            name: o.name,
          })),
        );
      } catch {
        if (!cancelled) setOfficeOptions([]);
      } finally {
        if (!cancelled) setOfficesLoading(false);
      }
    }
    loadOffices();
    return () => {
      cancelled = true;
    };
  }, [showAgentAffiliationFields, state.formData.agencyId]);

  useEffect(() => {
    if (!showAgentAffiliationFields || !state.formData.officeId) {
      setTeamOptions([]);
      return;
    }
    let cancelled = false;
    async function loadTeams() {
      setTeamsLoading(true);
      try {
        const list = await AppApi.searchAffiliationTeams(
          state.formData.officeId,
          "",
          100,
        );
        if (cancelled) return;
        setTeamOptions(
          (list || []).map((tm) => ({
            id: String(tm.id),
            name: tm.name,
          })),
        );
      } catch {
        if (!cancelled) setTeamOptions([]);
      } finally {
        if (!cancelled) setTeamsLoading(false);
      }
    }
    loadTeams();
    return () => {
      cancelled = true;
    };
  }, [showAgentAffiliationFields, state.formData.officeId]);

  // Prefill agency/office/team option labels when affiliation exists but lists haven't loaded yet
  useEffect(() => {
    const aff = state.user?.affiliation;
    if (!aff?.agency?.id) return;
    setAgencyOptions((prev) => {
      if (prev.some((o) => String(o.id) === String(aff.agency.id))) return prev;
      return [
        ...prev,
        {id: String(aff.agency.id), name: aff.agency.name || `Agency #${aff.agency.id}`},
      ];
    });
    if (aff.office?.id) {
      setOfficeOptions((prev) => {
        if (prev.some((o) => String(o.id) === String(aff.office.id))) return prev;
        return [
          ...prev,
          {
            id: String(aff.office.id),
            name: aff.office.name || `Office #${aff.office.id}`,
          },
        ];
      });
    }
    if (aff.team?.id) {
      setTeamOptions((prev) => {
        if (prev.some((o) => String(o.id) === String(aff.team.id))) return prev;
        return [
          ...prev,
          {
            id: String(aff.team.id),
            name: aff.team.name || `Team #${aff.team.id}`,
          },
        ];
      });
    }
  }, [state.user?.affiliation]);

  function handleAgencyChange(value) {
    dispatch({
      type: "SET_FORM_DATA",
      payload: {agencyId: value ? String(value) : "", officeId: "", teamId: ""},
    });
    if (state.isInitialLoad) {
      dispatch({type: "SET_FORM_CHANGED", payload: true});
    }
  }

  function handleOfficeChange(value) {
    dispatch({
      type: "SET_FORM_DATA",
      payload: {officeId: value ? String(value) : "", teamId: ""},
    });
    if (state.isInitialLoad) {
      dispatch({type: "SET_FORM_CHANGED", payload: true});
    }
  }

  function handleTeamChange(value) {
    dispatch({
      type: "SET_FORM_DATA",
      payload: {teamId: value ? String(value) : ""},
    });
    if (state.isInitialLoad) {
      dispatch({type: "SET_FORM_CHANGED", payload: true});
    }
  }

  async function saveAgentAffiliation(userId) {
    if (!isAgentRole(state.formData.role) || !state.formData.agencyId) return null;
    return AppApi.assignAgentAffiliation(userId, {
      agencyId: Number(state.formData.agencyId),
      ...(state.formData.officeId
        ? {officeId: Number(state.formData.officeId)}
        : {}),
      teamId: state.formData.teamId ? Number(state.formData.teamId) : null,
    });
  }

  async function applyComplimentaryOverrides(userId) {
    const payload = {};
    if (isAgentRole(state.formData.role)) {
      if (state.formData.opsyScoutOverrideEnabled) {
        payload.opsyScoutOverrideEnabled = true;
        payload.opsyScoutFreeAnalysesLimit = Number(
          state.formData.opsyScoutFreeAnalysesLimit,
        );
      }
    }
    if (canReceiveAiComplimentary(state.formData.role)) {
      if (state.formData.aiFeaturesOverrideEnabled) {
        payload.aiFeaturesOverrideEnabled = true;
        payload.aiFeaturesTokenMonthlyQuota = Number(
          state.formData.aiFeaturesTokenMonthlyQuota,
        );
      }
    }
    if (Object.keys(payload).length === 0) return null;
    await AppApi.updateUser(userId, payload);
    return payload;
  }

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

  const handleNavigateToSubscription = async () => {
    if (!state.user?.id || subscriptionNavigating) return;

    setSubscriptionNavigating(true);
    try {
      const accountId = state.user.latestSubscriptionAccountId;
      const userEmail = (state.user.email || "").toLowerCase();
      let subscriptions = [];

      if (accountId) {
        subscriptions = await AppApi.getSubscriptionsByAccountId(accountId);
      }

      if (!subscriptions.length) {
        const allSubscriptions = await AppApi.getAllSubscriptions();
        subscriptions = (allSubscriptions || []).filter((sub) => {
          const matchesAccount =
            accountId && Number(sub.accountId) === Number(accountId);
          const matchesEmail =
            userEmail && (sub.userEmail || "").toLowerCase() === userEmail;
          return matchesAccount || matchesEmail;
        });
      }

      if (!subscriptions.length) {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "warning",
            message: "No subscription record found for this user.",
          },
        });
        return;
      }

      const ordered = [...subscriptions].sort((a, b) => {
        const rank = (status) =>
          ["active", "trialing"].includes((status || "").toLowerCase()) ? 0 : 1;
        const statusDiff = rank(a.status) - rank(b.status);
        if (statusDiff !== 0) return statusDiff;

        const aTime = new Date(
          a.currentPeriodEnd || a.updatedAt || a.createdAt || 0,
        ).getTime();
        const bTime = new Date(
          b.currentPeriodEnd || b.updatedAt || b.createdAt || 0,
        ).getTime();
        return bTime - aTime;
      });

      const target = ordered[0];
      if (!target?.id) {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "warning",
            message: "Unable to determine a subscription to open.",
          },
        });
        return;
      }

      navigate(`/${accountUrl}/subscriptions/${target.id}`);
    } catch (error) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: getApiErrorMessage(
            error,
            "Could not open subscription. Please try again.",
          ),
        },
      });
    } finally {
      setSubscriptionNavigating(false);
    }
  };

  const profileUserRoleKey =
    state.user?.role === "super_admin" || state.user?.role === "superAdmin"
      ? "super_admin"
      : String(state.user?.role || "")
          .toLowerCase()
          .replace(/\s+/g, "_");
  const isProfileAgentUser = profileUserRoleKey === "agent";

  // When clicking on a Property smart button, take the user straight to the
  // single property if there's only one match; otherwise show a filtered list.
  const navigateToScopedProperties = (uids, filterMessage) => {
    if (!uids || uids.length === 0) {
      navigate(`/${accountUrl}/properties`);
      return;
    }
    if (uids.length === 1) {
      const uid = uids[0];
      navigate(`/${accountUrl}/properties/${uid}`, {
        state: {
          currentIndex: 1,
          totalItems: 1,
          visiblePropertyIds: [uid],
        },
      });
      return;
    }
    navigate(`/${accountUrl}/properties`, {
      state: {
        filterPropertyUids: uids,
        filterPropertyMessage: filterMessage,
      },
    });
  };

  const profileUserName = state.user?.name || t("thisUser") || "this user";

  const handleNavigateToOwnerProperties = () => {
    navigateToScopedProperties(
      ownerPropertyUids,
      `Showing properties owned by ${profileUserName}.`,
    );
  };

  const handleNavigateToAgentProperties = () => {
    navigateToScopedProperties(
      agentPropertyUids,
      `Showing properties where ${profileUserName} is on the team as agent (editor or viewer).`,
    );
  };

  const handleNavigateToInvitedProperties = () => {
    const email = String(state.user?.email || "")
      .trim()
      .toLowerCase();
    const applyFilters = email
      ? [
          {
            type: INVITED_USER_FILTER_TYPE,
            value: email,
            label: profileUserName,
          },
        ]
      : [];

    if (!invitedPropertyUids.length) {
      navigate(`/${accountUrl}/properties`, {
        state: applyFilters.length ? {applyFilters} : undefined,
      });
      return;
    }
    if (invitedPropertyUids.length === 1) {
      const uid = invitedPropertyUids[0];
      const row = invitedPropertyRows[0];
      navigate(buildPropertyDetailPath(accountUrl, row, uid), {
        state: {
          currentIndex: 1,
          totalItems: 1,
          visiblePropertyIds: [uid],
        },
      });
      return;
    }
    navigate(`/${accountUrl}/properties`, {
      state: {
        applyFilters,
        filterPropertyUids: invitedPropertyUids,
        filterPropertyMessage: `Showing properties ${profileUserName} has been invited to.`,
      },
    });
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
    <div className="relative min-h-screen bg-white dark:bg-gray-900">
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
          contentClassName="max-w-lg"
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
            <div className="flex-1 min-w-0">
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
              <div className="flex flex-wrap justify-end gap-2">
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

      <div className="m-1.5">
        <ModalBlank
          id="account-has-properties-modal"
          modalOpen={state.accountHasPropertiesModalOpen}
          setModalOpen={(open) =>
            dispatch({type: "SET_ACCOUNT_HAS_PROPERTIES_MODAL", payload: open})
          }
        >
          <div className="p-5 flex space-x-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-amber-100 dark:bg-amber-900/30">
              <svg
                className="shrink-0 fill-current text-amber-600 dark:text-amber-400"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                aria-hidden
              >
                <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 12c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm1-3H7V4h2v5z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2">
                <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {t("userDeleteAccountHasPropertiesTitle") ||
                    "Account still has properties"}
                </div>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-6 space-y-3">
                {state.user?.name && (
                  <p className="font-medium text-gray-800 dark:text-gray-200">
                    {state.user.name}
                  </p>
                )}
                <p>
                  {t("userDeleteAccountHasPropertiesBody") ||
                    "This user owns a workspace account that still has properties. Assign another account owner or remove all properties first, then try deleting again."}
                </p>
              </div>
              <div className="flex flex-wrap justify-end">
                <button
                  type="button"
                  className="btn-sm bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({
                      type: "SET_ACCOUNT_HAS_PROPERTIES_MODAL",
                      payload: false,
                    });
                  }}
                >
                  {t("ok") || "OK"}
                </button>
              </div>
            </div>
          </div>
        </ModalBlank>
      </div>

      <div className="m-1.5">
        <ModalBlank
          id="ownership-transfer-modal"
          modalOpen={state.ownershipTransferModalOpen}
          setModalOpen={(open) =>
            dispatch({type: "SET_OWNERSHIP_TRANSFER_MODAL", payload: open})
          }
        >
          <div className="p-5 flex space-x-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-amber-100 dark:bg-amber-900/30">
              <svg
                className="shrink-0 fill-current text-amber-600 dark:text-amber-400"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                aria-hidden
              >
                <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 12c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm1-3H7V4h2v5z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2">
                <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {t("userDeleteTransferOwnershipTitle") ||
                    "Transfer ownership first"}
                </div>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-6 space-y-3">
                {state.user?.name && (
                  <p className="font-medium text-gray-800 dark:text-gray-200">
                    {state.user.name}
                  </p>
                )}
                <p>
                  {t("userDeleteTransferOwnershipBody") ||
                    "This user still owns one or more properties. Transfer property ownership to another team member (Share / Team on the property), then try deleting again."}
                </p>
              </div>
              <div className="flex flex-wrap justify-end">
                <button
                  type="button"
                  className="btn-sm bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({
                      type: "SET_OWNERSHIP_TRANSFER_MODAL",
                      payload: false,
                    });
                  }}
                >
                  {t("ok") || "OK"}
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
              <DropdownFilter
                onDelete={
                  state.user?.role === "super_admin" ? undefined : handleDelete
                }
                onDuplicate={
                  canCreateUser && !isSuperAdminUser
                    ? handleDuplicate
                    : undefined
                }
                onResendInvitation={
                  isPendingUser
                    ? () => sendUserInvitation(state.user)
                    : undefined
                }
                resendingInvitation={resendingInvitation}
                onResendPasswordReset={
                  !isPendingUser
                    ? () => sendUserPasswordReset(state.user)
                    : undefined
                }
                resendingPasswordReset={resendingPasswordReset}
                align="right"
              />
            )}
            <button
              className="btn btn-primary transition-colors duration-200 shadow-sm"
              onClick={handleNewUser}
              hidden={!canCreateUser}
            >
              {t("new") || "New"}
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center gap-2 mb-2 min-w-0">
          {/* Smart buttons + status: horizontal scroll when the row overflows */}
          <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
            <div className="flex flex-nowrap items-center gap-3 py-1 pl-1 pr-2 sm:pl-0 sm:pr-1">
              {/* Contact Link Button - Only shows saved contact from database */}
              {savedContact ? (
                <button
                  onClick={handleNavigateToSavedContact}
                  className="shrink-0 flex items-center gap-2 px-3 py-2 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 transition-all duration-200 ml-3 sm:ml-4"
                >
                  <UserCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-semibold whitespace-nowrap">
                    Contact <span className="font-normal">1</span>
                  </span>
                </button>
              ) : (
                <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 ml-3 sm:ml-4">
                  <UserCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium whitespace-nowrap">
                    Contact <span className="font-normal">0</span>
                  </span>
                </div>
              )}

              {state.user ? (
                ownerPropertyCount > 0 && !propertySummaryLoading ? (
                  <button
                    type="button"
                    onClick={handleNavigateToOwnerProperties}
                    className="shrink-0 flex items-center gap-2 px-3 py-2 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 transition-all duration-200"
                  >
                    <Building2 className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-semibold whitespace-nowrap">
                      Properties{" "}
                      <span className="font-normal">{ownerPropertyCount}</span>
                    </span>
                  </button>
                ) : (
                  <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400">
                    <Building2 className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium whitespace-nowrap">
                      Properties{" "}
                      <span className="font-normal">
                        {propertySummaryLoading ? "…" : ownerPropertyCount}
                      </span>
                    </span>
                  </div>
                )
              ) : null}

              {state.user ? (
                invitedPropertyCount > 0 && !propertySummaryLoading ? (
                  <button
                    type="button"
                    onClick={handleNavigateToInvitedProperties}
                    className="shrink-0 flex items-center gap-2 px-3 py-2 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 transition-all duration-200"
                  >
                    <MailOpen className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-semibold whitespace-nowrap">
                      Invited{" "}
                      <span className="font-normal">
                        {invitedPropertyCount}
                      </span>
                    </span>
                  </button>
                ) : (
                  <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400">
                    <MailOpen className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium whitespace-nowrap">
                      Invited{" "}
                      <span className="font-normal">
                        {propertySummaryLoading ? "…" : invitedPropertyCount}
                      </span>
                    </span>
                  </div>
                )
              ) : null}

              {state.user && isProfileAgentUser ? (
                agentPropertyCount > 0 && !propertySummaryLoading ? (
                  <button
                    type="button"
                    onClick={handleNavigateToAgentProperties}
                    className="shrink-0 flex items-center gap-2 px-3 py-2 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 transition-all duration-200"
                  >
                    <Briefcase className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-semibold whitespace-nowrap">
                      Property agent{" "}
                      <span className="font-normal">{agentPropertyCount}</span>
                    </span>
                  </button>
                ) : (
                  <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400">
                    <Briefcase className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium whitespace-nowrap">
                      Property agent{" "}
                      <span className="font-normal">
                        {propertySummaryLoading ? "…" : agentPropertyCount}
                      </span>
                    </span>
                  </div>
                )
              ) : null}

              {state.user ? (
                <button
                  type="button"
                  onClick={handleNavigateToSubscription}
                  disabled={subscriptionNavigating}
                  className={`shrink-0 flex items-center gap-2 px-3 py-2 border rounded-lg transition-all duration-200 ${
                    subscriptionNavigating
                      ? "bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                      : "bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <CreditCard className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {subscriptionNavigating ? "Loading..." : "Subscription"}
                  </span>
                </button>
              ) : null}

              {/* Activated/Pending Status - Informational only */}
              {state.user &&
                (isPendingUser ? (
                  <div className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm bg-[#fddddd] dark:bg-[#402431] text-[#e63939] dark:text-[#c23437] whitespace-nowrap">
                    <span>Pending</span>
                  </div>
                ) : (
                  <div className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm bg-[#d3f4e3] dark:bg-[#173c36] text-[#2a9f52] dark:text-[#258c4d] whitespace-nowrap">
                    <span>Active</span>
                  </div>
                ))}
            </div>
          </div>

          {/* User Navigation */}
          <div className="flex items-center shrink-0">
            {state.user &&
              navigableUserIds.length > 1 &&
              navigableUserIndex >= 0 && (
                <>
                  <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                    {navigableUserIndex + 1} / {navigableUserIds.length}
                  </span>
                  <button
                    className="btn shadow-none p-1"
                    title="Previous"
                    onClick={() => {
                      if (navigableUserIndex > 0) {
                        const prevUserId =
                          navigableUserIds[navigableUserIndex - 1];
                        navigate(`/${accountUrl}/users/${prevUserId}`, {
                          state: {
                            ...location.state,
                            currentIndex: navigableUserIndex,
                            totalItems: navigableUserIds.length,
                            visibleContactIds: navigableUserIds,
                          },
                        });
                      }
                    }}
                    disabled={navigableUserIndex <= 0}
                  >
                    <svg
                      className={`fill-current shrink-0 ${
                        navigableUserIndex <= 0
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
                      if (navigableUserIndex < navigableUserIds.length - 1) {
                        const nextUserId =
                          navigableUserIds[navigableUserIndex + 1];
                        navigate(`/${accountUrl}/users/${nextUserId}`, {
                          state: {
                            ...location.state,
                            currentIndex: navigableUserIndex + 2,
                            totalItems: navigableUserIds.length,
                            visibleContactIds: navigableUserIds,
                          },
                        });
                      }
                    }}
                    disabled={navigableUserIndex >= navigableUserIds.length - 1}
                  >
                    <svg
                      className={`fill-current shrink-0 ${
                        navigableUserIndex >= navigableUserIds.length - 1
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
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              {/* User Name and Info */}
              <div className="flex items-start gap-3 sm:gap-4 min-w-0 w-full">
                <ImageUploadField
                  imageSrc={userPhotoDisplayUrl}
                  hasImage={
                    !!(
                      state.formData.image ||
                      state.user?.image ||
                      userPhotoDisplayUrl
                    )
                  }
                  imageUploading={userPhotoUploading}
                  onUpload={uploadUserPhoto}
                  onRemove={handleRemoveUserPhoto}
                  onPasteUrl={null}
                  showRemove={
                    !!(
                      state.formData.image ||
                      state.user?.image ||
                      userPhotoDisplayUrl
                    )
                  }
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
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 break-words">
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
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300 min-w-0">
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
            <div className="p-4 sm:p-6">
              <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 sm:p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                    <User className="h-5 w-5 text-[#456564]" />
                    {t("userInformation") || "User Information"}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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
                        clearable={!roleSelectLocked}
                        disabled={roleSelectLocked}
                        error={!!state.errors.role}
                        required={true}
                      />
                      {state.errors.role && (
                        <div className="mt-1 flex items-center text-sm text-red-500">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          <span>{state.errors.role}</span>
                        </div>
                      )}
                      {isAssistantUser && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {state.user?.assistantOfUserName ||
                          state.user?.assistantOfUserEmail
                            ? t("assistants.tetheredTo", {
                                defaultValue: "Tethered to {{name}}",
                                name:
                                  state.user.assistantOfUserName ||
                                  state.user.assistantOfUserEmail,
                              })
                            : t("assistants.managedViaAssistantsPage", {
                                defaultValue:
                                  "Team assistants are managed from the Assistants page.",
                              })}
                        </p>
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

                    {/* Agency (agents only) */}
                    {showAgentAffiliationFields && (
                      <div>
                        <label className={getLabelClasses()} htmlFor="agencyId">
                          {t("agency") || "Agency"}
                        </label>
                        <SelectDropdown
                          options={agencyOptions}
                          value={state.formData.agencyId || ""}
                          onChange={handleAgencyChange}
                          placeholder={
                            agenciesLoading
                              ? t("loading") || "Loading..."
                              : t("selectAgency") || "Select agency"
                          }
                          emptyMessage={
                            t("noAgenciesExist") || "No agencies exist"
                          }
                          name="agencyId"
                          id="agencyId"
                          clearable={true}
                          disabled={agenciesLoading}
                        />
                      </div>
                    )}

                    {/* Office (agents only, after agency) */}
                    {showAgentAffiliationFields && (
                      <div>
                        <label className={getLabelClasses()} htmlFor="officeId">
                          {t("office") || "Office"}
                        </label>
                        <SelectDropdown
                          options={officeOptions}
                          value={state.formData.officeId || ""}
                          onChange={handleOfficeChange}
                          placeholder={
                            !state.formData.agencyId
                              ? t("selectAgencyFirst") || "Select an agency first"
                              : officesLoading
                                ? t("loading") || "Loading..."
                                : t("selectOffice") ||
                                  "Default (main office) — or select"
                          }
                          name="officeId"
                          id="officeId"
                          clearable={true}
                          disabled={!state.formData.agencyId || officesLoading}
                        />
                      </div>
                    )}

                    {/* Team (agents only, after office) */}
                    {showAgentAffiliationFields && (
                      <div>
                        <label className={getLabelClasses()} htmlFor="teamId">
                          {t("team") || "Team"}
                        </label>
                        <SelectDropdown
                          options={teamOptions}
                          value={state.formData.teamId || ""}
                          onChange={handleTeamChange}
                          placeholder={
                            !state.formData.officeId
                              ? t("selectOfficeFirst") || "Select an office first"
                              : teamsLoading
                                ? t("loading") || "Loading..."
                                : t("selectTeam") ||
                                  "Independent within office — or select"
                          }
                          emptyMessage={
                            t("noTeamsListedIndependent") ||
                            "No teams listed — independent within office"
                          }
                          name="teamId"
                          id="teamId"
                          clearable={true}
                          disabled={!state.formData.officeId || teamsLoading}
                        />
                      </div>
                    )}
                  </div>

                  {/* Opsy Scout complimentary override (existing agents, or duplicated new user) */}
                  {showComplimentaryFields && showAgentAffiliationFields && (
                    <div className="mt-6 py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800/40 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {t("opsyScoutComplimentary") ||
                              "Opsy Scout (complimentary)"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {t("opsyScoutComplimentaryHelper") ||
                              "Applies only while the agent’s plan does not include Opsy Scout."}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={!!state.formData.opsyScoutOverrideEnabled}
                          aria-label={
                            t("enableOpsyScout") || "Enable Opsy Scout"
                          }
                          onClick={() => {
                            const next = !state.formData.opsyScoutOverrideEnabled;
                            dispatch({
                              type: "SET_FORM_DATA",
                              payload: {
                                opsyScoutOverrideEnabled: next,
                                ...(next
                                  ? {}
                                  : {opsyScoutFreeAnalysesLimit: ""}),
                              },
                            });
                            if (state.errors.opsyScoutFreeAnalysesLimit) {
                              dispatch({
                                type: "SET_ERRORS",
                                payload: {
                                  ...state.errors,
                                  opsyScoutFreeAnalysesLimit: null,
                                },
                              });
                            }
                            if (state.isInitialLoad) {
                              dispatch({
                                type: "SET_FORM_CHANGED",
                                payload: true,
                              });
                            }
                          }}
                          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                            state.formData.opsyScoutOverrideEnabled
                              ? "bg-[#456564]"
                              : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        >
                          <span
                            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                              state.formData.opsyScoutOverrideEnabled
                                ? "left-6"
                                : "left-1"
                            }`}
                          />
                        </button>
                      </div>

                      {state.formData.opsyScoutOverrideEnabled && (
                        <div>
                          <label
                            className={getLabelClasses()}
                            htmlFor="opsyScoutFreeAnalysesLimit"
                          >
                            {t("opsyScoutFreeAnalyses") || "Free analyses"}
                          </label>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            id="opsyScoutFreeAnalysesLimit"
                            name="opsyScoutFreeAnalysesLimit"
                            value={state.formData.opsyScoutFreeAnalysesLimit || ""}
                            onChange={handleChange}
                            className={getInputClasses(
                              "opsyScoutFreeAnalysesLimit",
                            )}
                            placeholder="e.g. 5"
                          />
                          {state.errors.opsyScoutFreeAnalysesLimit && (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                              {state.errors.opsyScoutFreeAnalysesLimit}
                            </p>
                          )}
                          {state.user?.opsyScoutFreeAnalysesUsed != null && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {t("opsyScoutFreeAnalysesUsed", {
                                used: state.user.opsyScoutFreeAnalysesUsed,
                                limit:
                                  state.formData.opsyScoutFreeAnalysesLimit ||
                                  "—",
                                defaultValue: "Used: {{used}} of {{limit}}",
                              })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI features complimentary override (existing agents / homeowners, or duplicated new user) */}
                  {showComplimentaryFields &&
                    canReceiveAiComplimentary(state.formData.role) && (
                    <div className="mt-6 py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800/40 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {t("aiFeaturesComplimentary") ||
                              "AI features (complimentary)"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {t("aiFeaturesComplimentaryHelper") ||
                              "Applies only while the user’s plan does not include AI features."}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={
                            !!state.formData.aiFeaturesOverrideEnabled
                          }
                          aria-label={
                            t("enableAiFeatures") || "Enable AI features"
                          }
                          onClick={() => {
                            const next =
                              !state.formData.aiFeaturesOverrideEnabled;
                            dispatch({
                              type: "SET_FORM_DATA",
                              payload: {
                                aiFeaturesOverrideEnabled: next,
                                ...(next
                                  ? {}
                                  : {aiFeaturesTokenMonthlyQuota: ""}),
                              },
                            });
                            if (state.errors.aiFeaturesTokenMonthlyQuota) {
                              dispatch({
                                type: "SET_ERRORS",
                                payload: {
                                  ...state.errors,
                                  aiFeaturesTokenMonthlyQuota: null,
                                },
                              });
                            }
                            if (state.isInitialLoad) {
                              dispatch({
                                type: "SET_FORM_CHANGED",
                                payload: true,
                              });
                            }
                          }}
                          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                            state.formData.aiFeaturesOverrideEnabled
                              ? "bg-[#456564]"
                              : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        >
                          <span
                            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                              state.formData.aiFeaturesOverrideEnabled
                                ? "left-6"
                                : "left-1"
                            }`}
                          />
                        </button>
                      </div>

                      {state.formData.aiFeaturesOverrideEnabled && (
                        <div>
                          <label
                            className={getLabelClasses()}
                            htmlFor="aiFeaturesTokenMonthlyQuota"
                          >
                            {t("aiFeaturesTokenMonthlyQuota") ||
                              "Monthly AI token limit"}
                          </label>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            id="aiFeaturesTokenMonthlyQuota"
                            name="aiFeaturesTokenMonthlyQuota"
                            value={
                              state.formData.aiFeaturesTokenMonthlyQuota || ""
                            }
                            onChange={handleChange}
                            className={getInputClasses(
                              "aiFeaturesTokenMonthlyQuota",
                            )}
                            placeholder="e.g. 25000"
                          />
                          {state.errors.aiFeaturesTokenMonthlyQuota && (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                              {state.errors.aiFeaturesTokenMonthlyQuota}
                            </p>
                          )}
                          {state.user?.aiFeaturesTokensUsedThisMonth !=
                            null && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {t("aiFeaturesTokensUsedThisMonth", {
                                used: state.user.aiFeaturesTokensUsedThisMonth,
                                limit:
                                  state.formData.aiFeaturesTokenMonthlyQuota ||
                                  "—",
                                defaultValue:
                                  "Used this month: {{used}} of {{limit}}",
                              })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Send invitation toggle (new user only, not on demo or when provisioning demo) */}
                  {state.isNew &&
                    !state.provisionDemoOnCreate &&
                    !isDemoSite() && (
                      <div className="mt-6 flex items-start justify-between gap-4 py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800/40">
                        <div className="flex items-start gap-2 min-w-0">
                          <Mail className="w-4 h-4 mt-0.5 text-[#456564] dark:text-[#7aa3a2] shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                              {t("sendInvitationEmailOnCreate") ||
                                "Send invitation email on create"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {state.sendInviteOnCreate
                                ? t("sendInvitationEmailOnCreateHelperOn") ||
                                  "The user will get an email to set their password and finish onboarding."
                                : t("sendInvitationEmailOnCreateHelperOff") ||
                                  "Create this user without emailing them. You can send an invitation later."}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={state.sendInviteOnCreate}
                          aria-label={
                            t("sendInvitationEmailOnCreate") ||
                            "Send invitation email on create"
                          }
                          onClick={() =>
                            dispatch({
                              type: "SET_SEND_INVITE_ON_CREATE",
                              payload: !state.sendInviteOnCreate,
                            })
                          }
                          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                            state.sendInviteOnCreate
                              ? "bg-[#456564]"
                              : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        >
                          <span
                            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                              state.sendInviteOnCreate ? "left-6" : "left-1"
                            }`}
                          />
                        </button>
                      </div>
                    )}

                  {/* Demo provision toggle (demo super_admin, new user only) */}
                  {state.isNew && isDemoSuperAdmin && (
                    <div className="mt-6 flex items-start justify-between gap-4 py-3 px-4 rounded-lg border border-[#456564]/30 dark:border-[#7aa3a2]/40 bg-[#456564]/5 dark:bg-gray-800/40">
                      <div className="flex items-start gap-2 min-w-0">
                        <Briefcase className="w-4 h-4 mt-0.5 text-[#456564] dark:text-[#7aa3a2] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {t("provisionDemoAccountOnCreate") ||
                              "Provision ready-to-use demo account"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {state.provisionDemoOnCreate
                              ? t("provisionDemoAccountOnCreateHelperOn") ||
                                "Creates an active paid account with sample properties, inspections, maintenance, messages, contacts, and contractors. No invitation email."
                              : t("provisionDemoAccountOnCreateHelperOff") ||
                                "Create a pending user without sample data."}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={state.provisionDemoOnCreate}
                        aria-label={
                          t("provisionDemoAccountOnCreate") ||
                          "Provision ready-to-use demo account"
                        }
                        onClick={() =>
                          dispatch({
                            type: "SET_PROVISION_DEMO_ON_CREATE",
                            payload: !state.provisionDemoOnCreate,
                          })
                        }
                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                          state.provisionDemoOnCreate
                            ? "bg-[#456564]"
                            : "bg-gray-300 dark:bg-gray-600"
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            state.provisionDemoOnCreate ? "left-6" : "left-1"
                          }`}
                        />
                      </button>
                    </div>
                  )}

                  {showPairedHomeownerToggle && (
                    <div className="mt-4 flex items-start justify-between gap-4 py-3 px-4 rounded-lg border border-[#456564]/20 dark:border-[#7aa3a2]/30 bg-white/60 dark:bg-gray-900/30">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {t("includePairedHomeownerLogin") ||
                            "Include paired homeowner login"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {t("includePairedHomeownerLoginHelper") ||
                            "Creates a login-able synthetic client on the messages property for bilateral demos."}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={state.includePairedHomeownerLogin}
                        aria-label={
                          t("includePairedHomeownerLogin") ||
                          "Include paired homeowner login"
                        }
                        onClick={() =>
                          dispatch({
                            type: "SET_INCLUDE_PAIRED_HOMEOWNER_LOGIN",
                            payload: !state.includePairedHomeownerLogin,
                          })
                        }
                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                          state.includePairedHomeownerLogin
                            ? "bg-[#456564]"
                            : "bg-gray-300 dark:bg-gray-600"
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            state.includePairedHomeownerLogin ? "left-6" : "left-1"
                          }`}
                        />
                      </button>
                    </div>
                  )}

                  {showDemoPasswordField && (
                    <div className="mt-4">
                      <label
                        className={getLabelClasses()}
                        htmlFor="demoPassword"
                      >
                        {t("demoAccountPassword") || "Login password"}
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1 min-w-0">
                          <input
                            id="demoPassword"
                            type={showDemoPassword ? "text" : "password"}
                            className={`${getInputClasses("demoPassword")} pr-11`}
                            value={state.demoPassword}
                            onChange={(e) =>
                              dispatch({
                                type: "SET_DEMO_PASSWORD",
                                payload: e.target.value,
                              })
                            }
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 flex items-center justify-center px-3 rounded-md text-gray-400 hover:text-[#456564] dark:hover:text-[#7aa3a2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#456564]/25"
                            onClick={() => setShowDemoPassword((v) => !v)}
                            aria-pressed={showDemoPassword}
                            aria-controls="demoPassword"
                            aria-label={
                              showDemoPassword
                                ? t("hidePassword", "Hide password")
                                : t("showPassword", "Show password")
                            }
                          >
                            {showDemoPassword ? (
                              <EyeOff
                                className="w-5 h-5 shrink-0"
                                aria-hidden
                              />
                            ) : (
                              <Eye className="w-5 h-5 shrink-0" aria-hidden />
                            )}
                          </button>
                        </div>
                        <button
                          type="button"
                          className="btn bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-[#8fa3a2] dark:hover:border-[#8fa3a2] text-gray-800 dark:text-gray-300 transition-colors duration-200 shadow-sm shrink-0"
                          onClick={() =>
                            dispatch({
                              type: "SET_DEMO_PASSWORD",
                              payload: generateRandomPassword(),
                            })
                          }
                        >
                          {t("generatePassword") || "Generate password"}
                        </button>
                      </div>
                      {state.errors.demoPassword && (
                        <div className="mt-1 flex items-center text-sm text-red-500">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          <span>{state.errors.demoPassword}</span>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {demoPasswordHelperText}
                      </p>
                    </div>
                  )}

                  {showDemoExpiresAtField && (
                    <div className="mt-4">
                      <label
                        className={getLabelClasses()}
                        htmlFor="demoExpiresAt"
                      >
                        {t("demoAccessExpires") || "Demo access expires"}
                      </label>
                      <input
                        id="demoExpiresAt"
                        type="datetime-local"
                        className={getInputClasses("demoExpiresAt")}
                        value={state.demoExpiresAt}
                        onChange={(e) =>
                          dispatch({
                            type: "SET_DEMO_EXPIRES_AT",
                            payload: e.target.value,
                          })
                        }
                      />
                      {state.errors.demoExpiresAt && (
                        <div className="mt-1 flex items-center text-sm text-red-500">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          <span>{state.errors.demoExpiresAt}</span>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t("demoAccessExpiresHelper") ||
                          "Ready-to-use demo accounts are available for 72 hours by default. Extend this date if the prospect needs more time."}
                      </p>
                      {!state.isNew && demoAccessExpired ? (
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 font-medium">
                          {t("demoAccountExpired") ||
                            "This demo account has expired and can no longer sign in."}
                        </p>
                      ) : null}
                    </div>
                  )}

                  {isDemoSuperAdmin && provisionPolling && (
                    <div
                      className="mt-6 rounded-lg border border-[#456564]/30 dark:border-[#7aa3a2]/40 bg-[#456564]/5 dark:bg-gray-800/40 p-4"
                      role="status"
                      aria-live="polite"
                    >
                      <div className="flex items-start gap-3">
                        <svg
                          className="animate-spin h-5 w-5 shrink-0 text-[#456564] dark:text-[#7aa3a2] mt-0.5"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {t("demoAccountProvisioningTitle") ||
                              "Creating demo account…"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t("demoAccountProvisioningHelper") ||
                              "Setting up sample properties, messages, and login credentials. This usually takes a few seconds."}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {isDemoSuperAdmin && demoCredentialBundle && (
                    <div className="mt-6 rounded-lg border border-[#456564]/30 dark:border-[#7aa3a2]/40 bg-[#456564]/5 dark:bg-gray-800/40 p-4 space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {t("demoCredentialsTitle") || "Demo login credentials"}
                        </p>
                        {demoCredentialBundle.demoExpiresAt ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t("demoExpiresAtHelper", {
                              defaultValue: "Access valid until {{time}}.",
                              time: formatDemoExpiresAt(
                                demoCredentialBundle.demoExpiresAt,
                              ),
                            })}
                          </p>
                        ) : null}
                        {credentialCopyMessage ? (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                            {credentialCopyMessage}
                          </p>
                        ) : null}
                      </div>

                      <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          {t("demoAgentCredentials") || "Agent"}
                        </p>
                        <p className="mt-2 text-sm text-gray-800 dark:text-gray-200 break-all">
                          {demoCredentialBundle.agentEmail}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                            onClick={() =>
                              handleCopyCredential(
                                t("demoAgentCredentials") || "Agent email",
                                demoCredentialBundle.agentEmail,
                              )
                            }
                          >
                            <Copy className="w-3.5 h-3.5 mr-1 inline" />
                            {t("copyEmail") || "Copy email"}
                          </button>
                          <button
                            type="button"
                            className="btn-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                            onClick={() =>
                              handleCopyCredential(
                                t("demoAccountPassword") || "Password",
                                demoCredentialBundle.agentPassword,
                              )
                            }
                          >
                            <Copy className="w-3.5 h-3.5 mr-1 inline" />
                            {t("copyPassword") || "Copy password"}
                          </button>
                        </div>
                      </div>

                      {demoCredentialBundle.pairedHomeowner ? (
                        <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {t("demoPairedHomeownerCredentials") ||
                              "Paired homeowner"}
                          </p>
                          <p className="mt-2 text-sm text-gray-800 dark:text-gray-200 break-all">
                            {demoCredentialBundle.pairedHomeowner.name} —{" "}
                            {demoCredentialBundle.pairedHomeowner.email}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t("demoPairedHomeownerSamePasswordNote") ||
                              "Uses the same login password as above."}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                              onClick={() =>
                                handleCopyCredential(
                                  t("demoPairedHomeownerCredentials") ||
                                    "Paired homeowner email",
                                  demoCredentialBundle.pairedHomeowner.email,
                                )
                              }
                            >
                              <Copy className="w-3.5 h-3.5 mr-1 inline" />
                              {t("copyEmail") || "Copy email"}
                            </button>
                            <button
                              type="button"
                              className="btn-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                              onClick={() =>
                                handleCopyCredential(
                                  t("demoAccountPassword") || "Password",
                                  demoCredentialBundle.agentPassword,
                                )
                              }
                            >
                              <Copy className="w-3.5 h-3.5 mr-1 inline" />
                              {t("copyPassword") || "Copy password"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              className={`${
                state.formDataChanged || state.isNew ? "sticky" : "hidden"
              } bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 rounded-b-lg transition-all duration-200`}
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
                  className="btn btn-primary transition-colors duration-200 shadow-sm min-w-[100px]"
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
                      {state.isNew && state.provisionDemoOnCreate
                        ? t("demoAccountCreating") || "Creating demo account…"
                        : t("saving") || "Saving"}
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

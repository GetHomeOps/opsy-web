import React, {useReducer, useEffect, useMemo, useState} from "react";
import {useNavigate, useParams, useLocation} from "react-router-dom";
import {
  AlertCircle,
  CreditCard,
  User,
  Calendar,
  Database,
  Package,
  History,
} from "lucide-react";
import Banner from "../../partials/containers/Banner";
import ModalBlank from "../../components/ModalBlank";
import DatePickerInput from "../../components/DatePickerInput";
import {useTranslation} from "react-i18next";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {useAuth} from "../../context/AuthContext";
import {useAutoCloseBanner} from "../../hooks/useAutoCloseBanner";
import AppApi from "../../api/api";

const initialFormData = {
  userId: "",
  subscriptionProductId: "",
  subscriptionStatus: "active",
  subscriptionStartDate: "",
  subscriptionEndDate: "",
};

const initialState = {
  formData: initialFormData,
  errors: {},
  isSubmitting: false,
  subscription: null,
  isNew: false,
  isLoading: true,
  bannerOpen: false,
  dangerModalOpen: false,
  bannerType: "success",
  bannerMessage: "",
  formDataChanged: false,
  isInitialLoad: true,
  products: [],
  users: [],
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
    case "SET_LOADING":
      return {...state, isLoading: action.payload};
    case "SET_SUBSCRIPTION":
      return {
        ...state,
        subscription: action.payload,
        isNew: !action.payload,
        formData: action.payload
          ? mapSubscriptionToForm(action.payload)
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
    case "SET_PRODUCTS":
      return {...state, products: action.payload};
    case "SET_USERS":
      return {...state, users: action.payload};
    default:
      return state;
  }
}

/** Maps backend subscription object to form fields */
function mapSubscriptionToForm(subscription) {
  const startRaw =
    subscription.subscriptionStartDate ?? subscription.currentPeriodStart;
  const endRaw =
    subscription.subscriptionEndDate ?? subscription.currentPeriodEnd;
  return {
    userId: subscription.userId || "",
    subscriptionProductId: subscription.subscriptionProductId || "",
    subscriptionStatus:
      subscription.subscriptionStatus ?? subscription.status ?? "active",
    subscriptionStartDate: startRaw ? String(startRaw).split("T")[0] : "",
    subscriptionEndDate: endRaw ? String(endRaw).split("T")[0] : "",
  };
}

function SubscriptionFormContainer() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const {id} = useParams();
  const routeLocation = useLocation();
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {currentAccount} = useCurrentAccount();
  const {currentUser} = useAuth();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";
  const isSuperAdmin = currentUser?.role === "super_admin";

  const isNew = !id || id === "new";

  const [accountHistory, setAccountHistory] = useState([]);

  // Fetch subscription, products, and users
  useEffect(() => {
    async function fetchData() {
      try {
        dispatch({type: "SET_LOADING", payload: true});

        const [products, users] = await Promise.all([
          AppApi.getAllSubscriptionProducts().catch(() => []),
          AppApi.getAllUsers().catch(() => []),
        ]);

        dispatch({type: "SET_PRODUCTS", payload: products || []});
        dispatch({type: "SET_USERS", payload: users || []});

        if (!isNew) {
          const subscription = await AppApi.getSubscription(Number(id));
          dispatch({type: "SET_SUBSCRIPTION", payload: subscription});

          if (subscription?.accountId) {
            try {
              const history = await AppApi.getSubscriptionsByAccountId(
                subscription.accountId,
              );
              setAccountHistory(history || []);
            } catch {
              try {
                const all = await AppApi.getAllSubscriptions();
                setAccountHistory(
                  (all || []).filter(
                    (s) => s.accountId === subscription.accountId,
                  ),
                );
              } catch {
                setAccountHistory([]);
              }
            }
          }
        } else {
          dispatch({type: "SET_SUBSCRIPTION", payload: null});
          setAccountHistory([]);
          const basicProduct = (products || []).find(
            (p) => (p.name || "").toLowerCase() === "basic",
          );
          if (basicProduct) {
            dispatch({
              type: "SET_FORM_DATA",
              payload: {
                subscriptionProductId: String(basicProduct.id),
              },
            });
          }
        }
      } catch (err) {
        console.error("Error fetching subscription data:", err);
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message: `${t("subscriptions.fetchError")}: ${err.message || err}`,
          },
        });
      } finally {
        dispatch({type: "SET_LOADING", payload: false});
      }
    }
    fetchData();
  }, [id, isNew, t]);

  // Banner auto-close
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

  // Status options
  const statusOptions = [
    {value: "active", label: t("subscriptions.statusActive")},
    {value: "inactive", label: t("subscriptions.statusInactive")},
    {value: "trial", label: t("subscriptions.statusTrial")},
    {value: "cancelled", label: t("subscriptions.statusCancelled")},
    {value: "expired", label: t("subscriptions.statusExpired")},
  ];

  // Admin users (filter to admin/super_admin roles for the user dropdown)
  const adminUsers = useMemo(() => {
    return state.users.filter(
      (u) =>
        u.role === "admin" || u.role === "super_admin" || u.role === "agent",
    );
  }, [state.users]);

  /** Handle form field changes */
  function handleChange(e) {
    const {id: fieldId, value} = e.target;
    dispatch({type: "SET_FORM_DATA", payload: {[fieldId]: value}});

    // Clear error when field is being edited
    if (state.errors[fieldId]) {
      dispatch({
        type: "SET_ERRORS",
        payload: {...state.errors, [fieldId]: null},
      });
    }

    if (state.isInitialLoad) {
      dispatch({type: "SET_FORM_CHANGED", payload: true});
    }
  }

  /** Form validation */
  function validateForm() {
    const newErrors = {};

    if (!state.formData.userId) {
      newErrors.userId = t("subscriptions.userRequired");
    }
    if (!state.formData.subscriptionProductId) {
      newErrors.subscriptionProductId = t("subscriptions.productRequired");
    }
    if (!state.formData.subscriptionStatus) {
      newErrors.subscriptionStatus = t("subscriptions.statusRequired");
    }
    if (!state.formData.subscriptionStartDate) {
      newErrors.subscriptionStartDate = t("subscriptions.startDateRequired");
    }
    if (!state.formData.subscriptionEndDate) {
      newErrors.subscriptionEndDate = t("subscriptions.endDateRequired");
    }

    dispatch({type: "SET_ERRORS", payload: newErrors});
    return Object.keys(newErrors).length === 0;
  }

  /** Create new subscription */
  async function handleSubmit(evt) {
    evt.preventDefault();
    if (!validateForm()) return;

    dispatch({type: "SET_SUBMITTING", payload: true});

    try {
      const data = {
        userId: Number(state.formData.userId),
        subscriptionProductId: state.formData.subscriptionProductId
          ? Number(state.formData.subscriptionProductId)
          : null,
        subscriptionStatus: state.formData.subscriptionStatus,
        subscriptionStartDate: state.formData.subscriptionStartDate,
        subscriptionEndDate: state.formData.subscriptionEndDate,
      };

      const res = await AppApi.createSubscription(data);

      if (res && res.id) {
        navigate(`/${accountUrl}/subscriptions/${res.id}`);
        setTimeout(() => {
          dispatch({
            type: "SET_BANNER",
            payload: {
              open: true,
              type: "success",
              message: t("subscriptions.createdSuccessfully"),
            },
          });
        }, 100);
      }
    } catch (err) {
      console.error("Error creating subscription:", err);
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: `${t("subscriptions.createError")}: ${err.message || err}`,
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

  /** Update subscription status only (super_admin when viewing) */
  async function handleStatusUpdate(evt) {
    evt.preventDefault();
    dispatch({type: "SET_SUBMITTING", payload: true});
    try {
      await AppApi.updateSubscription(Number(id), {
        status: state.formData.subscriptionStatus,
      });
      const fullSubscription = await AppApi.getSubscription(Number(id));
      dispatch({type: "SET_SUBSCRIPTION", payload: fullSubscription});
      dispatch({type: "SET_FORM_CHANGED", payload: false});
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "success",
          message: t("subscriptions.updatedSuccessfully"),
        },
      });
    } catch (err) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: `${t("subscriptions.updateError")}: ${err.message || err}`,
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

  /** Delete subscription */
  async function confirmDelete() {
    try {
      dispatch({type: "SET_DANGER_MODAL", payload: false});
      await AppApi.deleteSubscription(Number(id));
      navigate(`/${accountUrl}/subscriptions`);
    } catch (error) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: `${t("subscriptions.deleteError")}: ${error}`,
        },
      });
    }
  }

  /** Cancel / Reset */
  function handleCancel() {
    if (state.subscription) {
      dispatch({
        type: "SET_FORM_DATA",
        payload: mapSubscriptionToForm(state.subscription),
      });
      dispatch({type: "SET_FORM_CHANGED", payload: false});
      dispatch({type: "SET_ERRORS", payload: {}});
    } else {
      navigate(`/${accountUrl}/subscriptions`);
    }
  }

  function handleBackClick() {
    navigate(`/${accountUrl}/subscriptions`);
  }

  function getPageTitle() {
    if (state.subscription) {
      const userName = state.subscription.userName || "";
      const productName = state.subscription.subscriptionProductName || "";
      return `${userName}${userName && productName ? " — " : ""}${productName}`;
    }
    return t("subscriptions.newSubscription");
  }

  const getLabelClasses = () =>
    "block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400";

  const getInputClasses = (fieldName) => {
    const baseClasses = "form-input w-full";
    const errorClasses = state.errors[fieldName]
      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
      : "";
    return `${baseClasses} ${errorClasses}`;
  };

  if (state.isLoading) {
    return (
      <div className="relative min-h-screen">
        <div className="flex justify-center items-center py-32">
          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
            <svg
              className="animate-spin h-5 w-5"
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
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>{t("subscriptions.loading")}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Banner */}
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

      {/* Delete Modal */}
      <div className="m-1.5">
        <ModalBlank
          id="danger-modal"
          modalOpen={state.dangerModalOpen}
          setModalOpen={(open) =>
            dispatch({type: "SET_DANGER_MODAL", payload: open})
          }
        >
          <div className="p-5 flex space-x-4">
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
            <div>
              <div className="mb-2">
                <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {t("subscriptions.deleteTitle", {count: 1})}
                </div>
              </div>
              <div className="text-sm mb-10">
                <p>
                  {t("subscriptions.deleteConfirmation")}{" "}
                  {t("actionCantBeUndone")}
                </p>
              </div>
              <div className="flex flex-wrap justify-end space-x-2">
                <button
                  className="btn-sm border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300"
                  onClick={() =>
                    dispatch({type: "SET_DANGER_MODAL", payload: false})
                  }
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
        {/* Navigation */}
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
              <path d="M9.4 13.4l1.4-1.4-4-4 4-4-1.4-1.4L4 8z" />
            </svg>
            <span className="text-lg">{t("subscriptions.title")}</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              className="btn bg-[#456564] hover:bg-[#34514f] text-white transition-colors duration-200 shadow-sm"
              onClick={() => navigate(`/${accountUrl}/subscriptions/new`)}
            >
              {t("new")}
            </button>
          </div>
        </div>

        {/* Status badge (left, read-only) and Subscription navigation (right) */}
        <div className="flex justify-between items-center mb-2">
          {/* Read-only status badge — same style as Active/Pending on UserFormContainer */}
          <div className="ml-4">
            {(() => {
              const currentStatus = (
                state.formData.subscriptionStatus || "active"
              ).toLowerCase();
              const styles = {
                active:
                  "bg-[#d3f4e3] dark:bg-[#173c36] text-[#2a9f52] dark:text-[#258c4d]",
                inactive:
                  "bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400",
                trial:
                  "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
                cancelled:
                  "bg-[#fddddd] dark:bg-[#402431] text-[#e63939] dark:text-[#c23437]",
                expired:
                  "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
              };
              const badgeClass = styles[currentStatus] || styles.inactive;
              const label =
                statusOptions.find(
                  (o) => o.value.toLowerCase() === currentStatus,
                )?.label || currentStatus;
              return (
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm ${badgeClass}`}
                >
                  <span>{label}</span>
                </div>
              );
            })()}
          </div>

          {/* Subscription navigation - right aligned (prev/next) */}
          <div className="flex items-center">
            {id &&
              id !== "new" &&
              (() => {
                const navState = routeLocation.state;
                if (
                  !navState ||
                  !navState.visibleSubscriptionIds ||
                  !Array.isArray(navState.visibleSubscriptionIds)
                )
                  return null;
                const {currentIndex, totalItems, visibleSubscriptionIds} =
                  navState;
                if (!totalItems || currentIndex == null) return null;
                const prevIndex = currentIndex - 2;
                const nextIndex = currentIndex;
                const prevId =
                  prevIndex >= 0 ? visibleSubscriptionIds[prevIndex] : null;
                const nextId =
                  nextIndex < visibleSubscriptionIds.length
                    ? visibleSubscriptionIds[nextIndex]
                    : null;
                return (
                  <>
                    <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                      {currentIndex} / {totalItems}
                    </span>
                    <button
                      type="button"
                      className="btn shadow-none p-1"
                      title={t("previous") || "Previous"}
                      onClick={() => {
                        if (prevId != null) {
                          navigate(`/${accountUrl}/subscriptions/${prevId}`, {
                            state: {
                              ...navState,
                              currentIndex: currentIndex - 1,
                            },
                          });
                        }
                      }}
                      disabled={prevId == null}
                    >
                      <svg
                        className={`fill-current shrink-0 ${
                          prevId == null
                            ? "text-gray-200 dark:text-gray-700"
                            : "text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-600"
                        }`}
                        width="24"
                        height="24"
                        viewBox="0 0 18 18"
                      >
                        <path d="M9.4 13.4l1.4-1.4-4-4 4-4-1.4-1.4L4 8z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="btn shadow-none p-1"
                      title={t("next") || "Next"}
                      onClick={() => {
                        if (nextId != null) {
                          navigate(`/${accountUrl}/subscriptions/${nextId}`, {
                            state: {
                              ...navState,
                              currentIndex: currentIndex + 1,
                            },
                          });
                        }
                      }}
                      disabled={nextId == null}
                    >
                      <svg
                        className={`fill-current shrink-0 ${
                          nextId == null
                            ? "text-gray-200 dark:text-gray-700"
                            : "text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-600"
                        }`}
                        width="24"
                        height="24"
                        viewBox="0 0 18 18"
                      >
                        <path d="M6.6 13.4L5.2 12l4-4-4-4 1.4-1.4L12 8z" />
                      </svg>
                    </button>
                  </>
                );
              })()}
          </div>
        </div>

        {/* Header Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center shrink-0">
                <CreditCard className="w-6 h-6 text-[#456564]" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {state.subscription
                    ? (state.subscription.databaseName ??
                        state.subscription.accountName ??
                        t("subscriptions.subscriptionDetailsTitle"))
                    : getPageTitle()}
                </h1>
                {state.subscription && (
                  <div className="mt-2 space-y-1">
                    {state.subscription.databaseName && (
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <Database className="w-4 h-4 mr-2 text-[#6E8276] shrink-0" />
                        <span>{state.subscription.databaseName}</span>
                      </div>
                    )}
                    {state.subscription.userEmail && (
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <User className="w-4 h-4 mr-2 text-[#6E8276] shrink-0" />
                        <span>{state.subscription.userEmail}</span>
                      </div>
                    )}
                    {state.subscription.subscriptionProductName && (
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <Package className="w-4 h-4 mr-2 text-[#6E8276] shrink-0" />
                        <span>
                          {state.subscription.subscriptionProductName}
                          {state.subscription.subscriptionProductPrice &&
                            ` — $${state.subscription.subscriptionProductPrice}`}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <form
            onSubmit={
              isNew
                ? handleSubmit
                : isSuperAdmin
                  ? handleStatusUpdate
                  : (e) => e.preventDefault()
            }
          >
            <div className="p-6">
              <div className="space-y-8">
                {isNew ? (
                  <>
                    {/* Create mode: full form */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-[#6E8276]" />
                        {t("subscriptions.subscriptionDetails")}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className={getLabelClasses()} htmlFor="userId">
                            {t("subscriptions.adminUser")}{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <select
                            id="userId"
                            className={`form-select w-full ${state.errors.userId ? "border-red-300" : ""}`}
                            value={state.formData.userId}
                            onChange={handleChange}
                          >
                            <option value="">
                              {t("subscriptions.selectUser")}
                            </option>
                            {adminUsers.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name} ({user.email})
                              </option>
                            ))}
                          </select>
                          {state.errors.userId && (
                            <div className="mt-1 flex items-center text-sm text-red-500">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              <span>{state.errors.userId}</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <label
                            className={getLabelClasses()}
                            htmlFor="subscriptionProductId"
                          >
                            {t("subscriptions.product")}{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <select
                            id="subscriptionProductId"
                            className={`form-select w-full ${state.errors.subscriptionProductId ? "border-red-300" : ""}`}
                            value={state.formData.subscriptionProductId}
                            onChange={handleChange}
                          >
                            <option value="">
                              {t("subscriptions.selectProduct")}
                            </option>
                            {state.products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name}
                                {product.price ? ` — $${product.price}` : ""}
                              </option>
                            ))}
                          </select>
                          {state.errors.subscriptionProductId && (
                            <div className="mt-1 flex items-center text-sm text-red-500">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              <span>{state.errors.subscriptionProductId}</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <label
                            className={getLabelClasses()}
                            htmlFor="subscriptionStatus"
                          >
                            {t("subscriptions.status")}{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <select
                            id="subscriptionStatus"
                            className={`form-select w-full ${state.errors.subscriptionStatus ? "border-red-300" : ""}`}
                            value={state.formData.subscriptionStatus}
                            onChange={handleChange}
                          >
                            <option value="">
                              {t("subscriptions.selectStatus")}
                            </option>
                            {statusOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {state.errors.subscriptionStatus && (
                            <div className="mt-1 flex items-center text-sm text-red-500">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              <span>{state.errors.subscriptionStatus}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-[#6E8276]" />
                        {t("subscriptions.dates")}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label
                            className={getLabelClasses()}
                            htmlFor="subscriptionStartDate"
                          >
                            {t("subscriptions.startDate")}{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <DatePickerInput
                            name="subscriptionStartDate"
                            value={state.formData.subscriptionStartDate}
                            onChange={handleChange}
                            className={getInputClasses("subscriptionStartDate")}
                            required
                          />
                          {state.errors.subscriptionStartDate && (
                            <div className="mt-1 flex items-center text-sm text-red-500">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              <span>{state.errors.subscriptionStartDate}</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <label
                            className={getLabelClasses()}
                            htmlFor="subscriptionEndDate"
                          >
                            {t("subscriptions.endDate")}{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <DatePickerInput
                            name="subscriptionEndDate"
                            value={state.formData.subscriptionEndDate}
                            onChange={handleChange}
                            className={getInputClasses("subscriptionEndDate")}
                            required
                          />
                          {state.errors.subscriptionEndDate && (
                            <div className="mt-1 flex items-center text-sm text-red-500">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              <span>{state.errors.subscriptionEndDate}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* View mode: read-only details, status editable by super_admin only */
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-[#6E8276]" />
                      {t("subscriptions.subscriptionDetailsTitle")}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className={getLabelClasses()}>
                          {t("subscriptions.pricePaid")}
                        </label>
                        <div className="form-input w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed">
                          {state.subscription?.subscriptionProductPrice != null
                            ? `$${state.subscription.subscriptionProductPrice}`
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <label className={getLabelClasses()}>
                          {t("subscriptions.subscriptionPlan")}
                        </label>
                        <div className="form-input w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed">
                          {state.subscription?.subscriptionProductName || "—"}
                        </div>
                      </div>
                      <div>
                        <label className={getLabelClasses()}>
                          {t("subscriptions.account")}
                        </label>
                        <div className="form-input w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed">
                          {state.subscription?.databaseName ??
                            state.subscription?.accountName ??
                            "—"}
                        </div>
                      </div>
                      <div>
                        <label className={getLabelClasses()}>
                          {t("subscriptions.userType")}
                        </label>
                        <div className="form-input w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed capitalize">
                          {state.subscription?.userType === "agent" ||
                          state.subscription?.userType === "homeowner"
                            ? state.subscription.userType
                            : state.subscription?.userType || "—"}
                        </div>
                      </div>
                      <div>
                        <label
                          className={getLabelClasses()}
                          htmlFor="subscriptionStatus"
                        >
                          {t("subscriptions.status")}
                        </label>
                        {isSuperAdmin ? (
                          <select
                            id="subscriptionStatus"
                            className="form-select w-full"
                            value={state.formData.subscriptionStatus}
                            onChange={handleChange}
                          >
                            {statusOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="form-input w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed capitalize">
                            {statusOptions.find(
                              (o) =>
                                o.value.toLowerCase() ===
                                (
                                  state.formData.subscriptionStatus || ""
                                ).toLowerCase(),
                            )?.label ||
                              state.formData.subscriptionStatus ||
                              "—"}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className={getLabelClasses()}>
                          {t("subscriptions.startDate")}
                        </label>
                        <div className="form-input w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed">
                          {state.formData.subscriptionStartDate || "—"}
                        </div>
                      </div>
                      <div>
                        <label className={getLabelClasses()}>
                          {t("subscriptions.endDate")}
                        </label>
                        <div className="form-input w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed">
                          {state.formData.subscriptionEndDate || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Action Bar - create mode always, view mode only when super_admin and status changed */}
            <div
              className={`${
                isNew
                  ? state.formDataChanged
                    ? "sticky"
                    : "hidden"
                  : isSuperAdmin && state.formDataChanged
                    ? "sticky"
                    : "hidden"
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
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      {t("saving")}
                    </div>
                  ) : isNew ? (
                    t("save")
                  ) : (
                    t("update")
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Subscription History for this account */}
        {!isNew && accountHistory.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mt-6">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <History className="h-5 w-5 text-[#6E8276]" />
                {t("subscriptions.subscriptionHistory", {
                  defaultValue: "Subscription History",
                })}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {accountHistory.length} record
                {accountHistory.length === 1 ? "" : "s"}{" "}
                {t("subscriptions.forThisAccount", {
                  defaultValue: "for this account",
                })}
              </p>
              <div className="overflow-x-auto">
                <table className="table-auto w-full">
                  <thead className="text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 border-t border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 whitespace-nowrap text-left font-semibold">
                        {t("subscriptions.subscription")}
                      </th>
                      <th className="px-4 py-3 whitespace-nowrap text-left font-semibold">
                        {t("subscriptions.billingInterval")}
                      </th>
                      <th className="px-4 py-3 whitespace-nowrap text-left font-semibold">
                        {t("subscriptions.startDate")}
                      </th>
                      <th className="px-4 py-3 whitespace-nowrap text-left font-semibold">
                        {t("subscriptions.endDate")}
                      </th>
                      <th className="px-4 py-3 whitespace-nowrap text-left font-semibold">
                        {t("subscriptions.status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-gray-200 dark:divide-gray-700">
                    {[...accountHistory]
                      .sort((a, b) => {
                        const aTime = new Date(
                          a.currentPeriodEnd ||
                            a.current_period_end ||
                            a.updatedAt ||
                            a.updated_at ||
                            0,
                        ).getTime();
                        const bTime = new Date(
                          b.currentPeriodEnd ||
                            b.current_period_end ||
                            b.updatedAt ||
                            b.updated_at ||
                            0,
                        ).getTime();
                        return bTime - aTime;
                      })
                      .map((sub) => {
                        const subId = sub.id;
                        const isCurrent = subId === Number(id);
                        const status = (
                          sub.status ||
                          sub.subscriptionStatus ||
                          ""
                        ).toLowerCase();
                        const statusColors = {
                          active:
                            "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
                          inactive:
                            "bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300",
                          cancelled:
                            "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
                          expired:
                            "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
                          trial:
                            "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
                          trialing:
                            "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
                        };
                        const badgeColor =
                          statusColors[status] || statusColors.inactive;
                        const productName =
                          sub.productName || sub.subscriptionProductName || "—";
                        const interval =
                          sub.billingInterval || sub.billing_interval || "";
                        const startDate =
                          sub.currentPeriodStart || sub.current_period_start;
                        const endDate =
                          sub.currentPeriodEnd || sub.current_period_end;
                        const fmtDate = (d) =>
                          d
                            ? new Date(d).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "—";

                        return (
                          <tr
                            key={subId}
                            className={`${isCurrent ? "bg-violet-50/50 dark:bg-violet-900/10" : "hover:bg-gray-50 dark:hover:bg-gray-700/30"} ${!isCurrent ? "cursor-pointer" : ""} transition-colors`}
                            onClick={() => {
                              if (!isCurrent) {
                                navigate(
                                  `/${accountUrl}/subscriptions/${subId}`,
                                );
                              }
                            }}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span
                                  className={
                                    isCurrent
                                      ? "font-semibold text-violet-700 dark:text-violet-400"
                                      : "text-gray-800 dark:text-gray-200"
                                  }
                                >
                                  {productName}
                                </span>
                                {isCurrent && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
                                    {t("subscriptions.current", {
                                      defaultValue: "Current",
                                    })}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap capitalize text-gray-600 dark:text-gray-400">
                              {interval === "year"
                                ? t("subscriptionProducts.yearly")
                                : interval === "month"
                                  ? t("subscriptionProducts.monthly")
                                  : interval || "—"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                              {fmtDate(startDate)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                              {fmtDate(endDate)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${badgeColor}`}
                              >
                                {status || "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SubscriptionFormContainer;

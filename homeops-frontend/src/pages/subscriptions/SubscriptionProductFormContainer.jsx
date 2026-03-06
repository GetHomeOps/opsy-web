import React, {useReducer, useEffect, useState} from "react";
import {useNavigate, useParams, useLocation} from "react-router-dom";
import {AlertCircle, Package} from "lucide-react";
import Banner from "../../partials/containers/Banner";
import ModalBlank from "../../components/ModalBlank";
import {useTranslation} from "react-i18next";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {useAutoCloseBanner} from "../../hooks/useAutoCloseBanner";
import AppApi from "../../api/api";

function formatStripePrice(unitAmount, currency = "usd") {
  if (unitAmount == null) return "N/A";
  return new Intl.NumberFormat("en-US", {style: "currency", currency}).format(unitAmount / 100);
}

function StripePriceSelect({label, prices, value, onChange, disabled}) {
  const options = (prices || [])
    .filter((p) => p.interval === (label.toLowerCase().includes("annual") || label.toLowerCase().includes("year") ? "year" : "month"))
    .sort((a, b) => (a.unitAmount || 0) - (b.unitAmount || 0));

  return (
    <div>
      <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">{label}</label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="form-select w-full"
      >
        <option value="">— Select from Stripe —</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.productName || "Product"} — {p.nickname || formatStripePrice(p.unitAmount, p.currency)}/{p.interval}
          </option>
        ))}
      </select>
    </div>
  );
}

const initialFormData = {
  name: "",
  description: "",
  targetRole: "homeowner",
  code: "",
  sortOrder: 0,
  trialDays: "",
  maxProperties: 1,
  maxContacts: 25,
  maxViewers: 2,
  maxTeamMembers: 5,
  aiTokenMonthlyQuota: 50000,
  stripePriceIdMonth: "",
  stripePriceIdYear: "",
};

const initialState = {
  formData: initialFormData,
  errors: {},
  isSubmitting: false,
  product: null,
  isNew: false,
  isLoading: true,
  bannerOpen: false,
  dangerModalOpen: false,
  bannerType: "success",
  bannerMessage: "",
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
    case "SET_LOADING":
      return {...state, isLoading: action.payload};
    case "SET_PRODUCT":
      return {
        ...state,
        product: action.payload,
        isNew: !action.payload,
        formData: action.payload
          ? mapProductToForm(action.payload)
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

/** Maps backend product object to form fields. Price comes from Stripe selection, not product. */
function mapProductToForm(product) {
  const lim = product.limits || {};
  const priceMonth = product.prices?.find((p) => p.billingInterval === "month" || p.billing_interval === "month");
  const priceYear = product.prices?.find((p) => p.billingInterval === "year" || p.billing_interval === "year");
  return {
    name: product.name || "",
    description: product.description || "",
    targetRole: product.targetRole || "homeowner",
    code: product.code || "",
    sortOrder: product.sortOrder ?? 0,
    trialDays: product.trialDays != null ? String(product.trialDays) : "",
    maxProperties: lim.maxProperties ?? product.maxProperties ?? 1,
    maxContacts: lim.maxContacts ?? product.maxContacts ?? 25,
    maxViewers: lim.maxViewers ?? product.maxViewers ?? 2,
    maxTeamMembers: lim.maxTeamMembers ?? product.maxTeamMembers ?? 5,
    aiTokenMonthlyQuota: lim.aiTokenMonthlyQuota ?? 50000,
    stripePriceIdMonth: priceMonth?.stripePriceId || priceMonth?.stripe_price_id || "",
    stripePriceIdYear: priceYear?.stripePriceId || priceYear?.stripe_price_id || "",
  };
}

function SubscriptionProductFormContainer() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [stripePrices, setStripePrices] = useState([]);
  const [products, setProducts] = useState([]);
  const {id} = useParams();
  const {t} = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  const isNew = !id || id === "new";

  // Fetch product + products list (for nav) + Stripe prices
  useEffect(() => {
    async function fetchData() {
      try {
        dispatch({type: "SET_LOADING", payload: true});
        const [productRes, productsRes, stripeRes] = await Promise.allSettled([
          !isNew ? AppApi.getSubscriptionProduct(Number(id)) : null,
          AppApi.getAllSubscriptionProducts(),
          AppApi.getStripePrices().catch(() => ({prices: []})),
        ]);
        if (!isNew && productRes.status === "fulfilled") {
          dispatch({type: "SET_PRODUCT", payload: productRes.value});
        } else if (isNew) {
          dispatch({type: "SET_PRODUCT", payload: null});
        }
        if (productsRes.status === "fulfilled") setProducts(productsRes.value || []);
        if (stripeRes.status === "fulfilled") setStripePrices(stripeRes.value?.prices || []);
      } catch (err) {
        console.error("Error fetching subscription product:", err);
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message: `${t("subscriptionProducts.fetchError")}: ${err.message || err}`,
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

  /** Handle form field changes */
  function handleChange(e) {
    const {id: fieldId, value} = e.target;
    dispatch({type: "SET_FORM_DATA", payload: {[fieldId]: value}});
    if (state.errors[fieldId]) {
      dispatch({type: "SET_ERRORS", payload: {...state.errors, [fieldId]: null}});
    }
    if (state.isInitialLoad) {
      dispatch({type: "SET_FORM_CHANGED", payload: true});
    }
  }

  function handleStripePriceChange(interval, value) {
    const key = interval === "month" ? "stripePriceIdMonth" : "stripePriceIdYear";
    dispatch({type: "SET_FORM_DATA", payload: {[key]: value || ""}});
    if (state.isInitialLoad) {
      dispatch({type: "SET_FORM_CHANGED", payload: true});
    }
  }

  /** Form validation. Price comes from Stripe selection, not required. */
  function validateForm() {
    const newErrors = {};
    if (!state.formData.name || !state.formData.name.trim()) {
      newErrors.name = t("subscriptionProducts.nameRequired");
    }
    dispatch({type: "SET_ERRORS", payload: newErrors});
    return Object.keys(newErrors).length === 0;
  }

  const limitFields = [
    { id: "maxProperties", label: "Max Properties" },
    { id: "maxContacts", label: "Max Contacts" },
    { id: "maxViewers", label: "Max Viewers" },
    { id: "maxTeamMembers", label: "Max Team Members" },
    { id: "aiTokenMonthlyQuota", label: "AI Tokens / month" },
  ];

  /** Create new product */
  async function handleSubmit(evt) {
    evt.preventDefault();
    if (!validateForm()) return;

    dispatch({type: "SET_SUBMITTING", payload: true});

    try {
      const data = {
        name: state.formData.name.trim(),
        description: state.formData.description.trim() || null,
        targetRole: state.formData.targetRole || "homeowner",
        price: 0,
        code: state.formData.code?.trim() || null,
        sortOrder: Number(state.formData.sortOrder) || 0,
        trialDays: state.formData.trialDays ? Number(state.formData.trialDays) : null,
        maxProperties: Number(state.formData.maxProperties) || 1,
        maxContacts: Number(state.formData.maxContacts) || 25,
        maxViewers: Number(state.formData.maxViewers) || 2,
        maxTeamMembers: Number(state.formData.maxTeamMembers) || 5,
        aiTokenMonthlyQuota: Number(state.formData.aiTokenMonthlyQuota) || 50000,
        stripePriceIdMonth: state.formData.stripePriceIdMonth?.trim() || null,
        stripePriceIdYear: state.formData.stripePriceIdYear?.trim() || null,
      };

      const res = await AppApi.createSubscriptionProduct(data);

      if (res && res.id) {
        navigate(`/${accountUrl}/subscription-products/${res.id}`);
        setTimeout(() => {
          dispatch({
            type: "SET_BANNER",
            payload: {
              open: true,
              type: "success",
              message: t("subscriptionProducts.createdSuccessfully"),
            },
          });
        }, 100);
      }
    } catch (err) {
      console.error("Error creating subscription product:", err);
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: `${t("subscriptionProducts.createError")}: ${err.message || err}`,
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

  /** Update existing product */
  async function handleUpdate(evt) {
    evt.preventDefault();
    if (!validateForm()) return;

    dispatch({type: "SET_SUBMITTING", payload: true});

    try {
      const data = {
        name: state.formData.name.trim(),
        description: state.formData.description.trim() || null,
        targetRole: state.formData.targetRole || "homeowner",
        code: state.formData.code?.trim() || null,
        sortOrder: Number(state.formData.sortOrder) || 0,
        trialDays: state.formData.trialDays ? Number(state.formData.trialDays) : null,
        limits: {
          maxProperties: Number(state.formData.maxProperties) || 1,
          maxContacts: Number(state.formData.maxContacts) || 25,
          maxViewers: Number(state.formData.maxViewers) || 2,
          maxTeamMembers: Number(state.formData.maxTeamMembers) || 5,
          aiTokenMonthlyQuota: Number(state.formData.aiTokenMonthlyQuota) || 50000,
        },
        prices: {
          month: state.formData.stripePriceIdMonth?.trim() || null,
          year: state.formData.stripePriceIdYear?.trim() || null,
        },
      };

      const res = await AppApi.updateSubscriptionProduct(Number(id), data);
      if (res) {
        const fullProduct = await AppApi.getSubscriptionProduct(Number(id));
        dispatch({type: "SET_PRODUCT", payload: fullProduct});
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "success",
            message: t("subscriptionProducts.updatedSuccessfully"),
          },
        });
      }
    } catch (err) {
      console.error("Error updating subscription product:", err);
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: `${t("subscriptionProducts.updateError")}: ${err.message || err}`,
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

  /** Archive product (no deletion) */
  async function confirmArchive() {
    try {
      dispatch({type: "SET_DANGER_MODAL", payload: false});
      await AppApi.archiveSubscriptionProduct(Number(id));
      navigate(`/${accountUrl}/subscription-products`);
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "success",
          message: t("subscriptionProducts.archivedSuccessfully") || "Product archived successfully.",
        },
      });
    } catch (error) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: `${t("subscriptionProducts.archiveError") || "Archive failed"}: ${error.message || error}`,
        },
      });
    }
  }

  /** Cancel / Reset */
  function handleCancel() {
    if (state.product) {
      dispatch({
        type: "SET_FORM_DATA",
        payload: mapProductToForm(state.product),
      });
      dispatch({type: "SET_FORM_CHANGED", payload: false});
      dispatch({type: "SET_ERRORS", payload: {}});
    } else {
      navigate(`/${accountUrl}/subscription-products`);
    }
  }

  function handleBackClick() {
    navigate(`/${accountUrl}/subscription-products`);
  }

  function getPageTitle() {
    if (state.product) {
      return state.product.name || "";
    }
    return t("subscriptionProducts.newProduct");
  }

  /** Build nav state for prev/next. Sorted by sortOrder then name. */
  function buildNavState(productId) {
    const sorted = [...products].sort((a, b) => {
      const aOrder = a.sortOrder ?? 999;
      const bOrder = b.sortOrder ?? 999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.name || "").localeCompare(b.name || "");
    });
    const idx = sorted.findIndex((p) => Number(p.id) === Number(productId));
    if (idx === -1) return null;
    return {
      currentIndex: idx + 1,
      totalItems: sorted.length,
      visibleProductIds: sorted.map((p) => p.id),
    };
  }

  /** Display price from Stripe-linked plan_prices (match stripePrices) or placeholder */
  function getDisplayPrice() {
    const priceMonth = state.product?.prices?.find((p) => p.billingInterval === "month" || p.billing_interval === "month");
    const priceYear = state.product?.prices?.find((p) => p.billingInterval === "year" || p.billing_interval === "year");
    const stripeId = priceMonth?.stripePriceId ?? priceYear?.stripePriceId;
    if (stripeId && stripePrices.length > 0) {
      const sp = stripePrices.find((p) => p.id === stripeId);
      if (sp?.unitAmount != null) return formatStripePrice(sp.unitAmount, sp.currency);
      return "Linked to Stripe";
    }
    return "Select from Stripe";
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
      <div className="relative min-h-screen bg-[var(--color-gray-50)] dark:bg-gray-900">
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
            <span>{t("subscriptionProducts.loading")}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[var(--color-gray-50)] dark:bg-gray-900">
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
                  {t("subscriptionProducts.archiveTitle") || "Archive product?"}
                </div>
              </div>
              <div className="text-sm mb-10">
                <p>
                  {t("subscriptionProducts.archiveConfirmation") || "This will hide the product from active plans. You can restore it later."}
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
                  className="btn-sm bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={confirmArchive}
                >
                  {t("subscriptionProducts.archive") || "Archive"}
                </button>
              </div>
            </div>
          </div>
        </ModalBlank>
      </div>

      <div className="px-0 sm:px-4 lg:px-5 xxl:px-12">
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
            <span className="text-lg">
              {t("subscriptionProducts.title")}
            </span>
          </button>

          <div className="flex items-center gap-3">
            {state.product && (
              <button
                className="btn border-gray-200 dark:border-gray-700/60 hover:border-amber-400 dark:hover:border-amber-500 text-amber-600 dark:text-amber-400"
                onClick={() =>
                  dispatch({type: "SET_DANGER_MODAL", payload: true})
                }
              >
                {t("subscriptionProducts.archive") || "Archive"}
              </button>
            )}
            <button
              className="btn bg-[#456564] hover:bg-[#34514f] text-white transition-colors duration-200 shadow-sm"
              onClick={() => navigate(`/${accountUrl}/subscription-products/new`)}
            >
              {t("new")}
            </button>
          </div>
        </div>

        {/* Prev/Next navigation */}
        <div className="flex justify-end mb-2">
          <div className="flex items-center">
            {state.product && (() => {
              const navState = location.state || buildNavState(state.product.id);
              if (!navState || !navState.visibleProductIds?.length) return null;
              const prevId = navState.currentIndex > 1 ? navState.visibleProductIds[navState.currentIndex - 2] : null;
              const nextId = navState.currentIndex < navState.totalItems ? navState.visibleProductIds[navState.currentIndex] : null;
              return (
                <>
                  <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                    {navState.currentIndex} / {navState.totalItems}
                  </span>
                  <button
                    className="btn shadow-none p-1"
                    title="Previous"
                    onClick={() => {
                      if (prevId) {
                        const nextNavState = buildNavState(prevId);
                        navigate(`/${accountUrl}/subscription-products/${prevId}`, {state: nextNavState});
                      }
                    }}
                    disabled={!prevId}
                  >
                    <svg
                      className={`fill-current shrink-0 w-6 h-6 ${!prevId ? "text-gray-200 dark:text-gray-700" : "text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-600"}`}
                      viewBox="0 0 18 18"
                    >
                      <path d="M9.4 13.4l1.4-1.4-4-4 4-4-1.4-1.4L4 8z" />
                    </svg>
                  </button>
                  <button
                    className="btn shadow-none p-1"
                    title="Next"
                    onClick={() => {
                      if (nextId) {
                        const nextNavState = buildNavState(nextId);
                        navigate(`/${accountUrl}/subscription-products/${nextId}`, {state: nextNavState});
                      }
                    }}
                    disabled={!nextId}
                  >
                    <svg
                      className={`fill-current shrink-0 w-6 h-6 ${!nextId ? "text-gray-200 dark:text-gray-700" : "text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-600"}`}
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
                <Package className="w-6 h-6 text-[#456564]" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 capitalize">
                  {getPageTitle()}
                </h1>
                {state.product && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium">{getDisplayPrice()}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <form onSubmit={isNew ? handleSubmit : handleUpdate}>
            <div className="p-6">
              <div className="space-y-8">
                {/* Product Details Section */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                    <Package className="h-5 w-5 text-[#6E8276]" />
                    {t("subscriptionProducts.productDetails")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Name */}
                    <div>
                      <label className={getLabelClasses()} htmlFor="name">
                        {t("name")}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="name"
                        className={getInputClasses("name")}
                        type="text"
                        value={state.formData.name}
                        onChange={handleChange}
                        placeholder={t("subscriptionProducts.namePlaceholder")}
                      />
                      {state.errors.name && (
                        <div className="mt-1 flex items-center text-sm text-red-500">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          <span>{state.errors.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Target Role */}
                    <div>
                      <label className={getLabelClasses()} htmlFor="targetRole">
                        Target Role
                      </label>
                      <select
                        id="targetRole"
                        className={getInputClasses("targetRole")}
                        value={state.formData.targetRole}
                        onChange={handleChange}
                      >
                        <option value="homeowner">Homeowner</option>
                        <option value="agent">Agent</option>
                      </select>
                    </div>

                    {/* Code */}
                    <div>
                      <label className={getLabelClasses()} htmlFor="code">
                        Plan Code
                      </label>
                      <input
                        id="code"
                        className={getInputClasses("code")}
                        type="text"
                        value={state.formData.code}
                        onChange={handleChange}
                        placeholder="e.g. homeowner_maintain"
                      />
                    </div>

                    {/* Sort Order & Trial Days */}
                    <div>
                      <label className={getLabelClasses()} htmlFor="sortOrder">
                        Sort Order
                      </label>
                      <input
                        id="sortOrder"
                        className={getInputClasses("sortOrder")}
                        type="number"
                        min="0"
                        value={state.formData.sortOrder}
                        onChange={handleChange}
                      />
                    </div>
                    <div>
                      <label className={getLabelClasses()} htmlFor="trialDays">
                        Trial Days
                      </label>
                      <input
                        id="trialDays"
                        className={getInputClasses("trialDays")}
                        type="number"
                        min="0"
                        value={state.formData.trialDays}
                        onChange={handleChange}
                        placeholder="Leave empty for no trial"
                      />
                    </div>

                    {/* Description (full width) */}
                    <div className="md:col-span-2">
                      <label
                        className={getLabelClasses()}
                        htmlFor="description"
                      >
                        {t("description")}
                      </label>
                      <textarea
                        id="description"
                        className="form-textarea w-full"
                        rows="3"
                        value={state.formData.description}
                        onChange={handleChange}
                        placeholder={t(
                          "subscriptionProducts.descriptionPlaceholder",
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Tier Limits Section */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                    Tier Limits
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {limitFields.map(({id, label}) => (
                      <div key={id}>
                        <label className={getLabelClasses()} htmlFor={id}>
                          {label}
                        </label>
                        <input
                          id={id}
                          className={getInputClasses(id)}
                          type="number"
                          min="0"
                          value={state.formData[id]}
                          onChange={handleChange}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stripe Prices (select from Stripe) */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                    Stripe Prices
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Select prices from your Stripe account. Ensure STRIPE_SECRET_KEY is set.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StripePriceSelect
                      label="Monthly price"
                      prices={stripePrices}
                      value={state.formData.stripePriceIdMonth}
                      onChange={(v) => handleStripePriceChange("month", v)}
                      disabled={state.isSubmitting}
                    />
                    <StripePriceSelect
                      label="Annual price"
                      prices={stripePrices}
                      value={state.formData.stripePriceIdYear}
                      onChange={(v) => handleStripePriceChange("year", v)}
                      disabled={state.isSubmitting}
                    />
                  </div>
                  {stripePrices.length === 0 && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      No Stripe prices found. Ensure STRIPE_SECRET_KEY is set in your .env.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky Action Bar */}
            <div
              className={`${
                state.formDataChanged || isNew ? "sticky" : "hidden"
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
      </div>
    </div>
  );
}

export default SubscriptionProductFormContainer;

import React, {
  useReducer,
  useMemo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {useNavigate, useParams, useLocation} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {Layers, Tag, Users} from "lucide-react";

import Sidebar from "../../../partials/Sidebar";
import Header from "../../../partials/Header";
import Banner from "../../../partials/containers/Banner";
import useCurrentAccount from "../../../hooks/useCurrentAccount";
import useImageUpload from "../../../hooks/useImageUpload";
import { S3_UPLOAD_FOLDER } from "../../../constants/s3UploadFolders";
import usePresignedPreview from "../../../hooks/usePresignedPreview";
import ImageUploadField from "../../../components/ImageUploadField";
import AppApi from "../../../api/api";

import CategoryActionsMenu from "./CategoryActionsMenu";
import CategoryForm from "./CategoryForm";
import ModalBlank from "../../../components/ModalBlank";
import {
  flatNavigationIdsFromHierarchy,
  sortCategoryHierarchy,
} from "./categoryListOrder";

const emptyFormData = {
  name: "",
  description: "",
  type: "child",
  parentId: "",
  icon: "",
  imageKey: "",
  is_active: true,
};

const initialState = {
  formData: emptyFormData,
  errors: {},
  dirty: false,
  isSubmitting: false,
  isNew: true,
  sidebarOpen: false,
  bannerOpen: false,
  bannerType: "success",
  bannerMessage: "",
  parentCategories: [],
  childCategories: [],
  existingCategory: null,
  professionalCount: 0,
  imageMenuOpen: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_FORM_DATA":
      return {
        ...state,
        formData: {...state.formData, ...action.payload},
      };
    case "SET_FIELD":
      return {
        ...state,
        formData: {...state.formData, ...action.payload},
        errors: {},
        dirty: true,
      };
    case "SET_DIRTY":
      return {...state, dirty: action.payload};
    case "SET_ERRORS":
      return {...state, errors: action.payload};
    case "SET_SUBMITTING":
      return {...state, isSubmitting: action.payload};
    case "SET_IS_NEW":
      return {...state, isNew: action.payload};
    case "SET_SIDEBAR_OPEN":
      return {...state, sidebarOpen: action.payload};
    case "SET_BANNER":
      return {
        ...state,
        bannerOpen: action.payload.open,
        bannerType: action.payload.type,
        bannerMessage: action.payload.message,
      };
    case "SET_PARENT_CATEGORIES":
      return {...state, parentCategories: action.payload};
    case "SET_CHILD_CATEGORIES":
      return {...state, childCategories: action.payload};
    case "SET_EXISTING_CATEGORY":
      return {...state, existingCategory: action.payload};
    case "SET_PROFESSIONAL_COUNT":
      return {...state, professionalCount: action.payload};
    case "SET_IMAGE_MENU_OPEN":
      return {...state, imageMenuOpen: action.payload};
    case "RESET_CATEGORY":
      return {
        ...state,
        formData: {...emptyFormData},
        existingCategory: null,
        childCategories: [],
        errors: {},
        dirty: false,
        imageMenuOpen: false,
      };
    case "RESET_FORM":
      return {...initialState, sidebarOpen: state.sidebarOpen};
    default:
      return state;
  }
}

function CategoryFormContainer() {
  const navigate = useNavigate();
  const location = useLocation();
  const {categoryId} = useParams();
  const {t} = useTranslation();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  const [state, dispatch] = useReducer(reducer, initialState);
  const [allCategoryIds, setAllCategoryIds] = useState([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const categoryLoadGenerationRef = useRef(0);

  const isNew = categoryId === "new" || !categoryId;

  /* ─── Image Upload ─────────────────────────────────────── */

  const handleFieldChange = useCallback((field, value) => {
    dispatch({type: "SET_FIELD", payload: {[field]: value}});
  }, []);

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
    uploadFolder: S3_UPLOAD_FOLDER.PROFESSIONALS,
    onSuccess: (key) => {
      handleFieldChange("imageKey", key);
    },
  });

  const imageKey = state.formData.imageKey ?? "";
  const imageKeyNeedsPresigned =
    imageKey && !imageKey.startsWith("blob:") && !imageKey.startsWith("http");

  const {
    url: presignedUrl,
    isLoading: presignedLoading,
    fetchPreview: fetchPresigned,
    clearUrl: clearPresignedUrl,
    currentKey: presignedKey,
  } = usePresignedPreview();

  /** Avoid showing the previous category's image while loading or after presigned/upload state leaks. */
  const categoryDataReady =
    isNew ||
    (state.existingCategory &&
      String(state.existingCategory.id) === String(categoryId));

  useLayoutEffect(() => {
    dispatch({type: "RESET_CATEGORY"});
  }, [categoryId]);

  useEffect(() => {
    clearPreview();
    clearUploadedUrl();
    clearPresignedUrl();
    setDeleteModalOpen(false);
    setIsDeleting(false);
  }, [categoryId, clearPreview, clearUploadedUrl, clearPresignedUrl]);

  useEffect(() => {
    if (imageKeyNeedsPresigned && imageKey && categoryDataReady) {
      fetchPresigned(imageKey);
    }
  }, [imageKeyNeedsPresigned, imageKey, fetchPresigned, categoryDataReady]);

  const imageSrc = useMemo(() => {
    if (imagePreviewUrl) return imagePreviewUrl;
    if (uploadedImageUrl) return uploadedImageUrl;
    if (!categoryDataReady && !isNew) return null;
    if (presignedUrl && presignedKey === imageKey && imageKey) return presignedUrl;
    if (state.existingCategory?.image_url && categoryDataReady) {
      return state.existingCategory.image_url;
    }
    return null;
  }, [
    imagePreviewUrl,
    uploadedImageUrl,
    presignedUrl,
    presignedKey,
    imageKey,
    categoryDataReady,
    isNew,
    state.existingCategory,
  ]);

  const imageLoading = useMemo(() => {
    if (isNew) return false;
    if (!categoryDataReady) return true;
    return Boolean(imageKeyNeedsPresigned && imageKey && presignedLoading);
  }, [
    isNew,
    categoryDataReady,
    imageKeyNeedsPresigned,
    imageKey,
    presignedLoading,
  ]);

  const handleImageRemove = useCallback(() => {
    clearPreview();
    clearUploadedUrl();
    clearPresignedUrl();
    handleFieldChange("imageKey", "");
  }, [clearPreview, clearUploadedUrl, clearPresignedUrl, handleFieldChange]);

  /* ─── Load data from API ─────────────────────────────────── */

  useEffect(() => {
    const loadGeneration = ++categoryLoadGenerationRef.current;
    let cancelled = false;

    const isStale = () =>
      cancelled || loadGeneration !== categoryLoadGenerationRef.current;

    (async () => {
      try {
        const hierarchy = await AppApi.getProfessionalCategoryHierarchy();
        if (isStale()) return;
        dispatch({
          type: "SET_PARENT_CATEGORIES",
          payload: sortCategoryHierarchy(hierarchy || []).map((p) => ({
            id: p.id,
            name: p.name,
          })),
        });

        setAllCategoryIds(flatNavigationIdsFromHierarchy(hierarchy || []));

        if (isNew) {
          if (isStale()) return;
          dispatch({type: "SET_IS_NEW", payload: true});
          dispatch({
            type: "SET_FORM_DATA",
            payload: {...emptyFormData},
          });
          return;
        }

        if (isStale()) return;
        dispatch({type: "SET_IS_NEW", payload: false});

        const cat = await AppApi.getProfessionalCategory(categoryId);
        if (isStale()) return;

        dispatch({type: "SET_EXISTING_CATEGORY", payload: cat});
        dispatch({
          type: "SET_FORM_DATA",
          payload: {
            name: cat.name || "",
            description: cat.description || "",
            type: cat.type || "child",
            parentId: cat.parent_id ? String(cat.parent_id) : "",
            icon: cat.icon || "",
            imageKey: cat.image_key || "",
            is_active: cat.is_active !== false,
          },
        });

        if (cat.type === "parent") {
          const allCats = await AppApi.getAllProfessionalCategories();
          if (isStale()) return;
          const children = (allCats || []).filter(
            (c) => c.parent_id === cat.id,
          );
          dispatch({type: "SET_CHILD_CATEGORIES", payload: children});
        }
      } catch (err) {
        if (!isStale()) {
          dispatch({
            type: "SET_BANNER",
            payload: {
              open: true,
              type: "error",
              message: err?.message || "Failed to load category",
            },
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryId, isNew]);

  /* ─── Banner auto-close ────────────────────────────────────── */

  useEffect(() => {
    if (state.bannerOpen) {
      const timer = setTimeout(() => {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: false,
            type: state.bannerType,
            message: state.bannerMessage,
          },
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.bannerOpen, state.bannerType, state.bannerMessage]);

  /* ─── Handlers ─────────────────────────────────────────────── */

  const validate = useCallback(() => {
    const errors = {};
    if (!state.formData.name.trim()) {
      errors.name = "Category name is required";
    }
    if (state.formData.type === "child" && !state.formData.parentId) {
      errors.parentId = "Parent category is required for subcategories";
    }
    return errors;
  }, [state.formData]);

  const handleSave = useCallback(async () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      dispatch({type: "SET_ERRORS", payload: errors});
      return;
    }

    dispatch({type: "SET_SUBMITTING", payload: true});

    try {
      const payload = {
        name: state.formData.name.trim(),
        description: state.formData.description || null,
        type: state.formData.type,
        parent_id: state.formData.parentId || null,
        icon: state.formData.icon || null,
        image_key: state.formData.imageKey || null,
        is_active: state.formData.is_active,
      };

      if (isNew) {
        const created = await AppApi.createProfessionalCategory(payload);
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "success",
            message: "Category created successfully",
          },
        });
        navigate(`/${accountUrl}/professionals/categories/${created.id}`);
      } else {
        await AppApi.updateProfessionalCategory(categoryId, payload);
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "success",
            message: "Category updated successfully",
          },
        });
        dispatch({type: "SET_DIRTY", payload: false});
      }
    } catch (err) {
      const msg = err?.messages?.[0] || err?.message || "Failed to save category";
      dispatch({
        type: "SET_BANNER",
        payload: {open: true, type: "error", message: msg},
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }, [validate, isNew, state.formData, categoryId, accountUrl, navigate]);

  const handleBack = useCallback(() => {
    navigate(`/${accountUrl}/professionals/categories`);
  }, [navigate, accountUrl]);

  const handleRequestDelete = useCallback(() => {
    setDeleteModalOpen(true);
  }, []);

  const confirmDeleteCategory = useCallback(async () => {
    if (isNew || !categoryId) return;
    setIsDeleting(true);
    try {
      await AppApi.deleteProfessionalCategory(categoryId);
      setDeleteModalOpen(false);
      navigate(`/${accountUrl}/professionals/categories`, {
        state: {
          categoriesFlashMessage: t("categoryDeletedSuccessfully", {
            defaultValue: "Category deleted successfully",
          }),
          categoriesFlashType: "success",
        },
      });
    } catch (err) {
      const msg =
        err?.messages?.[0] ||
        err?.message ||
        t("categoryDeleteFailed", {defaultValue: "Could not delete category."});
      dispatch({
        type: "SET_BANNER",
        payload: {open: true, type: "error", message: msg},
      });
    } finally {
      setIsDeleting(false);
    }
  }, [isNew, categoryId, accountUrl, navigate, t]);

  /* ─── Navigation (< >) ──────────────────────────────────────── */

  const navState = useMemo(() => {
    if (isNew || allCategoryIds.length === 0) return null;
    const ids = location.state?.visibleCategoryIds || allCategoryIds;
    const currentIndex = ids.findIndex((id) => String(id) === String(categoryId));
    if (currentIndex === -1) return null;
    return {
      currentIndex: currentIndex + 1,
      totalItems: ids.length,
      ids,
    };
  }, [isNew, allCategoryIds, categoryId, location.state]);

  const handlePrev = useCallback(() => {
    if (!navState || navState.currentIndex <= 1) return;
    const prevId = navState.ids[navState.currentIndex - 2];
    navigate(`/${accountUrl}/professionals/categories/${prevId}`, {
      state: {visibleCategoryIds: navState.ids},
    });
  }, [navState, navigate, accountUrl]);

  const handleNext = useCallback(() => {
    if (!navState || navState.currentIndex >= navState.totalItems) return;
    const nextId = navState.ids[navState.currentIndex];
    navigate(`/${accountUrl}/professionals/categories/${nextId}`, {
      state: {visibleCategoryIds: navState.ids},
    });
  }, [navState, navigate, accountUrl]);

  /* ─── Render ───────────────────────────────────────────────── */

  const isParent = state.formData.type === "parent";

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar
        sidebarOpen={state.sidebarOpen}
        setSidebarOpen={(open) =>
          dispatch({type: "SET_SIDEBAR_OPEN", payload: open})
        }
      />

      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header
          sidebarOpen={state.sidebarOpen}
          setSidebarOpen={(open) =>
            dispatch({type: "SET_SIDEBAR_OPEN", payload: open})
          }
        />

        <div className="m-1.5">
          <ModalBlank
            id="category-delete-modal"
            modalOpen={deleteModalOpen}
            setModalOpen={setDeleteModalOpen}
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
                    {state.formData.name?.trim()
                      ? t("confirmDeleteCategoryNamed", {
                          name: state.formData.name.trim(),
                          defaultValue: `Delete “{{name}}”?`,
                        })
                      : t("deleteCategory", {defaultValue: "Delete category?"})}
                  </div>
                </div>
                <div className="text-sm mb-10 text-gray-600 dark:text-gray-400 space-y-2">
                  <p>
                    {t("categoryDeleteConfirmation", {
                      defaultValue:
                        "This permanently removes the category. Professionals still assigned to it must be updated first, or the delete will fail.",
                    })}
                  </p>
                  {isParent && state.childCategories.length > 0 ? (
                    <p className="text-amber-700 dark:text-amber-400">
                      {t("categoryDeleteSubcategoriesNote", {
                        count: state.childCategories.length,
                        defaultValue:
                          "This parent has {{count}} subcategories; deleting it removes those subcategories too.",
                      })}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap justify-end space-x-2">
                  <button
                    type="button"
                    className="btn-sm border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300"
                    disabled={isDeleting}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteModalOpen(false);
                    }}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    className="btn-sm bg-red-500 hover:bg-red-600 text-white disabled:opacity-60"
                    disabled={isDeleting}
                    onClick={confirmDeleteCategory}
                  >
                    {isDeleting
                      ? t("deleting", {defaultValue: "Deleting…"})
                      : t("delete", {defaultValue: "Delete"})}
                  </button>
                </div>
              </div>
            </div>
          </ModalBlank>
        </div>

        <div className="fixed right-0 w-auto sm:w-full z-50">
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
            className={`transition-opacity duration-600 ${
              state.bannerOpen ? "opacity-100" : "opacity-0"
            }`}
          >
            {state.bannerMessage}
          </Banner>
        </div>

        <main className="grow">
          <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-5xl mx-auto">
            {/* ─── Navigation ───── */}
            <div className="flex justify-between items-center mb-2">
              <button
                type="button"
                className="btn text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-600 pl-0 focus:outline-none shadow-none"
                onClick={handleBack}
              >
                <svg
                  className="fill-current shrink-0 mr-1"
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                >
                  <path d="M9.4 13.4l1.4-1.4-4-4 4-4-1.4-1.4L4 8z" />
                </svg>
                <span className="text-lg">{t("categories")}</span>
              </button>

              <div className="flex items-center gap-3">
                {!isNew && state.existingCategory && (
                  <CategoryActionsMenu
                    key={categoryId}
                    variant="toolbar"
                    onRequestDelete={handleRequestDelete}
                  />
                )}
                <button
                  type="button"
                  className="btn bg-[#456564] hover:bg-[#34514f] text-white transition-colors duration-200 shadow-sm"
                  onClick={() =>
                    navigate(`/${accountUrl}/professionals/categories/new`)
                  }
                >
                  {t("new")}
                </button>
              </div>
            </div>

            {/* ─── Status Buttons + Navigation Row ───── */}
            {!isNew && state.existingCategory && (
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3 ml-4">
                  {state.formData.is_active ? (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm bg-[#d3f4e3] dark:bg-[#173c36] text-[#2a9f52] dark:text-[#258c4d]">
                      <span>Active</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm bg-[#fddddd] dark:bg-[#402431] text-[#e63939] dark:text-[#c23437]">
                      <span>Inactive</span>
                    </div>
                  )}

                  {isParent && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-transparent border border-violet-300 dark:border-violet-500/30 rounded-lg text-violet-700 dark:text-violet-300 transition-all duration-200">
                      <Layers className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm font-semibold">
                        Subcategories{" "}
                        <span className="font-normal">
                          {state.childCategories.length}
                        </span>
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 px-3 py-2 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 transition-all duration-200">
                    <Users className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-semibold">
                      Professionals{" "}
                      <span className="font-normal">
                        {state.existingCategory?.professional_count ?? state.professionalCount}
                      </span>
                    </span>
                  </div>
                </div>

                {navState && (
                  <div className="flex items-center">
                    <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                      {navState.currentIndex} / {navState.totalItems}
                    </span>
                    <button
                      type="button"
                      className="btn shadow-none p-1"
                      title="Previous"
                      onClick={handlePrev}
                      disabled={navState.currentIndex <= 1}
                    >
                      <svg
                        className={`fill-current shrink-0 ${
                          navState.currentIndex <= 1
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
                      title="Next"
                      onClick={handleNext}
                      disabled={navState.currentIndex >= navState.totalItems}
                    >
                      <svg
                        className={`fill-current shrink-0 ${
                          navState.currentIndex >= navState.totalItems
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
                  </div>
                )}
              </div>
            )}

            {/* ─── Header Card (Photo + Title) ───── */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <div className="p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-start gap-4">
                    <ImageUploadField
                      key={categoryId ?? "new"}
                      imageSrc={imageSrc}
                      hasImage={categoryDataReady && !!state.formData.imageKey}
                      imageLoading={imageLoading}
                      imageUploading={imageUploading}
                      onUpload={uploadImage}
                      onRemove={handleImageRemove}
                      showRemove={categoryDataReady && !!state.formData.imageKey}
                      imageUploadError={imageUploadError}
                      onDismissError={() => setImageUploadError(null)}
                      size="md"
                      placeholder="icon"
                      alt="Category"
                      uploadLabel="Upload photo"
                      removeLabel="Remove photo"
                      menuOpen={state.imageMenuOpen}
                      onMenuToggle={(open) =>
                        dispatch({type: "SET_IMAGE_MENU_OPEN", payload: open})
                      }
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                          {isNew ? "New Category" : state.formData.name}
                        </h1>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isParent
                              ? "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-200/60 dark:border-violet-500/20"
                              : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20"
                          }`}
                        >
                          {isParent ? (
                            <Layers className="w-3 h-3" />
                          ) : (
                            <Tag className="w-3 h-3" />
                          )}
                          {isParent ? "Parent" : "Sub"}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {state.formData.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {state.formData.description}
                          </p>
                        )}
                        {!isNew && isParent && state.childCategories.length > 0 && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {state.childCategories.length} subcategories
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Form Card ────────────────── */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6 sm:p-8">
                <CategoryForm
                  key={categoryId ?? "new"}
                  formData={state.formData}
                  errors={state.errors}
                  isNew={isNew}
                  parentCategories={state.parentCategories}
                  childCategories={state.childCategories}
                  existingCategory={state.existingCategory}
                  onChange={handleFieldChange}
                  onRequestDelete={
                    !isNew && state.existingCategory
                      ? handleRequestDelete
                      : undefined
                  }
                />
              </div>

              {/* Footer with Save/Update buttons */}
              <div
                className={`${
                  isNew || state.dirty ? "sticky" : "hidden"
                } bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 sm:px-8 py-4 rounded-b-xl transition-all duration-200`}
              >
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    className="btn bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300 transition-colors duration-200 shadow-sm"
                    onClick={handleBack}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    className="btn text-white transition-colors duration-200 shadow-sm min-w-[100px] bg-[#456564] hover:bg-[#34514f]"
                    onClick={handleSave}
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
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default CategoryFormContainer;

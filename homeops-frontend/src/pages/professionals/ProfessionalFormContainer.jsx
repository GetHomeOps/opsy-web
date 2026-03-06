import React, {
  useReducer,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {
  X,
  Plus,
  Loader2,
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Shield,
  FileText,
  Briefcase,
  User,
  ExternalLink,
  Camera,
  AlertCircle,
} from "lucide-react";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import Banner from "../../partials/containers/Banner";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import useImageUpload from "../../hooks/useImageUpload";
import AppApi from "../../api/api";
import ImageUploadField from "../../components/ImageUploadField";

const BUDGET_OPTIONS = [
  {value: "$", label: "$", description: "Budget-friendly"},
  {value: "$$", label: "$$", description: "Mid-range"},
  {value: "$$$", label: "$$$", description: "High-end"},
  {value: "$$$$", label: "$$$$", description: "Premium"},
];

const LANGUAGE_OPTIONS = [
  "English",
  "Spanish",
  "French",
  "Portuguese",
  "Mandarin",
  "Korean",
  "Vietnamese",
  "Arabic",
  "Russian",
  "Italian",
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const initialFormData = {
  company_name: "",
  contact_name: "",
  category_id: "",
  subcategory_id: "",
  description: "",
  phone: "",
  email: "",
  website: "",
  street1: "",
  street2: "",
  city: "",
  state: "",
  zip_code: "",
  country: "US",
  service_area: "",
  budget_level: "",
  languages: ["English"],
  years_in_business: "",
  is_verified: false,
  license_number: "",
  profile_photo: "",
};

const initialState = {
  formData: {...initialFormData},
  errors: {},
  isSubmitting: false,
  isNew: true,
  sidebarOpen: false,
  bannerOpen: false,
  bannerType: "success",
  bannerMessage: "",
  projectPhotos: [],
  uploadingPhotos: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_FORM_DATA":
      return {
        ...state,
        formData: {...state.formData, ...action.payload},
      };
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
    case "SET_PROJECT_PHOTOS":
      return {...state, projectPhotos: action.payload};
    case "ADD_PROJECT_PHOTO":
      return {
        ...state,
        projectPhotos: [...state.projectPhotos, action.payload],
      };
    case "REMOVE_PROJECT_PHOTO":
      return {
        ...state,
        projectPhotos: state.projectPhotos.filter(
          (p) => p.id !== action.payload,
        ),
      };
    case "SET_UPLOADING_PHOTOS":
      return {...state, uploadingPhotos: action.payload};
    case "LOAD_PROFESSIONAL":
      return {
        ...state,
        formData: action.payload.formData,
        projectPhotos: action.payload.photos || [],
        isNew: false,
      };
    case "RESET_FORM":
      return {...initialState, sidebarOpen: state.sidebarOpen};
    default:
      return state;
  }
}

/* ─── Main Component ─────────────────────────────────────────── */

function ProfessionalFormContainer() {
  const navigate = useNavigate();
  const {professionalId} = useParams();
  const {t} = useTranslation();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  const [state, dispatch] = useReducer(reducer, initialState);
  const projectPhotoInputRef = useRef(null);
  const initialFormDataRef = useRef(null);

  const isNew = professionalId === "new" || !professionalId;

  const hasChanges = useMemo(() => {
    if (isNew) return true;
    if (!initialFormDataRef.current) return false;
    const init = initialFormDataRef.current;
    const curr = state.formData;
    return Object.keys(init).some((key) => {
      const initVal = Array.isArray(init[key]) ? JSON.stringify(init[key]) : String(init[key] ?? "");
      const currVal = Array.isArray(curr[key]) ? JSON.stringify(curr[key]) : String(curr[key] ?? "");
      return initVal !== currVal;
    });
  }, [isNew, state.formData]);

  /* ─── Profile Photo Upload ─────────────────────────────────── */

  const handleFieldChange = useCallback((field, value) => {
    dispatch({type: "SET_FORM_DATA", payload: {[field]: value}});
    dispatch({type: "SET_ERRORS", payload: {}});
  }, []);

  const {
    uploadImage: uploadProfilePhoto,
    imagePreviewUrl: profilePreviewUrl,
    uploadedImageUrl: profileUploadedUrl,
    imageUploading: profileUploading,
    imageUploadError: profileUploadError,
    setImageUploadError: setProfileUploadError,
    clearPreview: clearProfilePreview,
    clearUploadedUrl: clearProfileUploadedUrl,
  } = useImageUpload({
    onSuccess: (key) => {
      handleFieldChange("profile_photo", key);
    },
  });

  const profileSrc = useMemo(() => {
    if (profilePreviewUrl) return profilePreviewUrl;
    if (profileUploadedUrl) return profileUploadedUrl;
    if (state.formData.profile_photo?.startsWith("http"))
      return state.formData.profile_photo;
    return null;
  }, [profilePreviewUrl, profileUploadedUrl, state.formData.profile_photo]);

  const handleProfileRemove = useCallback(() => {
    clearProfilePreview();
    clearProfileUploadedUrl();
    handleFieldChange("profile_photo", "");
  }, [clearProfilePreview, clearProfileUploadedUrl, handleFieldChange]);

  /* ─── Project Photos Upload ────────────────────────────────── */

  const handleProjectPhotoUpload = useCallback(
    async (file) => {
      if (!file || !file.type.startsWith("image/")) return;
      dispatch({type: "SET_UPLOADING_PHOTOS", payload: true});
      try {
        const {compressImageForUpload} = await import(
          "../../utils/compressImage"
        );
        const toUpload = await compressImageForUpload(file);
        const doc = await AppApi.uploadDocument(toUpload);
        const key = doc?.key ?? doc?.s3Key ?? doc?.url;
        let displayUrl = doc?.url ?? doc?.presignedUrl;
        if (key) {
          try {
            displayUrl = await AppApi.getPresignedPreviewUrl(key);
          } catch {
            displayUrl = displayUrl || URL.createObjectURL(file);
          }
        }
        if (key) {
          dispatch({
            type: "ADD_PROJECT_PHOTO",
            payload: {
              id: `temp-${Date.now()}`,
              photo_key: key,
              photo_url: displayUrl || URL.createObjectURL(file),
              caption: "",
            },
          });
        }
      } catch (err) {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message: "Failed to upload photo",
          },
        });
      } finally {
        dispatch({type: "SET_UPLOADING_PHOTOS", payload: false});
      }
    },
    [],
  );

  const handleProjectPhotoInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProjectPhotoUpload(file);
      e.target.value = "";
    }
  };

  /* ─── Category hierarchy ───────────────────────────────────── */

  const [categoryHierarchy, setCategoryHierarchy] = useState([]);
  const [projectPhotoUrls, setProjectPhotoUrls] = useState({});

  /* Fetch presigned URLs for project photos (existing photos from API may have expired URLs) */
  useEffect(() => {
    const keysToFetch = state.projectPhotos
      .map((p) => p.photo_key)
      .filter(Boolean)
      .filter((k) => !k.startsWith("blob:") && !k.startsWith("http"))
      .filter((k) => !projectPhotoUrls[k]);
    if (keysToFetch.length === 0) return;
    let cancelled = false;
    keysToFetch.forEach((key) => {
      AppApi.getPresignedPreviewUrl(key)
        .then((url) => {
          if (!cancelled) {
            setProjectPhotoUrls((prev) => ({...prev, [key]: url}));
          }
        })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [state.projectPhotos, projectPhotoUrls]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hierarchy = await AppApi.getProfessionalCategoryHierarchy();
        if (!cancelled) setCategoryHierarchy(hierarchy || []);
      } catch {
        // Categories might not be seeded yet
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const parentCategories = useMemo(
    () => categoryHierarchy.map((p) => ({id: String(p.id), name: p.name})),
    [categoryHierarchy],
  );

  const subcategories = useMemo(() => {
    if (!state.formData.category_id) return [];
    const parent = categoryHierarchy.find(
      (p) => String(p.id) === String(state.formData.category_id),
    );
    return (parent?.children ?? []).map((c) => ({id: String(c.id), name: c.name}));
  }, [state.formData.category_id, categoryHierarchy]);

  /* ─── Load existing professional ───────────────────────────── */

  useEffect(() => {
    if (isNew) {
      dispatch({type: "SET_IS_NEW", payload: true});
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const pro = await AppApi.getProfessional(professionalId);
        if (cancelled) return;
        const loadedData = {
          company_name: pro.company_name || "",
          contact_name: pro.contact_name || "",
          category_id: pro.category_id ? String(pro.category_id) : "",
          subcategory_id: pro.subcategory_id
            ? String(pro.subcategory_id)
            : "",
          description: pro.description || "",
          phone: pro.phone || "",
          email: pro.email || "",
          website: pro.website || "",
          street1: pro.street1 || "",
          street2: pro.street2 || "",
          city: pro.city || "",
          state: pro.state || "",
          zip_code: pro.zip_code || "",
          country: pro.country || "US",
          service_area: pro.service_area || "",
          budget_level: pro.budget_level || "",
          languages: pro.languages || ["English"],
          years_in_business: pro.years_in_business
            ? String(pro.years_in_business)
            : "",
          is_verified: pro.is_verified || false,
          license_number: pro.license_number || "",
          profile_photo: pro.profile_photo || "",
        };
        initialFormDataRef.current = {
          ...loadedData,
          languages: [...(loadedData.languages || [])],
        };
        setProjectPhotoUrls({});
        dispatch({
          type: "LOAD_PROFESSIONAL",
          payload: {
            formData: loadedData,
            photos: pro.photos || [],
          },
        });
      } catch {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message: "Failed to load professional",
          },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [professionalId, isNew]);

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
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [state.bannerOpen, state.bannerType, state.bannerMessage]);

  /* ─── Validation ───────────────────────────────────────────── */

  const validate = useCallback(() => {
    const errs = {};
    if (!state.formData.company_name.trim())
      errs.company_name = "Company name is required";
    if (!state.formData.phone.trim()) errs.phone = "Phone is required";
    if (!state.formData.website.trim()) errs.website = "Website is required";
    if (!state.formData.city.trim()) errs.city = "City is required";
    if (!state.formData.state.trim()) errs.state = "State is required";
    if (!state.formData.category_id.trim())
      errs.category_id = "Category is required";
    if (!state.formData.subcategory_id.trim())
      errs.subcategory_id = "Subcategory is required";
    if (
      state.formData.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.formData.email)
    )
      errs.email = "Invalid email address";
    return errs;
  }, [state.formData]);

  /* ─── Save ─────────────────────────────────────────────────── */

  const handleSave = useCallback(async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      dispatch({type: "SET_ERRORS", payload: errs});
      const msg = Object.values(errs).filter(Boolean).join(". ");
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: msg || (t("settings.pleaseFixErrors") || "Please fix the following errors."),
        },
      });
      return;
    }

    dispatch({type: "SET_SUBMITTING", payload: true});

    try {
      const payload = {
        ...state.formData,
        years_in_business: state.formData.years_in_business
          ? Number(state.formData.years_in_business)
          : null,
        category_id: state.formData.category_id || null,
        subcategory_id: state.formData.subcategory_id || null,
        account_id: currentAccount?.id || null,
      };

      let pro;
      if (isNew) {
        pro = await AppApi.createProfessional(payload);
      } else {
        pro = await AppApi.updateProfessional(professionalId, payload);
      }

      // Save project photos if any new ones
      for (const photo of state.projectPhotos) {
        if (String(photo.id).startsWith("temp-")) {
          await AppApi.addProfessionalPhoto(pro.id, {
            photo_key: photo.photo_key,
            caption: photo.caption,
          });
        }
      }

      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "success",
          message: isNew
            ? "Professional created successfully"
            : "Professional updated successfully",
        },
      });

      if (isNew) {
        navigate(`/${accountUrl}/professionals/manage/${pro.id}`);
      } else {
        // Sync initial snapshot so hasChanges becomes false and Update button hides
        const syncedData = {
          ...state.formData,
          years_in_business: state.formData.years_in_business
            ? String(state.formData.years_in_business)
            : "",
          languages: [...(state.formData.languages || [])],
        };
        initialFormDataRef.current = syncedData;
      }
    } catch (err) {
      const msg =
        err?.messages?.[0] || err?.message || "Failed to save professional";
      dispatch({
        type: "SET_BANNER",
        payload: {open: true, type: "error", message: msg},
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }, [
    validate,
    state.formData,
    state.projectPhotos,
    isNew,
    professionalId,
    currentAccount,
    accountUrl,
    navigate,
  ]);

  const handleBack = useCallback(() => {
    navigate(`/${accountUrl}/professionals/manage`);
  }, [navigate, accountUrl]);

  /* ─── Language toggle ──────────────────────────────────────── */

  const toggleLanguage = useCallback(
    (lang) => {
      const current = state.formData.languages || [];
      const updated = current.includes(lang)
        ? current.filter((l) => l !== lang)
        : [...current, lang];
      handleFieldChange("languages", updated);
    },
    [state.formData.languages, handleFieldChange],
  );

  /* ─── Form field helpers ───────────────────────────────────── */

  const fd = state.formData;
  const err = state.errors;

  const inputClass = (field) =>
    `form-input w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-[#456564] dark:focus:border-[#456564] rounded-lg shadow-sm text-sm ${
      err[field] ? "!border-red-500" : ""
    }`;

  const selectClass = (field) =>
    `form-select w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-[#456564] dark:focus:border-[#456564] rounded-lg shadow-sm text-sm ${
      err[field] ? "!border-red-500" : ""
    }`;

  /* ─── Render ───────────────────────────────────────────────── */

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
            className={`transition-opacity duration-600 ${
              state.bannerOpen ? "opacity-100" : "opacity-0"
            }`}
          >
            {state.bannerMessage}
          </Banner>
        </div>

        <main className="grow">
          <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-5xl mx-auto">
            {/* ─── Navigation and Actions ───── */}
            <div className="flex justify-between items-center mb-4">
              <button
                type="button"
                className="btn text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-600 mb-2 pl-0 focus:outline-none shadow-none"
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
                <span className="text-lg">Professionals</span>
              </button>
              <div className="flex items-center gap-3">
                {!isNew && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/${accountUrl}/professionals/${professionalId}`)
                    }
                    className="flex items-center gap-2 px-3 py-2 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 transition-all duration-200"
                  >
                    <ExternalLink className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-semibold">View Profile</span>
                  </button>
                )}
                {!isNew && (
                  <button
                    className="btn bg-[#456564] hover:bg-[#34514f] text-white transition-colors duration-200 shadow-sm"
                    onClick={() =>
                      navigate(`/${accountUrl}/professionals/manage/new`)
                    }
                  >
                    New
                  </button>
                )}
              </div>
            </div>

            {/* ─── Header Card: Photo + Company & Contact ───── */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <ImageUploadField
                    imageSrc={profileSrc}
                    hasImage={!!state.formData.profile_photo}
                    imageUploading={profileUploading}
                    onUpload={uploadProfilePhoto}
                    onRemove={handleProfileRemove}
                    showRemove={!!state.formData.profile_photo}
                    imageUploadError={profileUploadError}
                    onDismissError={() => setProfileUploadError(null)}
                    size="md"
                    placeholder="avatar"
                    alt="Professional"
                    uploadLabel="Upload photo"
                    removeLabel="Remove photo"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                        {fd.company_name || (isNew ? "New Contractor" : "Contractor")}
                      </h1>
                    </div>

                    <div className="space-y-1.5">
                      {fd.contact_name && (
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <User className="w-4 h-4 mr-2 text-[#456564] shrink-0" />
                          <span>{fd.contact_name}</span>
                        </div>
                      )}
                      {fd.phone && (
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <Phone className="w-4 h-4 mr-2 text-[#456564] shrink-0" />
                          <span>{fd.phone}</span>
                        </div>
                      )}
                      {fd.email && (
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <Mail className="w-4 h-4 mr-2 text-[#456564] shrink-0" />
                          <span>{fd.email}</span>
                        </div>
                      )}
                      {fd.website && (
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <Globe className="w-4 h-4 mr-2 text-[#456564] shrink-0" />
                          <span className="truncate">{fd.website}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6 space-y-8">
                {/* ─── Company & Contact Info (required fields at top) ───── */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-[#456564]" />
                    Company Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                        Company Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className={inputClass("company_name")}
                        placeholder="Anderson & Sons Plumbing"
                        value={fd.company_name}
                        onChange={(e) =>
                          handleFieldChange("company_name", e.target.value)
                        }
                      />
                      {err.company_name && (
                        <div className="mt-1 flex items-center text-sm text-red-500">
                          <AlertCircle className="h-4 w-4 mr-1 shrink-0" />
                          <span>{err.company_name}</span>
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                        Contact Name
                      </label>
                      <input
                        type="text"
                        className={inputClass("contact_name")}
                        placeholder="Optional contact person"
                        value={fd.contact_name}
                        onChange={(e) =>
                          handleFieldChange("contact_name", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                        Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        className={inputClass("phone")}
                        placeholder="(305) 555-1234"
                        value={fd.phone}
                        onChange={(e) =>
                          handleFieldChange("phone", e.target.value)
                        }
                      />
                      {err.phone && (
                        <div className="mt-1 flex items-center text-sm text-red-500">
                          <AlertCircle className="h-4 w-4 mr-1 shrink-0" />
                          <span>{err.phone}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                        Email
                      </label>
                      <input
                        type="email"
                        className={inputClass("email")}
                        placeholder="james@example.com"
                        value={fd.email}
                        onChange={(e) =>
                          handleFieldChange("email", e.target.value)
                        }
                      />
                      {err.email && (
                        <div className="mt-1 flex items-center text-sm text-red-500">
                          <AlertCircle className="h-4 w-4 mr-1 shrink-0" />
                          <span>{err.email}</span>
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                        Website <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="url"
                        className={inputClass("website")}
                        placeholder="https://www.example.com"
                        value={fd.website}
                        onChange={(e) =>
                          handleFieldChange("website", e.target.value)
                        }
                      />
                      {err.website && (
                        <div className="mt-1 flex items-center text-sm text-red-500">
                          <AlertCircle className="h-4 w-4 mr-1 shrink-0" />
                          <span>{err.website}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ─── Address ─────────────────────────────────── */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-[#456564]" />
                    Address
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                        Street Address
                      </label>
                      <input
                        type="text"
                        className={inputClass("street1")}
                        placeholder="123 Main Street"
                        value={fd.street1}
                        onChange={(e) =>
                          handleFieldChange("street1", e.target.value)
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                        Street Address 2
                      </label>
                      <input
                        type="text"
                        className={inputClass("street2")}
                        placeholder="Suite 200"
                        value={fd.street2}
                        onChange={(e) =>
                          handleFieldChange("street2", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                        City <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className={inputClass("city")}
                        placeholder="Miami"
                        value={fd.city}
                        onChange={(e) =>
                          handleFieldChange("city", e.target.value)
                        }
                      />
                      {err.city && (
                        <div className="mt-1 flex items-center text-sm text-red-500">
                          <AlertCircle className="h-4 w-4 mr-1 shrink-0" />
                          <span>{err.city}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                        State <span className="text-red-500">*</span>
                      </label>
                      <select
                        className={selectClass("state")}
                        value={fd.state}
                        onChange={(e) =>
                          handleFieldChange("state", e.target.value)
                        }
                      >
                        <option value="">State</option>
                        {US_STATES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      {err.state && (
                        <div className="mt-1 flex items-center text-sm text-red-500">
                          <AlertCircle className="h-4 w-4 mr-1 shrink-0" />
                          <span>{err.state}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                        ZIP Code
                      </label>
                      <input
                        type="text"
                        className={inputClass("zip_code")}
                        placeholder="33101"
                        value={fd.zip_code}
                        onChange={(e) =>
                          handleFieldChange("zip_code", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                        Service Area
                      </label>
                      <input
                        type="text"
                        className={inputClass("service_area")}
                        placeholder="Greater Miami area, Broward County"
                        value={fd.service_area}
                        onChange={(e) =>
                          handleFieldChange("service_area", e.target.value)
                        }
                      />
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        Describe the areas this contractor serves
                      </p>
                    </div>
                  </div>
                </div>

                {/* ─── Category & Services ─────────────────────── */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-[#456564]" />
                    Category & Services
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        className={selectClass("category_id")}
                        value={fd.category_id}
                        onChange={(e) => {
                          handleFieldChange("category_id", e.target.value);
                          handleFieldChange("subcategory_id", "");
                        }}
                      >
                        <option value="">Select a category...</option>
                        {parentCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {err.category_id && (
                        <div className="mt-1 flex items-center text-sm text-red-500">
                          <AlertCircle className="h-4 w-4 mr-1 shrink-0" />
                          <span>{err.category_id}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                        Subcategory <span className="text-red-500">*</span>
                      </label>
                      <select
                        className={selectClass("subcategory_id")}
                        value={fd.subcategory_id}
                        onChange={(e) =>
                          handleFieldChange("subcategory_id", e.target.value)
                        }
                        disabled={!fd.category_id}
                      >
                        <option value="">
                          {fd.category_id
                            ? "Select a subcategory..."
                            : "Choose a category first"}
                        </option>
                        {subcategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {err.subcategory_id && (
                        <div className="mt-1 flex items-center text-sm text-red-500">
                          <AlertCircle className="h-4 w-4 mr-1 shrink-0" />
                          <span>{err.subcategory_id}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                        Years in Business
                      </label>
                      <input
                        type="number"
                        min="0"
                        className={inputClass("years_in_business")}
                        placeholder="10"
                        value={fd.years_in_business}
                        onChange={(e) =>
                          handleFieldChange("years_in_business", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                        License Number
                      </label>
                      <input
                        type="text"
                        className={inputClass("license_number")}
                        placeholder="LIC-12345"
                        value={fd.license_number}
                        onChange={(e) =>
                          handleFieldChange("license_number", e.target.value)
                        }
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2.5 cursor-pointer group h-[38px]">
                        <input
                          type="checkbox"
                          checked={fd.is_verified}
                          onChange={(e) =>
                            handleFieldChange("is_verified", e.target.checked)
                          }
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-[#456564] focus:ring-[#456564]/30 focus:ring-offset-0"
                        />
                        <span className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                          <Shield className="w-4 h-4 text-emerald-500" />
                          Licensed & Verified
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="block text-sm font-medium mb-2 text-gray-500 dark:text-gray-400">
                      Budget Level
                    </label>
                    <div className="flex gap-2">
                      {BUDGET_OPTIONS.map((opt) => {
                        const active = fd.budget_level === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              handleFieldChange(
                                "budget_level",
                                active ? "" : opt.value,
                              )
                            }
                            className={`flex-1 py-2.5 px-3 rounded-lg border-2 text-center transition-all ${
                              active
                                ? "border-[#456564] bg-[#456564]/5 dark:bg-[#456564]/15"
                                : "border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600"
                            }`}
                          >
                            <div
                              className={`text-base font-bold ${active ? "text-[#456564] dark:text-[#7aa3a2]" : "text-gray-700 dark:text-gray-300"}`}
                            >
                              {opt.label}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {opt.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ─── About & Languages ───────────────────────── */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[#456564]" />
                    About
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">
                        Description
                      </label>
                      <textarea
                        className="form-textarea w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-[#456564] dark:focus:border-[#456564] rounded-lg shadow-sm text-sm"
                        rows={5}
                        placeholder="Award-winning contractor with over 15 years of experience..."
                        value={fd.description}
                        onChange={(e) =>
                          handleFieldChange("description", e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-500 dark:text-gray-400">
                        Languages Spoken
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {LANGUAGE_OPTIONS.map((lang) => {
                          const active = (fd.languages || []).includes(lang);
                          return (
                            <button
                              key={lang}
                              type="button"
                              onClick={() => toggleLanguage(lang)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                active
                                  ? "bg-[#456564] border-[#456564] text-white"
                                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                              }`}
                            >
                              {lang}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ─── Project Gallery ─────────────────────────── */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                    <Camera className="h-5 w-5 text-[#456564]" />
                    Project Gallery
                  </h3>
                  <input
                    ref={projectPhotoInputRef}
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleProjectPhotoInputChange}
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {state.projectPhotos.map((photo) => {
                      const imgSrc =
                        projectPhotoUrls[photo.photo_key] ||
                        photo.photo_url ||
                        (photo.photo_key?.startsWith("http")
                          ? photo.photo_key
                          : null);
                      return (
                      <div
                        key={photo.id}
                        className="relative group rounded-xl overflow-hidden aspect-[4/3] bg-gray-100 dark:bg-gray-700"
                      >
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={photo.caption || "Project photo"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            dispatch({
                              type: "REMOVE_PROJECT_PHOTO",
                              payload: photo.id,
                            })
                          }
                          className="absolute top-2 right-2 p-1 rounded-full bg-black/50 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        {photo.caption && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                            <p className="text-xs text-white truncate">
                              {photo.caption}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                    })}

                    <button
                      type="button"
                      onClick={() => projectPhotoInputRef.current?.click()}
                      disabled={state.uploadingPhotos}
                      className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 aspect-[4/3] hover:border-[#456564] dark:hover:border-[#456564] hover:bg-[#456564]/5 transition-all cursor-pointer group"
                    >
                      {state.uploadingPhotos ? (
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center group-hover:bg-[#456564]/10 transition-colors">
                            <Plus className="w-5 h-5 text-gray-400 group-hover:text-[#456564]" />
                          </div>
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 group-hover:text-[#456564]">
                            Add Photo
                          </span>
                        </>
                      )}
                    </button>
                  </div>

                  {state.projectPhotos.length === 0 && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-3 text-center">
                      Showcase completed projects to attract clients. Add up to 20
                      photos.
                    </p>
                  )}
                </div>
              </div>

              {/* ─── Save Footer ─────────────────────────────── */}
              <div
                className={`${
                  isNew || hasChanges ? "sticky" : "hidden"
                } bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 rounded-b-lg transition-all duration-200`}
              >
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    className="btn bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300 transition-colors duration-200 shadow-sm"
                    onClick={handleBack}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn text-white transition-colors duration-200 shadow-sm min-w-[100px] bg-[#456564] hover:bg-[#34514f]"
                    onClick={handleSave}
                    disabled={state.isSubmitting}
                  >
                    {state.isSubmitting ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </div>
                    ) : isNew ? (
                      "Save"
                    ) : (
                      "Update"
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

export default ProfessionalFormContainer;

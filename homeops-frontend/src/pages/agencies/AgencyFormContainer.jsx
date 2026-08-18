import React, {useCallback, useEffect, useMemo, useState} from "react";
import {useLocation, useNavigate, useParams} from "react-router-dom";
import Banner from "../../partials/containers/Banner";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {useAgencyListCache} from "../../context/AgencyContext";
import AppApi from "../../api/api";
import AgencyFormFields, {AGENCY_EMPTY_FORM} from "./AgencyFormFields";
import AgencyFormSkeleton from "./AgencyFormSkeleton";

function parseRouteAgencyId(raw) {
  if (raw == null || raw === "" || raw === "new") return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function fetchAgencyAtIndex(agencyListParams, oneBasedIndex) {
  const res = await AppApi.listAdminAgencies({
    ...agencyListParams,
    limit: 1,
    offset: Math.max(oneBasedIndex - 1, 0),
  });
  return res.agencies[0] ?? null;
}

function listAgencyMatchesRoute(listAgency, routeId) {
  if (!listAgency || routeId == null) return false;
  return Number(listAgency.id) === routeId;
}

function agencyToFormValues(agency) {
  if (!agency) return {...AGENCY_EMPTY_FORM};
  return {
    name: agency.name || "",
    website: agency.website || "",
    addressLine1: agency.addressLine1 || "",
    city: agency.city || "",
    state: agency.state || "",
    phone: agency.phone || "",
    officeName: "",
    logoUrl: agency.logoUrl || "",
    // Display-only: API enrichAgency already provides a working presigned URL
    logoDisplayUrl: agency.logoDisplayUrl || "",
  };
}

function AgencyFormContainer() {
  const navigate = useNavigate();
  const location = useLocation();
  const {agencyId} = useParams();
  const {currentAccount} = useCurrentAccount();
  const {getAgencyFromCache, updateAgencyInListCache} = useAgencyListCache();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  const isNew = agencyId === "new" || !agencyId;
  const routeAgencyId = isNew ? null : parseRouteAgencyId(agencyId);
  const hasInvalidRouteId = !isNew && routeAgencyId == null;

  const listAgencyFromState = location.state?.agency ?? null;
  const hasInstantAgency = listAgencyMatchesRoute(
    listAgencyFromState,
    routeAgencyId,
  );

  const [loading, setLoading] = useState(
    !isNew && !hasInvalidRouteId && !hasInstantAgency,
  );
  const [navigating, setNavigating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formInitial, setFormInitial] = useState(() =>
    hasInstantAgency
      ? agencyToFormValues(listAgencyFromState)
      : {...AGENCY_EMPTY_FORM},
  );
  const [editingId, setEditingId] = useState(
    hasInstantAgency ? listAgencyFromState.id : routeAgencyId,
  );
  const [formError, setFormError] = useState(null);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [bannerType, setBannerType] = useState("success");
  const [bannerMessage, setBannerMessage] = useState("");

  const listPath = accountUrl ? `/${accountUrl}/agencies/manage` : "/agencies/manage";
  const formPath = (id) =>
    accountUrl ? `/${accountUrl}/agencies/manage/${id}` : `/agencies/manage/${id}`;

  const navState = useMemo(() => {
    const s = location.state;
    if (!s?.currentIndex || !s?.totalItems) return null;
    if (s.agencyListParams) {
      return {
        currentIndex: s.currentIndex,
        totalItems: s.totalItems,
        agencyListParams: s.agencyListParams,
      };
    }
    if (s.visibleAgencyIds?.length) {
      return {
        currentIndex: s.currentIndex,
        totalItems: s.totalItems,
        visibleAgencyIds: s.visibleAgencyIds,
      };
    }
    return null;
  }, [location.state]);

  const navigateToAgency = useCallback(
    async (targetIndex) => {
      if (!navState || targetIndex < 1 || targetIndex > navState.totalItems) {
        return;
      }

      let targetAgency = null;
      if (navState.visibleAgencyIds) {
        const targetId = navState.visibleAgencyIds[targetIndex - 1] ?? null;
        targetAgency =
          (targetId != null ? getAgencyFromCache(targetId) : null) ??
          (targetId != null && Number(listAgencyFromState?.id) === targetId
            ? listAgencyFromState
            : null);
        if (!targetAgency && targetId != null) {
          targetAgency = {id: targetId};
        }
      }

      if (navState.agencyListParams) {
        setNavigating(true);
        try {
          const fetched = await fetchAgencyAtIndex(
            navState.agencyListParams,
            targetIndex,
          );
          if (fetched) targetAgency = fetched;
        } finally {
          setNavigating(false);
        }
      }

      if (!targetAgency?.id) return;

      navigate(formPath(targetAgency.id), {
        state: {
          ...location.state,
          currentIndex: targetIndex,
          totalItems: navState.totalItems,
          agencyListParams: navState.agencyListParams,
          visibleAgencyIds: navState.visibleAgencyIds,
          agency: targetAgency,
        },
      });
    },
    [
      navState,
      navigate,
      formPath,
      location.state,
      getAgencyFromCache,
      listAgencyFromState,
    ],
  );

  const handlePrevAgency = useCallback(() => {
    if (!navState || navState.currentIndex <= 1) return;
    navigateToAgency(navState.currentIndex - 1);
  }, [navState, navigateToAgency]);

  const handleNextAgency = useCallback(() => {
    if (!navState || navState.currentIndex >= navState.totalItems) return;
    navigateToAgency(navState.currentIndex + 1);
  }, [navState, navigateToAgency]);

  useEffect(() => {
    if (isNew) {
      setFormInitial({...AGENCY_EMPTY_FORM});
      setEditingId(null);
      setLoading(false);
      return;
    }

    if (hasInvalidRouteId) {
      setFormInitial({...AGENCY_EMPTY_FORM});
      setEditingId(null);
      setLoading(false);
      setFormError("Invalid agency link. Return to the list and open the agency again.");
      return;
    }

    const instantAgency = listAgencyMatchesRoute(
      location.state?.agency,
      routeAgencyId,
    )
      ? location.state.agency
      : null;

    const hasUsablePreview = Boolean(instantAgency?.name?.trim());

    if (instantAgency) {
      setFormInitial(agencyToFormValues(instantAgency));
      setEditingId(instantAgency.id);
      setFormError(null);
    } else {
      setFormInitial({...AGENCY_EMPTY_FORM});
      setEditingId(routeAgencyId);
    }

    let cancelled = false;
    setLoading(!hasUsablePreview);
    if (!instantAgency) {
      setFormError(null);
    }

    (async () => {
      try {
        const agency = await AppApi.getAdminAgency(routeAgencyId);
        if (cancelled) return;
        setFormInitial(agencyToFormValues(agency));
        setEditingId(agency.id);
        updateAgencyInListCache(agency);
      } catch (err) {
        if (cancelled) return;
        if (!instantAgency) {
          setFormError(err.message || "Failed to load agency");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    agencyId,
    isNew,
    hasInvalidRouteId,
    routeAgencyId,
    location.state?.agency,
    updateAgencyInListCache,
  ]);

  useEffect(() => {
    if (!bannerOpen) return;
    const timer = setTimeout(() => setBannerOpen(false), 3000);
    return () => clearTimeout(timer);
  }, [bannerOpen]);

  const showBanner = useCallback((type, message) => {
    setBannerType(type);
    setBannerMessage(message);
    setBannerOpen(true);
  }, []);

  const handleBack = () => navigate(listPath);

  const handleSubmit = async (form) => {
    const str = (v) => String(v ?? "").trim();
    const name = str(form.name);
    if (!name) {
      setFormError("Agency name is required.");
      return null;
    }

    setSaving(true);
    setFormError(null);

    try {
      const payload = {
        name,
        website: str(form.website) || null,
        addressLine1: str(form.addressLine1) || null,
        city: str(form.city) || null,
        state: str(form.state) || null,
        phone: str(form.phone) || null,
        logoUrl: str(form.logoUrl) || null,
      };

      if (editingId) {
        const agency = await AppApi.updateAdminAgency(editingId, payload);
        setFormInitial(agencyToFormValues(agency));
        updateAgencyInListCache(agency);
        return {agency};
      }

      const result = await AppApi.createAdminAgency({
        ...payload,
        officeName: form.officeName.trim() || null,
      });
      const agency = result?.agency;
      if (agency?.id) {
        updateAgencyInListCache(agency);
        showBanner("success", "Agency created successfully");
        navigate(
          accountUrl
            ? `/${accountUrl}/agencies/manage/${agency.id}`
            : `/agencies/manage/${agency.id}`,
          {
            replace: true,
            state: {agency},
          },
        );
      }
      return result;
    } catch (err) {
      setFormError(Array.isArray(err) ? err.join(" ") : err.message || "Failed to save agency");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleAgencyCreated = (agency) => {
    setEditingId(agency.id);
    setFormInitial(agencyToFormValues(agency));
  };

  const instantAgency = listAgencyMatchesRoute(
    location.state?.agency,
    routeAgencyId,
  )
    ? location.state.agency
    : null;

  const hasPreviewAgency =
    Boolean(instantAgency?.name?.trim()) || Boolean(formInitial.name?.trim());
  const isRouteSynced =
    routeAgencyId == null || Number(editingId) === routeAgencyId;
  const showPageSkeleton =
    !isNew &&
    !hasInvalidRouteId &&
    (navigating ||
      !isRouteSynced ||
      (loading && !hasPreviewAgency));

  return (
    <>

            <div className="fixed top-18 right-0 w-auto sm:w-full z-50">
          <Banner
            type={bannerType}
            open={bannerOpen}
            setOpen={setBannerOpen}
            className={`transition-opacity duration-600 ${
              bannerOpen ? "opacity-100" : "opacity-0"
            }`}
          >
            {bannerMessage}
          </Banner>
        </div>

        <main className="grow">
          <div className="px-3 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-2">
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
                <span className="text-lg">Agencies</span>
              </button>
              {!isNew && (
                <button
                  type="button"
                  className="btn btn-primary transition-colors duration-200 shadow-sm"
                  onClick={() =>
                    navigate(
                      accountUrl
                        ? `/${accountUrl}/agencies/manage/new`
                        : "/agencies/manage/new",
                    )
                  }
                >
                  New
                </button>
              )}
            </div>

            {!isNew && navState && navState.totalItems > 1 && (
              <div className="flex justify-end mb-2">
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                    {navState.currentIndex} / {navState.totalItems}
                  </span>
                  <button
                    type="button"
                    className="btn shadow-none p-1"
                    title="Previous agency"
                    onClick={handlePrevAgency}
                    disabled={
                      navigating ||
                      !navState.currentIndex ||
                      navState.currentIndex <= 1
                    }
                  >
                    <svg
                      className={`fill-current shrink-0 ${
                        navigating ||
                        !navState.currentIndex ||
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
                    title="Next agency"
                    onClick={handleNextAgency}
                    disabled={
                      navigating ||
                      !navState.currentIndex ||
                      navState.currentIndex >= navState.totalItems
                    }
                  >
                    <svg
                      className={`fill-current shrink-0 ${
                        navigating ||
                        !navState.currentIndex ||
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
              </div>
            )}

            <div aria-busy={showPageSkeleton}>
              {showPageSkeleton ? (
                <AgencyFormSkeleton />
              ) : (
                <AgencyFormFields
                  initialValues={formInitial}
                  editingId={editingId}
                  saving={saving}
                  formError={formError}
                  onSubmit={handleSubmit}
                  onSaveSuccess={() =>
                    showBanner("success", "Agency updated successfully")
                  }
                  onAgencyCreated={handleAgencyCreated}
                />
              )}
            </div>
          </div>
        </main>
      
  
    </>
  );
}

export default AgencyFormContainer;

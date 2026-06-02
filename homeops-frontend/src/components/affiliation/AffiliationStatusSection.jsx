import React, {useState, useEffect, useCallback} from "react";
import {Building2, Loader2} from "lucide-react";
import ModalBlank from "../ModalBlank";
import AffiliationPicker from "./AffiliationPicker";
import AppApi from "../../api/api";
import {SETTINGS_CARD} from "../../constants/layout";

const STATUS_LABELS = {
  independent: "Independent",
  affiliated: "Affiliated",
  pending_request: "Pending request",
};

const STATUS_COLORS = {
  independent: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  affiliated: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  pending_request: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

function AffiliationStatusSection({ onRefreshUser }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [requestNestedOpen, setRequestNestedOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await AppApi.getMyAffiliation();
      setData(res);
    } catch (err) {
      setError(Array.isArray(err) ? err.join(" ") : err.message || "Failed to load affiliation");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => {
      load();
      onRefreshUser?.();
    };
    window.addEventListener("opsy:affiliation-refresh", onRefresh);
    return () => window.removeEventListener("opsy:affiliation-refresh", onRefresh);
  }, [load, onRefreshUser]);

  const handleSaved = async (payload) => {
    setData(payload);
    setUpdateOpen(false);
    await onRefreshUser?.();
    await load();
  };

  const handleLeave = async () => {
    setLeaving(true);
    setError(null);
    try {
      const payload = await AppApi.leaveMyAffiliation();
      setData(payload);
      setLeaveOpen(false);
      await onRefreshUser?.();
    } catch (err) {
      setError(Array.isArray(err) ? err.join(" ") : err.message || "Failed to leave agency");
    } finally {
      setLeaving(false);
    }
  };

  const status = data?.status || "independent";
  const affiliation = data?.affiliation;
  const pending = data?.pendingRequest;

  return (
    <>
      <section className={SETTINGS_CARD.card}>
        <div className={SETTINGS_CARD.header}>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#456564] dark:text-[#5a7a78]" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Affiliation Status
            </h2>
          </div>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
            Your current agency, office, and team affiliation for branding and reporting context.
          </p>
        </div>
        <div className={`${SETTINGS_CARD.body} space-y-4`}>
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading affiliation...
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS.independent}`}
                >
                  {STATUS_LABELS[status] || status}
                </span>
              </div>
              {status === "affiliated" && affiliation && (
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Agency</dt>
                    <dd className="font-medium text-gray-900 dark:text-white mt-0.5 flex items-center gap-2">
                      {affiliation.agency?.logoDisplayUrl ? (
                        <img
                          src={affiliation.agency.logoDisplayUrl}
                          alt=""
                          className="w-8 h-8 rounded-lg object-cover border border-gray-200 dark:border-gray-600"
                        />
                      ) : null}
                      <span>{affiliation.agency?.name || "—"}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Office</dt>
                    <dd className="font-medium text-gray-900 dark:text-white mt-0.5">
                      {affiliation.office?.name || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Team</dt>
                    <dd className="font-medium text-gray-900 dark:text-white mt-0.5">
                      {affiliation.team?.name || "Independent within office"}
                    </dd>
                  </div>
                </dl>
              )}
              {status === "pending_request" && pending && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Pending {pending.requestType} request:{" "}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {pending.requestedName}
                  </span>
                </p>
              )}
              {status === "independent" && !pending && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  You are not affiliated with an agency. Your clients and properties remain tied to your account.
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUpdateOpen(true)}
                  disabled={status === "pending_request"}
                  className="btn bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50"
                >
                  Update Brokerage Affiliation
                </button>
                {status === "affiliated" && (
                  <button
                    type="button"
                    onClick={() => setLeaveOpen(true)}
                    className="btn border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Leave Current Agency
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <ModalBlank
        modalOpen={updateOpen}
        setModalOpen={(open) => {
          setUpdateOpen(open);
          if (!open) setRequestNestedOpen(false);
        }}
        contentClassName="max-w-xl overflow-visible"
        closeOnEscape={!requestNestedOpen}
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Update Brokerage Affiliation
          </h3>
          <AffiliationPicker
            onSaved={handleSaved}
            onRequestModalOpenChange={setRequestNestedOpen}
            initialAgencyId={affiliation?.agencyId}
            initialOfficeId={affiliation?.officeId}
            initialTeamId={affiliation?.teamId}
          />
        </div>
      </ModalBlank>

      <ModalBlank modalOpen={leaveOpen} setModalOpen={setLeaveOpen} contentClassName="max-w-md">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Leave Current Agency?
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            You will become independent. Your clients, properties, and history will stay on your account.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setLeaveOpen(false)}
              className="btn border-gray-200 dark:border-gray-700"
              disabled={leaving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLeave}
              disabled={leaving}
              className="btn bg-red-600 hover:bg-red-700 text-white"
            >
              {leaving ? "Leaving..." : "Leave Agency"}
            </button>
          </div>
        </div>
      </ModalBlank>
    </>
  );
}

export default AffiliationStatusSection;

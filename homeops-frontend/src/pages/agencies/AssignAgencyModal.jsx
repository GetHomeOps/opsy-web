import React, {useCallback, useEffect, useState} from "react";
import {Loader2} from "lucide-react";
import ModalBlank from "../../components/ModalBlank";
import SearchableAffiliationDropdown from "../../components/affiliation/SearchableAffiliationDropdown";
import AppApi from "../../api/api";

const SEARCH_LIMIT = 30;

/**
 * Admin modal to assign one or more agents to an agency.
 * Office is optional on first assign (server defaults to main office) but
 * can be set/changed here once an agency is selected.
 */
function AssignAgencyModal({
  open,
  onClose,
  userIds = [],
  initialAgencyId = "",
  initialOfficeId = "",
  agentName = null,
  onSaved,
}) {
  const [agencyId, setAgencyId] = useState("");
  const [officeId, setOfficeId] = useState("");
  const [agencies, setAgencies] = useState([]);
  const [offices, setOffices] = useState([]);
  const [agenciesLoading, setAgenciesLoading] = useState(false);
  const [officesLoading, setOfficesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isBulk = userIds.length > 1;
  const count = userIds.length;

  useEffect(() => {
    if (!open) return;
    setAgencyId(initialAgencyId ? String(initialAgencyId) : "");
    setOfficeId(initialOfficeId ? String(initialOfficeId) : "");
    setError(null);
    setAgencies([]);
    setOffices([]);
  }, [open, initialAgencyId, initialOfficeId, userIds.join(",")]);

  const searchAgencies = useCallback(async (q) => {
    setAgenciesLoading(true);
    try {
      const list = await AppApi.searchAffiliationAgencies(q, SEARCH_LIMIT);
      setAgencies(list || []);
    } catch {
      setAgencies([]);
    } finally {
      setAgenciesLoading(false);
    }
  }, []);

  const searchOffices = useCallback(
    async (q) => {
      if (!agencyId) return;
      setOfficesLoading(true);
      try {
        const list = await AppApi.searchAffiliationOffices(
          agencyId,
          q,
          SEARCH_LIMIT,
        );
        setOffices(list || []);
      } catch {
        setOffices([]);
      } finally {
        setOfficesLoading(false);
      }
    },
    [agencyId],
  );

  useEffect(() => {
    if (!open || !agencyId) {
      setOffices([]);
      return;
    }
    searchOffices("");
  }, [open, agencyId, searchOffices]);

  // Prefill selected agency/office into option lists so labels show immediately
  useEffect(() => {
    if (!open) return;
    if (initialAgencyId && agencies.length === 0) {
      searchAgencies("");
    }
  }, [open, initialAgencyId, agencies.length, searchAgencies]);

  const handleAgencyChange = (id) => {
    setAgencyId(String(id));
    setOfficeId("");
    setError(null);
  };

  const handleOfficeChange = (id) => {
    setOfficeId(String(id));
    setError(null);
  };

  const handleSave = async () => {
    if (!agencyId) {
      setError("Please select an agency");
      return;
    }
    if (!userIds.length) {
      setError("No agents selected");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        agencyId: Number(agencyId),
        ...(officeId ? {officeId: Number(officeId)} : {}),
      };

      if (userIds.length === 1) {
        await AppApi.assignAgentAffiliation(userIds[0], payload);
      } else {
        const result = await AppApi.bulkAssignAgentAffiliations({
          userIds,
          ...payload,
        });
        if (result.errors?.length && !result.assigned?.length) {
          throw new Error(
            result.errors[0]?.message || "Failed to assign agents",
          );
        }
        if (result.errors?.length) {
          setError(
            `Assigned ${result.summary?.assigned ?? 0} of ${result.summary?.total ?? userIds.length}. ${result.errors.length} failed.`,
          );
          onSaved?.(result);
          return;
        }
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(
        Array.isArray(err)
          ? err.join(" ")
          : err.message || "Failed to assign agency",
      );
    } finally {
      setSaving(false);
    }
  };

  const title = isBulk
    ? `Add ${count} agents to agency`
    : agentName
      ? `Assign agency — ${agentName}`
      : "Assign agency";

  return (
    <ModalBlank
      modalOpen={open}
      setModalOpen={(v) => {
        if (!v) onClose?.();
      }}
      contentClassName="max-w-lg overflow-visible"
    >
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          {isBulk
            ? "Select an agency for the selected agents. Office defaults to the agency’s main office if left blank."
            : "Select an agency. You can change the office now or leave it blank to use the main office."}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <SearchableAffiliationDropdown
            label="Agency"
            value={agencyId}
            onChange={handleAgencyChange}
            options={agencies}
            onSearch={searchAgencies}
            loading={agenciesLoading}
            placeholder="Search agencies..."
            emptyMessage="No agencies found"
          />

          <SearchableAffiliationDropdown
            label="Office"
            value={officeId}
            onChange={handleOfficeChange}
            options={offices}
            onSearch={searchOffices}
            loading={officesLoading}
            disabled={!agencyId}
            placeholder={
              agencyId
                ? "Default (main office) — or search to change"
                : "Select an agency first"
            }
            emptyMessage="No offices found"
          />
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn border-gray-200 dark:border-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !agencyId}
            className="btn btn-primary disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : isBulk ? (
              "Add to agency"
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>
    </ModalBlank>
  );
}

export default AssignAgencyModal;

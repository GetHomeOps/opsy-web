import React, {useState, useCallback, useEffect} from "react";
import {Loader2} from "lucide-react";
import AppApi from "../../api/api";
import SearchableAffiliationDropdown from "./SearchableAffiliationDropdown";
import RequestNewAffiliationModal from "./RequestNewAffiliationModal";

const INDEPENDENT_TEAM_VALUE = "__independent__";
const AFFILIATION_SEARCH_LIMIT = 30;

function AffiliationPicker({
  onSaved,
  onSkipped,
  onCancel,
  onRequestModalOpenChange,
  showSkip = false,
  initialAgencyId = "",
  initialOfficeId = "",
  initialTeamId = "",
}) {
  const [agencyId, setAgencyId] = useState(initialAgencyId || "");
  const [officeId, setOfficeId] = useState(initialOfficeId || "");
  const [teamId, setTeamId] = useState(initialTeamId || INDEPENDENT_TEAM_VALUE);

  const [agencies, setAgencies] = useState([]);
  const [offices, setOffices] = useState([]);
  const [teams, setTeams] = useState([]);

  const [agenciesLoading, setAgenciesLoading] = useState(false);
  const [officesLoading, setOfficesLoading] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState(null);

  const [requestModal, setRequestModal] = useState(null);

  useEffect(() => {
    onRequestModalOpenChange?.(!!requestModal);
  }, [requestModal, onRequestModalOpenChange]);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState(null);

  const searchAgencies = useCallback(async (q) => {
    setAgenciesLoading(true);
    try {
      const list = await AppApi.searchAffiliationAgencies(q, AFFILIATION_SEARCH_LIMIT);
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
        const list = await AppApi.searchAffiliationOffices(agencyId, q, AFFILIATION_SEARCH_LIMIT);
        setOffices(list || []);
      } catch {
        setOffices([]);
      } finally {
        setOfficesLoading(false);
      }
    },
    [agencyId],
  );

  const searchTeams = useCallback(
    async (q) => {
      if (!officeId) return;
      setTeamsLoading(true);
      try {
        const list = await AppApi.searchAffiliationTeams(officeId, q, AFFILIATION_SEARCH_LIMIT);
        setTeams(list || []);
      } catch {
        setTeams([]);
      } finally {
        setTeamsLoading(false);
      }
    },
    [officeId],
  );

  useEffect(() => {
    setOfficeId("");
    setTeamId(INDEPENDENT_TEAM_VALUE);
    setOffices([]);
    setTeams([]);
  }, [agencyId]);

  useEffect(() => {
    setTeamId(INDEPENDENT_TEAM_VALUE);
    setTeams([]);
  }, [officeId]);

  const teamOptions = [
    {
      id: INDEPENDENT_TEAM_VALUE,
      name: "No team / Independent within office",
    },
    ...teams,
  ];

  const handleAgencyChange = (id) => {
    setAgencyId(id);
    setError(null);
  };

  const handleOfficeChange = (id) => {
    setOfficeId(id);
    setError(null);
  };

  const handleTeamChange = (id) => {
    setTeamId(id);
    setError(null);
  };

  const handleSave = async () => {
    if (!agencyId || !officeId) {
      setError("Please select an agency and office.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = await AppApi.saveMyAffiliation({
        agencyId,
        officeId,
        teamId: teamId === INDEPENDENT_TEAM_VALUE ? null : teamId,
      });
      onSaved?.(payload);
    } catch (err) {
      setError(Array.isArray(err) ? err.join(" ") : err.message || "Failed to save affiliation");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSkipping(true);
    setError(null);
    try {
      await AppApi.skipAffiliationOnboarding();
      onSkipped?.();
    } catch (err) {
      setError(Array.isArray(err) ? err.join(" ") : err.message || "Failed to skip");
    } finally {
      setSkipping(false);
    }
  };

  const handleRequestSubmit = async (formData) => {
    setRequestSubmitting(true);
    setRequestError(null);
    try {
      const payload = await AppApi.createAffiliationRequest({
        requestType: requestModal,
        agencyId: agencyId || null,
        officeId: officeId || null,
        ...formData,
      });
      setRequestModal(null);
      onSaved?.(payload);
      return true;
    } catch (err) {
      setRequestError(Array.isArray(err) ? err.join(" ") : err.message || "Failed to submit request");
      return false;
    } finally {
      setRequestSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <SearchableAffiliationDropdown
        label="Agency"
        value={agencyId}
        onChange={handleAgencyChange}
        options={agencies}
        onSearch={searchAgencies}
        loading={agenciesLoading}
        placeholder="Select agency..."
        footerAction={{
          label: "My Agency is not listed (Request New Agency)",
          onClick: () => setRequestModal("agency"),
        }}
      />

      <SearchableAffiliationDropdown
        label="Office"
        value={officeId}
        onChange={handleOfficeChange}
        options={offices}
        onSearch={searchOffices}
        loading={officesLoading}
        disabled={!agencyId}
        placeholder={agencyId ? "Select office..." : "Select an agency first"}
        footerAction={
          agencyId
            ? {
                label: "My Office is not listed (Request New Office)",
                onClick: () => setRequestModal("office"),
              }
            : null
        }
      />

      <SearchableAffiliationDropdown
        label="Team"
        value={teamId}
        onChange={handleTeamChange}
        options={teamOptions}
        onSearch={searchTeams}
        loading={teamsLoading}
        disabled={!officeId}
        placeholder={officeId ? "Select team (optional)..." : "Select an office first"}
        emptyMessage="No teams listed — you can stay independent within the office"
        footerAction={
          officeId
            ? {
                label: "My Team is not listed (Request New Team)",
                onClick: () => setRequestModal("team"),
              }
            : null
        }
      />

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || skipping}
          className="btn bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Affiliation
        </button>
        {showSkip && (
          <>
            <button
              type="button"
              onClick={() => onCancel?.()}
              disabled={saving || skipping}
              className="btn border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={saving || skipping}
              className="btn border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
            >
              {skipping ? "Skipping..." : "Skip for now"}
            </button>
          </>
        )}
      </div>

      <RequestNewAffiliationModal
        open={!!requestModal}
        onClose={() => {
          setRequestModal(null);
          setRequestError(null);
        }}
        requestType={requestModal}
        onSubmit={handleRequestSubmit}
        submitting={requestSubmitting}
        error={requestError}
      />
    </div>
  );
}

export default AffiliationPicker;

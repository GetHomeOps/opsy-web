import React, {useEffect, useMemo, useState} from "react";
import {UserPlus, X, UserCog, Home, Users, Mail, Send, Check, AlertCircle, RefreshCw} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";
import SelectDropdown from "../../contacts/SelectDropdown";
import {useTranslation} from "react-i18next";
import useCurrentAccount from "../../../hooks/useCurrentAccount";
import AppApi from "../../../api/api";

const MEMBER_ROLES = [
  {id: "Mortgage Partner", name: "Mortgage Agent"},
  {id: "Insurer", name: "Insurance Agent"},
];

/* Converts a user to a member (use image_url for display when available) */
const toMember = (u, roleOverride) => ({
  id: u.id,
  name: u.name ?? "User",
  role: roleOverride ?? u.role ?? "Member",
  image: u.image_url ?? u.image ?? u.avatar,
});

/* HomeOps Team Modal Component */
function HomeOpsTeamModal({
  modalOpen,
  setModalOpen,
  teamMembers = [],
  users = [],
  propertyId,
  onSave,
  creatorId,
  canEditAgent = true,
}) {
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [homeownerSlots, setHomeownerSlots] = useState([""]);
  const [additionalMembers, setAdditionalMembers] = useState([]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(null);
  const [inviteError, setInviteError] = useState(null);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [resendingId, setResendingId] = useState(null);

  const {currentAccount} = useCurrentAccount();
  const {t} = useTranslation();

  /* Current agent from team (for read-only display when homeowner has no user list access) */
  const currentAgentMember = useMemo(
    () =>
      teamMembers.find(
        (m) =>
          (m.role ?? "").toLowerCase() === "agent" ||
          (m.role ?? "").toLowerCase() === "admin",
      ),
    [teamMembers],
  );

  /* Creator (e.g. current user on new property) cannot be removed from team */
  const creatorMember = creatorId
    ? teamMembers.find((m) => String(m.id) === String(creatorId))
    : null;
  const creatorRoleLower = (creatorMember?.role ?? "").toLowerCase();
  /* Property admin (role on this property) or only member cannot be removed */
  const propertyAdminId = teamMembers.find(
    (m) => (m.property_role ?? m.role ?? "").toLowerCase() === "admin",
  )?.id;
  const isOnlyMember = teamMembers.length === 1;
  const isAgentSlotLocked =
    (Boolean(creatorId && creatorMember) &&
      (creatorRoleLower === "agent" || creatorRoleLower === "admin")) ||
    (selectedAgentId &&
      (String(selectedAgentId) === String(propertyAdminId) || isOnlyMember));

  /* Filters the users to only include agents */
  const agents = useMemo(
    () =>
      users.filter(
        (u) =>
          (u.role ?? "").toLowerCase() === "agent" ||
          (u.role ?? "").toLowerCase() === "admin" ||
          (u.role ?? "").toLowerCase() === "super_admin",
      ),
    [users],
  );

  /* Maps the agents to options for the select dropdown */
  const homeowners = useMemo(
    () => users.filter((u) => (u.role ?? "").toLowerCase() === "homeowner"),
    [users],
  );

  /* Maps the agents to options for the select dropdown */
  const agentOptions = useMemo(
    () => agents.map((u) => ({id: u.id, name: u.name})),
    [agents],
  );

  /* Agent options excluding users already in the team (homeowner or additional member) so the same user cannot be added twice. Include current agent so dropdown can display selection. */
  const agentOptionsFiltered = useMemo(() => {
    const alreadyInTeam = new Set([
      ...homeownerSlots.filter(Boolean).map(String),
      ...additionalMembers.map((m) => m.userId).filter(Boolean).map(String),
    ]);
    const filtered = agentOptions.filter((o) => !alreadyInTeam.has(String(o.id)));
    if (selectedAgentId && !filtered.some((o) => String(o.id) === String(selectedAgentId))) {
      const current = agentOptions.find((o) => String(o.id) === String(selectedAgentId));
      if (current) filtered.push(current);
    }
    return filtered;
  }, [agentOptions, homeownerSlots, additionalMembers, selectedAgentId]);

  /* Maps the homeowners to options for the select dropdown */
  const homeownerOptionsBase = useMemo(
    () => homeowners.map((u) => ({id: u.id, name: u.name})),
    [homeowners],
  );

  /* Excludes the selected agent and the homeowners and team members already in the homeowner slot */
  const excludedForHomeownerSlot = (idx) => {
    const o = new Set([String(selectedAgentId)].filter(Boolean));
    homeownerSlots.forEach((id, i) => {
      if (i !== idx && id) o.add(String(id));
    });
    additionalMembers.forEach((m) => {
      if (m.userId) o.add(String(m.userId));
    });
    return o;
  };

  /* Excludes the selected agent and the homeowners and team members already in the team member row */
  const excludedForMemberRow = (idx) => {
    const o = new Set([String(selectedAgentId)].filter(Boolean));
    homeownerSlots.forEach((id) => {
      if (id) o.add(String(id));
    });
    additionalMembers.forEach((m, i) => {
      if (i !== idx && m.userId) o.add(String(m.userId));
    });
    return o;
  };

  /* Sets the selected agent, homeowners, and team members when the modal is opened */
  useEffect(() => {
    if (!modalOpen) return;
    const agent = teamMembers.find(
      (m) =>
        (m.role ?? "").toLowerCase() === "agent" ||
        (m.role ?? "").toLowerCase() === "admin",
    );
    const h = teamMembers.filter(
      (m) => (m.role ?? "").toLowerCase() === "homeowner",
    );
    const others = teamMembers.filter(
      (m) =>
        (m.role ?? "").toLowerCase() !== "agent" &&
        (m.role ?? "").toLowerCase() !== "admin" &&
        (m.role ?? "").toLowerCase() !== "homeowner",
    );
    setSelectedAgentId(agent?.id ?? "");
    setHomeownerSlots(h.length ? h.map((m) => m.id) : [""]);
    setAdditionalMembers(
      others.length
        ? others.map((m) => ({
            userId: m.id,
            role: MEMBER_ROLES.some((r) => r.id === m.role)
              ? m.role
              : "Mortgage Partner",
          }))
        : [],
    );
  }, [modalOpen, teamMembers]);

  useEffect(() => {
    if (!modalOpen) return;
    setInviteEmail("");
    setInviteSuccess(null);
    setInviteError(null);
    if (propertyId) {
      AppApi.getPropertyInvitations(propertyId)
        .then((invs) => setPendingInvitations((invs || []).filter((i) => i.status === "pending")))
        .catch(() => setPendingInvitations([]));
    }
  }, [modalOpen, propertyId]);

  const handleSendInvite = async () => {
    if (!inviteEmail || !propertyId || !currentAccount?.id) return;
    const emailLower = inviteEmail.trim().toLowerCase();
    const alreadyInTeam = (teamMembers ?? []).some((m) => {
      const mEmail = (m.email ?? m.inviteeEmail ?? "").trim().toLowerCase();
      return mEmail && mEmail === emailLower;
    });
    const alreadyPending = (pendingInvitations ?? []).some((i) => {
      const iEmail = (i.invitee_email ?? i.inviteeEmail ?? "").trim().toLowerCase();
      return iEmail && iEmail === emailLower;
    });
    if (alreadyInTeam || alreadyPending) {
      setInviteError("This person is already on the team or has a pending invitation.");
      return;
    }
    setInviteSending(true);
    setInviteSuccess(null);
    setInviteError(null);
    try {
      await AppApi.createInvitation({
        type: "property",
        inviteeEmail: inviteEmail,
        accountId: currentAccount.id,
        propertyId,
        intendedRole: inviteRole,
      });
      setInviteSuccess(inviteEmail);
      setInviteEmail("");
      const invs = await AppApi.getPropertyInvitations(propertyId);
      setPendingInvitations((invs || []).filter((i) => i.status === "pending"));
    } catch (err) {
      setInviteError(err?.message || "Failed to send invitation");
    } finally {
      setInviteSending(false);
    }
  };

  const handleResendInvitation = async (inv) => {
    setResendingId(inv.id);
    setInviteError(null);
    try {
      await AppApi.resendInvitation(inv.id);
      setInviteSuccess(inv.invitee_email || inv.inviteeEmail || "Invitation resent");
      setTimeout(() => setInviteSuccess(null), 3000);
    } catch (err) {
      setInviteError(err?.message || (t("invitations.resendError") || "Error resending invitation"));
    } finally {
      setResendingId(null);
    }
  };

  const setHomeownerSlot = (idx, value) => {
    setHomeownerSlots((prev) => {
      const next = [...prev];
      next[idx] = value ?? "";
      return next;
    });
  };

  /* Adds a new homeowner row */
  const addHomeownerSlot = () => {
    setHomeownerSlots((prev) => [...prev, ""]);
  };

  /* Removes a homeowner row */
  const removeHomeownerSlot = (idx) => {
    if (homeownerSlots.length <= 1) return;
    setHomeownerSlots((prev) => prev.filter((_, i) => i !== idx));
  };

  /* Adds a new team member row */
  const addMemberRow = () => {
    setAdditionalMembers((prev) => [
      ...prev,
      {userId: "", role: "Mortgage Partner"},
    ]);
  };

  /* Sets the selected team member when the team member row is changed */
  const setMemberRow = (idx, patch) => {
    setAdditionalMembers((prev) => {
      const next = [...prev];
      next[idx] = {...next[idx], ...patch};
      return next;
    });
  };

  /* Removes a team member row */
  const removeMemberRow = (idx) => {
    setAdditionalMembers((prev) => prev.filter((_, i) => i !== idx));
  };

  /* Handles the save of the team */
  const handleSave = () => {
    const team = [];
    const agent = agents.find((a) => String(a.id) === String(selectedAgentId));
    if (agent) {
      team.push(toMember(agent));
    } else if (currentAgentMember && !canEditAgent) {
      /* Homeowner cannot edit agent; preserve existing agent from team */
      team.push(currentAgentMember);
    }
    homeownerSlots.forEach((id) => {
      if (!id) return;
      const u = homeowners.find((h) => String(h.id) === String(id));
      if (u) team.push(toMember(u, "Homeowner"));
    });

    additionalMembers.forEach(({userId, role}) => {
      if (!userId) return;
      const u = users.find((x) => String(x.id) === String(userId));
      if (u) team.push(toMember(u, role));
    });

    /* Ensure creator is never dropped (e.g. when creatorId is set on new property) */
    if (creatorId && creatorMember && !team.some((m) => String(m.id) === String(creatorId))) {
      team.unshift(creatorMember);
    }

    onSave?.(team);
    setModalOpen(false);
  };

  return (
    <ModalBlank
      id="homeops-team-modal"
      modalOpen={modalOpen}
      setModalOpen={setModalOpen}
      closeOnClickOutside={false}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-6 pb-1 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Edit team
          </h2>
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Agent */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <UserCog className="w-4 h-4 text-[#456654]" />
              Agent
            </label>
            {canEditAgent ? (
              <SelectDropdown
                options={agentOptionsFiltered}
                value={selectedAgentId}
                onChange={(v) => setSelectedAgentId(v ?? "")}
                placeholder="Select an agent"
                name="agent"
                id="team-agent"
                clearable={!isAgentSlotLocked}
              />
            ) : (
              <div className="form-select w-full py-2 px-3 pr-10 text-sm text-gray-800 dark:text-gray-100 leading-5 truncate cursor-default">
                {currentAgentMember?.name ?? "—"}
              </div>
            )}
          </div>

          {/* Homeowners */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Home className="w-4 h-4 text-[#456654]" />
              Homeowner
            </label>
            <div className="space-y-3">
              {homeownerSlots.map((val, idx) => (
                <HomeownerRow
                  key={idx}
                  idx={idx}
                  value={val}
                  onChange={(v) => setHomeownerSlot(idx, v)}
                  onRemove={() => removeHomeownerSlot(idx)}
                  canRemove={
                    homeownerSlots.length > 1 &&
                    val !== String(creatorId) &&
                    val !== String(propertyAdminId) &&
                    !isOnlyMember
                  }
                  homeownerOptionsBase={homeownerOptionsBase}
                  excluded={excludedForHomeownerSlot(idx)}
                  clearable={
                    val !== String(creatorId) &&
                    val !== String(propertyAdminId) &&
                    !isOnlyMember
                  }
                />
              ))}
              <button
                type="button"
                onClick={addHomeownerSlot}
                className="btn-sm border border-[#456654] text-[#456654] hover:bg-[#456654] hover:text-white transition-colors inline-flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                Add new homeowner
              </button>
            </div>
          </div>

          {/* Team members */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Users className="w-4 h-4 text-[#456654]" />
              Team members
            </label>
            <div className="space-y-3">
              {additionalMembers.map((row, idx) => (
                <MemberRow
                  key={idx}
                  idx={idx}
                  userId={row.userId}
                  role={row.role}
                  onUserIdChange={(v) => setMemberRow(idx, {userId: v ?? ""})}
                  onRoleChange={(v) =>
                    setMemberRow(idx, {role: v ?? "Mortgage Partner"})
                  }
                  onRemove={() => removeMemberRow(idx)}
                  canRemove={
                    row.userId !== String(propertyAdminId) && !isOnlyMember
                  }
                  users={users}
                  excluded={excludedForMemberRow(idx)}
                />
              ))}
              <button
                type="button"
                onClick={addMemberRow}
                className="btn-sm bg-[#456654] hover:bg-[#34514f] text-white transition-colors inline-flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Invite new member by email */}
        {propertyId && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Mail className="w-4 h-4 text-[#456654]" />
              Invite new member
            </label>
            <div className="flex gap-2 items-start flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="form-input w-full text-sm"
                />
              </div>
              <div className="w-32 shrink-0">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="form-select w-full text-sm"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleSendInvite}
                disabled={inviteSending || !inviteEmail}
                className="btn-sm bg-[#456654] hover:bg-[#34514f] text-white transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {inviteSending ? "Sending..." : "Invite"}
              </button>
            </div>
            {inviteSuccess && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                Invitation sent to {inviteSuccess}
              </div>
            )}
            {inviteError && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-3.5 h-3.5" />
                {inviteError}
              </div>
            )}
            {pendingInvitations.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  {t("invitations.statusPending") || "Pending invitations"}
                </p>
                <div className="space-y-1">
                  {pendingInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between gap-2 py-1.5 px-2 bg-gray-50 dark:bg-gray-800 rounded text-xs"
                    >
                      <span className="text-gray-700 dark:text-gray-300 truncate flex-1 min-w-0">
                        {inv.invitee_email || inv.inviteeEmail}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500 shrink-0">
                        {inv.intended_role || inv.intendedRole || "editor"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleResendInvitation(inv)}
                        disabled={resendingId === inv.id}
                        className="shrink-0 inline-flex items-center gap-1 text-[#456564] dark:text-[#5a7a78] hover:underline font-medium disabled:opacity-50"
                      >
                        {resendingId === inv.id ? (
                          <span className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        {t("invitations.resendInvitationEmail") || "Resend Invitation Email"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="btn border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn bg-[#456654] hover:bg-[#34514f] text-white"
          >
            {t(`accept`)}
          </button>
        </div>
      </div>
    </ModalBlank>
  );
}

function HomeownerRow({
  idx,
  value,
  onChange,
  onRemove,
  canRemove,
  homeownerOptionsBase,
  excluded,
  clearable = true,
}) {
  const options = useMemo(
    () => homeownerOptionsBase.filter((o) => !excluded.has(String(o.id))),
    [homeownerOptionsBase, excluded],
  );
  return (
    <div className="flex gap-2 items-center flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <SelectDropdown
          options={options}
          value={value}
          onChange={onChange}
          placeholder="Select a homeowner"
          name={`homeowner-${idx}`}
          id={`team-homeowner-${idx}`}
          clearable={clearable}
        />
      </div>
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          aria-label="Remove homeowner slot"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/* Team Member Row */
function MemberRow({
  idx,
  userId,
  role,
  onUserIdChange,
  onRoleChange,
  onRemove,
  canRemove = true,
  users,
  excluded,
}) {
  const userOptions = useMemo(
    () =>
      users
        .filter((u) => !excluded.has(String(u.id)))
        .map((u) => ({id: u.id, name: u.name})),
    [users, excluded],
  );
  return (
    <div className="flex gap-2 items-center flex-wrap">
      <div className="flex-1 min-w-[180px]">
        <SelectDropdown
          options={userOptions}
          value={userId}
          onChange={onUserIdChange}
          placeholder="Select a user"
          name={`member-user-${idx}`}
          id={`team-member-user-${idx}`}
          clearable={true}
        />
      </div>
      <div className="w-40 shrink-0">
        <SelectDropdown
          options={MEMBER_ROLES}
          value={role}
          onChange={onRoleChange}
          placeholder="Role"
          name={`member-role-${idx}`}
          id={`team-member-role-${idx}`}
          clearable={false}
        />
      </div>
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          aria-label="Remove member"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default HomeOpsTeamModal;

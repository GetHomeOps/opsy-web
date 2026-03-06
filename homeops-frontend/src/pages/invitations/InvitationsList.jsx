import React, {useState, useEffect} from "react";
import {Link, useNavigate} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {UserPlus, Mail, Check, X, Home, Building2, ChevronRight} from "lucide-react";
import AppApi from "../../api/api";
import useCurrentAccount from "../../hooks/useCurrentAccount";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function InvitationsList() {
  const {t} = useTranslation();
  const {currentAccount} = useCurrentAccount();
  const navigate = useNavigate();
  const [received, setReceived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acceptingId, setAcceptingId] = useState(null);
  const [decliningId, setDecliningId] = useState(null);

  const accountUrl = currentAccount?.url || "";

  useEffect(() => {
    let cancelled = false;
    async function fetchReceived() {
      setLoading(true);
      setError(null);
      try {
        const invs = await AppApi.getReceivedInvitations();
        if (!cancelled) setReceived(invs || []);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || t("invitations.fetchError") || "Error loading invitations");
          setReceived([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchReceived();
    return () => { cancelled = true; };
  }, [t]);

  const handleAccept = async (inv) => {
    setAcceptingId(inv.id);
    try {
      await AppApi.acceptInvitationInApp(inv.id);
      setReceived((prev) => prev.filter((i) => i.id !== inv.id));
      if (inv.type === "property" && (inv.propertyUid || inv.propertyId) && accountUrl) {
        navigate(`/${accountUrl}/properties/${inv.propertyUid || inv.propertyId}`);
      } else {
        navigate(accountUrl ? `/${accountUrl}/home` : "/");
      }
    } catch (err) {
      setError(err?.message || "Failed to accept invitation");
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDecline = async (inv) => {
    setDecliningId(inv.id);
    try {
      await AppApi.declineInvitation(inv.id);
      setReceived((prev) => prev.filter((i) => i.id !== inv.id));
    } catch (err) {
      setError(err?.message || "Failed to decline invitation");
    } finally {
      setDecliningId(null);
    }
  };

  return (
    <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-9xl mx-auto">
      <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold mb-8">
        {t("invitations.title") || "Invitations"}
      </h1>

      <div className="space-y-6">
        <section className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#456564] dark:text-[#5a7a78]" />
            {t("invitations.newInvitation") || "Invitations for you"}
          </h2>

          {loading ? (
            <p className="text-gray-500 dark:text-gray-400 py-4">
              {t("invitations.loading") || "Loading…"}
            </p>
          ) : error ? (
            <p className="text-red-500 dark:text-red-400 py-4">{error}</p>
          ) : received.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 py-4">
              {t("invitations.noInvitationsFound") || "No invitations yet."}
            </p>
          ) : (
            <ul className="space-y-4">
              {received.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-600/60 bg-gray-50/50 dark:bg-gray-700/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {inv.type === "property" ? (
                        <Building2 className="w-4 h-4 text-[#456564] dark:text-[#5a7a78] shrink-0" />
                      ) : (
                        <UserPlus className="w-4 h-4 text-[#456564] dark:text-[#5a7a78] shrink-0" />
                      )}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {inv.inviterName || "Someone"} invited you
                        {inv.type === "property"
                          ? ` to join a property${inv.propertyAddress ? `: ${inv.propertyAddress}` : ""}`
                          : ` to join ${inv.accountName || "an account"}`}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {formatDate(inv.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {inv.type === "property" && (inv.propertyUid || inv.propertyId) && accountUrl ? (
                      <Link
                        to={`/${accountUrl}/properties/${inv.propertyUid || inv.propertyId}?invitation=${inv.id}`}
                        className="btn bg-[#456564] hover:bg-[#3d5857] dark:bg-[#5a7a78] dark:hover:bg-[#4d6a68] text-white inline-flex items-center gap-2"
                      >
                        View property & respond <ChevronRight className="w-4 h-4" />
                      </Link>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAccept(inv)}
                          disabled={acceptingId === inv.id || decliningId === inv.id}
                          className="btn bg-[#456564] hover:bg-[#3d5857] dark:bg-[#5a7a78] dark:hover:bg-[#4d6a68] text-white inline-flex items-center gap-2"
                        >
                          {acceptingId === inv.id ? (
                            <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecline(inv)}
                          disabled={acceptingId === inv.id || decliningId === inv.id}
                          className="btn border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                        >
                          {decliningId === inv.id ? (
                            <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-gray-500 border-t-transparent" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-6">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {t("invitations.allInvitations") || "All invitations"} — You can accept or decline property and account invitations from here.
          </p>
          {accountUrl && (
            <Link
              to={`/${accountUrl}/home`}
              className="inline-flex items-center gap-2 mt-4 text-[#456564] dark:text-[#5a7a78] font-medium hover:underline"
            >
              <Home className="w-4 h-4" />
              Back to home
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}

export default InvitationsList;

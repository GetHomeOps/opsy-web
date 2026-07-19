import React, {useEffect, useState} from "react";
import {Link, useNavigate, useParams} from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  Home,
  LayoutDashboard,
  Lightbulb,
  Wrench,
} from "lucide-react";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import SectionCard from "../properties/partials/passport/SectionCard";
import EmptyStateCard from "../properties/partials/passport/EmptyStateCard";
import PrePurchaseShell from "./PrePurchaseShell";
import PrePurchaseSetupModal from "./PrePurchaseSetupModal";

const TAB_PREVIEW = [
  {id: "overview", label: "Overview", icon: LayoutDashboard},
  {id: "identity", label: "Identity", icon: Home},
  {id: "systems", label: "Systems", icon: Wrench},
  {id: "issues", label: "Issues", icon: ClipboardList},
  {id: "recommendations", label: "Recommendations", icon: Lightbulb},
  {id: "documents", label: "Documents", icon: FileText},
];

/**
 * New pre-purchase analysis: empty profile shell + setup modal
 * (Identity → Details → Inspection), mirroring new-property setup.
 */
export default function PrePurchaseNewAnalysis() {
  const {accountUrl} = useParams();
  const navigate = useNavigate();
  const {currentAccount} = useCurrentAccount();

  const [modalOpen, setModalOpen] = useState(false);
  const [shellIdentity, setShellIdentity] = useState(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    setModalOpen(true);
  }, []);

  function goToDashboard() {
    navigate(`/${accountUrl}/pre-purchase`);
  }

  function handleComplete(analysisId) {
    setCompleting(true);
    navigate(`/${accountUrl}/pre-purchase/${analysisId}`, {replace: true});
  }

  const shellTitle =
    shellIdentity?.propertyName?.trim() ||
    shellIdentity?.addressLine1?.trim() ||
    shellIdentity?.address?.trim() ||
    "New Analysis";
  const shellAddress =
    [
      shellIdentity?.addressLine1 || shellIdentity?.address,
      [shellIdentity?.city, shellIdentity?.state, shellIdentity?.zip]
        .filter(Boolean)
        .join(", "),
    ]
      .filter(Boolean)
      .join(" · ") || "—";

  return (
    <PrePurchaseShell>
      <div className="space-y-4">
        <nav className="text-xs text-neutral-500 flex items-center gap-1.5 flex-wrap">
          <Link
            to={`/${accountUrl}/pre-purchase`}
            className="hover:text-[#456564] inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
            Opsy Scout
          </Link>
          <span aria-hidden>/</span>
          <span className="text-neutral-700 dark:text-neutral-300">New Analysis</span>
        </nav>

        <SectionCard flat className="!shadow-none">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white truncate">
              {shellTitle}
            </h1>
            <p className="text-sm text-neutral-500 mt-1">{shellAddress}</p>
            <p className="text-xs text-neutral-500 mt-2">
              Complete setup to create this Opsy Scout profile and optionally
              upload an inspection report.
            </p>
          </div>
        </SectionCard>

        <div
          className="flex gap-1 overflow-x-auto border-b border-neutral-200 dark:border-neutral-700 -mx-1 px-1 opacity-60 pointer-events-none"
          role="tablist"
          aria-label="Analysis sections"
          aria-disabled="true"
        >
          {TAB_PREVIEW.map((t) => {
            const Icon = t.icon;
            const active = t.id === "overview";
            return (
              <span
                key={t.id}
                className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 ${
                  active
                    ? "border-[#456564] text-[#456564]"
                    : "border-transparent text-neutral-500"
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden />
                {t.label}
              </span>
            );
          })}
        </div>

        <EmptyStateCard
          icon={FileText}
          title="Complete setup to continue"
          description="Add an address, look up public-records details, then upload an inspection report as the final step. Analysis starts automatically after upload."
        />
      </div>

      <PrePurchaseSetupModal
        modalOpen={modalOpen}
        setModalOpen={(open) => {
          setModalOpen(open);
          if (!open && !completing) goToDashboard();
        }}
        accountId={currentAccount?.id}
        onIdentityChange={setShellIdentity}
        onComplete={handleComplete}
        onCancel={goToDashboard}
      />
    </PrePurchaseShell>
  );
}

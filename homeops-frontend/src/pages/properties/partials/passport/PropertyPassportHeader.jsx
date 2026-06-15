import React, {useState} from "react";
import {
  Shield,
  MapPin,
  Copy,
  Check,
  Bed,
  Bath,
  Building2,
  Calendar,
  Ruler,
} from "lucide-react";
import Tooltip from "../../../../utils/Tooltip";
import OpsyHead from "../../../../images/opsy_head.png";
import {PASSPORT_CARD_SHADOW} from "./SectionCard";

const currencyFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function SpecCell({icon: Icon, label, value, hasDivider = false}) {
  const display = value != null && value !== "" ? String(value) : "—";

  return (
    <div
      className={`relative flex items-center justify-center gap-2.5 px-3 py-3.5 min-w-0 ${
        hasDivider
          ? "before:absolute before:left-0 before:top-1/2 before:h-10 before:w-px before:-translate-y-1/2 before:bg-neutral-200/90 dark:before:bg-neutral-700/70"
          : ""
      }`}
    >
      <Icon className="w-[18px] h-[18px] text-neutral-400 dark:text-neutral-500 shrink-0" />
      <div className="min-w-0 flex flex-col gap-0.5">
        <span className="text-[15px] font-bold text-neutral-900 dark:text-white leading-none truncate">
          {display}
        </span>
        <span
          className="text-xs text-neutral-500 dark:text-neutral-400 leading-tight truncate"
          title={label}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

function PropertySpecRow({cardData, sqft, propertyType}) {
  return (
    <div className="grid grid-cols-5">
      <SpecCell
        icon={Bed}
        label="Bedrooms"
        value={cardData.rooms ?? cardData.bedCount ?? null}
      />
      <SpecCell
        icon={Bath}
        label="Bathrooms"
        value={cardData.bathrooms ?? cardData.bathCount ?? null}
        hasDivider
      />
      <SpecCell
        icon={Ruler}
        label="Sq Ft"
        value={sqft != null ? Number(sqft).toLocaleString() : null}
        hasDivider
      />
      <SpecCell
        icon={Calendar}
        label="Year Built"
        value={cardData.yearBuilt ?? null}
        hasDivider
      />
      <SpecCell
        icon={Building2}
        label="Type"
        value={propertyType}
        hasDivider
      />
    </div>
  );
}

/**
 * Compact persistent header for the Property Passport workspace.
 * Purely presentational — image upload is passed in as a rendered slot so all
 * upload state and handlers stay in PropertyFormContainer.
 */
function PropertyPassportHeader({
  cardData = {},
  imageSlot,
  hasImage,
  headerRef,
  opsymizationSlot,
}) {
  const [addressCopied, setAddressCopied] = useState(false);

  const addressText =
    cardData.fullAddress ||
    cardData.address ||
    [cardData.city, cardData.state, cardData.zip].filter(Boolean).join(", ") ||
    "—";
  const sqft = cardData.squareFeet ?? cardData.sqFtTotal;
  const propertyType = cardData.propertyType || cardData.occupantType || null;
  const passportId = cardData.passportId ?? cardData.passport_id ?? null;

  const handleCopyAddress = () => {
    if (!addressText || addressText === "—") return;
    navigator.clipboard?.writeText?.(addressText);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 1500);
  };

  return (
    <section
      ref={headerRef}
      className="rounded-2xl overflow-hidden border border-neutral-200/80 bg-white dark:border-neutral-700/50 dark:bg-neutral-900"
      style={{boxShadow: PASSPORT_CARD_SHADOW}}
    >
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        {/* Property image — shorter on small screens; fixed width + aspect ratio on lg+ */}
        <div className="w-full lg:w-80 xl:w-96 shrink-0 px-4 pt-4 pb-2 lg:p-4 lg:pr-0 lg:flex lg:items-center">
          <div
            className={`relative w-full aspect-[16/9] sm:aspect-[2/1] lg:aspect-[4/3] rounded-xl overflow-hidden border transition-all duration-300 ${
              hasImage
                ? "border-neutral-200/80 dark:border-neutral-600/50 bg-neutral-50/50 dark:bg-neutral-800/30 shadow-sm"
                : "border-2 border-dashed border-neutral-200 dark:border-neutral-600 bg-neutral-50/30 dark:bg-neutral-800/20"
            }`}
          >
            <div className="absolute inset-0">{imageSlot}</div>
          </div>
        </div>

        {/* Property identity */}
        <div className="flex-1 min-w-0 flex flex-col px-4 md:px-6 py-4 lg:py-5 lg:min-h-[220px]">
          <div className="flex items-center gap-2 shrink-0">
            <span className="relative inline-flex">
              <Shield className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-white dark:border-neutral-900" />
            </span>
            <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.12em]">
              Opsy Digital Passport
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-center min-h-0 py-3 lg:py-4">
            {cardData.propertyName && (
              <h1 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-white tracking-tight leading-tight antialiased truncate mb-1">
                {cardData.propertyName}
              </h1>
            )}

            <div
              className={`flex items-center gap-1.5 min-w-0 ${
                cardData.propertyName
                  ? "text-sm text-neutral-600 dark:text-neutral-400"
                  : "text-xl md:text-2xl font-bold text-neutral-900 dark:text-white tracking-tight leading-tight antialiased"
              }`}
            >
              {cardData.propertyName && (
                <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              )}
              <span className="truncate">{addressText}</span>
              {addressText !== "—" && (
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="shrink-0 p-0.5 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                  title="Copy address"
                  aria-label="Copy address"
                >
                  {addressCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-[0.12em]">
                Passport ID:
              </span>
              <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                {passportId ?? "—"}
              </span>
            </div>
          </div>

          <div className="shrink-0 -mx-4 md:-mx-6 mt-2 lg:mt-3 border-t border-neutral-200/90 dark:border-neutral-700/60 max-[1350px]:hidden">
            <PropertySpecRow
              cardData={cardData}
              sqft={sqft}
              propertyType={propertyType}
            />
          </div>
        </div>

        {/* Opsymization status — right rail */}
        <div className="flex flex-col items-center justify-center gap-3 shrink-0 border-t lg:border-t-0 lg:border-l border-neutral-100 dark:border-neutral-800 px-4 py-4 lg:px-6 lg:w-64 xl:w-72">
          <Tooltip
            className="pl-0 inline-flex shrink-0"
            position="left"
            size="xl"
            gap={16}
            panelClassName="!min-w-0 !w-fit !max-w-sm !px-2.5"
            content="Your property is currently in Opsymization. This critical phase is building your comprehensive HomeOps Passport Score—your key to smarter, proactive home management. Available soon."
          >
            <img
              src={OpsyHead}
              alt="Opsy — Opsymizing your property"
              className="w-20 h-20 object-contain"
            />
          </Tooltip>
          {opsymizationSlot && (
            <div className="flex justify-center shrink-0">
              {opsymizationSlot}
            </div>
          )}
        </div>
      </div>

      <div className="hidden max-[1350px]:block border-t border-neutral-200/90 dark:border-neutral-700/60">
        <PropertySpecRow
          cardData={cardData}
          sqft={sqft}
          propertyType={propertyType}
        />
      </div>

      {cardData.price != null && cardData.price !== "" && (
        <div className="flex items-center justify-between px-4 md:px-5 py-2.5 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
          <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-[0.12em]">
            Estimated Value
          </span>
          <span className="text-base font-semibold text-neutral-900 dark:text-white tabular-nums">
            {currencyFormat.format(cardData.price)}
          </span>
        </div>
      )}
    </section>
  );
}

export default PropertyPassportHeader;

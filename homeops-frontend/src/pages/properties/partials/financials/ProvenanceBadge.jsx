import React from "react";
import {StatusBadge} from "../passport/StatusBadge";
import {sourceLabel} from "./financialsFormat";

/** Understated provenance pill. Hidden when source is unknown. */
function ProvenanceBadge({source, className = ""}) {
  const label = sourceLabel(source);
  if (!label) return null;
  return (
    <StatusBadge tone="neutral" className={`uppercase tracking-[0.06em] font-semibold ${className}`}>
      {label}
    </StatusBadge>
  );
}

export default ProvenanceBadge;

import React, {useState} from "react";
import {Sparkles, FileText, Loader2} from "lucide-react";
import SectionCard from "../passport/SectionCard";
import AppApi from "../../../../api/api";
import {formatAnalysisValue} from "../documents/documentAnalysisModalShared";

function sourceDocumentForItem(item, propertyDocuments = []) {
  const source = item?.source;
  if (!source) return null;
  const docId = source.propertyDocumentId ?? source.property_document_id;
  if (docId != null) {
    const match = propertyDocuments.find((d) => String(d.id) === String(docId));
    if (match) return match;
  }
  return {
    document_name: source.documentName || source.document_name || null,
    document_key: source.documentKey || source.document_key || null,
  };
}

export function SystemAdditionalDetailsCard({
  items = [],
  propertyDocuments = [],
}) {
  const [openingKey, setOpeningKey] = useState(null);

  const handleOpenSource = async (doc) => {
    const key = doc?.document_key ?? doc?.documentKey;
    if (!key) return;
    setOpeningKey(key);
    try {
      const url = await AppApi.getPresignedPreviewUrl(key);
      if (url) window.open(url, "_blank", "noopener");
    } catch {
      // Preview unavailable
    } finally {
      setOpeningKey(null);
    }
  };

  return (
    <SectionCard
      flat
      title="Additional Details"
      icon={Sparkles}
      bodyClassName="max-h-56 overflow-y-auto"
    >
      {items.length > 0 ? (
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {items.map((item, index) => {
            const sourceDoc = sourceDocumentForItem(item, propertyDocuments);
            const sourceName =
              sourceDoc?.document_name ||
              sourceDoc?.documentName ||
              item.source?.documentName ||
              null;
            const sourceKey = sourceDoc?.document_key || sourceDoc?.documentKey;
            const isOpening = openingKey && openingKey === sourceKey;
            return (
              <li
                key={item.id || `${item.label}-${index}`}
                className="py-2.5 first:pt-0 last:pb-0"
              >
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {item.label || "Detail"}
                </p>
                <p className="text-sm text-neutral-800 dark:text-neutral-200 mt-0.5 whitespace-pre-wrap break-words">
                  {formatAnalysisValue(item.value, {
                    fieldKey: item.fieldKey,
                    label: item.label,
                  })}
                </p>
                {sourceName && (
                  <button
                    type="button"
                    onClick={() => sourceKey && handleOpenSource(sourceDoc)}
                    disabled={!sourceKey || isOpening}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#456564] hover:underline disabled:no-underline disabled:text-neutral-400"
                  >
                    {isOpening ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <FileText className="w-3 h-3" />
                    )}
                    {sourceName}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No additional details yet. Analyze a document to add manufacturer,
          cost, model, and other facts that are not part of the standard system
          fields.
        </p>
      )}
    </SectionCard>
  );
}

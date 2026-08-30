import React from "react";
import InspectionReportItemsTable from "./InspectionReportItemsTable";
import RecommendedItemsTable, {
  RecurrentMaintenanceTable,
  UserTodosTable,
} from "./RecommendedItemsTable";

export default function SystemActionItemsTables({
  findingItems = [],
  recurrentItems = [],
  recommendationItems = [],
  userItems = [],
  systemLabel,
  systemKey,
  propertyId,
  completedChecklistItemIds,
  recordsByChecklistItemId = {},
  eventsByChecklistItemId = {},
  onItemCreated,
  handlers = {},
}) {
  const hasAnyItems =
    findingItems.length > 0 ||
    recurrentItems.length > 0 ||
    recommendationItems.length > 0 ||
    userItems.length > 0;

  if (!hasAnyItems && !(propertyId && systemKey)) return null;

  return (
    <div className="space-y-6">
      <InspectionReportItemsTable
        items={findingItems}
        completedChecklistItemIds={completedChecklistItemIds}
        recordsByChecklistItemId={recordsByChecklistItemId}
        eventsByChecklistItemId={eventsByChecklistItemId}
        handlers={handlers}
      />
      <RecurrentMaintenanceTable
        items={recurrentItems}
        completedChecklistItemIds={completedChecklistItemIds}
        recordsByChecklistItemId={recordsByChecklistItemId}
        eventsByChecklistItemId={eventsByChecklistItemId}
        handlers={handlers}
      />
      {recommendationItems.length > 0 && (
        <RecommendedItemsTable
          items={recommendationItems}
          systemLabel={systemLabel}
          systemKey={systemKey}
          propertyId={propertyId}
          onItemCreated={onItemCreated}
          completedChecklistItemIds={completedChecklistItemIds}
          recordsByChecklistItemId={recordsByChecklistItemId}
          eventsByChecklistItemId={eventsByChecklistItemId}
          handlers={handlers}
        />
      )}
      <UserTodosTable
        items={userItems}
        completedChecklistItemIds={completedChecklistItemIds}
        recordsByChecklistItemId={recordsByChecklistItemId}
        eventsByChecklistItemId={eventsByChecklistItemId}
        handlers={handlers}
      />
    </div>
  );
}

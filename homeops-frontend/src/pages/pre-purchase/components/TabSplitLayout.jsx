import React from "react";

/** Main content + sticky right rail used across Systems / Issues / Recommendations. */
export default function TabSplitLayout({main, rail}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
      <div className="min-w-0 space-y-4">{main}</div>
      {rail ? (
        <aside className="space-y-4 lg:sticky lg:top-4">{rail}</aside>
      ) : null}
    </div>
  );
}

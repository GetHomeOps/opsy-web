import {describe, expect, it} from "vitest";
import {buildGoogleCalendarUrl} from "./googleCalendarLink";

describe("buildGoogleCalendarUrl", () => {
  it("builds valid Google Calendar eventedit URL with core fields", () => {
    const event = {
      title: "HVAC Maintenance",
      date: "2025-03-15",
      scheduledTime: "09:30",
      type: "maintenance",
    };
    const url = buildGoogleCalendarUrl(event);
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/u\/0\/r\/eventedit\?/);
    expect(url).toContain("text=HVAC%20Maintenance");
    expect(url).toContain("dates=");
  });

  it("includes details for property, contractor, and notes", () => {
    const event = {
      title: "Inspection",
      date: "2025-04-01",
      scheduledTime: "14:00",
      type: "inspection",
      propertyName: "123 Main St",
      address: "123 Main St, City, State",
      contractorName: "ABC Inspections",
      notes: "Annual inspection",
    };
    const url = buildGoogleCalendarUrl(event);
    expect(url).toContain("details=");
    expect(decodeURIComponent(url)).toMatch(/Inspection/);
    expect(decodeURIComponent(url)).toMatch(/123 Main St/);
    expect(decodeURIComponent(url)).toMatch(/ABC Inspections/);
    expect(decodeURIComponent(url)).toMatch(/Annual inspection/);
    expect(url).toContain("location=");
  });

  it("handles missing optional fields", () => {
    const event = {date: "2025-01-10"};
    const url = buildGoogleCalendarUrl(event);
    expect(url).toContain("text=HomeOps%20Event");
    expect(url).toContain("dates=");
  });
});

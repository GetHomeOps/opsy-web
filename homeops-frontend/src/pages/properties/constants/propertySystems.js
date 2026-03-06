import {
  Building,
  Droplet,
  Home,
  Zap,
  Shield,
  FileCheck,
} from "lucide-react";

/** Predefined property systems used by Systems tab, Maintenance tab, and SystemsSetupModal. */
export const PROPERTY_SYSTEMS = [
  { id: "roof", name: "Roof", icon: Building, description: "Shingles, tiles, flashing & drainage" },
  { id: "gutters", name: "Gutters", icon: Droplet, description: "Gutter channels, downspouts & guards" },
  { id: "foundation", name: "Foundation & Structure", icon: Building, description: "Structural base, walls & framing" },
  { id: "exterior", name: "Exterior", icon: Building, description: "Siding, paint & exterior finishes" },
  { id: "windows", name: "Windows", icon: Home, description: "Windows, doors & weatherstripping" },
  { id: "heating", name: "Heating", icon: Zap, description: "Furnace, boiler & heat distribution" },
  { id: "ac", name: "Air Conditioning", icon: Zap, description: "Central AC, mini-splits & ventilation" },
  { id: "waterHeating", name: "Water Heating", icon: Droplet, description: "Water heater, tankless or tank units" },
  { id: "electrical", name: "Electrical", icon: Zap, description: "Panels, wiring & circuit breakers" },
  { id: "plumbing", name: "Plumbing", icon: Droplet, description: "Pipes, fixtures & water supply lines" },
  { id: "safety", name: "Safety", icon: Shield, description: "Smoke detectors, CO alarms & fire safety" },
  { id: "inspections", name: "Inspections", icon: FileCheck, description: "Scheduled & completed inspections" },
];

/** Default systems shown when user has not selected any from the modal. */
export const DEFAULT_SYSTEM_IDS = [
  "roof",
  "gutters",
  "heating",
  "ac",
  "electrical",
  "plumbing",
];

/**
 * Standard fields for custom systems added by the user.
 * Each custom system (e.g. Solar, Pool) gets a section with these fields in the Systems tab.
 *
 * Field types:
 * - text: Regular text input
 * - date: Full date picker (day/month/year)
 * - select: Dropdown with options
 * - installer: Installer dropdown (uses InstallerSelect component)
 * - computed-age: Read-only field calculated from installDate
 * - warranty-select: Yes/No dropdown
 */
export const STANDARD_CUSTOM_SYSTEM_FIELDS = [
  { key: "material", label: "Material", type: "text" },
  { key: "installDate", label: "Install Date", type: "date" },
  { key: "installer", label: "Installer", type: "installer" },
  { key: "age", label: "Age", type: "computed-age" },
  { key: "condition", label: "Condition", type: "select", options: ["Excellent", "Good", "Fair", "Poor"] },
  { key: "lastInspection", label: "Last Inspection", type: "date" },
  { key: "warranty", label: "Warranty", type: "warranty-select" },
  { key: "nextInspection", label: "Next Inspection", type: "date" },
  { key: "issues", label: "Known Issues", type: "textarea" },
];

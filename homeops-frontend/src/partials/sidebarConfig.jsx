/**
 * Sidebar navigation config — Stripe-style grouped layout.
 * Only ONE submenu level; collapsible groups have no nested depth.
 *
 * Role rules:
 * - adminOnly: visible to admin + super_admin
 * - adminOrAgent: visible to admin + super_admin + agent
 * - all: visible to all authenticated users
 */

import React from "react";
import {
  Home,
  Building2,
  Calendar,
  FolderOpen,
  Users,
  LayoutGrid,
  Settings2,
  UserCircle,
  ClipboardList,
  MessageSquare,
  MessageCircle,
  CreditCard,
  Package,
  Settings,
  Wallet,
  Cog,
  HelpCircle,
  UsersRound,
  BookOpen,
  BarChart3,
  DollarSign,
} from "lucide-react";

const ICON_SIZE = 18;
const ICON_PROPS = { size: ICON_SIZE, strokeWidth: 1.75 };

const icon = (Component) => (props) => (
  <Component {...props} {...ICON_PROPS} />
);

export const SIDEBAR_CONFIG = [
  // --- Home (standalone) ---
  {
    id: "home",
    type: "link",
    label: "Home",
    path: "home",
    icon: icon(Home),
    roles: "all",
  },

  // --- PROPERTY ---
  {
    id: "property",
    type: "section",
    label: "PROPERTY",
    items: [
      { id: "properties", label: "Properties", path: "properties", icon: icon(Building2), roles: "all" },
      { id: "calendar", label: "Calendar", path: "calendar", icon: icon(Calendar), roles: "all" },
      {
        id: "dashboard",
        type: "collapsible",
        label: "Dashboard",
        icon: icon(BarChart3),
        defaultExpanded: false,
        roles: "adminOnly",
        children: [
          { id: "agent-analytics", label: "Agent Analytics", path: "dashboard/agent-analytics", icon: icon(Users), roles: "adminOnly" },
          { id: "unit-cost", label: "Unit Cost", path: "dashboard/unit-cost", icon: icon(DollarSign), roles: "adminOnly" },
        ],
      },
    ],
  },

  // --- NETWORK ---
  {
    id: "network",
    type: "section",
    label: "NETWORK",
    items: [
      {
        id: "directory",
        type: "collapsible",
        label: "Directory",
        icon: icon(FolderOpen),
        defaultExpanded: true,
        children: [
          { id: "professionals", label: "Professionals", path: "professionals", activePaths: ["professionals", "my-professionals"], excludeFromActive: ["professionals/manage", "professionals/categories", "professionals/import"], icon: icon(Users), roles: "all" },
          { id: "categories", label: "Categories", path: "professionals/categories", icon: icon(LayoutGrid), roles: "adminOnly" },
          { id: "manage", label: "Manage", path: "professionals/manage", icon: icon(Settings2), roles: "adminOnly" },
        ],
      },
      { id: "contacts", label: "My Contacts", path: "contacts", icon: icon(UserCircle), roles: "all" },
      { id: "communications", label: "Communications", path: "communications", icon: icon(BookOpen), roles: "adminOrAgent" },
    ],
  },

  // --- ADMIN (admin + super_admin only) ---
  {
    id: "admin",
    type: "section",
    label: "ADMIN",
    roles: "adminOnly",
    items: [
      {
        id: "operations",
        type: "collapsible",
        label: "Operations",
        icon: icon(ClipboardList),
        defaultExpanded: true,
        children: [
          { id: "support-management", label: "Support Management", path: "support-management", icon: icon(MessageSquare), roles: "adminOnly" },
          { id: "feedback-management", label: "Feedback Management", path: "feedback-management", icon: icon(MessageCircle), roles: "adminOnly" },
        ],
      },
      {
        id: "subscriptions",
        type: "collapsible",
        label: "Subscriptions",
        icon: icon(CreditCard),
        defaultExpanded: false,
        roles: "adminOnly",
        children: [
          { id: "subscriptions-list", label: "Subscriptions", path: "subscriptions", icon: icon(CreditCard), roles: "adminOnly" },
          { id: "subscription-products", label: "Products & Plans", path: "subscription-products", icon: icon(Package), roles: "adminOnly" },
        ],
      },
    ],
  },
];

// Professionals (Sample) — kept separate, shown after main nav with divider
export const PROFESSIONALS_SAMPLE = {
  id: "professionals-sample",
  label: "Professionals (Sample)",
  path: "professionals-sample",
  activePaths: ["professionals-sample", "my-professionals-sample"],
  icon: icon(Users),
  roles: "all",
};

// Settings section — bottom of sidebar (Billing, Configuration, Support, Users)
// Support Management and Feedback Management moved to ADMIN > Operations
export const SETTINGS_CONFIG = {
  id: "settings",
  type: "collapsible",
  label: "Settings",
  icon: icon(Settings),
  defaultExpanded: false,
  children: [
    { id: "billing", label: "Billing", path: "settings/billing", icon: icon(Wallet), roles: "all", hideForSuperAdmin: true },
    { id: "configuration", label: "Configuration", path: "settings/configuration", icon: icon(Cog), roles: "all" },
    { id: "support", label: "Support", path: "settings/support", icon: icon(HelpCircle), roles: "all" },
    { id: "users", label: "Users", path: "users", icon: icon(UsersRound), roles: "adminOnly" },
  ],
};

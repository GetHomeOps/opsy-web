/**
 * Sidebar navigation config — Stripe-style grouped layout.
 * Only ONE submenu level; collapsible groups have no nested depth.
 *
 * Role rules:
 * - superAdminOnly: visible to super_admin only
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
  Headset,
  CreditCard,
  Package,
  UsersRound,
  BookOpen,
  BarChart3,
  DollarSign,
  Clock,
  Inbox,
} from "lucide-react";

const ICON_SIZE = 18;
const ICON_PROPS = {size: ICON_SIZE, strokeWidth: 1.75};

const icon = (Component) => (props) => <Component {...props} {...ICON_PROPS} />;

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
      {
        id: "properties",
        label: "Properties",
        path: "properties",
        icon: icon(Building2),
        roles: "all",
      },
      {
        id: "calendar",
        label: "Calendar",
        path: "calendar",
        icon: icon(Calendar),
        roles: "all",
      },
      {
        id: "dashboard",
        type: "collapsible",
        label: "Dashboard",
        icon: icon(BarChart3),
        defaultExpanded: false,
        roles: "adminOnly",
        children: [
          {
            id: "agent-analytics",
            label: "Agent Analytics",
            path: "dashboard/agent-analytics",
            icon: icon(Users),
            roles: "adminOnly",
          },
          {
            id: "property-analytics",
            label: "Property Analytics",
            path: "dashboard/properties",
            icon: icon(Building2),
            roles: "adminOnly",
          },
          {
            id: "unit-cost",
            label: "Unit Cost",
            path: "dashboard/unit-cost",
            icon: icon(DollarSign),
            roles: "adminOnly",
          },
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
          {
            id: "professionals",
            label: "Professionals",
            path: "professionals",
            activePaths: ["professionals", "my-professionals"],
            excludeFromActive: [
              "professionals/manage",
              "professionals/categories",
              "professionals/import",
            ],
            icon: icon(Users),
            roles: "all",
          },
          {
            id: "categories",
            label: "Categories",
            path: "professionals/categories",
            icon: icon(LayoutGrid),
            roles: "adminOnly",
          },
          {
            id: "manage",
            label: "Manage",
            path: "professionals/manage",
            icon: icon(Settings2),
            roles: "adminOnly",
          },
        ],
      },
      {
        id: "contacts",
        label: "My Contacts",
        path: "contacts",
        icon: icon(UserCircle),
        roles: "all",
      },
      {
        id: "communications",
        label: "Communications",
        path: "communications",
        icon: icon(BookOpen),
        roles: "adminOrAgent",
      },
      {
        id: "homeowner-messages",
        label: "Messages",
        path: "homeowner-messages",
        icon: icon(Inbox),
        roles: "all",
      },
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
        id: "helpdesk",
        label: "Helpdesk",
        path: "helpdesk",
        activePaths: [
          "helpdesk",
          "helpdesk/support",
          "helpdesk/feedback",
          "helpdesk/data-adjustments",
        ],
        icon: icon(Headset),
        roles: "adminOnly",
      },
      {
        id: "subscriptions",
        type: "collapsible",
        label: "Subscriptions",
        icon: icon(CreditCard),
        defaultExpanded: false,
        roles: "adminOnly",
        children: [
          {
            id: "subscriptions-list",
            label: "Subscriptions",
            path: "subscriptions",
            icon: icon(CreditCard),
            roles: "adminOnly",
          },
          {
            id: "subscription-products",
            label: "Products & Plans",
            path: "subscription-products",
            icon: icon(Package),
            roles: "superAdminOnly",
          },
        ],
      },
      {
        id: "users",
        label: "Users",
        path: "users",
        icon: icon(UsersRound),
        roles: "adminOnly",
      },
    ],
  },
];

// Coming Soon — placeholder page for upcoming features
export const COMING_SOON = {
  id: "coming-soon",
  label: "Coming Soon",
  path: "coming-soon",
  icon: icon(Clock),
  roles: "all",
};

// Professionals (Sample) — kept separate, shown after main nav with divider
export const PROFESSIONALS_SAMPLE = {
  id: "professionals-sample",
  label: "Professionals (Sample)",
  path: "professionals-sample",
  activePaths: ["professionals-sample", "my-professionals-sample"],
  icon: icon(Users),
  roles: "all",
};

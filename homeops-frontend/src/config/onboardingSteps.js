/**
 * Reusable onboarding steps configuration.
 * Add or modify steps here to extend the onboarding experience.
 *
 * Each step defines:
 * - id: unique identifier
 * - titleKey: i18n key for step title
 * - descriptionKey: i18n key for step description
 * - actionLabelKey: i18n key for the action button
 * - icon: Lucide icon component
 * - checkComplete: (context) => boolean - returns true when step is done
 * - getActionPath: (context) => string | null - path to navigate, or null for custom action
 */

import {User, Home} from "lucide-react";

/**
 * Check if user has completed their profile.
 * Required: profile photo, full name, phone number.
 */
export function isProfileComplete(user) {
  if (!user) return false;
  const hasPhoto = !!(
    user.image ||
    user.avatar_url ||
    user.avatarUrl ||
    user.image_url
  );
  const fullName = (user.name || user.fullName || "").trim();
  const phone = (user.phone || "").trim();
  return hasPhoto && fullName.length > 0 && phone.length > 0;
}

/**
 * Check if user has at least one property.
 */
export function hasFirstProperty(properties) {
  return Array.isArray(properties) && properties.length > 0;
}

/**
 * Default onboarding steps for agent and homeowner roles.
 * Steps are evaluated in order; completion is computed via checkComplete.
 */
export const DEFAULT_ONBOARDING_STEPS = [
  {
    id: "complete-profile",
    titleKey: "onboarding.step1Title",
    descriptionKey: "onboarding.step1Description",
    actionLabelKey: "onboarding.step1Action",
    icon: User,
    checkComplete: (ctx) => isProfileComplete(ctx.currentUser),
    getActionPath: (ctx) =>
      ctx.accountUrl
        ? `/${ctx.accountUrl}/settings/configuration`
        : "/settings/accounts",
  },
  {
    id: "create-property",
    titleKey: "onboarding.step2Title",
    descriptionKey: "onboarding.step2Description",
    actionLabelKey: "onboarding.step2Action",
    icon: Home,
    checkComplete: (ctx) => hasFirstProperty(ctx.properties),
    getActionPath: (ctx) =>
      ctx.accountUrl ? `/${ctx.accountUrl}/properties/new` : null,
    /** Use custom handler in modal (e.g. add property with limit check) instead of direct navigate */
    customActionId: "addProperty",
  },
];

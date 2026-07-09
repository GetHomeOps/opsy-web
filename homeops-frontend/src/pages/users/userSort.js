/** Sort helpers for the users list (mirrors UsersTable billing display logic). */

import {isDemoSite} from "../../utils/demoSite";

const ROLE_SORT_ORDER = {
  super_admin: 0,
  superadmin: 0,
  admin: 1,
  agent: 2,
  homeowner: 3,
};

const BILLING_SORT_RANK = {
  exempt_staff: 0,
  active_paid: 1,
  trialing: 2,
  comped: 3,
  free_plan: 4,
  past_due: 5,
  awaiting_payment: 6,
  unknown: 7,
};

/** Primary account status for Users list display, filter, and sort. */
const STATUS_SORT_RANK = {
  expired: 0,
  pending: 1,
  onboarding: 2,
  active: 3,
};

export function isDemoExpiryPast(iso) {
  if (!iso) return false;
  const tMs = new Date(iso).getTime();
  return !Number.isNaN(tMs) && tMs <= Date.now();
}

/**
 * Derived UI status for the Users list.
 * Precedence: expired (demo) > pending (not activated) > onboarding > active.
 * @returns {"expired"|"pending"|"onboarding"|"active"}
 */
export function getUserAccountStatus(user, {considerDemoExpiry = isDemoSite()} = {}) {
  if (considerDemoExpiry && isDemoExpiryPast(user?.demoExpiresAt)) {
    return "expired";
  }
  const isActive = user?.isActive ?? user?.is_active;
  if (!isActive) return "pending";
  if (user?.onboardingCompleted === false) return "onboarding";
  return "active";
}

export function getUserStatusSortValue(user) {
  return STATUS_SORT_RANK[getUserAccountStatus(user)] ?? 0;
}

/** Milliseconds until demo expiry; null if unset/invalid. Negative when past. */
export function getDemoExpiresAtMs(user) {
  const iso = user?.demoExpiresAt;
  if (!iso) return null;
  const tMs = new Date(iso).getTime();
  return Number.isNaN(tMs) ? null : tMs;
}

export function getUserDemoExpirySortValue(user) {
  const tMs = getDemoExpiresAtMs(user);
  // Missing expiry sorts last
  return tMs == null ? Number.POSITIVE_INFINITY : tMs;
}

export function getUserRoleSortValue(user) {
  const role = (user?.role || "").trim().toLowerCase();
  return ROLE_SORT_ORDER[role] ?? 99;
}

export function getUserBillingSortMeta(user) {
  const role = (user?.role || "").toLowerCase();
  if (role === "super_admin" || role === "admin" || role === "superadmin") {
    return {rank: BILLING_SORT_RANK.exempt_staff, tie: 0};
  }

  if (user?.paidRequired === undefined || user?.onboardingCompleted === false) {
    /* Billing not applicable until onboarding finishes (or fields missing). */
    return {rank: BILLING_SORT_RANK.unknown, tie: 0};
  }

  const latestStatus = user.latestSubscriptionStatus;
  const isStripe = user.latestSubscriptionIsStripe === true;
  const hasCurrentSub = latestStatus === "active" || latestStatus === "trialing";

  if (user.paidRequired) {
    if (hasCurrentSub && isStripe && latestStatus === "trialing") {
      const tie = user.latestSubscriptionPeriodEnd
        ? new Date(user.latestSubscriptionPeriodEnd).getTime()
        : 0;
      return {rank: BILLING_SORT_RANK.trialing, tie};
    }
    if (hasCurrentSub && isStripe) {
      return {rank: BILLING_SORT_RANK.active_paid, tie: 0};
    }
    if (hasCurrentSub && !isStripe) {
      return {rank: BILLING_SORT_RANK.comped, tie: 0};
    }
    if (latestStatus === "past_due") {
      return {rank: BILLING_SORT_RANK.past_due, tie: 0};
    }
    return {rank: BILLING_SORT_RANK.awaiting_payment, tie: 0};
  }

  return {rank: BILLING_SORT_RANK.free_plan, tie: 0};
}

function compareWithDirection(cmp, direction) {
  return direction === "asc" ? cmp : -cmp;
}

function tieBreakByName(a, b, direction) {
  return compareWithDirection(
    (a?.name || "").localeCompare(b?.name || ""),
    direction,
  );
}

export function compareUsersForSort(a, b, key, direction) {
  let cmp = 0;

  switch (key) {
    case "status":
      cmp = getUserStatusSortValue(a) - getUserStatusSortValue(b);
      break;
    case "demoExpiresAt": {
      const aMs = getUserDemoExpirySortValue(a);
      const bMs = getUserDemoExpirySortValue(b);
      cmp = aMs - bMs;
      break;
    }
    case "role": {
      const roleCmp = getUserRoleSortValue(a) - getUserRoleSortValue(b);
      if (roleCmp !== 0) {
        cmp = roleCmp;
      } else {
        cmp = (a?.role || "")
          .toLowerCase()
          .localeCompare((b?.role || "").toLowerCase());
      }
      break;
    }
    case "billingState": {
      const metaA = getUserBillingSortMeta(a);
      const metaB = getUserBillingSortMeta(b);
      cmp = metaA.rank - metaB.rank;
      if (cmp === 0) cmp = metaA.tie - metaB.tie;
      break;
    }
    default: {
      const valueA = (a?.[key] ?? "").toString().toLowerCase();
      const valueB = (b?.[key] ?? "").toString().toLowerCase();
      cmp = valueA.localeCompare(valueB);
      break;
    }
  }

  if (cmp !== 0) return compareWithDirection(cmp, direction);
  return tieBreakByName(a, b, direction);
}

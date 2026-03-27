import {useMemo, useContext} from "react";
import {useAuth} from "../context/AuthContext";
import PropertyContext from "../context/PropertyContext";
import ContactContext from "../context/ContactContext";
import {DEFAULT_ONBOARDING_STEPS} from "../config/onboardingSteps";

/**
 * Hook to compute onboarding progress for agent/homeowner users.
 * Returns steps with completion state and context for actions.
 *
 * @param {Object} options
 * @param {Array} [options.steps] - Override default steps (optional)
 * @param {Object} [options.extraContext] - Additional context merged in (e.g. calendarIntegrations)
 * @returns {{ steps: Array, completedCount: number, allComplete: boolean, context: Object }}
 */
export default function useOnboardingProgress({steps = DEFAULT_ONBOARDING_STEPS, extraContext = {}} = {}) {
  const {currentUser} = useAuth();
  const {currentAccount, properties = []} = useContext(PropertyContext) ?? {};
  const {contacts = []} = useContext(ContactContext) ?? {};
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  const context = useMemo(
    () => ({
      currentUser,
      properties,
      contacts,
      accountUrl,
      ...extraContext,
    }),
    [currentUser, properties, contacts, accountUrl, extraContext],
  );

  const stepsWithStatus = useMemo(() => {
    return steps.map((step) => {
      const completed = step.checkComplete?.(context) ?? false;
      const actionPath = step.getActionPath?.(context) ?? null;
      return {
        ...step,
        completed,
        actionPath,
      };
    });
  }, [steps, context]);

  const completedCount = stepsWithStatus.filter((s) => s.completed).length;
  const allComplete = completedCount === stepsWithStatus.length;

  return {
    steps: stepsWithStatus,
    completedCount,
    allComplete,
    context,
  };
}

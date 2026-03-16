import {useMemo, useContext} from "react";
import {useAuth} from "../context/AuthContext";
import PropertyContext from "../context/PropertyContext";
import {DEFAULT_ONBOARDING_STEPS} from "../config/onboardingSteps";

/**
 * Hook to compute onboarding progress for agent/homeowner users.
 * Returns steps with completion state and context for actions.
 *
 * @param {Object} options
 * @param {Array} [options.steps] - Override default steps (optional)
 * @returns {{ steps: Array, completedCount: number, allComplete: boolean, context: Object }}
 */
export default function useOnboardingProgress({steps = DEFAULT_ONBOARDING_STEPS} = {}) {
  const {currentUser} = useAuth();
  const {currentAccount, properties = []} = useContext(PropertyContext) ?? {};
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  const context = useMemo(
    () => ({
      currentUser,
      properties,
      accountUrl,
    }),
    [currentUser, properties, accountUrl],
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

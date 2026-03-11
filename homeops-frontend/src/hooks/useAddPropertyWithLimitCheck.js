import {useCallback, useState} from "react";
import {useNavigate} from "react-router-dom";
import {useAuth} from "../context/AuthContext";
import AppApi from "../api/api";

const ADMIN_ROLES = ["super_admin", "admin"];

/**
 * Hook to handle "Add Property" / "New" clicks with an upfront property limit check.
 * If at limit, calls onLimitReached and does not navigate.
 * Returns { handleAddProperty, isChecking }.
 */
export default function useAddPropertyWithLimitCheck({
  accountId,
  accountUrl,
  onLimitReached,
}) {
  const navigate = useNavigate();
  const {currentUser} = useAuth();
  const [isChecking, setIsChecking] = useState(false);

  const isAdmin = ADMIN_ROLES.includes(currentUser?.role);

  const handleAddProperty = useCallback(async () => {
    if (!accountUrl) return;

    if (isAdmin) {
      navigate(`/${accountUrl}/properties/new`);
      return;
    }

    setIsChecking(true);
    try {
      const res = await AppApi.getBillingStatus(accountId);
      const max = res?.limits?.maxProperties;
      const count = res?.usage?.propertiesCount ?? 0;

      if (max != null && count >= max) {
        onLimitReached?.();
        return;
      }

      navigate(`/${accountUrl}/properties/new`);
    } catch {
      // On error, allow navigation – limit will be enforced on save
      navigate(`/${accountUrl}/properties/new`);
    } finally {
      setIsChecking(false);
    }
  }, [accountId, accountUrl, isAdmin, onLimitReached, navigate]);

  return {handleAddProperty, isChecking};
}

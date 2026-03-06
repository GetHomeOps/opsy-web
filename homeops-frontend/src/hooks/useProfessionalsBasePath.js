import { useLocation } from "react-router-dom";

/**
 * Returns the base path for professionals routes.
 * When on /professionals-dummy or /professionals-dummy/:id, returns "professionals-dummy".
 * Otherwise returns "professionals".
 */
export default function useProfessionalsBasePath() {
  const { pathname } = useLocation();
  return pathname.includes("/professionals-dummy") ? "professionals-dummy" : "professionals";
}

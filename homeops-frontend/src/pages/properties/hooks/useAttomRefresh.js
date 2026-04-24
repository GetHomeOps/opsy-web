import {useCallback, useEffect, useRef, useState} from "react";
import AppApi from "../../../api/api";

/**
 * useAttomRefresh
 *
 * Manages the lifecycle of a manual ATTOM public-records refresh for one
 * property: reads the latest job on mount, lets the caller enqueue a new
 * one, polls every 3s while active, and fires `onComplete` exactly once
 * when a job reaches `completed` (so the caller can refetch the property).
 *
 * Safe to mount with `propertyId == null` (the hook simply stays idle).
 * Non-destructive merge is guaranteed server-side — this hook only wires UI.
 *
 * @param {string|number|null|undefined} propertyId
 * @param {{ onComplete?: () => void | Promise<void>, onFail?: (err: string) => void }} [opts]
 */
export function useAttomRefresh(propertyId, opts = {}) {
  const {onComplete, onFail} = opts;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [modalView, setModalView] = useState("confirm");
  const [jobStatus, setJobStatus] = useState(null);
  const [jobError, setJobError] = useState(null);
  const [populatedKeys, setPopulatedKeys] = useState([]);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const pollTimerRef = useRef(null);
  const completionHandledRef = useRef(false);
  const failureHandledRef = useRef(false);
  const manualRefreshRequestedRef = useRef(false);

  const isActive = jobStatus === "queued" || jobStatus === "processing";

  const syncLatestJob = useCallback(async () => {
    if (!propertyId) return null;
    try {
      const res = await AppApi.getPropertyAttomLookupStatus(propertyId);
      const job = res?.job ?? null;
      if (!job) {
        setJobStatus(null);
        setJobError(null);
        setPopulatedKeys([]);
        return null;
      }
      setJobStatus(job.status);
      setPopulatedKeys(Array.isArray(job.populatedKeys) ? job.populatedKeys : []);
      setJobError(
        job.status === "failed"
          ? job.errorMessage ||
              job.errorCode ||
              "ATTOM lookup failed. Please try again."
          : null,
      );
      return job;
    } catch (err) {
      console.error("[useAttomRefresh] status poll failed:", err?.message);
      return null;
    }
  }, [propertyId]);

  useEffect(() => {
    setInitialLoaded(false);
    completionHandledRef.current = false;
    failureHandledRef.current = false;
    manualRefreshRequestedRef.current = false;
    if (!propertyId) {
      setJobStatus(null);
      setJobError(null);
      setPopulatedKeys([]);
      setInitialLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      await syncLatestJob();
      if (cancelled) return;
      // On (re)mount, mark a finished job as already handled so we don't
      // fire onComplete/onFail for historical jobs loaded from the backend.
      completionHandledRef.current = true;
      failureHandledRef.current = true;
      setInitialLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId, syncLatestJob]);

  useEffect(() => {
    if (!isActive || !propertyId) return undefined;
    pollTimerRef.current = setInterval(() => {
      void syncLatestJob();
    }, 3000);
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isActive, propertyId, syncLatestJob]);

  useEffect(() => {
    if (!initialLoaded) return;
    if (
      manualRefreshRequestedRef.current &&
      jobStatus === "completed" &&
      !completionHandledRef.current
    ) {
      completionHandledRef.current = true;
      manualRefreshRequestedRef.current = false;
      setModalView("result");
      if (typeof onComplete === "function") {
        Promise.resolve(onComplete()).catch((err) =>
          console.error("[useAttomRefresh] onComplete error:", err),
        );
      }
    } else if (
      manualRefreshRequestedRef.current &&
      jobStatus === "failed" &&
      !failureHandledRef.current
    ) {
      failureHandledRef.current = true;
      manualRefreshRequestedRef.current = false;
      setModalView("result");
      if (typeof onFail === "function") {
        try {
          onFail(jobError);
        } catch (err) {
          console.error("[useAttomRefresh] onFail error:", err);
        }
      }
    }
  }, [jobStatus, initialLoaded, jobError, onComplete, onFail]);

  /** Kick off a new job. Caller usually shows a confirm dialog first. */
  const startRefresh = useCallback(async () => {
    if (!propertyId) return;
    setConfirmOpen(true);
    setModalView("progress");
    setJobError(null);
    completionHandledRef.current = false;
    failureHandledRef.current = false;
    manualRefreshRequestedRef.current = true;
    try {
      await AppApi.refreshPropertyAttomLookup(propertyId);
      await syncLatestJob();
    } catch (err) {
      console.error("[useAttomRefresh] refresh request failed:", err);
      const message =
        err?.message || "Unable to start refresh. Please try again in a moment.";
      setJobError(message);
      setModalView("result");
      manualRefreshRequestedRef.current = false;
      if (typeof onFail === "function") onFail(message);
    }
  }, [propertyId, syncLatestJob, onFail]);

  const openConfirm = useCallback(() => {
    setModalView("confirm");
    setConfirmOpen(true);
  }, []);
  const closeConfirm = useCallback(() => setConfirmOpen(false), []);

  return {
    modalView,
    jobStatus,
    jobError,
    populatedKeys,
    isActive,
    initialLoaded,
    confirmOpen,
    openConfirm,
    closeConfirm,
    startRefresh,
  };
}

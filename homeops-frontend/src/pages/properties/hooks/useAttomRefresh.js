import {useCallback, useEffect, useRef, useState} from "react";
import AppApi from "../../../api/api";

/** `null` from the API means unlimited (admin / super_admin). Missing/invalid → 4. */
function parseLookupLimit(value) {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 4;
}

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
 * @param {{ onComplete?: (populatedKeys?: string[]) => void | Promise<void>, onFail?: (err: string) => void }} [opts]
 */
export function useAttomRefresh(propertyId, opts = {}) {
  const {onComplete, onFail} = opts;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [modalView, setModalView] = useState("confirm");
  const [jobStatus, setJobStatus] = useState(null);
  const [jobError, setJobError] = useState(null);
  const [populatedKeys, setPopulatedKeys] = useState([]);
  const [lookupCount, setLookupCount] = useState(0);
  const [lookupLimit, setLookupLimit] = useState(4);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const pollTimerRef = useRef(null);
  const completionHandledRef = useRef(false);
  const failureHandledRef = useRef(false);
  const manualRefreshRequestedRef = useRef(false);
  /** When true, failures are logged but do not invoke onFail (background auto-pull). */
  const silentRefreshRef = useRef(false);
  /** Latest populatedKeys from the polled job (avoids stale state in onComplete). */
  const populatedKeysRef = useRef([]);
  /** Always call the latest callbacks (avoids stale closures during long polls). */
  const onCompleteRef = useRef(onComplete);
  const onFailRef = useRef(onFail);
  onCompleteRef.current = onComplete;
  onFailRef.current = onFail;

  const isActive = jobStatus === "queued" || jobStatus === "processing";

  const syncLatestJob = useCallback(async () => {
    if (!propertyId) return null;
    try {
      const res = await AppApi.getPropertyAttomLookupStatus(propertyId);
      const job = res?.job ?? null;
      setLookupCount(Number(res?.lookupCount) || 0);
      if (res && Object.prototype.hasOwnProperty.call(res, "lookupLimit")) {
        setLookupLimit(parseLookupLimit(res.lookupLimit));
      }
      if (!job) {
        setJobStatus(null);
        setJobError(null);
        setPopulatedKeys([]);
        populatedKeysRef.current = [];
        return null;
      }
      const keys = Array.isArray(job.populatedKeys) ? job.populatedKeys : [];
      populatedKeysRef.current = keys;
      setJobStatus(job.status);
      setPopulatedKeys(keys);
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

  /** Fire onComplete/onFail once for a terminal job started by this hook. */
  const settleRequestedJob = useCallback((status, errorMessage) => {
    if (!manualRefreshRequestedRef.current) return;

    if (status === "completed" && !completionHandledRef.current) {
      completionHandledRef.current = true;
      manualRefreshRequestedRef.current = false;
      silentRefreshRef.current = false;
      setModalView("result");
      const cb = onCompleteRef.current;
      if (typeof cb === "function") {
        Promise.resolve(cb(populatedKeysRef.current)).catch((err) =>
          console.error("[useAttomRefresh] onComplete error:", err),
        );
      }
      return;
    }

    if (status === "failed" && !failureHandledRef.current) {
      failureHandledRef.current = true;
      manualRefreshRequestedRef.current = false;
      const wasSilent = silentRefreshRef.current;
      silentRefreshRef.current = false;
      setModalView("result");
      const cb = onFailRef.current;
      if (typeof cb === "function" && !wasSilent) {
        try {
          cb(errorMessage);
        } catch (err) {
          console.error("[useAttomRefresh] onFail error:", err);
        }
      } else if (wasSilent && errorMessage) {
        console.info(
          "[useAttomRefresh] silent background lookup failed:",
          errorMessage,
        );
      }
    }
  }, []);

  useEffect(() => {
    setInitialLoaded(false);
    completionHandledRef.current = false;
    failureHandledRef.current = false;
    manualRefreshRequestedRef.current = false;
    silentRefreshRef.current = false;
    if (!propertyId) {
      setJobStatus(null);
      setJobError(null);
      setPopulatedKeys([]);
      setLookupCount(0);
      setLookupLimit(4);
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
      void (async () => {
        const job = await syncLatestJob();
        if (!job) return;
        const err =
          job.status === "failed"
            ? job.errorMessage ||
              job.errorCode ||
              "ATTOM lookup failed. Please try again."
            : null;
        settleRequestedJob(job.status, err);
      })();
    }, 3000);
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isActive, propertyId, syncLatestJob, settleRequestedJob]);

  useEffect(() => {
    if (!initialLoaded) return;
    settleRequestedJob(jobStatus, jobError);
  }, [jobStatus, initialLoaded, jobError, settleRequestedJob]);

  const isAtLookupLimit = lookupLimit != null && lookupCount >= lookupLimit;

  /** Kick off a new job. Pass `{ silent: true }` to skip the confirm dialog (e.g. address-change auto-pull). */
  const startRefresh = useCallback(
    async ({silent = false} = {}) => {
      if (!propertyId) return;
      if (isAtLookupLimit) {
        const message = `ATTOM lookup limit reached (${lookupLimit} per property).`;
        setJobError(message);
        if (!silent) {
          setConfirmOpen(true);
          setModalView("result");
        }
        if (typeof onFailRef.current === "function" && !silent) {
          onFailRef.current(message);
        }
        return;
      }
      if (!silent) {
        setConfirmOpen(true);
        setModalView("progress");
      }
      // Optimistically move off any prior terminal status BEFORE flipping the
      // request refs. Otherwise clearing jobError can re-run the settle effect
      // against the previous failed/completed job and swallow onComplete for
      // the new lookup (common after address-change auto-pull).
      setJobError(null);
      setJobStatus("queued");
      completionHandledRef.current = false;
      failureHandledRef.current = false;
      manualRefreshRequestedRef.current = true;
      silentRefreshRef.current = silent;
      try {
        const res = await AppApi.refreshPropertyAttomLookup(propertyId);
        if (res?.lookupCount != null) setLookupCount(Number(res.lookupCount) || 0);
        if (res && Object.prototype.hasOwnProperty.call(res, "lookupLimit")) {
          setLookupLimit(parseLookupLimit(res.lookupLimit));
        }
        const job = await syncLatestJob();
        // If the worker finished before React could observe a status transition
        // (e.g. previous status was already "completed"), settle immediately.
        if (job?.status === "completed" || job?.status === "failed") {
          const err =
            job.status === "failed"
              ? job.errorMessage ||
                job.errorCode ||
                "ATTOM lookup failed. Please try again."
              : null;
          settleRequestedJob(job.status, err);
        }
      } catch (err) {
        console.error("[useAttomRefresh] refresh request failed:", err);
        const message =
          err?.message || "Unable to start refresh. Please try again in a moment.";
        setJobError(message);
        if (!silent) {
          setModalView("result");
        }
        manualRefreshRequestedRef.current = false;
        silentRefreshRef.current = false;
        if (typeof onFailRef.current === "function" && !silent) {
          onFailRef.current(message);
        } else if (silent) {
          console.info(
            "[useAttomRefresh] silent background lookup failed:",
            message,
          );
        }
      }
    },
    [propertyId, syncLatestJob, settleRequestedJob, isAtLookupLimit, lookupLimit],
  );

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
    lookupCount,
    lookupLimit,
    isAtLookupLimit,
    isActive,
    initialLoaded,
    confirmOpen,
    openConfirm,
    closeConfirm,
    startRefresh,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";

export function useTabbedSectionData(activeTab, periodKey, fetcher) {
  const [data, setData] = useState({});
  const [tabStatus, setTabStatus] = useState({});
  const [reloadTick, setReloadTick] = useState(0);
  const [lastUpdated, setLastUpdated] = useState({});
  const cacheKey = `${activeTab}:${periodKey}:${reloadTick}`;
  const seenRef = useRef(new Set());

  useEffect(() => {
    if (seenRef.current.has(cacheKey)) return;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    setTabStatus((prev) => ({ ...prev, [activeTab]: "loading" }));
    fetcher(activeTab, periodKey, controller.signal)
      .then((payload) => {
        if (!active) return;
        seenRef.current.add(cacheKey);
        setData((prev) => {
          const next = { ...prev, ...payload };
          if (payload?.sevdesk && typeof payload.sevdesk === "object") {
            next.sevdesk = { ...(prev.sevdesk || {}), ...payload.sevdesk };
          }
          return next;
        });
        setLastUpdated((prev) => ({ ...prev, [activeTab]: Date.now() }));
        setTabStatus((prev) => ({ ...prev, [activeTab]: "ready" }));
      })
      .catch(() => {
        if (!active) return;
        setTabStatus((prev) => ({ ...prev, [activeTab]: "error" }));
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [cacheKey, activeTab, periodKey, fetcher]);

  const reload = useCallback(() => {
    seenRef.current.clear();
    setReloadTick((value) => value + 1);
  }, []);

  return {
    data,
    status: tabStatus[activeTab] || "idle",
    lastUpdated: lastUpdated[activeTab] || 0,
    reload
  };
}

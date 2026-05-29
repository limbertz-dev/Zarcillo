"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { fetchReadings, type FetchReadingsOptions } from "./queries";
import { supabase } from "./supabase";
import type { Reading } from "./types";

export type UseReadingsState = {
  readings: Reading[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  lastUpdate: Date | null;
};

export type UseReadingsOptions = FetchReadingsOptions & {
  realtime?: boolean;
};

type State = {
  readings: Reading[];
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
};

type Action =
  | { type: "start" }
  | { type: "success"; data: Reading[] }
  | { type: "error"; message: string }
  | { type: "insert"; row: Reading; limit?: number };

const initialState: State = {
  readings: [],
  loading: true,
  error: null,
  lastUpdate: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "start":
      return { ...state, loading: true };
    case "success":
      return {
        readings: action.data,
        loading: false,
        error: null,
        lastUpdate: new Date(),
      };
    case "error":
      return { ...state, loading: false, error: action.message };
    case "insert": {
      const merged = [action.row, ...state.readings];
      const limit = action.limit ?? merged.length;
      return {
        ...state,
        readings: merged.slice(0, limit),
        lastUpdate: new Date(),
      };
    }
  }
}

export function useReadings(
  options: UseReadingsOptions = {},
): UseReadingsState {
  const { realtime = false, ...fetchOpts } = options;
  const [state, dispatch] = useReducer(reducer, initialState);
  const [tick, setTick] = useState(0);

  const optsKey = JSON.stringify({
    ids: fetchOpts.deviceIds,
    limit: fetchOpts.limit,
    since:
      fetchOpts.since instanceof Date
        ? fetchOpts.since.toISOString()
        : fetchOpts.since,
    until:
      fetchOpts.until instanceof Date
        ? fetchOpts.until.toISOString()
        : fetchOpts.until,
    ascending: fetchOpts.ascending,
  });

  const optsRef = useRef(fetchOpts);
  useEffect(() => {
    optsRef.current = fetchOpts;
  });

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "start" });
    fetchReadings(optsRef.current)
      .then((data) => {
        if (cancelled) return;
        dispatch({ type: "success", data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        dispatch({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [optsKey, tick]);

  useEffect(() => {
    if (!realtime) return;
    const channel = supabase
      .channel(`readings-${optsKey}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "readings" },
        (payload) => {
          const newRow = payload.new as Reading;
          const opts = optsRef.current;
          if (
            opts.deviceIds &&
            opts.deviceIds.length > 0 &&
            !opts.deviceIds.includes(newRow.device_id)
          ) {
            return;
          }
          dispatch({ type: "insert", row: newRow, limit: opts.limit });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [optsKey, realtime]);

  return {
    readings: state.readings,
    loading: state.loading,
    error: state.error,
    lastUpdate: state.lastUpdate,
    refresh: () => setTick((t) => t + 1),
  };
}

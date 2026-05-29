"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import type { AppData, Goal, HoursEntry, PaceMode, TimeOff } from "./types"

const STORAGE_KEY = "bonustrak:data:v1"
const PACE_KEY = "bonustrak:paceMode:v1"

const EMPTY: AppData = { goal: null, entries: [], timeOff: [] }

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

interface StoreValue {
  data: AppData
  hydrated: boolean
  paceMode: PaceMode
  setPaceMode: (m: PaceMode) => void
  setGoal: (g: Goal) => void
  addEntry: (e: Omit<HoursEntry, "id">) => void
  updateEntry: (id: string, patch: Partial<Omit<HoursEntry, "id">>) => void
  deleteEntry: (id: string) => void
  addTimeOff: (t: Omit<TimeOff, "id">) => void
  updateTimeOff: (id: string, patch: Partial<Omit<TimeOff, "id">>) => void
  deleteTimeOff: (id: string) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY)
  const [paceMode, setPaceModeState] = useState<PaceMode>("trailing")
  const [hydrated, setHydrated] = useState(false)

  // Load from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as AppData
        setData({
          goal: parsed.goal ?? null,
          entries: Array.isArray(parsed.entries) ? parsed.entries : [],
          timeOff: Array.isArray(parsed.timeOff) ? parsed.timeOff : [],
        })
      }
      const pace = localStorage.getItem(PACE_KEY)
      if (pace === "trailing" || pace === "ytd") setPaceModeState(pace)
    } catch (err) {
      console.log("[v0] failed to load BonusTrak data:", err)
    }
    setHydrated(true)
  }, [])

  // Persist whenever data changes (after hydration).
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (err) {
      console.log("[v0] failed to save BonusTrak data:", err)
    }
  }, [data, hydrated])

  const setPaceMode = useCallback((m: PaceMode) => {
    setPaceModeState(m)
    try {
      localStorage.setItem(PACE_KEY, m)
    } catch {
      /* ignore */
    }
  }, [])

  const setGoal = useCallback((g: Goal) => {
    setData((prev) => ({ ...prev, goal: g }))
  }, [])

  const addEntry = useCallback((e: Omit<HoursEntry, "id">) => {
    setData((prev) => ({ ...prev, entries: [...prev.entries, { ...e, id: genId() }] }))
  }, [])

  const updateEntry = useCallback((id: string, patch: Partial<Omit<HoursEntry, "id">>) => {
    setData((prev) => ({
      ...prev,
      entries: prev.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }))
  }, [])

  const deleteEntry = useCallback((id: string) => {
    setData((prev) => ({ ...prev, entries: prev.entries.filter((e) => e.id !== id) }))
  }, [])

  const addTimeOff = useCallback((t: Omit<TimeOff, "id">) => {
    setData((prev) => ({ ...prev, timeOff: [...prev.timeOff, { ...t, id: genId() }] }))
  }, [])

  const updateTimeOff = useCallback((id: string, patch: Partial<Omit<TimeOff, "id">>) => {
    setData((prev) => ({
      ...prev,
      timeOff: prev.timeOff.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }))
  }, [])

  const deleteTimeOff = useCallback((id: string) => {
    setData((prev) => ({ ...prev, timeOff: prev.timeOff.filter((t) => t.id !== id) }))
  }, [])

  const value: StoreValue = {
    data,
    hydrated,
    paceMode,
    setPaceMode,
    setGoal,
    addEntry,
    updateEntry,
    deleteEntry,
    addTimeOff,
    updateTimeOff,
    deleteTimeOff,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}

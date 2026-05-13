import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type Overtime = {
  id: number;
  date: string;
  hours: number;
  earlyHours: number;
  lateHours: number;
  earlyClassHours: number;
  lateClassHours: number;
  leaveStart?: string | null;
  leaveEnd?: string | null;
  notes?: string | null;
  createdAt: string;
};

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export const OVERTIME_KEY = (from?: string, to?: string) =>
  from && to ? ["overtime", from, to] : ["overtime"];

export function useOvertimeRange(from: string, to: string) {
  return useQuery<Overtime[]>({
    queryKey: OVERTIME_KEY(from, to),
    queryFn: async () => {
      const res = await fetch(`${BASE()}/api/overtime?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to fetch overtime");
      return res.json();
    },
  });
}

export function useUpsertOvertime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      date: string;
      earlyHours: number;
      lateHours: number;
      earlyClassHours: number;
      lateClassHours: number;
      leaveStart?: string;
      leaveEnd?: string;
      notes?: string;
    }) => {
      const res = await fetch(`${BASE()}/api/overtime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save overtime");
      return res.json() as Promise<Overtime>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["overtime"] });
    },
  });
}

export function useDeleteOvertime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (date: string) => {
      const res = await fetch(`${BASE()}/api/overtime/${date}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete overtime");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["overtime"] }),
  });
}

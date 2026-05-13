import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type ShiftTemplate = {
  id: number;
  name: string;
  color: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
  createdAt: string;
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchTemplates(): Promise<ShiftTemplate[]> {
  const res = await fetch(`${BASE}/api/shift-templates`);
  if (!res.ok) throw new Error("Failed to fetch templates");
  return res.json();
}

async function createTemplate(data: Omit<ShiftTemplate, "id" | "createdAt">): Promise<ShiftTemplate> {
  const res = await fetch(`${BASE}/api/shift-templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create template");
  return res.json();
}

async function updateTemplate(id: number, data: Partial<Omit<ShiftTemplate, "id" | "createdAt">>): Promise<ShiftTemplate> {
  const res = await fetch(`${BASE}/api/shift-templates/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update template");
  return res.json();
}

async function deleteTemplate(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/shift-templates/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete template");
}

export const TEMPLATES_KEY = ["shift-templates"];

export function useShiftTemplates() {
  return useQuery({ queryKey: TEMPLATES_KEY, queryFn: fetchTemplates });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<ShiftTemplate, "id" | "createdAt">> }) =>
      updateTemplate(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export async function bulkCreateShifts(data: {
  templateId: number;
  startDate: string;
  endDate: string;
  daysOfWeek: number[];
  notes?: string;
}): Promise<{ created: number }> {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api/shifts/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? "Failed to bulk create shifts");
  }
  return res.json();
}

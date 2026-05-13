import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useCreateTemplate, useUpdateTemplate, type ShiftTemplate } from "@/hooks/useShiftTemplates";

const PRESET_COLORS = [
  "#f59e0b", "#0d9488", "#6366f1", "#10b981",
  "#ef4444", "#3b82f6", "#ec4899", "#8b5cf6",
  "#f97316", "#84cc16",
];

type FormData = {
  name: string;
  color: string;
  startTime: string;
  endTime: string;
  notes: string;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editTemplate?: ShiftTemplate;
  onSuccess?: () => void;
}

export default function TemplateDialog({ open, onOpenChange, editTemplate, onSuccess }: Props) {
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();

  const [form, setForm] = useState<FormData>({
    name: "",
    color: PRESET_COLORS[0],
    startTime: "09:00",
    endTime: "17:00",
    notes: "",
  });

  useEffect(() => {
    if (editTemplate) {
      setForm({
        name: editTemplate.name,
        color: editTemplate.color,
        startTime: editTemplate.startTime,
        endTime: editTemplate.endTime,
        notes: editTemplate.notes ?? "",
      });
    } else {
      setForm({ name: "", color: PRESET_COLORS[0], startTime: "09:00", endTime: "17:00", notes: "" });
    }
  }, [editTemplate, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form, notes: form.notes || undefined };
    const cb = { onSuccess: () => { onSuccess?.(); onOpenChange(false); } };

    if (editTemplate) {
      updateTemplate.mutate({ id: editTemplate.id, data }, cb);
    } else {
      createTemplate.mutate(data, cb);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => onOpenChange(false)}>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-card rounded-2xl border border-card-border shadow-xl w-full max-w-md p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">
                {editTemplate ? "編輯班次模板" : "新增班次模板"}
              </h2>
              <button onClick={() => onOpenChange(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">模板名稱（選填）</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例：早班、午班、夜班（可留空）"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">顏色</label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color} type="button"
                      onClick={() => setForm({ ...form, color })}
                      className={`w-8 h-8 rounded-full transition-all ${form.color === color ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105"}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">開始時間</label>
                  <input
                    type="time" lang="zh-TW" required value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">結束時間</label>
                  <input
                    type="time" lang="zh-TW" required value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">備註（選填）</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="備註事項..."
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <button
                type="submit"
                disabled={createTemplate.isPending || updateTemplate.isPending}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {editTemplate ? "儲存變更" : "新增模板"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, Layers, Clock, Repeat, ChevronLeft } from "lucide-react";
import { useDeleteTemplate } from "@/hooks/useShiftTemplates";
import { getListShiftsQueryKey, getGetShiftSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import ShiftDialog from "@/components/ShiftDialog";
import TemplateDialog from "@/components/TemplateDialog";
import RecurringPanel from "@/components/RecurringPanel";
import MonthView, { type ShiftItem } from "@/components/MonthView";
import { useShiftTemplates, type ShiftTemplate } from "@/hooks/useShiftTemplates";

type Tab = "shifts" | "recurring";

export default function Shifts() {
  const { data: templates, isLoading: templatesLoading } = useShiftTemplates();
  const queryClient = useQueryClient();
  const deleteTemplate = useDeleteTemplate();

  const [tab, setTab] = useState<Tab>("shifts");
  const [showTemplates, setShowTemplates] = useState(false);
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editShift, setEditShift] = useState<ShiftItem | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [editTemplate, setEditTemplate] = useState<ShiftTemplate | undefined>(undefined);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handleShiftClick = (date: Date, existing?: ShiftItem) => {
    setSelectedDate(format(date, "yyyy-MM-dd"));
    setEditShift(existing);
    setShiftDialogOpen(true);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetShiftSummaryQueryKey() });
  };

  const handleDeleteTemplate = (id: number) => {
    deleteTemplate.mutate(id, { onSuccess: () => setConfirmDeleteId(null) });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">班次管理</h1>
        {showTemplates ? (
          <button
            onClick={() => setShowTemplates(false)}
            className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-xl text-sm font-medium hover:bg-muted/80 transition-colors border border-border"
          >
            <ChevronLeft className="w-4 h-4" />
            返回
          </button>
        ) : (
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-xl text-sm font-medium hover:bg-muted/80 transition-colors border border-border"
          >
            <Layers className="w-4 h-4" />
            班次模板
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {showTemplates ? (
          /* ── Templates panel ── */
          <motion.div key="templates" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <p className="text-sm text-muted-foreground mb-4">
              班次模板定義預設的上班時段，新增單次班次或週期排班時可快速套用。
            </p>

            {templatesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : (templates ?? []).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">沒有班次模板</p>
                <p className="text-sm mt-1">點選下方「新增模板」建立預設班次時段</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(templates ?? []).map((template, i) => (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-card border border-card-border rounded-2xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow"
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: template.color }}
                    >
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground">
                        {template.name || <span className="text-muted-foreground italic font-normal">（未命名）</span>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {template.startTime} — {template.endTime}
                      </div>
                      {template.notes && (
                        <div className="text-xs text-muted-foreground mt-0.5">{template.notes}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {confirmDeleteId === template.id ? (
                        <>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            disabled={deleteTemplate.isPending}
                            className="px-3 h-9 rounded-xl bg-destructive text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
                          >
                            確定刪除
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-3 h-9 rounded-xl bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80 transition-colors"
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditTemplate(template); setTemplateDialogOpen(true); }}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 transition-colors text-muted-foreground"
                            title="編輯"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(template.id)}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-destructive/10 hover:bg-destructive/20 transition-colors text-destructive"
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* 新增模板 — 置底 */}
            <button
              onClick={() => { setEditTemplate(undefined); setTemplateDialogOpen(true); }}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-2xl text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
            >
              <Plus className="w-4 h-4" />
              新增模板
            </button>
          </motion.div>
        ) : (
          /* ── Tabs panel ── */
          <motion.div key="main" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {/* Tab selector */}
            <div className="flex gap-1 p-1 bg-muted rounded-xl mb-5 w-fit">
              {([
                { key: "shifts",    label: "班次編輯", icon: Clock  },
                { key: "recurring", label: "週期排班", icon: Repeat },
              ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    tab === key
                      ? "bg-card shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {tab === "shifts" ? (
                <motion.div key="shifts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <MonthView onShiftClick={handleShiftClick} />
                </motion.div>
              ) : (
                <motion.div key="recurring" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <RecurringPanel />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <ShiftDialog
        open={shiftDialogOpen}
        onOpenChange={(v) => {
          setShiftDialogOpen(v);
          if (!v) { setEditShift(undefined); setSelectedDate(undefined); }
        }}
        defaultDate={selectedDate}
        editShift={editShift}
        onSuccess={handleSuccess}
      />
      <TemplateDialog
        open={templateDialogOpen}
        onOpenChange={(v) => { setTemplateDialogOpen(v); if (!v) setEditTemplate(undefined); }}
        editTemplate={editTemplate}
      />
    </div>
  );
}

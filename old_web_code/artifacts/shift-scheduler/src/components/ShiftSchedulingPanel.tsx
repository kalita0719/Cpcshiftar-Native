import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings, Repeat, Palmtree, CalendarRange, ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { useShiftTemplates, useDeleteTemplate, type ShiftTemplate } from "@/hooks/useShiftTemplates";
import TemplateDialog from "@/components/TemplateDialog";

interface Props {
  open: boolean;
  onClose: () => void;
  selectedDate: string | null;
  onTemplateSelect: (template: ShiftTemplate) => void;
  onHolidaySelect: () => void;
  cycleMode: boolean;
  onCycleModeToggle: () => void;
  cycleStart: string | null;
  cycleEnd: string | null;
  onCycleGenerate: () => void;
  applying: boolean;
}

type View = "main" | "settings";

export default function ShiftSchedulingPanel({
  open,
  onClose,
  selectedDate,
  onTemplateSelect,
  onHolidaySelect,
  cycleMode,
  onCycleModeToggle,
  cycleStart,
  cycleEnd,
  onCycleGenerate,
  applying,
}: Props) {
  const { data: templates, isLoading } = useShiftTemplates();
  const deleteTemplate = useDeleteTemplate();

  const [view, setView] = useState<View>("main");
  const [editTarget, setEditTarget] = useState<ShiftTemplate | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const cycleRangeReady = !!(cycleStart && cycleEnd);

  const cycleRangeLabel = (() => {
    if (!cycleStart) return "尚未選取";
    if (!cycleEnd) return `${cycleStart} → 請點選結束日`;
    const start = cycleStart <= cycleEnd ? cycleStart : cycleEnd;
    const end = cycleStart <= cycleEnd ? cycleEnd : cycleStart;
    const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
    return `${start} → ${end}（${days} 天）`;
  })();

  const openAdd = () => {
    setEditTarget(undefined);
    setDialogOpen(true);
  };

  const openEdit = (t: ShiftTemplate) => {
    setEditTarget(t);
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteTemplate.mutateAsync(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClose = () => {
    setView("main");
    onClose();
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 bg-card border-t border-card-border shadow-2xl rounded-t-2xl overflow-hidden"
          >
            <AnimatePresence mode="wait">
              {view === "main" ? (
                <motion.div
                  key="main"
                  initial={{ x: 0 }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 320 }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border">
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">
                        {cycleMode ? "🔄 週期輪班 — 圈選基準週期" : "快捷排班"}
                      </h3>
                      {cycleMode ? (
                        <p className="text-xs text-green-600 font-medium mt-0.5">{cycleRangeLabel}</p>
                      ) : selectedDate ? (
                        <p className="text-xs text-primary font-medium mt-0.5">選取日期：{selectedDate} → 點班次自動跳下一天</p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5">點選行事曆日期開始排班</p>
                      )}
                    </div>
                    <button
                      onClick={handleClose}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="px-4 py-3">
                    {cycleMode ? (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                          <CalendarRange className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>在行事曆上點選起始日，再點選結束日，圈定基準週期（最多 30 天）。圈選後按下方「生成週期班表」。</span>
                        </div>
                        {cycleRangeReady && (
                          <button
                            onClick={onCycleGenerate}
                            disabled={applying}
                            className="w-full py-2.5 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                          >
                            <Repeat className="w-4 h-4" />
                            {applying ? "生成中..." : "生成週期班表"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {isLoading ? (
                          <div className="flex gap-2 flex-wrap">
                            {[1, 2, 3, 4].map((i) => (
                              <div key={i} className="h-10 w-24 bg-muted rounded-xl animate-pulse" />
                            ))}
                          </div>
                        ) : (templates ?? []).length === 0 ? (
                          <div className="text-center py-3 text-muted-foreground text-sm">
                            尚無班次模板，請點「班次設定」新增
                          </div>
                        ) : (
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={onHolidaySelect}
                              disabled={!selectedDate || applying}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-40"
                            >
                              <Palmtree className="w-3.5 h-3.5" />
                              休假
                            </button>
                            {(templates ?? []).map((t) => (
                              <button
                                key={t.id}
                                onClick={() => onTemplateSelect(t)}
                                disabled={!selectedDate || applying}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
                                style={{ backgroundColor: t.color }}
                              >
                                <span>{t.name || "未命名"}</span>
                                <span className="text-white/70 text-xs">{t.startTime}–{t.endTime}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Bottom action buttons */}
                  <div className="px-4 pb-4 flex gap-2">
                    <button
                      onClick={() => setView("settings")}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors border border-border"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      班次設定
                    </button>
                    <button
                      onClick={onCycleModeToggle}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                        cycleMode
                          ? "bg-green-500 text-white border-green-500 hover:bg-green-600"
                          : "bg-muted text-foreground border-border hover:bg-muted/80"
                      }`}
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      {cycleMode ? "退出週期" : "週期輪班"}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="settings"
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 320 }}
                >
                  {/* Settings Header */}
                  <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setView("main")}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <h3 className="font-semibold text-foreground text-sm">班次設定</h3>
                    </div>
                    <button
                      onClick={handleClose}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Settings Content */}
                  <div className="px-4 py-3 max-h-64 overflow-y-auto">
                    {isLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
                        ))}
                      </div>
                    ) : (templates ?? []).length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        尚無班次模板，點下方「新增班次」開始建立
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(templates ?? []).map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-background"
                          >
                            {/* Color dot */}
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: t.color }}
                            />
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground truncate">
                                {t.name || "未命名"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t.startTime} – {t.endTime}
                              </div>
                            </div>
                            {/* Actions */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEdit(t)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(t.id)}
                                disabled={deletingId === t.id}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-500 disabled:opacity-40"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Settings Footer */}
                  <div className="px-4 pb-4 pt-2 border-t border-border">
                    <button
                      onClick={openAdd}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
                    >
                      <Plus className="w-4 h-4" />
                      新增班次
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Template create/edit dialog */}
      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editTemplate={editTarget}
      />
    </>
  );
}

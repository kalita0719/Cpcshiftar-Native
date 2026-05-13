import { useState } from "react";
import { Settings2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function ls(key: string, fallback = "") {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function ss(key: string, val: string) {
  try { localStorage.setItem(key, val); } catch {}
}

const K = {
  salary:          "ot_base_salary",
  startDay:        "ot_start_day",
  handoverEnabled: "ot_handover_enabled",
  midAllowance:    "ot_mid_allowance",
  nightAllowance:  "ot_night_allowance",
};

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors duration-300 flex-shrink-0 ${value ? "bg-primary" : "bg-muted-foreground/30"}`}
    >
      <motion.span
        animate={{ x: value ? 20 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow block"
      />
    </button>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

export default function OvertimeSettingsDialog() {
  const [open, setOpen] = useState(false);
  const [salary,      setSalaryRaw]      = useState(() => ls(K.salary));
  const [startDayStr, setStartDayStr]    = useState(() => ls(K.startDay, "1"));
  const [handover,    setHandoverRaw]    = useState(() => ls(K.handoverEnabled, "false") === "true");
  const [midAmt,      setMidAmtRaw]      = useState(() => ls(K.midAllowance));
  const [nightAmt,    setNightAmtRaw]    = useState(() => ls(K.nightAllowance));

  const commitStartDay = (raw: string) => {
    const n = Math.min(28, Math.max(1, parseInt(raw) || 1));
    setStartDayStr(String(n));
    ss(K.startDay, String(n));
  };

  const set = {
    salary:   (v: string)  => { setSalaryRaw(v);   ss(K.salary, v); },
    handover: (v: boolean) => { setHandoverRaw(v); ss(K.handoverEnabled, String(v)); },
    midAmt:   (v: string)  => { setMidAmtRaw(v);   ss(K.midAllowance, v); },
    nightAmt: (v: string)  => { setNightAmtRaw(v); ss(K.nightAllowance, v); },
  };

  const baseSalary = parseFloat(salary) || 0;
  const hourlyRate = baseSalary / 240;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-colors"
        aria-label="加班費設定"
      >
        <Settings2 className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="fixed top-16 right-4 z-50 w-[min(380px,calc(100vw-2rem))] bg-card border border-card-border rounded-2xl shadow-xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-primary" />
                  加班費設定
                </h2>
                <button
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-lg leading-none"
                  aria-label="關閉"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <SettingRow label="月底薪（元）">
                  <NumInput value={salary} onChange={set.salary} placeholder="例：40000" />
                </SettingRow>
                <SettingRow label="薪資計算起始日（每月）">
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={1} max={28}
                      value={startDayStr}
                      onChange={(e) => setStartDayStr(e.target.value)}
                      onBlur={(e) => commitStartDay(e.target.value)}
                      className="w-20 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="text-sm text-muted-foreground">號</span>
                  </div>
                </SettingRow>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">啟用交接班</p>
                    <p className="text-xs text-muted-foreground mt-0.5">每班提早 15 分鐘上班、延後 15 分鐘下班（+0.5h），與當日加班合併累進計算</p>
                  </div>
                  <Toggle value={handover} onChange={set.handover} />
                </div>
              </div>

              <div className="border-t border-border pt-4 grid grid-cols-2 gap-4">
                <SettingRow label="中班津貼（元 / 次）">
                  <NumInput value={midAmt} onChange={set.midAmt} placeholder="例：200" />
                </SettingRow>
                <SettingRow label="晚班津貼（元 / 次）">
                  <NumInput value={nightAmt} onChange={set.nightAmt} placeholder="例：300" />
                </SettingRow>
              </div>

              {baseSalary > 0 && (
                <div className="border-t border-border pt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>時薪基數：<strong className="text-foreground">${hourlyRate.toFixed(1)}</strong> 元</span>
                  <span>1.33×：<strong className="text-foreground">${(hourlyRate * 1.33).toFixed(1)}</strong></span>
                  <span>1.66×：<strong className="text-foreground">${(hourlyRate * 1.66).toFixed(1)}</strong></span>
                  <span>2.0×：<strong className="text-foreground">${(hourlyRate * 2.0).toFixed(1)}</strong></span>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

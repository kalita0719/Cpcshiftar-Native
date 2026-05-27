/** 時薪 = 底薪 ÷ 240，四捨五入至小數點第一位 */
export function hourlyRateFromBaseSalary(baseSalary: number): number {
  if (baseSalary <= 0) return 0;
  return Math.round((baseSalary / 240) * 10) / 10;
}

export type BracketHours = { b133: number; b166: number; b266: number };

/**
 * 依各倍率「合計時數」計算加班費（先加總每月各段時數再計算）：
 * 1.33× → 時薪 × 時數 × 4/3；1.66× → × 5/3；2.66× → × 8/3
 */
export function bracketOvertimePay(hourlyRate: number, hours: BracketHours): number {
  if (hourlyRate <= 0) return 0;
  const { b133, b166, b266 } = hours;
  return (
    hourlyRate * b133 * (4 / 3) +
    hourlyRate * b166 * (5 / 3) +
    hourlyRate * b266 * (8 / 3)
  );
}

/** 1.33× 費率（交接班等）：時薪 × 時數 × 4/3 */
export function overtimeRate133Pay(hourlyRate: number, hours: number): number {
  if (hourlyRate <= 0 || hours <= 0) return 0;
  return hourlyRate * hours * (4 / 3);
}

export function hourlyRateAt133(hourlyRate: number): number {
  return hourlyRate * (4 / 3);
}

export function hourlyRateAt166(hourlyRate: number): number {
  return hourlyRate * (5 / 3);
}

export function hourlyRateAt266(hourlyRate: number): number {
  return hourlyRate * (8 / 3);
}

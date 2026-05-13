export type ShiftItem = {
  id: number;
  name: string;
  color: string;
  startTime: string;
  endTime: string;
  date: string;
  notes?: string | null;
  createdAt: string;
};

export type ShiftTemplate = {
  id: number;
  name: string;
  color: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
  createdAt: string;
};

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

export type AppSettings = {
  baseSalary: string;
  startDay: string;
  handoverEnabled: boolean;
  midAllowance: string;
  nightAllowance: string;
  nextShiftId: number;
  nextTemplateId: number;
  nextOvertimeId: number;
};

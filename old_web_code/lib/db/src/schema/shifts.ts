import { pgTable, text, serial, timestamp, unique, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shiftTemplatesTable = pgTable("shift_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#0d9488"),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertShiftTemplateSchema = createInsertSchema(shiftTemplatesTable).omit({ id: true, createdAt: true });
export type InsertShiftTemplate = z.infer<typeof insertShiftTemplateSchema>;
export type ShiftTemplate = typeof shiftTemplatesTable.$inferSelect;

export const shiftsTable = pgTable("shifts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#0d9488"),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  date: text("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique("shifts_date_unique").on(t.date)]);

export const insertShiftSchema = createInsertSchema(shiftsTable).omit({ id: true, createdAt: true });
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shiftsTable.$inferSelect;


export const overtimeTable = pgTable("overtime", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  hours: numeric("hours", { precision: 5, scale: 2 }).notNull(),
  earlyHours: numeric("early_hours", { precision: 5, scale: 2 }).notNull().default("0"),
  lateHours: numeric("late_hours", { precision: 5, scale: 2 }).notNull().default("0"),
  earlyClassHours: numeric("early_class_hours", { precision: 5, scale: 2 }).notNull().default("0"),
  lateClassHours: numeric("late_class_hours", { precision: 5, scale: 2 }).notNull().default("0"),
  leaveStart: text("leave_start"),
  leaveEnd: text("leave_end"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique("overtime_date_unique").on(t.date)]);

export const insertOvertimeSchema = createInsertSchema(overtimeTable).omit({ id: true, createdAt: true });
export type InsertOvertime = z.infer<typeof insertOvertimeSchema>;
export type Overtime = typeof overtimeTable.$inferSelect;

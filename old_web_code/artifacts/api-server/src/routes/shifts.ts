import { Router } from "express";
import { db } from "@workspace/db";
import { shiftsTable, shiftTemplatesTable } from "@workspace/db";
import { eq, gte, lte, and, count, sql } from "drizzle-orm";
import { z } from "zod";
import {
  CreateShiftBody,
  GetShiftParams,
  UpdateShiftBody,
  UpdateShiftParams,
  DeleteShiftParams,
  GetWeeklyShiftsQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const shifts = await db.select().from(shiftsTable).orderBy(shiftsTable.date, shiftsTable.startTime);
    const result = shifts.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
    }));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list shifts");
    res.status(500).json({ error: "Failed to list shifts" });
  }
});

router.get("/week", async (req, res) => {
  try {
    const params = GetWeeklyShiftsQueryParams.safeParse(req.query);
    if (!params.success) {
      return res.status(400).json({ error: "Invalid params" });
    }
    const { weekStart } = params.data;
    const weekStartDate = new Date(weekStart as string);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);

    const startStr = weekStartDate.toISOString().slice(0, 10);
    const endStr = weekEndDate.toISOString().slice(0, 10);

    const shifts = await db
      .select()
      .from(shiftsTable)
      .where(and(gte(shiftsTable.date, startStr), lte(shiftsTable.date, endStr)))
      .orderBy(shiftsTable.date, shiftsTable.startTime);

    res.json(shifts.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to get weekly shifts");
    res.status(500).json({ error: "Failed to get weekly shifts" });
  }
});

router.get("/summary", async (req, res) => {
  try {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const monthEndStr = monthEnd.toISOString().slice(0, 10);

    const [totalResult] = await db.select({ count: count() }).from(shiftsTable);
    const [weekResult] = await db
      .select({ count: count() })
      .from(shiftsTable)
      .where(and(gte(shiftsTable.date, weekStartStr), lte(shiftsTable.date, weekEndStr)));
    const [monthResult] = await db
      .select({ count: count() })
      .from(shiftsTable)
      .where(and(gte(shiftsTable.date, monthStartStr), lte(shiftsTable.date, monthEndStr)));

    const weekShifts = await db
      .select()
      .from(shiftsTable)
      .where(and(gte(shiftsTable.date, weekStartStr), lte(shiftsTable.date, weekEndStr)));

    let totalHoursThisWeek = 0;
    for (const shift of weekShifts) {
      const [sh, sm] = shift.startTime.split(":").map(Number);
      const [eh, em] = shift.endTime.split(":").map(Number);
      let hours = eh - sh + (em - sm) / 60;
      if (hours < 0) hours += 24;
      totalHoursThisWeek += hours;
    }

    res.json({
      totalShifts: totalResult?.count ?? 0,
      shiftsThisWeek: weekResult?.count ?? 0,
      shiftsThisMonth: monthResult?.count ?? 0,
      totalHoursThisWeek: Math.round(totalHoursThisWeek * 10) / 10,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get shift summary");
    res.status(500).json({ error: "Failed to get shift summary" });
  }
});

const WeekdayBulkBody = z.object({
  mode: z.literal("weekday"),
  templateId: z.number().int().positive(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  notes: z.string().optional(),
});

const CycleBulkBody = z.object({
  mode: z.literal("cycle"),
  pattern: z.array(z.number().int().positive().nullable()).min(2).max(30),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

const RawBulkBody = z.object({
  mode: z.literal("raw"),
  shifts: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    name: z.string().min(1),
    color: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    notes: z.string().optional(),
  })).max(400),
});

const BulkShiftBody = z.discriminatedUnion("mode", [WeekdayBulkBody, CycleBulkBody, RawBulkBody]);

type ShiftRow = { name: string; color: string; startTime: string; endTime: string; date: string; notes?: string | null };

router.post("/bulk", async (req, res) => {
  try {
    const body = BulkShiftBody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error });

    const rows: ShiftRow[] = [];

    if (body.data.mode === "raw") {
      for (const s of body.data.shifts) {
        rows.push({ date: s.date, name: s.name, color: s.color, startTime: s.startTime, endTime: s.endTime, notes: s.notes ?? null });
      }
    } else {
      const { startDate, endDate, notes } = body.data;
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return res.status(400).json({ error: "endDate must be after startDate" });

      if (body.data.mode === "weekday") {
        const [template] = await db
          .select()
          .from(shiftTemplatesTable)
          .where(eq(shiftTemplatesTable.id, body.data.templateId));
        if (!template) return res.status(404).json({ error: "Template not found" });

        const daysSet = new Set(body.data.daysOfWeek);
        for (let i = 0; i <= diffDays; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          if (daysSet.has(d.getDay())) {
            rows.push({ name: template.name, color: template.color, startTime: template.startTime, endTime: template.endTime, date: d.toISOString().slice(0, 10), notes: notes ?? null });
          }
        }
      } else {
        const pattern = body.data.pattern;
        const templateIds = [...new Set(pattern.filter((id): id is number => id !== null))];
        const templates = templateIds.length > 0
          ? await db.select().from(shiftTemplatesTable).where(
              templateIds.length === 1
                ? eq(shiftTemplatesTable.id, templateIds[0])
                : sql`${shiftTemplatesTable.id} = ANY(${sql.raw(`ARRAY[${templateIds.join(",")}]::integer[]`)})`,
            )
          : [];
        const tplMap = new Map(templates.map((t) => [t.id, t]));

        for (let i = 0; i <= diffDays; i++) {
          const templateId = pattern[i % pattern.length];
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          const dateStr = d.toISOString().slice(0, 10);
          if (templateId === null) {
            rows.push({ name: "休假", color: "#94a3b8", startTime: "00:00", endTime: "00:00", date: dateStr, notes: notes ?? null });
          } else {
            const t = tplMap.get(templateId);
            if (!t) continue;
            rows.push({ name: t.name, color: t.color, startTime: t.startTime, endTime: t.endTime, date: dateStr, notes: notes ?? null });
          }
        }
      }
    }

    if (rows.length === 0) return res.json({ created: 0 });

    for (const row of rows) {
      await db.insert(shiftsTable).values(row).onConflictDoUpdate({
        target: shiftsTable.date,
        set: { name: row.name, color: row.color, startTime: row.startTime, endTime: row.endTime, notes: row.notes },
      });
    }

    res.json({ created: rows.length });
  } catch (err) {
    req.log.error({ err }, "Failed to bulk create shifts");
    res.status(500).json({ error: "Failed to bulk create shifts" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const params = GetShiftParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json({ error: "Invalid ID" });

    const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, params.data.id));
    if (!shift) return res.status(404).json({ error: "Shift not found" });
    res.json({ ...shift, createdAt: shift.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to get shift");
    res.status(500).json({ error: "Failed to get shift" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreateShiftBody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error });

    const [shift] = await db
      .insert(shiftsTable)
      .values(body.data)
      .onConflictDoUpdate({
        target: shiftsTable.date,
        set: {
          name: body.data.name,
          color: body.data.color,
          startTime: body.data.startTime,
          endTime: body.data.endTime,
          notes: body.data.notes ?? null,
        },
      })
      .returning();

    res.status(201).json({ ...shift, createdAt: shift.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to create shift");
    res.status(500).json({ error: "Failed to create shift" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const params = UpdateShiftParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json({ error: "Invalid ID" });

    const body = UpdateShiftBody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error });

    const [shift] = await db
      .update(shiftsTable)
      .set(body.data)
      .where(eq(shiftsTable.id, params.data.id))
      .returning();

    if (!shift) return res.status(404).json({ error: "Shift not found" });
    res.json({ ...shift, createdAt: shift.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to update shift");
    res.status(500).json({ error: "Failed to update shift" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const params = DeleteShiftParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json({ error: "Invalid ID" });

    await db.delete(shiftsTable).where(eq(shiftsTable.id, params.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete shift");
    res.status(500).json({ error: "Failed to delete shift" });
  }
});

export default router;

import { Router } from "express";
import { db } from "@workspace/db";
import { overtimeTable } from "@workspace/db";
import { eq, gte, lte, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const OvertimeBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  earlyHours: z.number().min(0).max(5),
  lateHours: z.number().min(0).max(5),
  earlyClassHours: z.number().min(0).max(5).default(0),
  lateClassHours: z.number().min(0).max(5).default(0),
  leaveStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  leaveEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().optional(),
});

function serialize(o: typeof overtimeTable.$inferSelect) {
  const earlyHours = Number(o.earlyHours ?? 0);
  const lateHours = Number(o.lateHours ?? 0);
  const earlyClassHours = Number(o.earlyClassHours ?? 0);
  const lateClassHours = Number(o.lateClassHours ?? 0);
  return {
    ...o,
    hours: earlyHours + lateHours,
    earlyHours,
    lateHours,
    earlyClassHours,
    lateClassHours,
    leaveStart: o.leaveStart ?? null,
    leaveEnd: o.leaveEnd ?? null,
    createdAt: o.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const { from, to } = req.query;
    if (from && to) {
      const rows = await db
        .select()
        .from(overtimeTable)
        .where(and(gte(overtimeTable.date, String(from)), lte(overtimeTable.date, String(to))));
      return res.json(rows.map(serialize));
    }
    const rows = await db.select().from(overtimeTable);
    res.json(rows.map(serialize));
  } catch (err) {
    req.log.error({ err }, "Failed to list overtime");
    res.status(500).json({ error: "Failed to list overtime" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = OvertimeBody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error });

    const { date, earlyHours, lateHours, earlyClassHours, lateClassHours, leaveStart, leaveEnd, notes } = body.data;
    const totalHours = earlyHours + lateHours;

    const [row] = await db
      .insert(overtimeTable)
      .values({
        date,
        hours: String(totalHours),
        earlyHours: String(earlyHours),
        lateHours: String(lateHours),
        earlyClassHours: String(earlyClassHours),
        lateClassHours: String(lateClassHours),
        leaveStart: leaveStart ?? null,
        leaveEnd: leaveEnd ?? null,
        notes: notes ?? null,
      })
      .onConflictDoUpdate({
        target: overtimeTable.date,
        set: {
          hours: String(totalHours),
          earlyHours: String(earlyHours),
          lateHours: String(lateHours),
          earlyClassHours: String(earlyClassHours),
          lateClassHours: String(lateClassHours),
          leaveStart: leaveStart ?? null,
          leaveEnd: leaveEnd ?? null,
          notes: notes ?? null,
        },
      })
      .returning();

    res.status(201).json(serialize(row));
  } catch (err) {
    req.log.error({ err }, "Failed to upsert overtime");
    res.status(500).json({ error: "Failed to upsert overtime" });
  }
});

router.delete("/:date", async (req, res) => {
  try {
    const date = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Invalid date" });
    await db.delete(overtimeTable).where(eq(overtimeTable.date, date));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete overtime");
    res.status(500).json({ error: "Failed to delete overtime" });
  }
});

export default router;

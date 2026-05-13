import { Router } from "express";
import { db } from "@workspace/db";
import { shiftTemplatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const TemplateBody = z.object({
  name: z.string(),
  color: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  notes: z.string().nullable().optional(),
});

function serialize(t: typeof shiftTemplatesTable.$inferSelect) {
  return { ...t, createdAt: t.createdAt.toISOString() };
}

const DEFAULT_TEMPLATES = [
  { name: "早班", color: "#f59e0b", startTime: "07:00", endTime: "15:00" },
  { name: "午班", color: "#0d9488", startTime: "15:00", endTime: "23:00" },
  { name: "夜班", color: "#6366f1", startTime: "23:00", endTime: "07:00" },
];

router.get("/", async (req, res) => {
  try {
    let templates = await db
      .select()
      .from(shiftTemplatesTable)
      .orderBy(shiftTemplatesTable.createdAt);

    if (templates.length === 0) {
      const inserted = await db
        .insert(shiftTemplatesTable)
        .values(DEFAULT_TEMPLATES)
        .returning();
      templates = inserted;
    }

    res.json(templates.map(serialize));
  } catch (err) {
    req.log.error({ err }, "Failed to list templates");
    res.status(500).json({ error: "Failed to list templates" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = TemplateBody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error });
    const [t] = await db.insert(shiftTemplatesTable).values(body.data).returning();
    res.status(201).json(serialize(t));
  } catch (err) {
    req.log.error({ err }, "Failed to create template");
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    const body = TemplateBody.partial().safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error });
    const [t] = await db
      .update(shiftTemplatesTable)
      .set(body.data)
      .where(eq(shiftTemplatesTable.id, id))
      .returning();
    if (!t) return res.status(404).json({ error: "Not found" });
    res.json(serialize(t));
  } catch (err) {
    req.log.error({ err }, "Failed to update template");
    res.status(500).json({ error: "Failed to update template" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });
    await db.delete(shiftTemplatesTable).where(eq(shiftTemplatesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete template");
    res.status(500).json({ error: "Failed to delete template" });
  }
});

export default router;

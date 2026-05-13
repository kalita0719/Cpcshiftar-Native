import { Router, type IRouter } from "express";
import healthRouter from "./health";
import shiftsRouter from "./shifts";
import templatesRouter from "./templates";
import overtimeRouter from "./overtime";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/shifts", shiftsRouter);
router.use("/shift-templates", templatesRouter);
router.use("/overtime", overtimeRouter);

export default router;

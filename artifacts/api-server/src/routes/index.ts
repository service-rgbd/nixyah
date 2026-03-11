import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import chefsRouter from "./chefs.js";
import storiesRouter from "./stories.js";
import ordersRouter from "./orders.js";
import chatsRouter from "./chats.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(chefsRouter);
router.use(storiesRouter);
router.use(ordersRouter);
router.use(chatsRouter);

export default router;

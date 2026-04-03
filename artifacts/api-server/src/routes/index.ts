import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import chefsRouter from "./chefs.js";
import chefRouter from "./chef.js";
import pushRouter from "./push.js";
import storiesRouter from "./stories.js";
import cartRouter from "./cart.js";
import uploadsRouter from "./uploads.js";
import ordersRouter from "./orders.js";
import chatsRouter from "./chats.js";
import deliveryRouter from "./delivery.js";
import customRequestsRouter from "./custom-requests.js";
import commerceRouter from "./commerce.js";
import merchantRouter from "./merchant.js";
import adminRouter from "./admin.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(chefsRouter);
router.use("/chef", chefRouter);
router.use(storiesRouter);
router.use("/push", pushRouter);
router.use(cartRouter);
router.use(uploadsRouter);
router.use(ordersRouter);
router.use(customRequestsRouter);
router.use(chatsRouter);
router.use(deliveryRouter);
router.use(commerceRouter);
router.use(merchantRouter);
router.use(adminRouter);

export default router;

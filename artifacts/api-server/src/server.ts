import app from "./app.js";
import { notifyExpiredOrders } from "./lib/chef-followers.js";
import { expirePendingMealOrders, ORDER_PENDING_WINDOW_MS } from "./lib/order-window.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${port}`);
});

async function runPendingOrderExpirySweep() {
  try {
    const expiredOrderIds = await expirePendingMealOrders();
    if (expiredOrderIds.length > 0) {
      await notifyExpiredOrders(expiredOrderIds);
      console.log(`[orders] expired ${expiredOrderIds.length} pending order(s)`);
    }
  } catch (error) {
    console.error("[orders] pending expiry sweep failed", error);
  }
}

void runPendingOrderExpirySweep();
setInterval(() => {
  void runPendingOrderExpirySweep();
}, Math.max(60_000, Math.floor(ORDER_PENDING_WINDOW_MS / 3)));

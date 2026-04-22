import { Router, type IRouter } from "express";
import { buildAndroidAssetLinks, buildAppleAppSiteAssociation } from "../lib/passkeys.js";

const router: IRouter = Router();

router.get("/.well-known/apple-app-site-association", (_req, res) => {
  res.type("application/json").send(buildAppleAppSiteAssociation());
});

router.get("/.well-known/assetlinks.json", (_req, res) => {
  res.json(buildAndroidAssetLinks());
});

export default router;

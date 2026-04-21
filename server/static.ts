import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { injectSeoIntoHtml, isNoIndexPath } from "@shared/seo";

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist/public");
  const indexPath = path.resolve(distPath, "index.html");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, { index: false }));

  // Fall through to index.html if the file doesn't exist, while injecting
  // route-aware SEO meta tags into the HTML shell.
  app.use("*", (req, res) => {
    const rawHtml = fs.readFileSync(indexPath, "utf8");
    const origin = `${req.protocol}://${req.get("host")}`;
    const html = injectSeoIntoHtml(rawHtml, req.path, origin);
    res.setHeader("Cache-Control", "no-store");
    if (isNoIndexPath(req.path)) {
      res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    }
    res.type("html").send(html);
  });
}

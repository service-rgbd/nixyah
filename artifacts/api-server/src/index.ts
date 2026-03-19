import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load env files from workspace root BEFORE any other imports.
// `.env` provides the base configuration and `.env.local` only fills missing values.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../../..");

const localPath = path.join(workspaceRoot, ".env.local");
const envPath = path.join(workspaceRoot, ".env");

const loaded: string[] = [];

if (fs.existsSync(envPath)) {
	dotenv.config({ path: envPath });
	loaded.push(".env");
}

if (fs.existsSync(localPath)) {
	dotenv.config({ path: localPath });
	loaded.push(".env.local");
}

if (loaded.length > 0) {
	console.log(`[env] loaded ${loaded.join(" + ")}`);
} else {
	console.warn("[env] no .env or .env.local found in workspace root");
}

// Now that env vars are loaded, import and run the server
import("./server.js");


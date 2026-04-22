type CheckResult = {
  name: string;
  ok: boolean;
  status: number;
  detail: string;
};

function getEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function describePayload(payload: unknown): string {
  if (typeof payload === "string") {
    return payload.slice(0, 200);
  }

  const objectValue = asObject(payload);
  if (!objectValue) {
    return String(payload);
  }

  const message = objectValue.message;
  const error = objectValue.error;
  if (typeof message === "string") {
    return message;
  }
  if (typeof error === "string") {
    return error;
  }
  return JSON.stringify(objectValue).slice(0, 200);
}

async function login(apiBaseUrl: string, loginId: string, password: string) {
  const response = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailOrPhone: loginId, password }),
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(`Login failed (${response.status}): ${describePayload(payload)}`);
  }

  const token = asObject(payload)?.token;
  if (typeof token !== "string" || !token) {
    throw new Error("Login succeeded but no token was returned.");
  }

  return token;
}

async function checkCourierPresign(apiBaseUrl: string, token: string): Promise<CheckResult> {
  const response = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/uploads/presign`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: "piece.jpg",
      contentType: "image/jpeg",
      purpose: "courier-document",
      fileSize: 12345,
    }),
  });

  const payload = await readJson(response);
  return {
    name: "courier-document presign",
    ok: response.ok,
    status: response.status,
    detail: describePayload(payload),
  };
}

async function checkCourierDossierRoute(apiBaseUrl: string, token: string): Promise<CheckResult> {
  const response = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/auth/me/courier-dossier`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const payload = await readJson(response);
  return {
    name: "courier dossier route",
    ok: response.status !== 404,
    status: response.status,
    detail: describePayload(payload),
  };
}

async function checkAdminCouriersRoute(apiBaseUrl: string, token: string): Promise<CheckResult> {
  const response = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/admin/couriers`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await readJson(response);
  return {
    name: "admin couriers route",
    ok: response.ok,
    status: response.status,
    detail: describePayload(payload),
  };
}

async function main() {
  const apiBaseUrl = getEnv("CHECK_API_BASE_URL") ?? "https://api.nixyah.com/api";
  const loginId = getEnv("CHECK_LOGIN_ID");
  const password = getEnv("CHECK_PASSWORD");

  if (!loginId || !password) {
    console.error("Missing CHECK_LOGIN_ID or CHECK_PASSWORD.");
    console.error("Example:");
    console.error("CHECK_LOGIN_ID=admin@nixyah.ci CHECK_PASSWORD=... pnpm run check:deployed:courier-upload");
    process.exit(1);
  }

  console.log(`Checking deployed courier upload compatibility against ${apiBaseUrl}`);
  const token = await login(apiBaseUrl, loginId, password);
  const results = await Promise.all([
    checkCourierPresign(apiBaseUrl, token),
    checkCourierDossierRoute(apiBaseUrl, token),
    checkAdminCouriersRoute(apiBaseUrl, token),
  ]);

  let hasFailure = false;
  for (const result of results) {
    const prefix = result.ok ? "PASS" : "FAIL";
    console.log(`${prefix} ${result.name}: HTTP ${result.status}${result.detail ? ` - ${result.detail}` : ""}`);
    if (!result.ok) {
      hasFailure = true;
    }
  }

  if (hasFailure) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
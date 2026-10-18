#!/usr/bin/env node
// Push vapi/system-prompt.md and vapi/assistant.json to the Vapi assistant used by the browser call.
//
//   node scripts/vapi-sync.mjs --dry-run   # print the update without sending it
//   node scripts/vapi-sync.mjs             # apply it
//
// Needs VAPI_PRIVATE_KEY (a Vapi *private* key; keep it out of NEXT_PUBLIC_ variables), NEXT_PUBLIC_VAPI_ASSISTANT_CONFIG (or the older NEXT_PUBLIC_VAPI_ASSISTANT_ID),
// APP_BASE_URL (the deployed app, for the tool URL) and either VAPI_TOOL_CREDENTIAL_ID (preferred: the Vapi custom
// credential that sends x-vapi-secret) or VAPI_SERVER_SECRET. The assistant's model provider and model are kept as set
// in the Vapi dashboard; this only replaces the system prompt, the call settings and the Neeley tools.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.vapi.ai";
const dryRun = process.argv.includes("--dry-run");

const env = (k) => process.env[k]?.trim() || "";
const key = env("VAPI_PRIVATE_KEY");
const assistantId = env("VAPI_ASSISTANT_ID") || env("NEXT_PUBLIC_VAPI_ASSISTANT_CONFIG") || env("NEXT_PUBLIC_VAPI_ASSISTANT_ID");
const baseUrl = env("APP_BASE_URL").replace(/\/+$/, "");
const credentialId = env("VAPI_TOOL_CREDENTIAL_ID");
const secret = env("VAPI_SERVER_SECRET");

const missing = [
  !key && "VAPI_PRIVATE_KEY",
  !assistantId && "NEXT_PUBLIC_VAPI_ASSISTANT_CONFIG",
  !baseUrl && "APP_BASE_URL",
  !credentialId && !secret && "VAPI_TOOL_CREDENTIAL_ID or VAPI_SERVER_SECRET",
].filter(Boolean);
if (missing.length) {
  console.error(`Missing: ${missing.join(", ")}`);
  process.exit(1);
}
if (!/^https:\/\//.test(baseUrl)) {
  console.error("APP_BASE_URL must be the public https URL Vapi can reach, e.g. https://your-app.vercel.app");
  process.exit(1);
}

const prompt = fs.readFileSync(path.join(root, "vapi", "system-prompt.md"), "utf8").trim();
const config = JSON.parse(fs.readFileSync(path.join(root, "vapi", "assistant.json"), "utf8"));

async function vapi(method, url, body) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} failed: ${res.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

const ours = new Set(config.tools.map((t) => t.name));
const current = await vapi("GET", `/assistant/${assistantId}`);
const model = current.model ?? {};
if (!model.provider || !model.model) {
  console.error("The assistant has no model selected. Pick a provider and model in the Vapi dashboard first, then rerun.");
  process.exit(1);
}

// Saved tools attached by id (for example a neeley_advising_answer tool made in the dashboard) are replaced by the
// inline tools below; any other attached tools are kept.
const keptToolIds = [];
for (const id of model.toolIds ?? []) {
  const tool = await vapi("GET", `/tool/${id}`).catch(() => null);
  if (tool?.function?.name && ours.has(tool.function.name)) console.log(`Detaching saved tool ${tool.function.name} (${id}); it is now defined inline.`);
  else keptToolIds.push(id);
}

const server = (timeoutSeconds) => ({
  url: `${baseUrl}/api/vapi/tools`,
  timeoutSeconds,
  ...(credentialId ? { credentialId } : { headers: { "x-vapi-secret": secret } }),
});

const tools = [
  ...(model.tools ?? []).filter((t) => !(t.type === "function" && ours.has(t.function?.name)) && t.type !== "endCall"),
  ...config.tools.map((t) => {
    const s = config.toolSettings[t.name] ?? {};
    return {
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
      server: server(s.timeoutSeconds ?? 20),
      messages: s.requestStart ? [{ type: "request-start", content: s.requestStart }] : undefined,
    };
  }),
  { type: "endCall" },
];

const update = {
  name: config.name,
  firstMessage: config.firstMessage,
  firstMessageMode: config.firstMessageMode,
  endCallMessage: config.endCallMessage,
  maxDurationSeconds: config.maxDurationSeconds,
  model: {
    ...model,
    ...config.model,
    messages: [{ role: "system", content: prompt }, ...(model.messages ?? []).filter((m) => m.role !== "system")],
    tools,
    toolIds: keptToolIds,
  },
};

if (dryRun) {
  const shown = JSON.stringify(update, null, 2).replaceAll(secret || "\u0000", "<VAPI_SERVER_SECRET>");
  console.log(shown);
  console.log(`\nDry run: nothing was sent. ${tools.length} tools, prompt ${prompt.length} characters.`);
} else {
  await vapi("PATCH", `/assistant/${assistantId}`, update);
  console.log(`Updated assistant ${assistantId}: ${config.tools.length} Neeley tools at ${baseUrl}/api/vapi/tools, prompt ${prompt.length} characters.`);
}

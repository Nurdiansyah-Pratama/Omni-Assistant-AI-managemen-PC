import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { requestAiChat } from "./ai/ai_router";
import {
  handleOfficeRequest,
  type OfficeRequestPayload,
} from "./office_integration";

const DEFAULT_PORT = 17878;
const MAX_BODY_BYTES = 512 * 1024;

let server: http.Server | null = null;

function getPort() {
  return Number(process.env.OMNI_LOCAL_API_PORT) || DEFAULT_PORT;
}

function getStaticRoot() {
  const candidates = [
    path.join(process.cwd(), "office-addin", "src"),
    path.join(app.getAppPath(), "office-addin", "src"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

function sendJson(
  response: http.ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  response.end(body);
}

function sendText(
  response: http.ServerResponse,
  statusCode: number,
  body: string,
  contentType = "text/plain; charset=utf-8",
) {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
  });
  response.end(body);
}

function contentTypeFor(filePath: string) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".xml")) return "application/xml; charset=utf-8";
  return "application/octet-stream";
}

function readRequestBody(request: http.IncomingMessage) {
  return new Promise<unknown>((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Payload terlalu besar."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("JSON request tidak valid."));
      }
    });
    request.on("error", reject);
  });
}

function officeActionFromPath(pathname: string) {
  const map: Record<string, string> = {
    "/api/office/chat": "chat",
    "/api/office/analyze": "explain",
    "/api/office/rewrite": "rewrite",
    "/api/office/summarize": "summarize",
    "/api/office/generate": "generate",
    "/api/office/format": "format",
    "/api/office/excel/formula": "excelFormula",
    "/api/office/excel/analyze": "excelAnalyze",
    "/api/office/powerpoint/generate-slides": "powerpointSlides",
    "/api/office/powerpoint/slides": "powerpointSlides",
    "/api/office/project/create-plan": "projectPlan",
    "/api/office/project/schedule": "projectPlan",
    "/api/office/outlook/draft-email": "outlookEmail",
    "/api/office/outlook/email": "outlookEmail",
  };
  return map[pathname];
}

async function handlePost(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  pathname: string,
) {
  const payload = (await readRequestBody(request)) as Record<string, unknown>;

  if (pathname === "/api/ai/chat") {
    const result = await requestAiChat({
      messages: payload.messages,
      mode:
        payload.mode === "coding" || payload.mode === "design"
          ? payload.mode
          : "general",
      focus: typeof payload.focus === "string" ? payload.focus : undefined,
    });
    sendJson(response, result.ok ? 200 : 400, result);
    return;
  }

  const action = officeActionFromPath(pathname);
  if (!action) {
    sendJson(response, 404, {
      success: false,
      result: "Endpoint tidak ditemukan.",
      suggestedAction: "preview",
      warnings: [],
    });
    return;
  }

  const result = await handleOfficeRequest({
    ...(payload as OfficeRequestPayload),
    action: String(payload.action || action),
  });
  sendJson(response, result.success ? 200 : 400, result);
}

function serveStatic(response: http.ServerResponse, pathname: string) {
  const staticRoot = getStaticRoot();
  const relativePath =
    pathname === "/office" || pathname === "/office/"
      ? "taskpane.html"
      : pathname.replace(/^\/office\//, "");
  const filePath = path.resolve(staticRoot, relativePath);

  if (!filePath.startsWith(path.resolve(staticRoot))) {
    sendText(response, 403, "Forbidden");
    return;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendText(response, 404, "Not found");
    return;
  }

  sendText(
    response,
    200,
    fs.readFileSync(filePath, "utf8"),
    contentTypeFor(filePath),
  );
}

export function initializeLocalApiServer() {
  if (server) return;

  server = http.createServer((request, response) => {
    void (async () => {
      try {
        if (request.method === "OPTIONS") {
          sendJson(response, 204, {});
          return;
        }

        const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
        if (request.method === "GET" && url.pathname === "/api/health") {
          sendJson(response, 200, {
            ok: true,
            name: "Omni Assistant Local API",
            port: getPort(),
            updatedAt: new Date().toISOString(),
          });
          return;
        }
        if (request.method === "GET" && url.pathname.startsWith("/office")) {
          serveStatic(response, url.pathname);
          return;
        }
        if (request.method === "POST") {
          await handlePost(request, response, url.pathname);
          return;
        }

        sendJson(response, 404, { ok: false, error: "Not found" });
      } catch (error) {
        sendJson(response, 500, {
          success: false,
          result:
            error instanceof Error ? error.message : "Local API gagal memproses request.",
          suggestedAction: "preview",
          warnings: [],
        });
      }
    })();
  });

  server.listen(getPort(), "127.0.0.1", () => {
    console.info(`[omni-local-api] listening on http://127.0.0.1:${getPort()}`);
  });
}

export function stopLocalApiServer() {
  server?.close();
  server = null;
}

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT || 8765);

function llmConfig() {
  const key = process.env.LLM_API_KEY || process.env.XAI_API_KEY || process.env.OPENAI_API_KEY || "";
  let base = process.env.LLM_BASE_URL || "";
  let model = process.env.LLM_MODEL || "";
  if (!base && process.env.XAI_API_KEY) base = "https://api.x.ai/v1";
  if (!base && process.env.OPENAI_API_KEY) base = "https://api.openai.com/v1";
  if (!model && base.includes("x.ai")) model = "grok-4";
  if (!model) model = "gpt-4o-mini";
  return { key, base: base.replace(/\/$/, ""), model };
}

function health() {
  const config = llmConfig();
  const configured = Boolean(config.key && config.base);
  return {
    configured,
    model: configured ? config.model : "",
    base: configured ? config.base : "",
    message: configured
      ? ""
      : "还没有模型配置。在启动 server.js 前设置 LLM_API_KEY 和 LLM_BASE_URL，可选 LLM_MODEL。密钥只留在环境变量里。",
  };
}

async function complete(system, user) {
  const config = llmConfig();
  if (!config.key || !config.base) {
    const error = new Error(health().message);
    error.status = 400;
    throw error;
  }
  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  const payload = await postChat(config, { model: config.model, temperature: 0, messages, response_format: { type: "json_object" } });
  if (payload.unsupportedFormat) {
    const retry = await postChat(config, { model: config.model, temperature: 0, messages });
    return { text: retry.text, model: config.model };
  }
  return { text: payload.text, model: config.model };
}

async function postChat(config, body) {
  const response = await fetch(`${config.base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 400 && body.response_format) {
    const message = payload.error?.message || "";
    if (/response_format|json_object/i.test(message)) return { unsupportedFormat: true };
  }
  if (!response.ok) {
    const error = new Error(payload.error?.message || `模型接口返回 ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return { text: payload.choices?.[0]?.message?.content || "" };
}

function send(response, status, body, type) {
  response.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8",
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    if (request.method === "GET" && url.pathname === "/api/health") {
      send(response, 200, JSON.stringify(health()), "application/json; charset=utf-8");
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/llm") {
      const payload = JSON.parse(await readBody(request));
      const requests = Array.isArray(payload.requests) ? payload.requests : [];
      const replies = await Promise.all(
        requests.map(async (item) => {
          try {
            const result = await complete(item.system, item.user);
            return { id: item.id, text: result.text, model: result.model };
          } catch (error) {
            return { id: item.id, error: error.message };
          }
        }),
      );
      send(response, 200, JSON.stringify({ replies }), "application/json; charset=utf-8");
      return;
    }
    const relative = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const file = path.resolve(root, relative);
    if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      send(response, 404, "not found", "text/plain; charset=utf-8");
      return;
    }
    send(response, 200, fs.readFileSync(file), types[path.extname(file)] || "application/octet-stream");
  } catch (error) {
    send(response, 500, JSON.stringify({ error: error.message }), "application/json; charset=utf-8");
  }
});

server.listen(port, "127.0.0.1", () => {
  const config = health();
  console.log(`http://127.0.0.1:${port}/`);
  console.log(config.configured ? `model ${config.model} via ${config.base}` : config.message);
});

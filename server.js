const http = require("node:http");
const { URL } = require("node:url");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getFetch() {
  if (typeof fetch === "function") return fetch;
  // Node < 18 fallback
  const mod = await import("node-fetch");
  return mod.default;
}

function pickAssistantAnswerText(messages) {
  const parts = [];
  for (const m of messages || []) {
    if (!m) continue;
    if (m.role !== "assistant") continue;
    if (m.type !== "answer") continue;
    if (m.content_type && m.content_type !== "text") continue;
    if (typeof m.content === "string" && m.content.trim()) parts.push(m.content);
  }
  return parts.join("\n").trim();
}

async function cozeChatCreate({ baseURL, apiVersion, token, botId, userId, query, conversationId }) {
  const doFetch = await getFetch();
  const v = apiVersion === "v1" ? "v1" : "v3";
  const url = new URL(`${baseURL}/${v}/chat`);
  if (conversationId) url.searchParams.set("conversation_id", String(conversationId));

  const resp = await doFetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bot_id: String(botId),
      user_id: String(userId),
      stream: false,
      auto_save_history: true,
      additional_messages: [
        {
          role: "user",
          content: String(query),
          content_type: "text",
        },
      ],
    }),
  });

  const text = await resp.text();
  if (!resp.ok) {
    const err = new Error(`Coze create failed: HTTP ${resp.status}`);
    err.status = resp.status;
    err.body = text;
    throw err;
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    const err = new Error("Coze create failed: invalid JSON");
    err.body = text;
    throw err;
  }

  if (json.code !== 0) {
    const err = new Error(`Coze create failed: code=${json.code} msg=${json.msg || ""}`.trim());
    err.body = json;
    throw err;
  }

  return json.data;
}

async function cozeChatRetrieve({ baseURL, apiVersion, token, conversationId, chatId }) {
  const doFetch = await getFetch();
  const v = apiVersion === "v1" ? "v1" : "v3";
  const url = new URL(`${baseURL}/${v}/chat/retrieve`);
  url.searchParams.set("conversation_id", String(conversationId));
  url.searchParams.set("chat_id", String(chatId));

  const resp = await doFetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const text = await resp.text();
  if (!resp.ok) {
    const err = new Error(`Coze retrieve failed: HTTP ${resp.status}`);
    err.status = resp.status;
    err.body = text;
    throw err;
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    const err = new Error("Coze retrieve failed: invalid JSON");
    err.body = text;
    throw err;
  }

  if (json.code !== 0) {
    const err = new Error(`Coze retrieve failed: code=${json.code} msg=${json.msg || ""}`.trim());
    err.body = json;
    throw err;
  }

  return json.data;
}

async function cozeConversationMessageList({ baseURL, token, conversationId, chatId }) {
  const doFetch = await getFetch();
  const url = new URL(`${baseURL}/v1/conversation/message/list`);
  url.searchParams.set("conversation_id", String(conversationId));

  const resp = await doFetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      order: "asc",
      chat_id: chatId ? String(chatId) : undefined,
      limit: 50,
    }),
  });

  const text = await resp.text();
  if (!resp.ok) {
    const err = new Error(`Coze message list failed: HTTP ${resp.status}`);
    err.status = resp.status;
    err.body = text;
    throw err;
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    const err = new Error("Coze message list failed: invalid JSON");
    err.body = text;
    throw err;
  }

  if (json.code !== 0) {
    const err = new Error(`Coze message list failed: code=${json.code} msg=${json.msg || ""}`.trim());
    err.body = json;
    throw err;
  }

  return json.data;
}

/**
 * 调用 Coze 智能体对话 API（异步 + 轮询）
 *
 * - 默认优先按你给的 API 地址（v1/chat）发起；若接口不存在/返回 404，会自动 fallback 到 v3/chat。
 * - 轮询 `chat/retrieve` 直到 completed，再拉取消息列表拼出最终 answer 文本。
 */
async function cozeChatAndPoll({
  botId,
  userId,
  query,
  token,
  baseURL = "https://api.coze.cn",
  timeoutMs = 60_000,
  pollIntervalMs = 1000,
}) {
  let apiVersion = "v1";
  let chat;
  try {
    chat = await cozeChatCreate({ baseURL, apiVersion, token, botId, userId, query });
  } catch (e) {
    if (e && e.status === 404) {
      apiVersion = "v3";
      chat = await cozeChatCreate({ baseURL, apiVersion, token, botId, userId, query });
    } else {
      throw e;
    }
  }

  const conversationId = chat.conversation_id;
  const chatId = chat.id;
  const start = Date.now();

  let cur = chat;
  while (cur && (cur.status === "created" || cur.status === "in_progress")) {
    if (Date.now() - start > timeoutMs) {
      const err = new Error("Coze chat timeout");
      err.conversation_id = conversationId;
      err.chat_id = chatId;
      throw err;
    }
    await sleep(pollIntervalMs);
    cur = await cozeChatRetrieve({ baseURL, apiVersion, token, conversationId, chatId });
  }

  if (!cur) throw new Error("Coze chat failed: empty status");
  if (cur.status === "failed") {
    const err = new Error("Coze chat failed");
    err.last_error = cur.last_error;
    throw err;
  }
  if (cur.status === "requires_action") {
    const err = new Error("Coze chat requires_action (tool outputs needed)");
    err.required_action = cur.required_action;
    throw err;
  }
  if (cur.status !== "completed") {
    const err = new Error(`Coze chat unexpected status: ${cur.status}`);
    err.chat = cur;
    throw err;
  }

  const messages = await cozeConversationMessageList({
    baseURL,
    token,
    conversationId,
    chatId,
  });

  return {
    conversation_id: conversationId,
    chat_id: chatId,
    answer: pickAssistantAnswerText(messages) || "当前暂时无法回答，请稍后重试。",
    messages,
  };
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

// 本地转发接口：给前端 app.js 调用（避免把 PAT 暴露在浏览器里）
async function handleApiChat(req, res) {
  const token = process.env.COZE_API_TOKEN;
  if (!token) {
    return sendJson(res, 500, { answer: "服务端未配置 COZE_API_TOKEN。" });
  }

  const botId = process.env.COZE_BOT_ID || "7611013202654707722";
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { answer: "请求体不是合法 JSON。" });
  }

  const userId = body.user_id || `u_${Date.now()}`;
  const query = body.user_query || body.query || "";
  if (!String(query).trim()) {
    return sendJson(res, 400, { answer: "请输入问题。" });
  }

  try {
    const result = await cozeChatAndPoll({
      botId,
      userId,
      query,
      token,
      baseURL: "https://api.coze.cn",
    });
    return sendJson(res, 200, { answer: result.answer });
  } catch (e) {
    return sendJson(res, 500, { answer: "抱歉，服务繁忙，请稍后再试。" });
  }
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3001);
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    if (u.pathname === "/api/chat" && req.method === "POST") {
      await handleApiChat(req, res);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  });

  server.listen(port);
}

module.exports = {
  cozeChatAndPoll,
};


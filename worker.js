export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 处理 CORS 预检
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(),
      });
    }

    // 只开放 /api/chat POST
    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const user_query = (body && body.user_query) || "";
        const user_id = (body && body.user_id) || "unknown";
        const conversation_id = (body && body.conversation_id) || "";

        if (!user_query || typeof user_query !== "string") {
          return json({ error: "user_query is required" }, { status: 400 });
        }

        const token = env.COZE_TOKEN;
        const botId = env.COZE_BOT_ID;

        if (!token || !botId) {
          return json(
            { error: "COZE_TOKEN or COZE_BOT_ID not configured" },
            { status: 500 }
          );
        }

        const baseURL = (env.COZE_BASE_URL || "https://api.coze.cn").replace(/\/$/, "");

        const result = await cozeChatAndPoll({
          baseURL,
          token,
          botId,
          userId: user_id,
          query: user_query,
          conversationId: conversation_id,
        });

        return json(
          {
            answer: result.answer,
            conversation_id: result.conversation_id,
            chat_id: result.chat_id,
          },
          { status: 200 }
        );
      } catch (e) {
        return json(
          { error: "chat failed", detail: String(e) },
          { status: 500 }
        );
      }
    }

    // 其他路径 404
    return new Response("Not found", {
      status: 404,
      headers: buildCorsHeaders(),
    });
  },
};

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*", // 如需限制可改为你的网页域名
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, { status = 200 } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...buildCorsHeaders(),
    },
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

async function cozeChatCreate({ baseURL, token, botId, userId, query, conversationId }) {
  const url = new URL(`${baseURL}/v3/chat`);
  if (conversationId) url.searchParams.set("conversation_id", String(conversationId));

  const resp = await fetch(url.toString(), {
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

async function cozeChatRetrieve({ baseURL, token, conversationId, chatId }) {
  const url = new URL(`${baseURL}/v3/chat/retrieve`);
  url.searchParams.set("conversation_id", String(conversationId));
  url.searchParams.set("chat_id", String(chatId));

  const resp = await fetch(url.toString(), {
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
  const url = new URL(`${baseURL}/v1/conversation/message/list`);
  url.searchParams.set("conversation_id", String(conversationId));

  const resp = await fetch(url.toString(), {
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

async function cozeChatAndPoll({
  baseURL,
  token,
  botId,
  userId,
  query,
  conversationId,
  timeoutMs = 60_000,
  pollIntervalMs = 1000,
}) {
  const chat = await cozeChatCreate({ baseURL, token, botId, userId, query, conversationId });
  const conversation_id = chat.conversation_id;
  const chat_id = chat.id;
  const start = Date.now();

  let cur = chat;
  while (cur && (cur.status === "created" || cur.status === "in_progress")) {
    if (Date.now() - start > timeoutMs) {
      const err = new Error("Coze chat timeout");
      err.conversation_id = conversation_id;
      err.chat_id = chat_id;
      throw err;
    }
    await sleep(pollIntervalMs);
    cur = await cozeChatRetrieve({ baseURL, token, conversationId: conversation_id, chatId: chat_id });
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
    conversationId: conversation_id,
    chatId: chat_id,
  });

  return {
    conversation_id,
    chat_id,
    answer: pickAssistantAnswerText(messages) || "当前暂时无法回答，请稍后重试。",
  };
}

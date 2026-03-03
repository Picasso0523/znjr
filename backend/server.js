const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cron = require("node-cron");
const cheerio = require("cheerio");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 简单内存缓存，实际可替换为数据库
const store = {
  products: [],
  news: {
    news: [],
    consumer: [],
    notice: [],
  },
  education: [],
  ruralNews: [],
  about: {
    company: "",
    timeline: [],
  },
};

async function syncAllData() {
  console.log("[sync] start");
  try {
    // 产品信息
    const productResp = await axios.get("https://www.msxf.com/product", { timeout: 15000 });
    const $product = cheerio.load(productResp.data);
    const productNames = ["安逸花手机客户端", "马上金融手机客户端", "优逸花手机客户端"];
    store.products = productNames.map((name) => {
      const titleEl = $product(`*:contains("${name}")`).first();
      let descBlock = "";
      if (titleEl.length) {
        const texts = [];
        let node = titleEl.next();
        for (let i = 0; i < 6 && node && node.length; i += 1) {
          texts.push(node.text().trim());
          node = node.next();
        }
        descBlock = texts.filter(Boolean).join(" ");
      }
      return {
        name,
        description: descBlock,
      };
    });

    // 新闻与公告等可以按需扩展，这里先占位为空数组结构
    store.news = {
      news: [],
      consumer: [],
      notice: [],
    };

    store.education = [];
    store.ruralNews = [];

    // 关于我们简单抓取一段文本作为示例
    const aboutResp = await axios.get("https://www.msxf.com/about_us", { timeout: 15000 });
    const $about = cheerio.load(aboutResp.data);
    const text = $about("body").text().replace(/\s+/g, " ").trim();
    store.about.company = text.slice(0, 600);
  } catch (e) {
    console.error("[sync] error:", e.message);
  }
  console.log("[sync] done");
}

// 每天早上 8:00 触发（服务器时区需与需求对齐）
cron.schedule("0 8 * * *", () => {
  syncAllData();
});

// 启动时先同步一次
syncAllData();

// 产品数据
app.get("/api/products", (req, res) => {
  res.json({ items: store.products });
});

// 新闻
app.get("/api/news", (req, res) => {
  res.json(store.news);
});

// 金融教育
app.get("/api/education", (req, res) => {
  res.json({ items: store.education });
});

// 乡村振兴要闻
app.get("/api/rural-news", (req, res) => {
  res.json({ items: store.ruralNews });
});

// 关于我们
app.get("/api/about", (req, res) => {
  res.json(store.about);
});

// AI 客服转发接口
app.post("/api/chat", async (req, res) => {
  const { user_id, user_query } = req.body || {};
  if (!user_query) {
    return res.status(400).json({ error: "user_query is required" });
  }

  try {
    // 这里示意如何调用 Coze，具体 URL / 请求体需按 Coze 文档调整
    const token =
      process.env.COZE_TOKEN ||
      "pat_QrQhre34Yndgl1Z93u9hc5MzeXs1qipjdns9Xifr0H4TZmeEW5Zpghmi0qAmQLxO";
    const appId = process.env.COZE_APP_ID || "7611013202654707722";

    const cozeResp = await axios.post(
      "https://api.coze.cn/open_api/v1/workflow/run",
      {
        app_id: appId,
        // 具体字段按 Coze 工作流要求传入
        inputs: {
          user_query,
          user_id: user_id || "unknown",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 20000,
      }
    );

    // 根据实际返回结构取回答内容
    const answer =
      cozeResp.data?.data?.[0]?.output || cozeResp.data?.message || "暂无回复内容。";

    res.json({ answer });
  } catch (e) {
    console.error("[chat] error:", e.message);
    res.status(500).json({ error: "chat failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Anyihua backend listening on port ${PORT}`);
});


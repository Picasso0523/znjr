// 导航栏滚动背景切换 + 移动端折叠菜单
const headerEl = document.querySelector(".site-header");
const navToggle = document.getElementById("nav-toggle");
const mainNavEl = document.getElementById("main-nav");

window.addEventListener("scroll", () => {
  if (!headerEl) return;
  const scrolled = window.scrollY > 40;
  headerEl.classList.toggle("scrolled", scrolled);
});

if (navToggle && headerEl && mainNavEl) {
  navToggle.addEventListener("click", () => {
    const isOpen = headerEl.classList.toggle("nav-open");
    navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  mainNavEl.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 960 && headerEl.classList.contains("nav-open")) {
        headerEl.classList.remove("nav-open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  });
}

// 首页跑马灯背景 + 文案
const heroSection = document.getElementById("hero");
const heroPrev = document.getElementById("hero-prev");
const heroNext = document.getElementById("hero-next");
const heroTitleEl = document.querySelector(".hero-left h1");
const heroSubtitleEl = document.querySelector(".hero-subtitle");

const heroSlides = [
  {
    image: "images/bj1.png",
    title: "安逸花 · 便捷消费信贷服务",
    subtitle: "额度灵活 · 审批快速 · 利率透明 · 安全合规",
  },
  {
    image: "images/bj2.png",
    title: "每一笔，都是托付",
    subtitle: "我们珍视每一次选择背后的目光。十余年合规运营，只为不负你的信任。",
  },
  {
    image: "images/bj3.png",
    title: "一刻生意，一刻金",
    subtitle: "专为小微企业主打造的极速资金通道，让机会从不因周转而错过。",
  },
];
let heroIndex = 0;

function applyHeroBackground() {
  if (!heroSection) return;
  const slide = heroSlides[heroIndex];
  heroSection.style.backgroundImage = `url("${slide.image}")`;
  if (heroTitleEl) {
    heroTitleEl.textContent = slide.title;
  }
  if (heroSubtitleEl) {
    heroSubtitleEl.textContent = slide.subtitle;
  }
}

function showNextHero(delta) {
  const len = heroSlides.length;
  if (!len) return;
  heroIndex = (heroIndex + delta + len) % len;
  applyHeroBackground();
}

applyHeroBackground();
let heroTimer = setInterval(() => showNextHero(1), 5000);

if (heroPrev) {
  heroPrev.addEventListener("click", () => {
    showNextHero(-1);
    clearInterval(heroTimer);
    heroTimer = setInterval(() => showNextHero(1), 5000);
  });
}

if (heroNext) {
  heroNext.addEventListener("click", () => {
    showNextHero(1);
    clearInterval(heroTimer);
    heroTimer = setInterval(() => showNextHero(1), 5000);
  });
}

// 乡村振兴轮播图
const ruralSlideEl = document.getElementById("rural-slide");
const ruralPrev = document.getElementById("rural-prev");
const ruralNext = document.getElementById("rural-next");
const ruralSlides = ["images/xczx1.png", "images/xczx2.png", "images/xczx3.png"];
let ruralIndex = 0;

function applyRuralSlide() {
  if (!ruralSlideEl) return;
  ruralSlideEl.src = ruralSlides[ruralIndex];
}

function showNextRural(delta) {
  const len = ruralSlides.length;
  if (!len) return;
  ruralIndex = (ruralIndex + delta + len) % len;
  applyRuralSlide();
}

applyRuralSlide();
let ruralTimer = setInterval(() => showNextRural(1), 5000);

if (ruralPrev) {
  ruralPrev.addEventListener("click", () => {
    showNextRural(-1);
    clearInterval(ruralTimer);
    ruralTimer = setInterval(() => showNextRural(1), 5000);
  });
}

if (ruralNext) {
  ruralNext.addEventListener("click", () => {
    showNextRural(1);
    clearInterval(ruralTimer);
    ruralTimer = setInterval(() => showNextRural(1), 5000);
  });
}

// 展开 / 收起风险提示
const safetyToggle = document.getElementById("safety-toggle");
const safetyMore = document.getElementById("safety-more");

if (safetyToggle && safetyMore) {
  safetyToggle.addEventListener("click", () => {
    const shown = safetyMore.style.display === "block";
    safetyMore.style.display = shown ? "none" : "block";
    safetyToggle.textContent = shown ? "展开更多" : "收起";
  });
}

// AI 客服弹窗逻辑
const aiBtn = document.getElementById("ai-assistant-button");
const aiDialog = document.getElementById("ai-assistant-dialog");
const aiCloseBtn = document.getElementById("ai-close-btn");
const aiForm = document.getElementById("ai-form");
const aiInput = document.getElementById("ai-input");
const aiMessages = document.getElementById("ai-messages");
const aiSuggestions = document.querySelectorAll(".ai-suggestion");

const CHAT_STORAGE_KEY_PREFIX = "anyihua_chat_history_";
let chatHistory = [];
let isBotTyping = false;
let typingMessageEl = null;

function resizeAiInput() {
  if (!aiInput) return;
  aiInput.style.height = "auto";
  aiInput.style.height = `${aiInput.scrollHeight}px`;
}

function openAiDialog() {
  if (!aiDialog) return;
  aiDialog.style.display = "flex";
  aiDialog.setAttribute("aria-hidden", "false");
  if (aiInput) {
    resizeAiInput();
    aiInput.focus();
  }
}

function closeAiDialog() {
  if (!aiDialog) return;
  aiDialog.style.display = "none";
  aiDialog.setAttribute("aria-hidden", "true");
}

if (aiBtn) {
  aiBtn.addEventListener("click", openAiDialog);
}

if (aiCloseBtn) {
  aiCloseBtn.addEventListener("click", closeAiDialog);
}

aiSuggestions.forEach((btn) => {
  btn.addEventListener("click", () => {
    const text = btn.textContent || "";
    if (aiInput) {
      aiInput.value = text;
      resizeAiInput();
    }
    if (aiForm) {
      aiForm.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });
});

function appendMessage(text, from) {
  if (!aiMessages) return null;
  const div = document.createElement("div");
  div.className = `ai-message ${from === "user" ? "ai-message-user" : "ai-message-bot"}`;
  div.textContent = text;
  aiMessages.appendChild(div);
  aiMessages.scrollTop = aiMessages.scrollHeight;

  // 记录普通消息到本地历史（不包括“正在输入中...”占位）
  if (from === "user" || from === "bot") {
    chatHistory.push({
      from,
      text,
      ts: Date.now(),
    });
    try {
      const key = CHAT_STORAGE_KEY_PREFIX + getUserId();
      localStorage.setItem(key, JSON.stringify(chatHistory));
    } catch (e) {
      // 忽略本地存储错误
    }
  }

  return div;
}

// 生成简单 userId（正式项目应从登录态或后端生成）
function getUserId() {
  const key = "anyihua_user_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `u_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function loadChatHistory() {
  try {
    const key = CHAT_STORAGE_KEY_PREFIX + getUserId();
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) => item && (item.from === "user" || item.from === "bot") && typeof item.text === "string"
    );
  } catch (e) {
    return [];
  }
}

function renderChatHistory() {
  if (!aiMessages) return;
  // 清除可能存在的旧消息，保留快捷问题区域
  const oldMessages = aiMessages.querySelectorAll(".ai-message");
  oldMessages.forEach((el) => el.remove());

  chatHistory.forEach((item) => {
    appendMessage(item.text, item.from);
  });
}

function initChat() {
  chatHistory = loadChatHistory();
  if (!aiMessages) return;

  // 把 HTML 中默认的欢迎语清空，由 JS 统一控制
  const oldMessages = aiMessages.querySelectorAll(".ai-message");
  oldMessages.forEach((el) => el.remove());

  if (chatHistory.length > 0) {
    renderChatHistory();
  } else {
    appendMessage("我是小马客服，请问有什么可以帮助您的吗？", "bot");
  }
}

function showBotTyping() {
  if (!aiMessages || isBotTyping) return;
  isBotTyping = true;
  typingMessageEl = document.createElement("div");
  typingMessageEl.className = "ai-message ai-message-bot ai-message-typing";
  typingMessageEl.textContent = "正在输入中....";
  aiMessages.appendChild(typingMessageEl);
  aiMessages.scrollTop = aiMessages.scrollHeight;
}

function finishBotTyping(finalText) {
  if (!aiMessages) return;
  if (typingMessageEl && typingMessageEl.parentNode === aiMessages) {
    typingMessageEl.remove();
  }
  typingMessageEl = null;
  isBotTyping = false;
  appendMessage(finalText, "bot");
}

function setFormDisabled(disabled) {
  if (aiInput) {
    aiInput.disabled = disabled;
  }
  if (aiForm) {
    const submitBtn = aiForm.querySelector("button[type='submit']");
    if (submitBtn) {
      submitBtn.disabled = disabled;
    }
  }
  aiSuggestions.forEach((btn) => {
    btn.disabled = disabled;
  });
}

if (aiForm && aiInput) {
  aiInput.addEventListener("input", resizeAiInput);
  aiInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      aiForm.requestSubmit();
    }
  });

  aiForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = aiInput.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    aiInput.value = "";
    resizeAiInput();

    setFormDisabled(true);
    showBotTyping();

    try {
      // 调用Cloudflare Worker转发到Coze的接口
      const resp = await fetch("https://xiaoma-kefu.1063528814.workers.dev/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: getUserId(),
          user_query: text,
        }),
      });

      let answerText = "当前暂时无法回答，请稍后重试。";
      try {
        const data = await resp.json();
        if (data && typeof data.answer === "string" && data.answer.trim()) {
          answerText = data.answer.trim();
        }
      } catch (parseErr) {
        // 忽略解析错误，使用默认文案
      }

      finishBotTyping(answerText);

      if (!resp.ok) {
        // 非 2xx 时在控制台打印，方便排查
        console.error("API error", resp.status, answerText);
      }
    } catch (err) {
      finishBotTyping("抱歉，服务繁忙，请稍后再试。");
    }
    setFormDisabled(false);
  });
}

// 动态加载乡村振兴要闻（当前已移除要闻列表，仅保留占位避免报错）
const newsListEl = document.getElementById("news-list"); // 已不再使用新闻动态加载
// 金融教育和振兴要闻列表已从页面移除

function createListItem(title, meta, link) {
  const li = document.createElement("li");
  li.className = "news-item";
  const titleEl = document.createElement("a");
  titleEl.className = "news-item-title";
  titleEl.textContent = title;
  if (link) {
    titleEl.href = link;
    titleEl.target = "_blank";
    titleEl.rel = "noopener noreferrer";
  }
  const metaEl = document.createElement("div");
  metaEl.className = "news-item-meta";
  metaEl.textContent = meta;
  li.appendChild(titleEl);
  li.appendChild(metaEl);
  return li;
}

async function loadAllData() {
  try {
    // 当前仅保留函数结构，避免后续扩展时报错

  } catch (e) {
    if (newsListEl) {
      newsListEl.innerHTML = "<li class=\"news-item\">新闻数据加载失败。</li>";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadAllData();
  initChat();
  openAiDialog();
});



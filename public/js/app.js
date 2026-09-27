const NAV = [
  { group: "Overview", items: [
    { id: "dashboard", label: "Dashboard", icon: "🏠" },
    { id: "content", label: "Content Performance", icon: "📊" },
    { id: "analytics", label: "Analytics", icon: "📈" },
    { id: "audience", label: "Audience", icon: "👥" },
    { id: "conversations", label: "Conversations", icon: "💬" },
  ]},
  { group: "Hindsight Memory", items: [
    { id: "memory", label: "Memory Overview", icon: "🧠" },
    { id: "memory-search", label: "Search Memory", icon: "🔎" },
  ]},
  { group: "Agent", items: [
    { id: "advisor", label: "AI Advisor", icon: "🤖" },
    { id: "planner", label: "Content Planner", icon: "📅" },
    { id: "history", label: "Recommendation History", icon: "📚" },
    { id: "learning", label: "Learning Loop", icon: "🔄" },
  ]},
  { group: "System", items: [
    { id: "settings", label: "Settings", icon: "⚙️" },
    { id: "about", label: "How It Works", icon: "ℹ️" },
  ]},
];

function renderShell() {
  const sidebar = document.getElementById("sidebar");
  sidebar.innerHTML = `
    <div class="brand">Social<span>Mind</span> AI</div>
    <div class="tagline">Agent with persistent Hindsight memory</div>
    ${NAV.map(
      (g) => `
      <div class="nav-group">
        <div class="nav-label">${g.group}</div>
        ${g.items
          .map(
            (it) => `<a class="nav-link" data-route="${it.id}"><span>${it.icon}</span><span>${it.label}</span></a>`
          )
          .join("")}
      </div>`
    ).join("")}
  `;
  sidebar.querySelectorAll(".nav-link").forEach((a) => {
    a.addEventListener("click", () => (location.hash = "#/" + a.dataset.route));
  });
}

function setActiveNav(route) {
  document.querySelectorAll(".nav-link").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === route);
  });
}

const routes = {}; // route -> async render(container, param)

function page(title, sub, bodyHtml) {
  return `<h1 class="page-title">${title}</h1><p class="page-sub">${sub}</p>${bodyHtml}`;
}

// ---------------- Dashboard ----------------
routes["dashboard"] = async (el) => {
  const d = await api.get("/api/dashboard");
  el.innerHTML = page(
    "Dashboard",
    "Your AI agent remembers what your audience likes — here's the current state of that memory.",
    `
    <div class="grid grid-4">
      <div class="stat-tile"><div class="value">${d.totalPosts}</div><div class="label">Posts analyzed</div></div>
      <div class="stat-tile"><div class="value">${d.avgEngagementRate}</div><div class="label">Avg. engagement rate</div></div>
      <div class="stat-tile"><div class="value">${d.bestTime}</div><div class="label">Best posting time</div></div>
      <div class="stat-tile"><div class="value">${d.topTopic}</div><div class="label">Top topic</div></div>
    </div>

    <div class="section-title">Recent performance</div>
    <div class="card">
      <table>
        <tr><th>Post</th><th>Topic</th><th class="num">Engagement</th></tr>
        ${d.recent
          .map(
            (p) => `<tr class="clickable" data-open="content/${p.id}"><td>${esc(p.title)}</td><td>${esc(p.topic)}</td><td class="num">${p.engagement.toLocaleString()}</td></tr>`
          )
          .join("")}
      </table>
    </div>

    <div class="section-title">AI insight</div>
    <div class="card" style="border-left:3px solid var(--teal)">
      🧠 ${esc(d.insight)}
      <div style="margin-top:14px"><button class="btn" id="go-advisor">Ask AI Advisor</button></div>
    </div>
  `
  );
  el.querySelectorAll("[data-open]").forEach((r) =>
    r.addEventListener("click", () => (location.hash = "#/" + r.dataset.open))
  );
  el.querySelector("#go-advisor").addEventListener("click", () => (location.hash = "#/advisor"));
};

// ---------------- Content performance (list) ----------------
routes["content"] = async (el, param) => {
  if (param) return renderPostDetail(el, param);
  const posts = await api.get("/api/posts");
  const topics = ["All", ...new Set(posts.map((p) => p.topic))];
  el.innerHTML = page(
    "Content Performance",
    "What happened to your previous content — every post the agent has learned from.",
    `
    <div class="flex-between" style="margin-bottom:16px">
      <input type="text" id="search" placeholder="Search posts…" style="max-width:260px">
      <select id="filter">${topics.map((t) => `<option value="${t}">${t}</option>`).join("")}</select>
    </div>
    <div class="card"><table id="tbl">
      <tr><th>Post</th><th>Topic</th><th class="num">Likes</th><th class="num">Comments</th><th class="num">Shares</th><th class="num">Engagement</th></tr>
    </table></div>
  `
  );
  const tbl = el.querySelector("#tbl");
  function draw(list) {
    tbl.innerHTML =
      `<tr><th>Post</th><th>Topic</th><th class="num">Likes</th><th class="num">Comments</th><th class="num">Shares</th><th class="num">Engagement</th></tr>` +
      (list.length
        ? list
            .map(
              (p) => `<tr class="clickable" data-id="${p.id}">
        <td>${esc(p.title)}</td><td>${esc(p.topic)}</td>
        <td class="num">${p.likes.toLocaleString()}</td><td class="num">${p.comments.toLocaleString()}</td>
        <td class="num">${p.shares.toLocaleString()}</td><td class="num">${p.engagement.toLocaleString()}</td></tr>`
            )
            .join("")
        : `<tr><td colspan="6" class="empty">No posts match.</td></tr>`);
    tbl.querySelectorAll("[data-id]").forEach((r) =>
      r.addEventListener("click", () => (location.hash = "#/content/" + r.dataset.id))
    );
  }
  draw(posts);
  async function refresh() {
    const list = await api.get(
      `/api/posts?search=${encodeURIComponent(el.querySelector("#search").value)}&topic=${encodeURIComponent(
        el.querySelector("#filter").value
      )}`
    );
    draw(list);
  }
  el.querySelector("#search").addEventListener("input", refresh);
  el.querySelector("#filter").addEventListener("change", refresh);
};

async function renderPostDetail(el, id) {
  const p = await api.get("/api/posts/" + id);
  el.innerHTML = `
    <a class="back-link" id="back">← Back to Content Performance</a>
    <h1 class="page-title" style="margin-top:14px">${esc(p.title)}</h1>
    <p class="page-sub">Posted ${esc(p.date)} at ${esc(p.time)}</p>
    <div class="rec-box">
      <div class="item"><div class="k">Topic</div><div class="v">${esc(p.topic)}</div></div>
      <div class="item"><div class="k">Type</div><div class="v">${esc(p.type)}</div></div>
      <div class="item"><div class="k">Engagement</div><div class="v">${p.engagement.toLocaleString()}</div></div>
      <div class="item"><div class="k">Likes / Comments / Shares</div><div class="v">${p.likes} / ${p.comments} / ${p.shares}</div></div>
    </div>
    <div class="section-title">AI analysis</div>
    <div class="card" style="border-left:3px solid var(--teal)">🧠 ${esc(p.analysis)}</div>
  `;
  el.querySelector("#back").addEventListener("click", () => (location.hash = "#/content"));
}

// ---------------- Analytics ----------------
routes["analytics"] = async (el) => {
  const a = await api.get("/api/analytics");
  el.innerHTML = page(
    "Content Analytics",
    "What type of content works best — aggregated from your stored demo dataset.",
    `
    <div class="section-title">Top performing topics</div>
    <div class="card">${barChart(a.topics.map((t) => ({ label: t.topic, value: t.engagement, display: t.engagement.toLocaleString() })))}</div>
    <div class="section-title">Content type</div>
    <div class="card">${barChart(a.types.map((t) => ({ label: t.type, value: t.avgEngagement, display: t.avgEngagement.toLocaleString() })))}</div>
    <div class="section-title">Best posting time</div>
    <div class="card">${barChart(a.times.map((t) => ({ label: t.time, value: t.engagement, display: t.engagement.toLocaleString() })))}</div>
  `
  );
};

// ---------------- Audience ----------------
routes["audience"] = async (el) => {
  const a = await api.get("/api/audience");
  el.innerHTML = page(
    "Audience Profile",
    "Who the agent thinks your audience is, based on posts and conversations it remembers.",
    `
    <div class="grid grid-2">
      <div class="card">
        <div class="section-title" style="margin-top:0">Audience interests</div>
        ${a.interests.map((i) => `<span class="chip dot">${esc(i)}</span>`).join("")}
      </div>
      <div class="card">
        <div class="section-title" style="margin-top:0">Preferred content</div>
        ${a.preferredContent.map((i) => `<span class="chip dot">${esc(i)}</span>`).join("")}
      </div>
    </div>
    <div class="grid grid-2" style="margin-top:14px">
      <div class="stat-tile"><div class="value" style="font-size:16px">${esc(a.tone)}</div><div class="label">Preferred tone</div></div>
      <div class="stat-tile"><div class="value" style="font-size:16px">${esc(a.mostActive)}</div><div class="label">Most active times</div></div>
    </div>
  `
  );
};

// ---------------- Conversations ----------------
routes["conversations"] = async (el) => {
  const convos = await api.get("/api/conversations");
  el.innerHTML = page(
    "Community Conversations",
    "The agent keeps a running memory of what your audience says, and its sentiment.",
    `
    <div class="flex-between" style="margin-bottom:16px">
      <input type="text" id="search" placeholder="Search conversations…" style="max-width:280px">
      <button class="btn secondary" id="add">+ Log conversation</button>
    </div>
    <div id="list"></div>
  `
  );
  function draw(list) {
    el.querySelector("#list").innerHTML = list.length
      ? list
          .map(
            (c) => `
      <div class="card" style="margin-bottom:12px">
        <div class="flex-between">
          <div style="font-size:14.5px">"${esc(c.text)}"</div>
          <span class="pill ${c.sentiment === "positive" ? "pos" : "neg"}">${c.sentiment === "positive" ? "🟢 Positive" : "🔴 Negative"}</span>
        </div>
        <div class="muted" style="font-size:12.5px;margin-top:8px">Topic: ${esc(c.topic)} · ${esc(c.detected)} · ${esc(c.date)}</div>
      </div>`
          )
          .join("")
      : `<div class="empty">No conversations logged yet.</div>`;
  }
  draw(convos);
  el.querySelector("#search").addEventListener("input", async (e) => {
    draw(await api.get("/api/conversations?search=" + encodeURIComponent(e.target.value)));
  });
  el.querySelector("#add").addEventListener("click", async () => {
    const text = prompt("What did someone say?");
    if (!text) return;
    const topic = prompt("Which topic does this relate to? (Java / AI / React / DSA / Product)", "Java") || "General";
    const positive = confirm("Is the sentiment positive? OK = positive, Cancel = negative");
    await api.post("/api/conversations", {
      text, topic, sentiment: positive ? "positive" : "negative",
      detected: positive ? `Interest: ${topic} content` : `Feedback about ${topic}`,
    });
    toast("Conversation logged and stored in Hindsight memory.");
    draw(await api.get("/api/conversations"));
  });
};

// ---------------- Hindsight Memory ----------------
routes["memory"] = async (el) => {
  const m = await api.get("/api/memories");
  el.innerHTML = page(
    "Hindsight Memory",
    "The agent's persistent memory — every experience it has stored and can recall later.",
    `
    <div class="grid grid-4">
      <div class="stat-tile"><div class="value">${m.counts.total}</div><div class="label">Total memories</div></div>
      <div class="stat-tile"><div class="value">${m.counts.content}</div><div class="label">Content memories</div></div>
      <div class="stat-tile"><div class="value">${m.counts.audience}</div><div class="label">Audience memories</div></div>
      <div class="stat-tile"><div class="value">${m.counts.conversation}</div><div class="label">Conversation memories</div></div>
    </div>
    <div class="section-title">All memories</div>
    <div class="grid grid-2" id="cards"></div>
  `
  );
  el.querySelector("#cards").innerHTML = m.memories
    .map(
      (mem) => `
    <div class="memory-card ${mem.type}">
      <div class="kind">${mem.type} memory</div>
      <div class="text">${esc(mem.text)}</div>
      <div class="source">Source: ${esc(mem.source)}</div>
    </div>`
    )
    .join("");
};

// ---------------- Memory search ----------------
routes["memory-search"] = async (el) => {
  el.innerHTML = page(
    "Memory Search",
    "Search Hindsight memory directly — this is the recall your AI Advisor uses under the hood.",
    `
    <div class="row" style="margin-bottom:18px">
      <input type="text" id="q" placeholder="e.g. Java content">
      <button class="btn" id="go" style="flex:0 0 auto">Search</button>
    </div>
    <div id="results"></div>
  `
  );
  async function run() {
    const q = el.querySelector("#q").value.trim();
    if (!q) return;
    const r = await api.get("/api/memories/search?q=" + encodeURIComponent(q));
    el.querySelector("#results").innerHTML = `
      <div class="muted" style="margin-bottom:14px">${r.count} relevant ${r.count === 1 ? "memory" : "memories"} found for "${esc(r.query)}"</div>
      ${r.results.map((m) => `<div class="memory-card ${m.type}" style="margin-bottom:12px">
          <div class="kind">${m.type} memory</div>
          <div class="text">${esc(m.text)}</div>
          <div class="source">Source: ${esc(m.source)}</div>
        </div>`).join("") || `<div class="empty">No memories matched. Try a different word.</div>`}
      ${r.count ? `<button class="btn secondary" id="use">Use memories for recommendation</button>` : ""}
    `;
    const useBtn = el.querySelector("#use");
    if (useBtn) useBtn.addEventListener("click", () => (location.hash = "#/advisor"));
  }
  el.querySelector("#go").addEventListener("click", run);
  el.querySelector("#q").addEventListener("keydown", (e) => e.key === "Enter" && run());
};

// ---------------- AI Advisor ----------------
routes["advisor"] = async (el) => {
  el.innerHTML = page(
    "AI Content Advisor",
    "Ask what to post next. The agent recalls Hindsight memory before answering.",
    `
    <div class="card">
      <div class="field">
        <label>What are you planning to post?</label>
        <textarea id="note" rows="2" placeholder="I want to create a post for next Monday.">I want to create a post for next Monday.</textarea>
      </div>
      <div class="row">
        <div class="field">
          <label>Goal</label>
          <select id="goal">
            <option>Engagement</option>
            <option>Education</option>
            <option>Product Awareness</option>
            <option>Community Growth</option>
          </select>
        </div>
        <div class="field">
          <label>Platform</label>
          <select id="platform">
            <option>LinkedIn</option>
            <option>Twitter / X</option>
            <option>Instagram</option>
          </select>
        </div>
      </div>
      <button class="btn" id="analyze">Analyze</button>
    </div>
    <div id="result" style="margin-top:22px"></div>
  `
  );
  el.querySelector("#analyze").addEventListener("click", async () => {
    const goal = el.querySelector("#goal").value;
    const platform = el.querySelector("#platform").value;
    const note = el.querySelector("#note").value;
    el.querySelector("#result").innerHTML = `<div class="empty">Recalling Hindsight memory…</div>`;
    const r = await api.post("/api/advisor/analyze", { goal, platform, note });
    window.__lastRec = r;
    el.querySelector("#result").innerHTML = `
      <div class="section-title" style="margin-top:0">AI recommendation</div>
      <div class="rec-box">
        <div class="item"><div class="k">Topic</div><div class="v">${esc(r.topic)}</div></div>
        <div class="item"><div class="k">Format</div><div class="v">${esc(r.format)}</div></div>
        <div class="item"><div class="k">Time</div><div class="v">${esc(r.time)}</div></div>
        <div class="item"><div class="k">Tone</div><div class="v">${esc(r.tone)}</div></div>
      </div>
      <div class="section-title">Why I'm recommending this</div>
      <div class="card"><ul class="reasoning-list">${r.reasoning.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>

      <div class="section-title">Memories used</div>
      <div>
        <span class="chip">🧠 ${r.memoriesUsed.content} content memories</span>
        <span class="chip">🧠 ${r.memoriesUsed.audience} audience memories</span>
        <span class="chip">🧠 ${r.memoriesUsed.conversation} conversation memories</span>
      </div>

      <div style="margin-top:20px"><button class="btn" id="generate">Generate Post</button></div>
      <div id="gen"></div>
    `;
    el.querySelector("#generate").addEventListener("click", () => renderGenerator(el.querySelector("#gen"), r));
  });
};

async function renderGenerator(container, rec) {
  container.innerHTML = `<div class="empty">Writing the post…</div>`;
  const post = await api.post("/api/advisor/generate", { topic: rec.topic, format: rec.format, tone: rec.tone });
  container.innerHTML = `
    <div class="section-title">Generated post</div>
    <div class="post-generated" id="post-body">${esc(post.body)}</div>
    <button class="btn secondary" id="regen">Regenerate</button>
    <button class="btn secondary" id="edit">Edit</button>
    <button class="btn" id="save">Save recommendation</button>
  `;
  container.querySelector("#regen").addEventListener("click", () => renderGenerator(container, rec));
  container.querySelector("#edit").addEventListener("click", () => {
    const box = container.querySelector("#post-body");
    box.contentEditable = "true";
    box.focus();
    toast("You can edit the post text directly now.");
  });
  container.querySelector("#save").addEventListener("click", async () => {
    await api.post("/api/recommendations", { topic: rec.topic, format: rec.format, time: rec.time, tone: rec.tone });
    toast("Saved to Recommendation History as pending.");
  });
}

// ---------------- Content Planner ----------------
routes["planner"] = async (el) => {
  const plan = await api.get("/api/planner");
  const days = Object.keys(plan);
  el.innerHTML = page(
    "Content Calendar",
    "A weekly plan the agent proposes from the same Hindsight memory as the Advisor.",
    `<div class="week-grid">${days
      .map(
        (d) => `
      <div class="week-day" data-day="${d}">
        <div class="d">${d.toUpperCase()}</div>
        <div class="t">${esc(plan[d].topic)}</div>
        <div class="f">${esc(plan[d].format)}</div>
        <div class="time">${esc(plan[d].time)}</div>
      </div>`
      )
      .join("")}</div>
    <div id="detail" style="margin-top:24px"></div>`
  );
  el.querySelectorAll(".week-day").forEach((card) =>
    card.addEventListener("click", async () => {
      const day = card.dataset.day;
      const detail = el.querySelector("#detail");
      detail.innerHTML = `<div class="empty">Loading ${day}…</div>`;
      const d = plan[day];
      detail.innerHTML = `
        <div class="card">
          <div class="section-title" style="margin-top:0">${day} — ${esc(d.topic)}</div>
          <div class="rec-box">
            <div class="item"><div class="k">Topic</div><div class="v">${esc(d.topic)}</div></div>
            <div class="item"><div class="k">Format</div><div class="v">${esc(d.format)}</div></div>
            <div class="item"><div class="k">Time</div><div class="v">${esc(d.time)}</div></div>
            <div class="item"><div class="k">Reason</div><div class="v" style="font-weight:400;font-size:13px">Strong historical engagement</div></div>
          </div>
          <button class="btn" id="gen-day">Generate Post</button>
          <div id="day-gen"></div>
        </div>
      `;
      detail.querySelector("#gen-day").addEventListener("click", async () => {
        const r = await api.post(`/api/planner/${day}/generate`, {});
        detail.querySelector("#day-gen").innerHTML = `<div class="post-generated">${esc(r.post.body)}</div>`;
      });
    })
  );
};

// ---------------- Recommendation History ----------------
routes["history"] = async (el) => {
  const recs = await api.get("/api/recommendations");
  el.innerHTML = page(
    "Recommendation History",
    "Every recommendation the agent has made. Add a result to close the learning loop.",
    `<div class="card"><table id="tbl">
      <tr><th>Date</th><th>Topic</th><th>Format</th><th>Time</th><th class="num">Result</th><th></th></tr>
    </table></div>`
  );
  function draw(list) {
    el.querySelector("#tbl").innerHTML =
      `<tr><th>Date</th><th>Topic</th><th>Format</th><th>Time</th><th class="num">Result</th><th></th></tr>` +
      list
        .map(
          (r) => `<tr>
        <td>${esc(r.date)}</td><td>${esc(r.topic)}</td><td>${esc(r.format)}</td><td>${esc(r.time)}</td>
        <td class="num">${r.result != null ? r.result.toLocaleString() : "Pending"}</td>
        <td>${r.result == null ? `<button class="btn secondary" data-id="${r.id}">Add result</button>` : "✓"}</td>
      </tr>`
        )
        .join("");
    el.querySelectorAll("[data-id]").forEach((b) =>
      b.addEventListener("click", async () => {
        const val = prompt("Engagement result for this published post?");
        if (!val || isNaN(Number(val))) return;
        await api.patch(`/api/recommendations/${b.dataset.id}/result`, { result: Number(val) });
        toast("Result stored — Hindsight memory updated.");
        draw(await api.get("/api/recommendations"));
      })
    );
  }
  draw(recs);
};

// ---------------- Learning Loop ----------------
routes["learning"] = async (el) => {
  const steps = [
    "Past content", "Engagement", "Audience response", "Hindsight memory",
    "AI learns patterns", "New recommendation", "New post", "New engagement", "Hindsight memory updated",
  ];
  el.innerHTML = page(
    "Learning Loop",
    "How the agent improves over time — this cycle is the central idea behind SocialMind AI.",
    `<div class="card"><div class="loop-diagram">
      ${steps.map((s, i) => `<div class="loop-step">${esc(s)}</div>${i < steps.length - 1 ? `<div class="loop-arrow">↓</div>` : `<div class="loop-arrow">↺ back to Past content</div>`}`).join("")}
    </div></div>`
  );
};

// ---------------- Settings ----------------
routes["settings"] = async (el) => {
  const s = await api.get("/api/settings");
  el.innerHTML = page(
    "Settings",
    "Brand and agent configuration used throughout recommendations.",
    `
    <div class="card">
      <div class="row">
        <div class="field"><label>Brand name</label><input id="brandName" type="text" value="${esc(s.brandName)}"></div>
        <div class="field"><label>Primary platform</label><input id="platform" type="text" value="${esc(s.platform)}"></div>
      </div>
      <div class="row">
        <div class="field"><label>Audience</label><input id="audience" type="text" value="${esc(s.audience)}"></div>
        <div class="field"><label>Brand tone</label><input id="tone" type="text" value="${esc(s.tone)}"></div>
      </div>
      <div class="row">
        <div class="field"><label>AI model</label><input id="aiModel" type="text" value="${esc(s.aiModel)}"></div>
        <div class="field"><label>Memory engine</label><input id="memoryEngine" type="text" value="${esc(s.memoryEngine)}" disabled></div>
      </div>
      <button class="btn" id="save">Save settings</button>
    </div>
  `
  );
  el.querySelector("#save").addEventListener("click", async () => {
    await api.post("/api/settings", {
      brandName: el.querySelector("#brandName").value,
      platform: el.querySelector("#platform").value,
      audience: el.querySelector("#audience").value,
      tone: el.querySelector("#tone").value,
      aiModel: el.querySelector("#aiModel").value,
    });
    toast("Settings saved.");
  });
};

// ---------------- About ----------------
routes["about"] = async (el) => {
  const steps = [
    ["Collect", "Past posts, engagement and conversations"],
    ["Remember", "Hindsight stores useful experiences as memories"],
    ["Recall", "Relevant memories are retrieved for a given question"],
    ["Analyze", "The agent identifies patterns across recalled memories"],
    ["Recommend", "The agent suggests content, format and timing"],
    ["Learn", "New results become future memory"],
  ];
  el.innerHTML = page(
    "How SocialMind AI Works",
    "A short explanation for anyone opening this project without a walkthrough.",
    `<div class="card"><div class="loop-diagram">
      ${steps.map(([t, d], i) => `<div class="loop-step"><strong>${i + 1}. ${esc(t)}</strong><br><span class="muted" style="font-size:12.5px">${esc(d)}</span></div>${i < steps.length - 1 ? `<div class="loop-arrow">↓</div>` : ""}`).join("")}
    </div></div>`
  );
};

// ---------------- Router ----------------
async function router() {
  const hash = location.hash.replace(/^#\//, "");
  const [route, ...rest] = hash.split("/");
  const r = route || "dashboard";
  setActiveNav(r);
  const el = document.getElementById("app");
  const fn = routes[r];
  if (!fn) {
    el.innerHTML = `<div class="empty">Page not found.</div>`;
    return;
  }
  try {
    await fn(el, rest.join("/"));
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="empty">Something went wrong loading this page. Is the server running? (${esc(e.message)})</div>`;
  }
}

renderShell();
window.addEventListener("hashchange", router);
router();

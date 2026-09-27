const express = require("express");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "db.json");
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- tiny JSON "database" ----------
function loadDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}
function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
function uid(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

// ---------- derived analytics helpers ----------
function topicStats(posts) {
  const byTopic = {};
  posts.forEach((p) => {
    byTopic[p.topic] = byTopic[p.topic] || { topic: p.topic, posts: 0, engagement: 0 };
    byTopic[p.topic].posts += 1;
    byTopic[p.topic].engagement += p.engagement;
  });
  return Object.values(byTopic)
    .map((t) => ({ ...t, avgEngagement: Math.round(t.engagement / t.posts) }))
    .sort((a, b) => b.engagement - a.engagement);
}

function typeStats(posts) {
  const byType = {};
  posts.forEach((p) => {
    byType[p.type] = byType[p.type] || { type: p.type, posts: 0, engagement: 0 };
    byType[p.type].posts += 1;
    byType[p.type].engagement += p.engagement;
  });
  return Object.values(byType)
    .map((t) => ({ ...t, avgEngagement: Math.round(t.engagement / t.posts) }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);
}

function timeStats(posts) {
  const byTime = {};
  posts.forEach((p) => {
    byTime[p.time] = byTime[p.time] || { time: p.time, posts: 0, engagement: 0 };
    byTime[p.time].posts += 1;
    byTime[p.time].engagement += p.engagement;
  });
  return Object.values(byTime).sort((a, b) => b.engagement - a.engagement);
}

// ---------- the "Hindsight" recall + recommendation engine ----------
// This simulates persistent-memory recall: it scores topics using stored
// posts (content memory), conversations (audience/conversation memory) and
// prior memory records, then explains exactly which memories it used.
function recall(db, { goal, note }) {
  const posts = db.posts;
  const tStats = topicStats(posts);
  const noteLower = (note || "").toLowerCase();

  // mentioned topic in the user's note gets a boost so the demo is steerable
  const mentionedTopic = tStats.find((t) => noteLower.includes(t.topic.toLowerCase()));

  const convByTopic = {};
  db.conversations.forEach((c) => {
    convByTopic[c.topic] = convByTopic[c.topic] || { positive: 0, negative: 0, items: [] };
    convByTopic[c.topic][c.sentiment === "positive" ? "positive" : "negative"] += 1;
    convByTopic[c.topic].items.push(c);
  });

  // score = normalized engagement + audience-request boost + goal alignment
  const scored = tStats.map((t) => {
    const conv = convByTopic[t.topic] || { positive: 0, negative: 0, items: [] };
    let score = t.avgEngagement + conv.positive * 400 - conv.negative * 300;
    if (goal === "Product Awareness" && t.topic === "Product") score += 500;
    if (goal === "Community Growth") score += conv.positive * 150;
    if (mentionedTopic && mentionedTopic.topic === t.topic) score += 1000;
    return { ...t, conv, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  const bestTypeOverall = typeStats(posts)[0];
  const topicPosts = posts.filter((p) => p.topic === best.topic);
  const bestTypeForTopic = typeStats(topicPosts)[0] || bestTypeOverall;
  const bestTimeForTopic = timeStats(topicPosts)[0] || timeStats(posts)[0];

  const relatedMemories = db.memories.filter((m) => m.topic === best.topic);
  const relatedConversations = best.conv.items;

  const reasoning = [];
  reasoning.push(
    `${best.posts} previous ${best.topic} posts averaged ${best.avgEngagement.toLocaleString()} engagement, the strongest of any topic in memory.`
  );
  if (best.conv.positive > 0) {
    reasoning.push(
      `${best.conv.positive} audience conversation${best.conv.positive > 1 ? "s" : ""} explicitly requested more ${best.topic} content.`
    );
  }
  if (best.conv.negative > 0) {
    reasoning.push(
      `${best.conv.negative} conversation${best.conv.negative > 1 ? "s" : ""} pushed back on this topic/format — factored in as a caution, not a block.`
    );
  }
  reasoning.push(
    `"${bestTypeForTopic.type}" is the ${best.topic} format with the highest average engagement (${bestTypeForTopic.avgEngagement.toLocaleString()}).`
  );
  reasoning.push(
    `Posts published around ${bestTimeForTopic.time} have historically generated the strongest results for this topic.`
  );
  if (goal) reasoning.push(`Your stated goal ("${goal}") was weighted into the topic score.`);

  const memoriesUsed = {
    content: relatedMemories.filter((m) => m.type === "content").length + topicPosts.length,
    audience: relatedMemories.filter((m) => m.type === "audience").length,
    conversation: relatedConversations.length,
  };

  return {
    topic: best.topic,
    format: bestTypeForTopic.type,
    time: bestTimeForTopic.time,
    tone: db.settings.tone,
    reasoning,
    memoriesUsed,
    recalled: {
      posts: topicPosts.map((p) => ({ id: p.id, title: p.title, engagement: p.engagement })),
      memories: relatedMemories,
      conversations: relatedConversations,
    },
  };
}

// ---------- post generation templates ----------
const HOOKS = {
  Tutorial: (topic) => `A short, practical walkthrough on ${topic} — the kind of thing you wish someone had shown you earlier.`,
  Carousel: (topic) => `5 things about ${topic} that quietly separate solid engineers from great ones.`,
  Question: (topic) => `Genuine question for the ${topic} crowd:`,
  Promotion: (topic) => `We just shipped something for people working with ${topic}.`,
  Announcement: (topic) => `News for anyone following our ${topic} work:`,
};

function generatePost({ topic, format, tone }) {
  const hook = (HOOKS[format] || HOOKS.Tutorial)(topic);
  const bullets = {
    Java: [
      "Creating unnecessary objects in hot paths",
      "Reaching for the wrong Collection type",
      "Ignoring StringBuilder for string concatenation",
      "Unbatched, chatty database calls",
      "Swallowing exceptions instead of handling them",
    ],
    AI: [
      "Treating the model as a database instead of a reasoner",
      "Skipping evaluation until after launch",
      "No memory of past interactions",
      "Prompting instead of designing the system around the model",
      "Ignoring latency and cost until it's a fire",
    ],
    React: [
      "Overusing useEffect for derived state",
      "Prop drilling instead of composition",
      "Re-rendering the whole tree on one state change",
      "Skipping keys (or using index as key)",
      "Fetching data with no loading/error states",
    ],
    DSA: [
      "Reaching for O(n²) when O(n log n) is one import away",
      "Not recognizing a sliding-window problem",
      "Recomputing instead of memoizing",
      "Ignoring space complexity entirely",
      "Guessing Big-O instead of counting it",
    ],
    Product: [
      "A faster onboarding flow",
      "Clearer pricing",
      "Docs that actually match the product",
      "Fewer clicks to your first result",
      "Support that responds like a human",
    ],
  };
  const list = bullets[topic] || bullets.Java;
  const title =
    format === "Promotion" || format === "Announcement"
      ? `${topic}: what's new`
      : `5 ${topic} mistakes worth avoiding`;

  const body = [hook, "", title, "", ...list.map((b, i) => `${i + 1}. ${b}`), "", "Which one have you faced?"].join(
    "\n"
  );

  return { title, body, tone, format, topic };
}

// ================= ROUTES =================

// Dashboard
app.get("/api/dashboard", (req, res) => {
  const db = loadDB();
  const posts = db.posts;
  const totalPosts = posts.length;
  const avgEngRate = (
    (posts.reduce((s, p) => s + p.likes + p.comments + p.shares, 0) / posts.length / 10000) *
    100
  ).toFixed(1);
  const best = timeStats(posts)[0];
  const topTopic = topicStats(posts)[0];
  const recent = [...posts].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);

  res.json({
    totalPosts,
    avgEngagementRate: avgEngRate + "%",
    bestTime: best.time,
    topTopic: topTopic.topic,
    recent,
    insight: `Your audience responds strongly to technical, educational content, especially ${topicStats(
      posts
    )
      .slice(0, 2)
      .map((t) => t.topic)
      .join(" and ")} topics.`,
  });
});

// Content performance
app.get("/api/posts", (req, res) => {
  const db = loadDB();
  const { search = "", topic = "All" } = req.query;
  let posts = db.posts;
  if (topic !== "All") posts = posts.filter((p) => p.topic === topic);
  if (search) posts = posts.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));
  res.json(posts);
});

app.get("/api/posts/:id", (req, res) => {
  const db = loadDB();
  const post = db.posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  const topicPosts = db.posts.filter((p) => p.topic === post.topic && p.id !== post.id);
  const avgOther = topicPosts.length
    ? Math.round(topicPosts.reduce((s, p) => s + p.engagement, 0) / topicPosts.length)
    : post.engagement;
  const diff = Math.round(((post.engagement - avgOther) / avgOther) * 100);
  const analysis =
    diff >= 0
      ? `This post performed ${diff}% above your other ${post.topic} posts.`
      : `This post performed ${Math.abs(diff)}% below your other ${post.topic} posts.`;
  res.json({ ...post, analysis });
});

app.post("/api/posts", (req, res) => {
  const db = loadDB();
  const p = req.body;
  const engagement = (p.likes || 0) + (p.comments || 0) + (p.shares || 0);
  const post = {
    id: uid("p"),
    title: p.title,
    topic: p.topic,
    type: p.type || "Tutorial",
    date: p.date || new Date().toISOString().slice(0, 10),
    time: p.time || "11:00 AM",
    likes: p.likes || 0,
    comments: p.comments || 0,
    shares: p.shares || 0,
    engagement,
  };
  db.posts.push(post);

  // learning loop: a new result becomes a new content memory
  db.memories.push({
    id: uid("m"),
    type: "content",
    text: `New ${post.topic} post ("${post.title}") logged with ${post.engagement.toLocaleString()} engagement at ${post.time}.`,
    source: "1 new post",
    topic: post.topic,
    createdAt: post.date,
  });
  saveDB(db);
  res.json(post);
});

// Analytics
app.get("/api/analytics", (req, res) => {
  const db = loadDB();
  res.json({
    topics: topicStats(db.posts),
    types: typeStats(db.posts),
    times: timeStats(db.posts),
  });
});

// Audience
app.get("/api/audience", (req, res) => {
  const db = loadDB();
  const topics = topicStats(db.posts).map((t) => t.topic);
  const best = timeStats(db.posts).slice(0, 3).map((t) => t.time);
  res.json({
    interests: topics,
    preferredContent: db.settings.preferredContent.concat(["Coding Tips", "Technical Explanations"]),
    tone: db.settings.tone,
    mostActive: best.join(", "),
  });
});

// Conversations
app.get("/api/conversations", (req, res) => {
  const db = loadDB();
  const { search = "" } = req.query;
  let convos = db.conversations;
  if (search) convos = convos.filter((c) => c.text.toLowerCase().includes(search.toLowerCase()));
  res.json([...convos].sort((a, b) => (a.date < b.date ? 1 : -1)));
});

app.post("/api/conversations", (req, res) => {
  const db = loadDB();
  const { text, sentiment, topic, detected } = req.body;
  const convo = {
    id: uid("c"),
    text,
    sentiment: sentiment || "positive",
    topic: topic || "General",
    detected: detected || "Interest noted",
    date: new Date().toISOString().slice(0, 10),
  };
  db.conversations.push(convo);
  db.memories.push({
    id: uid("m"),
    type: "conversation",
    text: `Audience said: "${text}" (${convo.sentiment}).`,
    source: "1 new conversation",
    topic: convo.topic,
    createdAt: convo.date,
  });
  saveDB(db);
  res.json(convo);
});

// Hindsight memory center
app.get("/api/memories", (req, res) => {
  const db = loadDB();
  const counts = {
    total: db.memories.length,
    content: db.memories.filter((m) => m.type === "content").length,
    audience: db.memories.filter((m) => m.type === "audience").length,
    conversation: db.memories.filter((m) => m.type === "conversation").length,
  };
  res.json({ counts, memories: [...db.memories].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) });
});

app.get("/api/memories/search", (req, res) => {
  const db = loadDB();
  const q = (req.query.q || "").toLowerCase();
  const results = db.memories.filter(
    (m) => m.text.toLowerCase().includes(q) || m.topic.toLowerCase().includes(q)
  );
  res.json({ query: req.query.q || "", count: results.length, results });
});

// AI Advisor
app.post("/api/advisor/analyze", (req, res) => {
  const db = loadDB();
  const { goal, platform, note } = req.body;
  const rec = recall(db, { goal, note });
  saveDB(db); // recall is read-only today, but keep symmetry if it starts logging
  res.json({ goal, platform: platform || db.settings.platform, ...rec });
});

app.post("/api/advisor/generate", (req, res) => {
  const { topic, format, tone } = req.body;
  const post = generatePost({ topic, format, tone });
  res.json(post);
});

// Recommendation history (+ learning loop closing)
app.get("/api/recommendations", (req, res) => {
  const db = loadDB();
  res.json([...db.recommendations].sort((a, b) => (a.date < b.date ? 1 : -1)));
});

app.post("/api/recommendations", (req, res) => {
  const db = loadDB();
  const r = req.body;
  const rec = {
    id: uid("r"),
    date: r.date || new Date().toISOString().slice(0, 10),
    topic: r.topic,
    format: r.format,
    time: r.time,
    tone: r.tone,
    status: "pending",
    result: null,
  };
  db.recommendations.push(rec);
  saveDB(db);
  res.json(rec);
});

app.patch("/api/recommendations/:id/result", (req, res) => {
  const db = loadDB();
  const rec = db.recommendations.find((r) => r.id === req.params.id);
  if (!rec) return res.status(404).json({ error: "Not found" });
  rec.result = req.body.result;
  rec.status = "published";

  // close the learning loop: outcome becomes a new Hindsight memory
  db.memories.push({
    id: uid("m"),
    type: "content",
    text: `Recommendation for ${rec.topic} (${rec.format}, ${rec.time}) resulted in ${rec.result.toLocaleString()} engagement once published.`,
    source: "recommendation outcome",
    topic: rec.topic,
    createdAt: rec.date,
  });
  saveDB(db);
  res.json(rec);
});

// Content planner
app.get("/api/planner", (req, res) => {
  const db = loadDB();
  res.json(db.planner);
});

app.post("/api/planner/:day/generate", (req, res) => {
  const db = loadDB();
  const day = req.body.plan || db.planner[req.params.day];
  if (!day) return res.status(404).json({ error: "No plan for that day" });
  const post = generatePost({ topic: day.topic, format: day.format, tone: db.settings.tone });
  res.json({ day: req.params.day, plan: day, post });
});

// Settings
app.get("/api/settings", (req, res) => res.json(loadDB().settings));
app.post("/api/settings", (req, res) => {
  const db = loadDB();
  db.settings = { ...db.settings, ...req.body };
  saveDB(db);
  res.json(db.settings);
});

// fallback to SPA
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`SocialMind AI running at http://localhost:${PORT}`);
});

# SocialMind AI

A social media engagement agent with persistent "Hindsight" memory.
Full working demo: Node/Express backend + a vanilla JS single-page frontend,
no build step required.

## What's inside

- **Backend** (`server.js`) — an Express API that stores posts, audience
  conversations, and Hindsight memories in a JSON file (`data/db.json`), and
  runs the recall + recommendation engine.
- **Frontend** (`public/`) — a single-page app (plain HTML/CSS/JS, no
  React/webpack needed) covering every screen from the spec: Dashboard,
  Content Performance, Analytics, Audience, Conversations, Hindsight Memory,
  Memory Search, AI Advisor, Post Generator, Content Planner, Recommendation
  History, Learning Loop, Settings, and How It Works.
- **Data** (`data/db.json`) — seeded demo dataset (posts, conversations,
  memories, recommendation history) so the app is fully populated the first
  time you open it. This is demo data, not real social-media statistics.

## Requirements

- [Node.js](https://nodejs.org) 16 or later (includes npm).

## Run it

```bash
cd socialmind-ai
npm install
npm start
```

Then open **http://localhost:4000** in your browser. That's the whole setup —
one server serves both the API and the frontend.

To reset the demo data at any point, just re-copy `data/db.json` from this zip
over the one in your project folder (the app writes new memories/posts back
into that same file as you use it, which is what makes the "learning loop"
demo work).

## The demo story (matches the original spec)

1. Open **Content Performance** — the seeded Java/AI/React/DSA/Product posts
   are already there.
2. Open **Conversations** and click **+ Log conversation** to add something
   like *"Can you make more Java tutorials?"* (or just look at the seeded
   ones — several are already there).
3. Go to **Hindsight Memory** to see those turned into content, audience, and
   conversation memories, or use **Search Memory** to search e.g. "Java".
4. Go to **AI Advisor**, type what you're planning to post, pick a goal and
   platform, and click **Analyze**. The agent recalls the stored memories and
   explains its reasoning ("Why I'm recommending this") before recommending a
   topic, format, time and tone.
5. Click **Generate Post** to have the agent write a post using that
   recommendation.
6. Click **Save recommendation**, then go to **Recommendation History** and
   use **Add result** to log what the post actually did once "published".
   That outcome is written straight back into Hindsight Memory — closing the
   learning loop shown on the **Learning Loop** page.

## How the "Hindsight" recall actually works

There's no external AI API key required — the recommendation engine
(`recall()` in `server.js`) is a transparent, rule-based scorer over your
real stored data:

- It ranks topics by historical average engagement (content memory).
- It boosts topics that audience conversations have explicitly asked for, and
  discounts ones with negative feedback (audience/conversation memory).
- It nudges the score toward whatever goal you picked, and toward any topic
  you mention in your note.
- It picks the best-performing format and posting time *for that specific
  topic*, not just the site-wide best.
- It returns the exact memories, posts, and conversations it used, so the
  "Why this recommendation?" panel is always grounded in real numbers you can
  verify — not a canned response.

If you want to swap this for a real LLM call (Groq, Anthropic, OpenAI, etc.),
the natural place is the `recall()` function and `/api/advisor/analyze` route
in `server.js` — keep the same recalled-memories payload as input/output so
the rest of the app doesn't need to change.

## Project structure

```
socialmind-ai/
├── server.js            # Express API + Hindsight recall/recommendation engine
├── package.json
├── data/
│   └── db.json           # seeded demo dataset (posts, conversations, memories…)
└── public/
    ├── index.html
    ├── css/style.css
    └── js/
        ├── api.js         # fetch helper + small UI utilities
        └── app.js          # router + every page's render logic
```

## Notes

- All numbers on the Analytics/Dashboard/Audience pages come from the seeded
  demo dataset, not real social platforms — clearly a stand-in you can
  replace with real API data later (Twitter/X, LinkedIn, Instagram are listed
  as optional/future work, per the original spec).
- There's no login/auth — this is a single-user demo build, matching the
  "optional, build later" list in the spec.

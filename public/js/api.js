const api = {
  async get(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("GET " + url + " failed");
    return res.json();
  },
  async post(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) throw new Error("POST " + url + " failed");
    return res.json();
  },
  async patch(url, body) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) throw new Error("PATCH " + url + " failed");
    return res.json();
  },
};

function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function barChart(rows, { max } = {}) {
  const m = max || Math.max(...rows.map((r) => r.value), 1);
  const colors = ["#45d6c4", "#f2a73b", "#9b8cf2", "#5fcf8f", "#e1636b", "#6ea8ff"];
  return `<div class="bar-chart">${rows
    .map(
      (r, i) => `
    <div class="bar-row">
      <div class="bar-label">${esc(r.label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, (r.value / m) * 100)}%;background:${colors[i % colors.length]}"></div></div>
      <div class="bar-value">${esc(r.display != null ? r.display : r.value)}</div>
    </div>`
    )
    .join("")}</div>`;
}

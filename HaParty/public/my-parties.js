document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id),
    esc = (s) =>
      String(s ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
  async function api(u) {
    const r = await fetch(u),
      d = await r.json();
    if (!r.ok) throw Error(d.message);
    return d;
  }
  async function init() {
    try {
      const me = await api("/api/auth/me");
      if (!me.loggedIn) return (location.href = "/auth.html");
      $("navActions").innerHTML =
        `<a class="btn btn-outline" href="/">หน้าแรก</a><a class="btn btn-outline" href="/profile.html">โปรไฟล์</a>`;
      const ps = await api("/api/my/parties");
      $("myParties").innerHTML = ps.length
        ? ps
            .map(
              (p) =>
                `<article class="party-card"><div class="party-card-top"><span class="game-label">${esc(p.game_name)}</span><span class="status ${p.status === "open" ? "status-open" : "status-closed"}">${p.status === "open" ? "เปิดรับ" : "เต็ม / ปิดรับ"}</span></div><h3>${esc(p.name)}</h3><div class="party-meta"><span>◷ ${esc(new Date(p.play_time).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }))}</span><span>♙ ${p.member_count}/${p.max_members}</span></div><div class="party-card-footer"><small>เข้าร่วมเมื่อ ${new Date(p.joined_at).toLocaleDateString("th-TH")}</small><a class="btn btn-primary" href="/party.html?id=${p.id}">ดูรายละเอียด →</a></div></article>`,
            )
            .join("")
        : '<div class="empty-state">คุณยังไม่ได้สร้างหรือเข้าร่วม Party</div>';
    } catch (e) {
      $("myParties").innerHTML =
        `<div class="empty-state">${esc(e.message)}</div>`;
    }
  }
  init();
});

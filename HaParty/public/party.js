document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id),
    id = new URLSearchParams(location.search).get("id"),
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
  let user, party;
  async function api(url, opts = {}) {
    const r = await fetch(url, {
        ...opts,
        headers: {
          "Content-Type": "application/json",
          ...(opts.headers || {}),
        },
      }),
      d = await r.json();
    if (!r.ok) throw Error(d.message);
    return d;
  }
  function note(t, err = false) {
    $("pageMessage").textContent = t;
    $("pageMessage").classList.remove("hidden");
    $("pageMessage").classList.toggle("error", err);
  }
  const date = (s) =>
    new Date(s).toLocaleString("th-TH", {
      dateStyle: "full",
      timeStyle: "short",
    });
  async function nav() {
    const d = await api("/api/auth/me");
    user = d.user;
    $("navActions").innerHTML = user
      ? `<a class="btn btn-outline" href="/create-party.html">＋ สร้าง Party</a><a class="btn btn-outline" href="/my-parties.html">Party ของฉัน</a><a class="btn btn-outline" href="/profile.html">โปรไฟล์</a>${user.role === "admin" ? '<a class="btn btn-outline" href="/admin.html">Admin</a>' : ""}<span class="nav-username">${esc(user.username)}</span><button class="btn btn-outline" id="logout">ออกจากระบบ</button>`
      : '<a class="btn btn-outline" href="/auth.html">เข้าสู่ระบบ</a>';
    if ($("logout"))
      $("logout").onclick = async () => {
        await api("/api/auth/logout", { method: "POST" });
        location.href = "/";
      };
  }
  async function load() {
    try {
      if (!id) throw Error("ไม่พบรหัส Party");
      await nav();
      party = await api("/api/parties/" + id);
      render();
    } catch (e) {
      $("partyContent").innerHTML =
        `<div class="empty-state">${esc(e.message)}</div>`;
    }
  }
  function render() {
    const p = party,
      full =
        p.status === "closed" ||
        Number(p.member_count) >= Number(p.max_members);
    const actions = !user
      ? '<a class="btn btn-primary" href="/auth.html">เข้าสู่ระบบเพื่อเข้าร่วม</a>'
      : p.isOwner
        ? `<a class="btn btn-outline" href="/create-party.html?edit=${p.id}">แก้ไข Party</a><button class="btn btn-danger" id="deleteParty">ลบ Party</button>`
        : p.isMember
          ? '<button class="btn btn-outline" id="leaveParty">ออกจาก Party</button>'
          : full
            ? '<button class="btn btn-outline" disabled>Party เต็มแล้ว</button>'
            : '<button class="btn btn-primary" id="joinParty">เข้าร่วม Party</button>';
    $("partyContent").innerHTML =
      `<div><section class="detail-hero"><span class="game-label">${esc(p.game_name)}</span><span class="status ${full ? "status-closed" : "status-open"}">${full ? "เต็ม / ปิดรับ" : "เปิดรับสมาชิก"}</span><h1>${esc(p.name)}</h1><div class="party-owner">สร้างโดย ${esc(p.owner_username)}</div><p>${esc(p.description || "ไม่มีรายละเอียดเพิ่มเติม")}</p><div class="detail-stats"><span>◷ ${esc(date(p.play_time))}</span><span>♙ ${p.member_count}/${p.max_members} คน</span><span>${full ? "ปิดรับสมาชิก" : "เหลือ " + (p.max_members - p.member_count) + " ที่"}</span></div><div class="form-actions">${actions}</div></section><section class="panel"><h2 style="font-size:20px;margin-top:0">รายละเอียดการเล่น</h2><p class="small-muted">โปรดตรวจสอบเวลาเล่นและรายละเอียดก่อนเข้าร่วม Party</p><div><b>เกม:</b> ${esc(p.game_name)}</div><div><b>เวลาเล่น:</b> ${esc(date(p.play_time))}</div><div><b>สมาชิก:</b> ${p.member_count} จาก ${p.max_members} คน</div></section></div><aside class="panel"><h2 style="font-size:20px;margin-top:0">สมาชิกใน Party</h2><div class="member-list">${p.members.map((m) => `<div class="member-row"><div class="avatar">${esc(m.username.slice(0, 1).toUpperCase())}</div><div class="member-info"><div>${esc(m.username)}${m.id === p.owner_id ? "<small>เจ้าของ Party</small>" : ""}</div></div>${m.id === p.owner_id ? '<span class="owner-tag">OWNER</span>' : p.isOwner ? `<button class="btn btn-danger btn-small" data-kick="${m.id}">นำออก</button>` : ""}</div>`).join("")}</div></aside>`;
    $("joinParty")?.addEventListener("click", () =>
      action("/api/parties/" + id + "/join", "POST"),
    );
    $("leaveParty")?.addEventListener("click", () => {
      if (confirm("ต้องการออกจาก Party นี้หรือไม่?"))
        action("/api/parties/" + id + "/leave", "POST");
    });
    $("deleteParty")?.addEventListener("click", async () => {
      if (confirm("ยืนยันลบ Party นี้หรือไม่?"))
        try {
          await api("/api/parties/" + id, { method: "DELETE" });
          location.href = "/";
        } catch (e) {
          note(e.message, true);
        }
    });
    document.querySelectorAll("[data-kick]").forEach(
      (b) =>
        (b.onclick = async () => {
          if (confirm("ต้องการนำสมาชิกคนนี้ออกจาก Party หรือไม่?"))
            try {
              await api(`/api/parties/${id}/members/${b.dataset.kick}`, {
                method: "DELETE",
              });
              party = await api("/api/parties/" + id);
              render();
              note("นำสมาชิกออกแล้ว");
            } catch (e) {
              note(e.message, true);
            }
        }),
    );
  }
  async function action(url, method) {
    try {
      await api(url, { method });
      party = await api("/api/parties/" + id);
      render();
      note("ดำเนินการสำเร็จ");
    } catch (e) {
      note(e.message, true);
    }
  }
  load();
});

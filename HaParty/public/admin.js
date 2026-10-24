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
  let tab = "users",
    user;
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
  function msg(t, err = false) {
    $("adminMessage").textContent = t;
    $("adminMessage").classList.remove("hidden");
    $("adminMessage").classList.toggle("error", err);
  }
  async function init() {
    try {
      const d = await api("/api/auth/me");
      if (!d.loggedIn) return (location.href = "/auth.html");
      if (d.user.role !== "admin") {
        document.querySelector("main").innerHTML =
          '<div class="container"><div class="empty-state">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div></div>';
        return;
      }
      user = d.user;
      $("navActions").innerHTML =
        `<a class="btn btn-outline" href="/">หน้าแรก</a><span class="nav-username">${esc(user.username)}</span>`;
      const s = await api("/api/admin/stats");
      $("stats").innerHTML =
        `<div class="stat-card"><span>ผู้ใช้ทั้งหมด</span><strong>${s.users}</strong></div><div class="stat-card"><span>เกมทั้งหมด</span><strong>${s.games}</strong></div><div class="stat-card"><span>Party ทั้งหมด</span><strong>${s.parties}</strong></div>`;
      document.querySelectorAll("[data-tab]").forEach(
        (b) =>
          (b.onclick = () => {
            tab = b.dataset.tab;
            document
              .querySelectorAll("[data-tab]")
              .forEach((x) => x.classList.toggle("active", x === b));
            render();
          }),
      );
      await render();
    } catch (e) {
      msg(e.message, true);
    }
  }
  async function render() {
    try {
      if (tab === "users") {
        const a = await api("/api/admin/users");
        $("adminContent").innerHTML =
          `<h2>จัดการผู้ใช้</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>ชื่อผู้ใช้</th><th>อีเมล</th><th>สิทธิ์</th><th>จัดการ</th></tr></thead><tbody>${a.map((x) => `<tr><td>${esc(x.username)}</td><td>${esc(x.email)}</td><td><select class="form-control" data-role="${x.id}"><option value="user" ${x.role === "user" ? "selected" : ""}>User</option><option value="admin" ${x.role === "admin" ? "selected" : ""}>Admin</option></select></td><td><div class="table-actions"><button class="btn btn-outline btn-small" data-saveuser="${x.id}">บันทึก</button><button class="btn btn-danger btn-small" data-deluser="${x.id}">ลบ</button></div></td></tr>`).join("")}</tbody></table></div>`;
        document.querySelectorAll("[data-saveuser]").forEach(
          (b) =>
            (b.onclick = async () => {
              try {
                await api("/api/admin/users/" + b.dataset.saveuser, {
                  method: "PUT",
                  body: JSON.stringify({
                    role: document.querySelector(
                      `[data-role="${b.dataset.saveuser}"]`,
                    ).value,
                  }),
                });
                msg("บันทึกสิทธิ์แล้ว");
              } catch (e) {
                msg(e.message, true);
              }
            }),
        );
        document.querySelectorAll("[data-deluser]").forEach(
          (b) =>
            (b.onclick = async () => {
              if (confirm("ยืนยันลบผู้ใช้นี้?"))
                try {
                  await api("/api/admin/users/" + b.dataset.deluser, {
                    method: "DELETE",
                  });
                  msg("ลบผู้ใช้แล้ว");
                  render();
                } catch (e) {
                  msg(e.message, true);
                }
            }),
        );
      } else if (tab === "games") {
        const a = await api("/api/games");
        $("adminContent").innerHTML =
          `<h2>จัดการเกม</h2><form id="gameForm" class="inline-form"><input class="form-control" name="name" placeholder="ชื่อเกม" required><input class="form-control" name="image_url" placeholder="URL รูปภาพ (ไม่บังคับ)"><input class="form-control full" name="description" placeholder="รายละเอียดเกม"><button class="btn btn-primary">เพิ่มเกม</button></form><div class="table-wrap"><table class="data-table"><thead><tr><th>ชื่อเกม</th><th>รายละเอียด</th><th>จัดการ</th></tr></thead><tbody>${a.map((g) => `<tr><td>${esc(g.name)}</td><td>${esc(g.description || "-")}</td><td><div class="table-actions"><button class="btn btn-outline btn-small" data-editgame="${g.id}">แก้ไข</button><button class="btn btn-danger btn-small" data-delgame="${g.id}">ลบ</button></div></td></tr>`).join("")}</tbody></table></div>`;
        $("gameForm").onsubmit = async (e) => {
          e.preventDefault();
          try {
            await api("/api/games", {
              method: "POST",
              body: JSON.stringify(
                Object.fromEntries(new FormData(e.currentTarget)),
              ),
            });
            msg("เพิ่มเกมแล้ว");
            render();
          } catch (e) {
            msg(e.message, true);
          }
        };
        document.querySelectorAll("[data-editgame]").forEach(
          (b) =>
            (b.onclick = async () => {
              const g = a.find((x) => x.id === Number(b.dataset.editgame)),
                name = prompt("ชื่อเกม", g.name);
              if (name === null) return;
              const description =
                prompt("รายละเอียด", g.description || "") ?? g.description;
              const image_url =
                prompt("URL รูปภาพ", g.image_url || "") ?? g.image_url;
              try {
                await api("/api/games/" + g.id, {
                  method: "PUT",
                  body: JSON.stringify({ name, description, image_url }),
                });
                msg("แก้ไขเกมแล้ว");
                render();
              } catch (e) {
                msg(e.message, true);
              }
            }),
        );
        document.querySelectorAll("[data-delgame]").forEach(
          (b) =>
            (b.onclick = async () => {
              if (confirm("ยืนยันลบเกมนี้?"))
                try {
                  await api("/api/games/" + b.dataset.delgame, {
                    method: "DELETE",
                  });
                  msg("ลบเกมแล้ว");
                  render();
                } catch (e) {
                  msg(e.message, true);
                }
            }),
        );
      } else {
        const a = await api("/api/admin/parties");
        $("adminContent").innerHTML =
          `<h2>จัดการ Party</h2><p class="small-muted">ผู้ดูแลสามารถลบ Party ที่ไม่เหมาะสมได้</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Party</th><th>เกม</th><th>ผู้สร้าง</th><th>สมาชิก</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${a.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.game_name)}</td><td>${esc(p.owner_username)}</td><td>${p.member_count}</td><td>${p.status === "open" ? "เปิดรับ" : "ปิดรับ"}</td><td><button class="btn btn-danger btn-small" data-delparty="${p.id}">ลบ Party</button></td></tr>`).join("")}</tbody></table></div>`;
        document.querySelectorAll("[data-delparty]").forEach(
          (b) =>
            (b.onclick = async () => {
              if (confirm("ยืนยันลบ Party นี้?"))
                try {
                  await api("/api/parties/" + b.dataset.delparty, {
                    method: "DELETE",
                  });
                  msg("ลบ Party แล้ว");
                  render();
                } catch (e) {
                  msg(e.message, true);
                }
            }),
        );
      }
    } catch (e) {
      msg(e.message, true);
    }
  }
  init();
});

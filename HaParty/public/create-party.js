document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id),
    q = new URLSearchParams(location.search),
    edit = q.get("edit");
  let user;
  const esc = (s) =>
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
  function show(t, err = true) {
    $("formMessage").textContent = t;
    $("formMessage").classList.remove("hidden");
    $("formMessage").classList.toggle("error", err);
  }
  async function nav() {
    const d = await api("/api/auth/me");
    user = d.user;
    if (!user) {
      location.href = "/auth.html";
      return;
    }
    $("navActions").innerHTML =
      `<a class="btn btn-outline" href="/">หน้าแรก</a><a class="btn btn-outline" href="/my-parties.html">Party ของฉัน</a><span class="nav-username">${esc(user.username)}</span>`;
  }
  async function init() {
    try {
      await nav();
      const gs = await api("/api/games");
      $("game_id").innerHTML = gs
        .map((g) => `<option value="${g.id}">${esc(g.name)}</option>`)
        .join("");
      if (edit) {
        $("formTitle").textContent = "แก้ไข Party";
        $("submitButton").textContent = "บันทึกการแก้ไข";
        const p = await api("/api/parties/" + edit);
        if (!p.isOwner && user.role !== "admin")
          throw Error("แก้ไขได้เฉพาะ Party ของคุณ");
        $("game_id").value = p.game_id;
        $("name").value = p.name;
        $("max_members").value = p.max_members;
        $("play_time").value = new Date(
          new Date(p.play_time).getTime() -
            new Date(p.play_time).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16);
        $("description").value = p.description || "";
      }
    } catch (e) {
      show(e.message);
    }
  }
  $("partyForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const body = Object.fromEntries(new FormData(e.currentTarget));
      const d = await api(edit ? "/api/parties/" + edit : "/api/parties", {
        method: edit ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      location.href = "/party.html?id=" + (edit ? edit : d.id);
    } catch (e) {
      show(e.message);
    }
  };
  init();
});

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);
  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleString("th-TH", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "ไม่ระบุเวลา";

  async function api(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({ message: "ข้อมูลผิดพลาด" }));
    if (!response.ok) throw Error(data.message || "เกิดข้อผิดพลาด");
    return data;
  }

  async function renderNavbar() {
    const nav = $("navActions");
    if (!nav) return;

    try {
      const { user } = await api("/api/auth/me");
      nav.innerHTML = user
        ? `<a class="btn btn-glass" href="/create-party.html">＋ สร้าง Party</a>
           <a class="btn btn-outline" href="/my-parties.html">Party ของฉัน</a>
           <a class="btn btn-outline" href="/profile.html">โปรไฟล์</a>
           ${user.role === "admin" ? '<a class="btn btn-outline" href="/admin.html">Admin</a>' : ""}
           <span class="nav-username">${escapeHtml(user.username)}</span>
           <button class="btn btn-outline" id="logoutBtn">ออกจากระบบ</button>`
        : '<a class="btn btn-outline" href="/auth.html">เข้าสู่ระบบ</a> <a class="btn btn-primary" href="/auth.html?mode=register">สมัครสมาชิก</a>';

      const logoutButton = $("logoutBtn");
      if (logoutButton) {
        logoutButton.onclick = async () => {
          try {
            await api("/api/auth/logout", { method: "POST" });
            location.href = "/";
          } catch (error) {
            alert(error.message);
          }
        };
      }
    } catch {
      nav.innerHTML = '<a class="btn btn-outline" href="/auth.html">เข้าสู่ระบบ</a>';
    }
  }

  async function loadGames() {
    const games = await api("/api/games");
    const gamesList = $("gamesList");

    if (gamesList) {
      gamesList.innerHTML = games.length
        ? games
            .map(
              (game) => `
                <button class="game-card" data-game="${game.id}">
                  ${game.image_url
                    ? `<img class="game-image" src="${escapeHtml(game.image_url)}" alt="${escapeHtml(game.name)}" onerror="this.outerHTML='<div class=&quot;game-placeholder&quot;>🎮</div>'">`
                    : '<div class="game-placeholder">🎮</div>'}
                  <div class="game-info">
                    <strong>${escapeHtml(game.name)}</strong>
                    <small>${escapeHtml(game.description || "ค้นหา Party เกมนี้")}</small>
                  </div>
                </button>`,
            )
            .join("")
        : '<div class="empty-state">ยังไม่มีเกม</div>';
    }

    const gameFilter = $("gameFilter");
    if (gameFilter) {
      const previousValue = gameFilter.value;
      gameFilter.innerHTML =
        '<option value="">ทุกเกม</option>' +
        games
          .map((game) => `<option value="${game.id}">${escapeHtml(game.name)}</option>`)
          .join("");
      gameFilter.value = previousValue;
    }

    document.querySelectorAll("[data-game]").forEach((button) => {
      button.onclick = () => {
        gameFilter.value = button.dataset.game;
        $("parties").scrollIntoView({ behavior: "smooth" });
        loadParties();
      };
    });
  }

  async function loadParties() {
    const list = $("partyList");
    if (!list) return;
    list.innerHTML = '<div class="loading">กำลังโหลด Party...</div>';

    try {
      const params = new URLSearchParams();
      if ($("searchInput").value.trim()) {
        params.set("q", $("searchInput").value.trim());
      }

      ["gameFilter", "timeFilter", "statusFilter"].forEach((id, index) => {
        if ($(id).value) {
          params.set(["game_id", "time", "status"][index], $(id).value);
        }
      });
      if ($("memberFilter")?.value) {
        params.set("member_count", $("memberFilter").value);
      }

      const parties = await api(`/api/parties?${params}`);
      list.innerHTML = parties.length
        ? parties
            .map((party) => {
              const full =
                party.status === "closed" ||
                Number(party.member_count) >= Number(party.max_members);
              const remaining = Number(party.max_members) - Number(party.member_count);
              return `
                <article class="party-card">
                  <div class="party-card-top">
                    <span class="game-label">${escapeHtml(party.game_name)}</span>
                    <span class="status ${full ? "status-closed" : "status-open"}">
                      ${full ? "เต็ม / ปิดรับ" : "เปิดรับสมาชิก"}
                    </span>
                  </div>
                  <h3>${escapeHtml(party.name)}</h3>
                  <div class="party-owner">สร้างโดย ${escapeHtml(party.owner_username)}</div>
                  <div class="party-meta">
                    <span>◷ ${escapeHtml(formatDate(party.play_time))}</span>
                    <span>♙ ${party.member_count}/${party.max_members} คน</span>
                  </div>
                  <div class="party-card-footer">
                    <small>${full ? "ไม่มีที่นั่งว่าง" : `ว่าง ${remaining} ที่`}</small>
                    <a class="btn btn-primary" href="/party.html?id=${party.id}">ดูรายละเอียด →</a>
                  </div>
                </article>`;
            })
            .join("")
        : '<div class="empty-state">ไม่พบ Party ที่ตรงกับเงื่อนไข</div>';
    } catch (error) {
      list.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}<br>ตรวจสอบว่า MySQL และเซิร์ฟเวอร์ทำงานอยู่</div>`;
    }
  }

  $("searchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    loadParties();
  });
  ["gameFilter", "timeFilter", "statusFilter", "memberFilter"].forEach((id) => {
    $(id)?.addEventListener("change", loadParties);
  });

  renderNavbar();
  loadGames().catch(console.error);
  loadParties();
});

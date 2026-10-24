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
    $("message").textContent = t;
    $("message").classList.remove("hidden");
    $("message").classList.toggle("error", err);
  }
  async function init() {
    try {
      const d = await api("/api/auth/me");
      if (!d.loggedIn) return (location.href = "/auth.html");
      $("profileForm").username.value = d.user.username;
      $("profileForm").email.value = d.user.email;
      $("navActions").innerHTML =
        `<a class="btn btn-outline" href="/">หน้าแรก</a><a class="btn btn-outline" href="/my-parties.html">Party ของฉัน</a><span class="nav-username">${esc(d.user.username)}</span>`;
    } catch (e) {
      msg(e.message, true);
    }
  }
  $("profileForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const d = await api("/api/profile", {
        method: "PUT",
        body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
      });
      msg(d.message);
    } catch (e) {
      msg(e.message, true);
    }
  };
  init();
});

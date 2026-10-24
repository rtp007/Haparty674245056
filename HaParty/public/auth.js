document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  function mode(register) {
    $("loginForm").classList.toggle("hidden", register);
    $("registerForm").classList.toggle("hidden", !register);
    $("loginTab").classList.toggle("active", !register);
    $("registerTab").classList.toggle("active", register);
    $("authTitle").textContent = register
      ? "สร้างบัญชี Ha Party"
      : "ยินดีต้อนรับกลับ";
    $("authDesc").textContent = register
      ? "สมัครสมาชิกเพื่อสร้างและเข้าร่วม Party"
      : "เข้าสู่ระบบเพื่อค้นหาและเข้าร่วมทีม";
    $("authMessage").classList.add("hidden");
    $("authMessage").classList.remove("error");
  }

  function show(message) {
    $("authMessage").textContent = message;
    $("authMessage").classList.remove("hidden");
    $("authMessage").classList.add("error");
  }

  async function submit(form, url) {
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.message || "เกิดข้อผิดพลาด");
      location.href = "/";
    } catch (error) {
      show(error.message);
    } finally {
      button.disabled = false;
    }
  }

  $("loginTab").onclick = () => mode(false);
  $("registerTab").onclick = () => mode(true);
  $("loginForm").onsubmit = (event) => {
    event.preventDefault();
    submit(event.currentTarget, "/api/auth/login");
  };
  $("registerForm").onsubmit = (event) => {
    event.preventDefault();
    submit(event.currentTarget, "/api/auth/register");
  };
  mode(new URLSearchParams(location.search).get("mode") === "register");
});

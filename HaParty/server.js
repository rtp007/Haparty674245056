require("dotenv").config();
const express = require("express"),
  session = require("express-session"),
  bcrypt = require("bcrypt"),
  path = require("path"),
  db = require("./db");
const app = express(),
  PORT = Number(process.env.PORT) || 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    name: "haparty.sid",
    secret: process.env.SESSION_SECRET || "replace-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);
app.use(express.static(path.join(__dirname, "public")));
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const me = (req) => req.session.user;
const login = (req, res, next) =>
  me(req) ? next() : res.status(401).json({ message: "กรุณาเข้าสู่ระบบก่อน" });
const admin = (req, res, next) =>
  !me(req)
    ? res.status(401).json({ message: "กรุณาเข้าสู่ระบบก่อน" })
    : me(req).role !== "admin"
      ? res.status(403).json({ message: "เฉพาะผู้ดูแลระบบ" })
      : next();
const validId = (x) => Number.isInteger(Number(x)) && Number(x) > 0;
async function party(id, conn = db) {
  const [r] = await conn.query(
    `SELECT p.*,g.name game_name,g.image_url game_image,u.username owner_username,COUNT(pm.user_id) member_count
 FROM parties p JOIN games g ON g.id=p.game_id JOIN users u ON u.id=p.owner_id
 LEFT JOIN party_members pm ON pm.party_id=p.id WHERE p.id=? GROUP BY p.id`,
    [id],
  );
  return r[0];
}
async function updateStatus(conn, id) {
  const [r] = await conn.query(
    "SELECT p.max_members,COUNT(pm.user_id) n FROM parties p LEFT JOIN party_members pm ON pm.party_id=p.id WHERE p.id=? GROUP BY p.id",
    [id],
  );
  if (r.length)
    await conn.query("UPDATE parties SET status=? WHERE id=?", [
      Number(r[0].n) >= Number(r[0].max_members) ? "closed" : "open",
      id,
    ]);
}
app.get("/api/health", (req, res) => res.json({ ok: true, app: "Ha Party" }));

// สมัครสมาชิก / เข้าสู่ระบบ / Session
app.post(
  "/api/auth/register",
  wrap(async (req, res) => {
    const username = String(req.body.username || "").trim(),
      email = String(req.body.email || "")
        .trim()
        .toLowerCase(),
      password = String(req.body.password || "");
    if (username.length < 3 || username.length > 50)
      return res
        .status(400)
        .json({ message: "ชื่อผู้ใช้ต้องมี 3-50 ตัวอักษร" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ message: "อีเมลไม่ถูกต้อง" });
    if (password.length < 8)
      return res
        .status(400)
        .json({ message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" });
    const [x] = await db.query(
      "SELECT id FROM users WHERE username=? OR email=?",
      [username, email],
    );
    if (x.length)
      return res.status(409).json({ message: "ชื่อผู้ใช้หรืออีเมลถูกใช้แล้ว" });
    const hash = await bcrypt.hash(password, 12),
      [r] = await db.query(
        "INSERT INTO users(username,email,password) VALUES(?,?,?)",
        [username, email, hash],
      );
    req.session.user = { id: r.insertId, username, email, role: "user" };
    res
      .status(201)
      .json({ message: "สมัครสมาชิกสำเร็จ", user: req.session.user });
  }),
);
app.post(
  "/api/auth/login",
  wrap(async (req, res) => {
    const val = String(
        req.body.login || req.body.username || req.body.email || "",
      ).trim(),
      password = String(req.body.password || "");
    const [r] = await db.query(
      "SELECT * FROM users WHERE username=? OR email=? LIMIT 1",
      [val, val.toLowerCase()],
    );
    if (!r.length || !(await bcrypt.compare(password, r[0].password)))
      return res
        .status(401)
        .json({ message: "ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง" });
    const u = r[0];
    req.session.regenerate((err) => {
      if (err)
        return res.status(500).json({ message: "เริ่ม Session ไม่สำเร็จ" });
      req.session.user = {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
      };
      res.json({ message: "เข้าสู่ระบบสำเร็จ", user: req.session.user });
    });
  }),
);
app.get("/api/auth/me", (req, res) =>
  res.json({ loggedIn: !!me(req), user: me(req) || null }),
);
app.post("/api/auth/logout", (req, res) =>
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ message: "ออกจากระบบไม่สำเร็จ" });
    res.clearCookie("haparty.sid");
    res.json({ message: "ออกจากระบบสำเร็จ" });
  }),
);

// เกม: อ่านได้ทุกคน / เพิ่มแก้ไขลบได้เฉพาะ Admin
app.get(
  "/api/games",
  wrap(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const [r] = await db.query(
      "SELECT * FROM games WHERE name LIKE ? ORDER BY name",
      [`%${q}%`],
    );
    res.json(r);
  }),
);
app.post(
  "/api/games",
  admin,
  wrap(async (req, res) => {
    const n = String(req.body.name || "").trim();
    if (!n) return res.status(400).json({ message: "กรุณากรอกชื่อเกม" });
    const [r] = await db.query(
      "INSERT INTO games(name,image_url,description) VALUES(?,?,?)",
      [n, req.body.image_url || null, req.body.description || ""],
    );
    res.status(201).json({ message: "เพิ่มเกมแล้ว", id: r.insertId });
  }),
);
app.put(
  "/api/games/:id",
  admin,
  wrap(async (req, res) => {
    const n = String(req.body.name || "").trim();
    if (!n) return res.status(400).json({ message: "กรุณากรอกชื่อเกม" });
    await db.query(
      "UPDATE games SET name=?,image_url=?,description=? WHERE id=?",
      [
        n,
        req.body.image_url || null,
        req.body.description || "",
        req.params.id,
      ],
    );
    res.json({ message: "แก้ไขเกมแล้ว" });
  }),
);
app.delete(
  "/api/games/:id",
  admin,
  wrap(async (req, res) => {
    try {
      const [r] = await db.query("DELETE FROM games WHERE id=?", [
        req.params.id,
      ]);
      if (!r.affectedRows) return res.status(404).json({ message: "ไม่พบเกม" });
      res.json({ message: "ลบเกมแล้ว" });
    } catch (e) {
      if (e.code === "ER_ROW_IS_REFERENCED_2")
        return res
          .status(409)
          .json({ message: "มี Party ใช้เกมนี้อยู่ จึงลบไม่ได้" });
      throw e;
    }
  }),
);

// ค้นหาและกรอง Party
app.get(
  "/api/parties",
  wrap(async (req, res) => {
    const q = String(req.query.q || "").trim(),
      cond = ["(p.name LIKE ? OR g.name LIKE ? OR u.username LIKE ?)"],
      params = [`%${q}%`, `%${q}%`, `%${q}%`];
    if (req.query.game_id && validId(req.query.game_id)) {
      cond.push("p.game_id=?");
      params.push(Number(req.query.game_id));
    }
    if (["open", "closed"].includes(req.query.status)) {
      cond.push("p.status=?");
      params.push(req.query.status);
    }
    if (req.query.time === "upcoming") cond.push("p.play_time>=NOW()");
    if (req.query.time === "past") cond.push("p.play_time<NOW()");
    let sql = `SELECT p.*,g.name game_name,g.image_url game_image,u.username owner_username,COUNT(pm.user_id) member_count
 FROM parties p JOIN games g ON g.id=p.game_id JOIN users u ON u.id=p.owner_id LEFT JOIN party_members pm ON pm.party_id=p.id
 WHERE ${cond.join(" AND ")} GROUP BY p.id`;
    const having = [],
      hp = [];
    if (Number(req.query.min_members) > 0) {
      having.push("(p.max_members-COUNT(pm.user_id))>=?");
      hp.push(Number(req.query.min_members));
    }
    // กรองตามจำนวนสมาชิกปัจจุบัน (5+ หมายถึงตั้งแต่ 5 คนขึ้นไป)
    if (req.query.member_count === "5+") {
      having.push("COUNT(pm.user_id)>=?");
      hp.push(5);
    } else if (Number(req.query.member_count) > 0) {
      having.push("COUNT(pm.user_id)=?");
      hp.push(Number(req.query.member_count));
    }
    if (having.length) sql += " HAVING " + having.join(" AND ");
    sql += ' ORDER BY (p.status="open") DESC,p.play_time ASC,p.created_at DESC';
    const [r] = await db.query(sql, [...params, ...hp]);
    res.json(r);
  }),
);
app.get(
  "/api/parties/:id",
  wrap(async (req, res) => {
    const p = await party(req.params.id);
    if (!p) return res.status(404).json({ message: "ไม่พบ Party" });
    const [members] = await db.query(
      "SELECT u.id,u.username,pm.joined_at FROM party_members pm JOIN users u ON u.id=pm.user_id WHERE pm.party_id=? ORDER BY (u.id=?) DESC,pm.joined_at",
      [req.params.id, p.owner_id],
    );
    res.json({
      ...p,
      members,
      isOwner: !!me(req) && me(req).id === p.owner_id,
      isMember: !!me(req) && members.some((x) => x.id === me(req).id),
      userId: me(req)?.id || null,
    });
  }),
);
app.post(
  "/api/parties",
  login,
  wrap(async (req, res) => {
    const game = Number(req.body.game_id),
      name = String(req.body.name || "").trim(),
      max = Number(req.body.max_members),
      time = String(req.body.play_time || "");
    if (
      !validId(game) ||
      name.length < 3 ||
      name.length > 120 ||
      !Number.isInteger(max) ||
      max < 2 ||
      max > 20 ||
      !time ||
      isNaN(Date.parse(time))
    )
      return res.status(400).json({
        message: "กรุณาตรวจสอบเกม ชื่อ Party จำนวนสมาชิก และเวลาเล่น",
      });
    const [g] = await db.query("SELECT id FROM games WHERE id=?", [game]);
    if (!g.length) return res.status(400).json({ message: "ไม่พบเกม" });
    const c = await db.getConnection();
    try {
      await c.beginTransaction();
      const [r] = await c.query(
        "INSERT INTO parties(owner_id,game_id,name,max_members,play_time,description) VALUES(?,?,?,?,?,?)",
        [
          me(req).id,
          game,
          name,
          max,
          new Date(time),
          String(req.body.description || ""),
        ],
      );
      await c.query("INSERT INTO party_members(party_id,user_id) VALUES(?,?)", [
        r.insertId,
        me(req).id,
      ]);
      await updateStatus(c, r.insertId);
      await c.commit();
      res.status(201).json({ message: "สร้าง Party สำเร็จ", id: r.insertId });
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }),
);
app.put(
  "/api/parties/:id",
  login,
  wrap(async (req, res) => {
    const p = await party(req.params.id);
    if (!p) return res.status(404).json({ message: "ไม่พบ Party" });
    if (p.owner_id !== me(req).id && me(req).role !== "admin")
      return res.status(403).json({ message: "แก้ไขได้เฉพาะเจ้าของ Party" });
    const game = Number(req.body.game_id),
      name = String(req.body.name || "").trim(),
      max = Number(req.body.max_members),
      time = String(req.body.play_time || "");
    if (
      !validId(game) ||
      name.length < 3 ||
      !Number.isInteger(max) ||
      max < Number(p.member_count) ||
      max > 20 ||
      !time ||
      isNaN(Date.parse(time))
    )
      return res.status(400).json({
        message: "ข้อมูลไม่ถูกต้อง หรือจำนวนสมาชิกน้อยกว่าสมาชิกปัจจุบัน",
      });
    await db.query(
      "UPDATE parties SET game_id=?,name=?,max_members=?,play_time=?,description=? WHERE id=?",
      [
        game,
        name,
        max,
        new Date(time),
        String(req.body.description || ""),
        req.params.id,
      ],
    );
    await updateStatus(db, req.params.id);
    res.json({ message: "แก้ไข Party สำเร็จ" });
  }),
);
app.delete(
  "/api/parties/:id",
  login,
  wrap(async (req, res) => {
    const p = await party(req.params.id);
    if (!p) return res.status(404).json({ message: "ไม่พบ Party" });
    if (p.owner_id !== me(req).id && me(req).role !== "admin")
      return res
        .status(403)
        .json({ message: "ลบได้เฉพาะเจ้าของ Party หรือ Admin" });
    await db.query("DELETE FROM parties WHERE id=?", [req.params.id]);
    res.json({ message: "ลบ Party สำเร็จ" });
  }),
);
app.post(
  "/api/parties/:id/join",
  login,
  wrap(async (req, res) => {
    const c = await db.getConnection();
    try {
      await c.beginTransaction();
      const [p] = await c.query(
        "SELECT id,max_members,status FROM parties WHERE id=? FOR UPDATE",
        [req.params.id],
      );
      if (!p.length) {
        await c.rollback();
        return res.status(404).json({ message: "ไม่พบ Party" });
      }
      const [existing] = await c.query(
        "SELECT id FROM party_members WHERE party_id=? AND user_id=?",
        [req.params.id, me(req).id],
      );
      if (existing.length) {
        await c.rollback();
        return res.status(409).json({ message: "คุณเป็นสมาชิกอยู่แล้ว" });
      }
      const [[cnt]] = await c.query(
        "SELECT COUNT(*) n FROM party_members WHERE party_id=?",
        [req.params.id],
      );
      if (p[0].status !== "open" || Number(cnt.n) >= Number(p[0].max_members)) {
        await c.rollback();
        return res.status(409).json({ message: "Party เต็มหรือปิดรับแล้ว" });
      }
      await c.query("INSERT INTO party_members(party_id,user_id) VALUES(?,?)", [
        req.params.id,
        me(req).id,
      ]);
      await updateStatus(c, req.params.id);
      await c.commit();
      res.json({ message: "เข้าร่วม Party สำเร็จ" });
    } catch (e) {
      await c.rollback();
      if (e.code === "ER_DUP_ENTRY")
        return res.status(409).json({ message: "คุณเป็นสมาชิกอยู่แล้ว" });
      throw e;
    } finally {
      c.release();
    }
  }),
);
app.post(
  "/api/parties/:id/leave",
  login,
  wrap(async (req, res) => {
    const p = await party(req.params.id);
    if (!p) return res.status(404).json({ message: "ไม่พบ Party" });
    if (p.owner_id === me(req).id)
      return res
        .status(400)
        .json({ message: "เจ้าของ Party ออกจากทีมไม่ได้ กรุณาลบ Party แทน" });
    const [r] = await db.query(
      "DELETE FROM party_members WHERE party_id=? AND user_id=?",
      [req.params.id, me(req).id],
    );
    if (!r.affectedRows)
      return res.status(400).json({ message: "คุณไม่ได้เป็นสมาชิก Party นี้" });
    await updateStatus(db, req.params.id);
    res.json({ message: "ออกจาก Party สำเร็จ" });
  }),
);
app.delete(
  "/api/parties/:id/members/:userId",
  login,
  wrap(async (req, res) => {
    const p = await party(req.params.id);
    if (!p) return res.status(404).json({ message: "ไม่พบ Party" });
    if (p.owner_id !== me(req).id && me(req).role !== "admin")
      return res.status(403).json({ message: "เฉพาะเจ้าของ Party หรือ Admin" });
    if (Number(req.params.userId) === p.owner_id)
      return res.status(400).json({ message: "นำเจ้าของ Party ออกไม่ได้" });
    const [r] = await db.query(
      "DELETE FROM party_members WHERE party_id=? AND user_id=?",
      [req.params.id, req.params.userId],
    );
    if (!r.affectedRows)
      return res.status(404).json({ message: "ไม่พบสมาชิก" });
    await updateStatus(db, req.params.id);
    res.json({ message: "นำสมาชิกออกแล้ว" });
  }),
);

// โปรไฟล์และประวัติ Party
app.put(
  "/api/profile",
  login,
  wrap(async (req, res) => {
    const username = String(req.body.username || "").trim(),
      email = String(req.body.email || "")
        .trim()
        .toLowerCase();
    if (username.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ message: "ชื่อผู้ใช้หรืออีเมลไม่ถูกต้อง" });
    const [d] = await db.query(
      "SELECT id FROM users WHERE (username=? OR email=?) AND id<>?",
      [username, email, me(req).id],
    );
    if (d.length)
      return res.status(409).json({ message: "ชื่อผู้ใช้หรืออีเมลถูกใช้แล้ว" });
    await db.query("UPDATE users SET username=?,email=? WHERE id=?", [
      username,
      email,
      me(req).id,
    ]);
    req.session.user.username = username;
    req.session.user.email = email;
    res.json({ message: "บันทึกโปรไฟล์แล้ว", user: me(req) });
  }),
);
app.get(
  "/api/my/parties",
  login,
  wrap(async (req, res) => {
    const [r] = await db.query(
      `SELECT p.id,p.name,p.play_time,p.status,p.max_members,g.name game_name,COUNT(pm.user_id) member_count,MAX(mine.joined_at) joined_at FROM party_members mine JOIN parties p ON p.id=mine.party_id JOIN games g ON g.id=p.game_id LEFT JOIN party_members pm ON pm.party_id=p.id WHERE mine.user_id=? GROUP BY p.id ORDER BY joined_at DESC`,
      [me(req).id],
    );
    res.json(r);
  }),
);

// Admin: users, games, parties
app.get(
  "/api/admin/users",
  admin,
  wrap(async (req, res) => {
    const [r] = await db.query(
      "SELECT id,username,email,role,created_at FROM users ORDER BY created_at DESC",
    );
    res.json(r);
  }),
);
app.put(
  "/api/admin/users/:id",
  admin,
  wrap(async (req, res) => {
    const role = req.body.role === "admin" ? "admin" : "user";
    if (Number(req.params.id) === me(req).id && role !== "admin")
      return res.status(400).json({ message: "ไม่สามารถลดสิทธิ์ตัวเองได้" });
    await db.query("UPDATE users SET role=? WHERE id=?", [role, req.params.id]);
    res.json({ message: "ปรับสิทธิ์ผู้ใช้แล้ว" });
  }),
);
app.delete(
  "/api/admin/users/:id",
  admin,
  wrap(async (req, res) => {
    if (Number(req.params.id) === me(req).id)
      return res.status(400).json({ message: "ไม่สามารถลบบัญชีตัวเองได้" });
    const [r] = await db.query("DELETE FROM users WHERE id=?", [req.params.id]);
    if (!r.affectedRows)
      return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    res.json({ message: "ลบผู้ใช้แล้ว" });
  }),
);
app.get(
  "/api/admin/stats",
  admin,
  wrap(async (req, res) => {
    const [[u]] = await db.query("SELECT COUNT(*) n FROM users"),
      [[g]] = await db.query("SELECT COUNT(*) n FROM games"),
      [[p]] = await db.query("SELECT COUNT(*) n FROM parties");
    res.json({ users: u.n, games: g.n, parties: p.n });
  }),
);
app.get(
  "/api/admin/parties",
  admin,
  wrap(async (req, res) => {
    const [r] = await db.query(
      "SELECT p.id,p.name,p.status,p.play_time,g.name game_name,u.username owner_username,COUNT(pm.user_id) member_count FROM parties p JOIN games g ON g.id=p.game_id JOIN users u ON u.id=p.owner_id LEFT JOIN party_members pm ON pm.party_id=p.id GROUP BY p.id ORDER BY p.created_at DESC",
    );
    res.json(r);
  }),
);
app.use("/api", (req, res) => res.status(404).json({ message: "ไม่พบ API" }));
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === "ER_DUP_ENTRY")
    return res.status(409).json({ message: "ข้อมูลนี้มีอยู่แล้ว" });
  if (["ER_NO_SUCH_TABLE", "ER_BAD_DB_ERROR"].includes(err.code))
    return res.status(500).json({
      message: "ไม่พบฐานข้อมูล กรุณานำเข้า database/haparty.sql ใน phpMyAdmin",
    });
  res.status(500).json({ message: "เกิดข้อผิดพลาด กรุณาตรวจสอบ Terminal" });
});
app.listen(PORT, () =>
  console.log(`Ha Party running at http://localhost:${PORT}`),
);

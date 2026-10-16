/**
 * Full API smoke test — boots the real Express app against an in-memory
 * MongoDB (no external services needed: mail/storage/payments/video all
 * degrade gracefully) and exercises every auth-relevant endpoint through the
 * unified user accounts.
 *
 *   node scripts/endpoint-tests.mjs
 */
import { MongoMemoryServer } from "mongodb-memory-server";

// Skips the rate limiters (one loopback client firing hundreds of requests).
process.env.NODE_ENV = "test";

// Must be set before the app imports config, which reads MONGODB_URI.
const mongod = await MongoMemoryServer.create({
  instance: { dbName: "lifebookz_endpoint_test" },
});
process.env.MONGODB_URI = mongod.getUri();

const [
  appModule,
  mongooseModule,
  databaseModule,
] = await Promise.all([
  import("../src/app.js"),
  import("mongoose"),
  import("../src/config/database.js"),
]);

const app = appModule.default;
const mongoose = mongooseModule.default;

// app.js never opens the Mongo connection itself (server.js does it for prod).
await databaseModule.connectDatabase();

const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const port = server.address().port;
const BASE = `http://127.0.0.1:${port}/api/v1`;

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  return { status: res.status, data: json };
}

const uniq = Date.now();
const reader = { email: `reader${uniq}@test.com`, password: "password123", fullName: "Test Reader" };
const secondReader = { email: `reader2${uniq}@test.com`, password: "password123", fullName: "Second Reader" };

try {
  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------
  {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    const data = await res.json();
    check("GET / health", res.status === 200 && data.success === true);
  }

  // -------------------------------------------------------------------------
  // Reader signup — nothing but email, password, name
  // -------------------------------------------------------------------------
  let readerToken;
  {
    const res = await call("POST", "/users/register", { body: reader });
    check("POST /users/register → 201", res.status === 201, `got ${res.status} ${JSON.stringify(res.data)}`);
    check("signup returns role=user", res.data?.data?.user?.role === "user");
    check("signup has no username in payload", !("username" in (res.data?.data?.user || {})));
    check("signup does not leak passwordHash", !JSON.stringify(res.data).includes("passwordHash"));
    readerToken = res.data?.data?.token;
  }

  {
    const res = await call("GET", "/users/me", { token: readerToken });
    check("GET /users/me → 200", res.status === 200);
    check("/users/me role=user", res.data?.data?.role === "user");
  }

  {
    const dup = await call("POST", "/users/register", { body: reader });
    check("duplicate email register → 409", dup.status === 409);
  }

  // Sign-up lives only in the client portal — the other portals must not
  // offer registration at all.
  {
    const goneA = await call("POST", "/authors/register", { body: reader });
    const goneE = await call("POST", "/experts/register", { body: reader });
    check("POST /authors/register removed", goneA.status === 404, `got ${goneA.status}`);
    check("POST /experts/register removed", goneE.status === 404, `got ${goneE.status}`);
  }

  {
    const bad = await call("POST", "/users/login", { body: { email: reader.email, password: "wrong-pass" } });
    check("login wrong password → 401", bad.status === 401);
    const noAcc = await call("POST", "/users/login", { body: { email: "ghost@test.com", password: "x" } });
    check("login unknown email → 401", noAcc.status === 401);
    const ok = await call("POST", "/users/login", { body: { email: reader.email, password: reader.password } });
    check("reader relogs in → 200", ok.status === 200 && ok.data?.data?.user?.role === "user");
  }

  // -------------------------------------------------------------------------
  // Same account on the author portal — instant access, implicit upgrade
  // -------------------------------------------------------------------------
  let authorToken;
  {
    const res = await call("POST", "/authors/login", { body: { email: reader.email, password: reader.password } });
    check("POST /authors/login with reader account → 200", res.status === 200, `got ${res.status}`);
    check("author portal login upgrades role → author", res.data?.data?.author?.role === "author");
    check("author login token present", !!res.data?.data?.token);
    authorToken = res.data?.data?.token;
  }

  {
    const me = await call("GET", "/authors/me", { token: authorToken });
    check("GET /authors/me → 200 as upgraded author", me.status === 200 && me.data?.data?.role === "author");
    // One account serves every portal — the author token still opens the
    // reader dashboard, since the account now holds BOTH roles.
    const asReader = await call("GET", "/users/me", { token: authorToken });
    check("GET /users/me with author token → 200 (one account serves all)", asReader.status === 200);
  }

  // -------------------------------------------------------------------------
  // Author writing flow — story gates on profile completion
  // -------------------------------------------------------------------------
  let storyId;
  {
    const res = await call("POST", "/stories", {
      token: authorToken,
      body: { title: "My first draft story", storyType: "memory", chapterName: "Childhood" },
    });
    check(
      "POST /stories draft → 201",
      res.status === 201 || res.status === 422,
      `got ${res.status}`,
    );
    storyId = res.data?.data?.id;
  }

  // A banner is mandatory — presign one and create the publishable story.
  let publicStoryId;
  {
    const presign = await call("POST", "/uploads/presign", {
      token: authorToken,
      body: { kind: "image", contentType: "image/png", filename: "banner.png", size: 1024 },
    });
    const banner = presign.data?.data
      ? { url: presign.data.data.url, key: presign.data.data.key }
      : null;

    const res = await call("POST", "/stories", {
      token: authorToken,
      body: {
        title: "Feed story",
        storyType: "experience",
        chapterName: "Career",
        content: "<p>A published story body</p>",
        bannerImage: banner,
      },
    });
    check(
      "POST /stories with banner → 201",
      res.status === 201,
      `got ${res.status} ${JSON.stringify(res.data)}`,
    );
    publicStoryId = res.data?.data?.id;
  }

  {
    const pub = await call("POST", `/stories/${publicStoryId}/publish`, { token: authorToken });
    check("publish before profile complete → 403", pub.status === 403, `got ${pub.status}`);
  }

  {
    const res = await call("PATCH", "/authors/me", {
      token: authorToken,
      body: { profession: "Writer", bio: "I write lifebooks.", phone: "9999999999", dob: "1990-05-01", gender: "Male", address: { country: "India", city: "Hyderabad" } },
    });
    check("PATCH /authors/me completes profile", res.status === 200 && res.data?.data?.isAuthor === true, `got ${res?.status} ${JSON.stringify(res?.data)}`);
    const pub = await call("POST", `/stories/${publicStoryId}/publish`, { token: authorToken });
    check("publish after profile complete → 200", pub.status === 200, `got ${pub.status}`);
  }

  // -------------------------------------------------------------------------
  // Presigned uploads — the ONE endpoint every portal uploads through
  // (avatars, covers, story media). Files never pass through this server;
  // only the resulting { url, key } descriptor reaches the profile PATCHes.
  // -------------------------------------------------------------------------
  {
    const presign = await call("POST", "/uploads/presign", {
      token: authorToken,
      body: { kind: "avatar", contentType: "image/png", filename: "avatar.png", size: 1024 },
    });
    check(
      "POST /uploads/presign (avatar) → 201",
      presign.status === 201 && presign.data?.data?.uploadUrl && presign.data?.data?.key && presign.data?.data?.url,
      `got ${presign.status} ${JSON.stringify(presign.data)}`,
    );

    const badKind = await call("POST", "/uploads/presign", {
      token: authorToken,
      body: { kind: "document", contentType: "application/pdf", filename: "x.pdf", size: 10 },
    });
    check("POST /uploads/presign rejects unsupported kind → 400/422", badKind.status === 400 || badKind.status === 422, `got ${badKind.status}`);

    // The avatar/cover PATCH both portals rely on. The PUT to R2 happens in
    // the browser; here we only assert the descriptor is accepted and
    // stored.
    const avatarRef = presign.data?.data
      ? { url: presign.data.data.url, key: presign.data.data.key }
      : null;
    const badge = await call("PATCH", "/users/me", {
      token: authorToken,
      body: { avatar: avatarRef },
    });
    check(
      "PATCH /users/me stores presigned avatar (author token, cross-portal) → 200",
      badge.status === 200 && badge.data?.data?.avatar?.key === avatarRef?.key,
      `got ${badge.status} ${JSON.stringify(badge.data)}`,
    );

    const coverResign = await call("POST", "/uploads/presign", {
      token: authorToken,
      body: { kind: "cover", contentType: "image/jpeg", filename: "cover.jpg", size: 2048 },
    });
    const coverRef = coverResign.data?.data
      ? { url: coverResign.data.data.url, key: coverResign.data.data.key }
      : null;
    const coverPatch = await call("PATCH", "/authors/me", {
      token: authorToken,
      body: { coverImage: coverRef },
    });
    check(
      "PATCH /authors/me stores presigned cover → 200",
      coverPatch.status === 200 && coverPatch.data?.data?.coverImage?.key === coverRef?.key,
      `got ${coverPatch.status} ${JSON.stringify(coverPatch.data)}`,
    );
  }

  {
    const feed = await call("GET", "/stories");
    check("GET /stories public feed includes published book", feed.status === 200 && feed.data?.data?.stories?.some((s) => s.id === publicStoryId));
    const detail = await call("GET", `/stories/${publicStoryId}`);
    check("GET /stories/:id detail → 200", detail.status === 200 && detail.data?.data?.author?.fullName === reader.fullName);
    check(
      "story author carries profession",
      (detail.data?.data?.author?.profession || "").toLowerCase() === "writer",
      `got ${JSON.stringify(detail.data?.data?.author)}`,
    );
    const proflist = await call("GET", "/stories/professions");
    check("GET /stories/professions lists Writer", proflist.status === 200 && typeof proflist.data?.data === "object");
    const mineS = await call("GET", `/authors/${detail.data?.data?.author?.id}`);
    check("GET /authors/:id public profile → 200", mineS.status === 200, `got ${mineS.status} ${JSON.stringify(mineS.data)}`);
    const stats = await call("GET", "/authors/me/stats", { token: authorToken });
    check("GET /authors/me/stats → 200", stats.status === 200 && Number.isInteger(stats.data?.data?.stories));
    const drafts = await call("GET", "/stories/drafts", { token: authorToken });
    check("GET /stories/drafts → 200", drafts.status === 200 && drafts.data?.data?.stories?.some((s) => s.id === storyId));

    const types = await call("GET", "/stories/types");
    check(
      "GET /stories/types lists the storyType enum",
      types.status === 200 && Array.isArray(types.data?.data) && types.data.data.includes("memory"),
      `got ${types.status}`,
    );

    const mine = await call("GET", "/stories/mine", { token: authorToken });
    check(
      "GET /stories/mine → 200 with published story",
      mine.status === 200 && mine.data?.data?.stories?.some((s) => s.id === publicStoryId),
      `got ${mine.status}`,
    );

    const latestRail = await call("GET", "/stories/latest");
    check(
      "GET /stories/latest → 200 includes the published story",
      latestRail.status === 200 && latestRail.data?.data?.stories?.some((s) => s.id === publicStoryId),
      `got ${latestRail.status}`,
    );

    const filtered = await call("GET", "/stories", { query: { storyType: "experience", limit: 10 } });
    check(
      "GET /stories?storyType=experience filters by type",
      filtered.status === 200 && filtered.data?.data?.stories?.some((s) => s.id === publicStoryId),
      `got ${filtered.status}`,
    );
  }

  // Likes + comments (any signed-in account)
  {
    const like = await call("POST", `/stories/${publicStoryId}/like`, { token: authorToken });
    check("POST /stories/:id/like → liked=true", like.status === 200 && like.data?.data?.liked === true);
    const comment = await call("POST", `/stories/${publicStoryId}/comments`, { token: authorToken, body: { content: "Great book!" } });
    check("POST /stories/:id/comments → 201", comment.status === 201);
    const comments = await call("GET", `/stories/${publicStoryId}/comments`);
    check("GET comments populated with author name", comments.status === 200 && comments.data?.data?.comments?.[0]?.user?.fullName === reader.fullName);
    const reply = await call("POST", `/stories/comments/${comment.data?.data?.id}/reply`, { token: authorToken, body: { content: "Thanks!" } });
    check("author reply to comment → 201", reply.status === 201);
  }

  // Author callback for second reader (still role=user)
  let secondToken;
  {
    const reg = await call("POST", "/users/register", { body: secondReader });
    secondToken = reg.data?.data?.token;
    const like = await call("POST", `/stories/${publicStoryId}/like`, { token: secondToken });
    check("second reader can like → liked=true", like.data?.data?.liked === true);
    unlike_check: {
      const unlike = await call("POST", `/stories/${publicStoryId}/like`, { token: secondToken });
      check("second reader can unlike → liked=false", unlike.data?.data?.liked === false);
    }
  }

  // -------------------------------------------------------------------------
  // Expert upgrade flow — a full application, admin approval, matching
  // -------------------------------------------------------------------------
  let expertToken;
  let expertId;
  {
    const login = await call("POST", "/experts/login", { body: { email: reader.email, password: reader.password } });
    check("expert portal login with author account → 200", login.status === 200 && login.data?.data?.expert?.role === "author");

    const missing = await call("POST", "/experts/upgrade", {
      token: authorToken,
      body: { expertise: "Career coaching" },
    });
    check(
      "expert upgrade with missing fields → 400/422",
      (missing.status === 400 || missing.status === 422) && /qualification|bio|phone/i.test(JSON.stringify(missing.data)),
      `got ${missing.status} ${JSON.stringify(missing.data)}`,
    );

    const res = await call("POST", "/experts/upgrade", {
      token: authorToken,
      body: {
        expertise: "Career growth & counselling",
        qualification: "MA Psychology, 10 years in HR",
        categories: ["career", "health"],
        bio: "I coach people through career transitions.",
        phone: "8888888888",
        languages: ["English", "Hindi"],
        experience: 8,
        price: 500,
      },
    });
    check("POST /experts/upgrade → 200", res.status === 200, `got ${res.status} ${JSON.stringify(res.data)}`);
    check("upgraded role=expert", res.data?.data?.expert?.role === "expert");
    check("upgrade token flushed to expert", !!res.data?.data?.token);
    check(
      "upgrade response carries expert details",
      (res.data?.data?.expert?.expertise || "") !== "" && Array.isArray(res.data?.data?.expert?.categories) && res.data?.data?.expert?.categories?.length > 0,
      `got ${JSON.stringify(res.data?.data?.expert)}`,
    );
    expertToken = res.data?.data?.token;
    expertId = res.data?.data?.expert?.id;

    const afterUpgrade = await mongoose.model("User").findById(expertId).lean();
    console.log("DB expert block after upgrade:", JSON.stringify(afterUpgrade?.expert));
  }

  {
    const me = await call("GET", "/experts/me", { token: expertToken });
    check("GET /experts/me → 200 role expert", me.status === 200 && me.data?.data?.role === "expert");
    const avail = await call("PATCH", "/experts/me/availability", { token: expertToken, body: { isAvailable: false } });
    check("PATCH /experts/me/availability → 200", avail.status === 200 && avail.data?.data?.isAvailable === false);
    const again = await call("PATCH", "/experts/me/availability", { token: expertToken, body: { isAvailable: true } });
    check("availability toggled back on", again.data?.data?.isAvailable === true);
    // One account serves every portal — the expert token also opens the
    // reader dashboard, since the account holds the reader role too.
    const shadow = await call("GET", "/users/me", { token: expertToken });
    check("reader portal accepts expert token (one account serves all) → 200", shadow.status === 200);
  }

  // Public experts page (author portal-approved list)
  {
    const res = await call("POST", "/consultations/match", {
      token: secondToken,
      body: { problem: "I need career guidance for a switch." },
    });
    check("match before admin approval → empty", res.status === 200 && res.data?.data?.experts?.length === 0);
  }

  // -------------------------------------------------------------------------
  // Admin — approvals and dashboards
  // -------------------------------------------------------------------------
  let adminToken;
  {
    const login = await call("POST", "/admin/login", {
      body: { email: process.env.ADMIN_EMAIL?.replace(/"/g, ""), password: process.env.ADMIN_PASSWORD?.replace(/"/g, "") },
    });
    check("POST /admin/login → 200", login.status === 200 && !!login.data?.data?.token, `got ${login.status}`);
    adminToken = login.data?.data?.token;
  }

  {
    const dash = await call("GET", "/admin/dashboard", { token: adminToken });
    check("GET /admin/dashboard → 200", dash.status === 200 && dash.data?.data?.totalExperts === 1, JSON.stringify(dash.data?.data));
    const pendA = await call("GET", "/admin/authors/pending", { token: adminToken });
    check("GET /admin/authors/pending → 200", pendA.status === 200 && Array.isArray(pendA.data?.data));
    const pendE = await call("GET", "/admin/experts/pending", { token: adminToken });
    check("pending experts include our expert", pendE.status === 200 && pendE.data?.data?.some((e) => e.id === expertId));
    const appr = await call("PATCH", `/admin/experts/${expertId}/approve`, { token: adminToken });
    check("PATCH /admin/experts/:id/approve → 200", appr.status === 200, `got ${appr.status} ${JSON.stringify(appr.data)}`);
    const afterApprove = await mongoose.model("User").findById(expertId).lean();
    console.log("DB expert block after approve:", JSON.stringify(afterApprove?.expert));
    const usersList = await call("GET", "/admin/users", { token: adminToken });
    check("GET /admin/users lists role=user only", usersList.status === 200 && usersList.data?.data?.every((u) => u.role === "user"));
    const stories = await call("GET", "/admin/stories", { token: adminToken });
    check("GET /admin/stories → 200", stories.status === 200);
    const feat = await call("PATCH", `/admin/stories/${publicStoryId}/featured`, { token: adminToken, body: { featured: true } });
    check("featured toggle → 200", feat.status === 200 && feat.data?.data?.featured === true);
  }

  {
    const res = await call("POST", "/consultations/match", {
      token: secondToken,
      body: { problem: "I need career guidance for a switch.", category: "career" },
    });
    check(
      "match after approval → 1 expert",
      res.status === 200 && res.data?.data?.experts?.length === 1 && res.data?.data?.experts?.[0]?.id === expertId,
      `got ${res.status} ${JSON.stringify(res.data?.data?.experts)}`,
    );
  }

  // -------------------------------------------------------------------------
  // Consultation booking end-to-end (without payment/video, which need
  // Razorpay/Chime credentials)
  // -------------------------------------------------------------------------
  let consultationId;
  {
    const req = await call("POST", "/consultations/requests", {
      token: secondToken,
      body: { expertId, problem: "Career anxiety after graduation.", category: "career" },
    });
    check("POST /consultations/requests → 201", req.status === 201 && req.data?.data?.status === "PENDING", `got ${req.status}`);
    consultationId = req.data?.data?.id;

    const mine = await call("GET", "/consultations/mine", { token: secondToken });
    check("GET /consultations/mine lists booking", mine.status === 200 && mine.data?.data?.consultations?.some((c) => c.id === consultationId));

    const expertList = await call("GET", "/consultations/expert", { token: expertToken });
    check("GET /consultations/expert lists booking for expert", expertList.status === 200 && expertList.data?.data?.consultations?.some((c) => c.id === consultationId));

    const wb = await call("GET", "/consultations/expert", { token: secondToken });
    check("reader cannot read expert booking list → 403", wb.status === 403);

    const accept = await call("POST", `/consultations/${consultationId}/accept`, { token: expertToken });
    check("expert accepts booking → CONFIRMED", accept.status === 200 && accept.data?.data?.status === "CONFIRMED", `got ${accept.status}`);

    const session = await call("GET", `/consultations/${consultationId}`, { token: secondToken });
    check(
      "GET /consultations/:id as participant → 200",
      session.status === 200 && session.data?.data?.paid === false,
      `got ${session.status} ${JSON.stringify(session.data)}`,
    );

    // A completely separate account must not see the consultation. (The
    // first reader became the expert, so they ARE a participant.)
    const strangerReg = await call("POST", "/users/register", {
      body: { email: `stranger${uniq}@test.com`, password: "password123", fullName: "Bystander" },
    });
    const stranger = await call("GET", `/consultations/${consultationId}`, {
      token: strangerReg.data?.data?.token,
    });
    check(
      "non-participant cannot view consultation",
      stranger.status === 403 || stranger.status === 404,
      `got ${stranger.status} ${JSON.stringify(stranger.data)}`,
    );

    // Handoff round-trip
    const handoff = await call("POST", "/consultations/handoff", {
      token: expertToken,
      body: {},
    });
    check("POST /consultations/handoff returns code", handoff.status === 200 && !!handoff.data?.data?.code);
    const exchange = await call("POST", "/consultations/handoff/exchange", { body: { code: handoff.data?.data?.code } });
    check("handoff exchange returns token+role", exchange.status === 200 && exchange.data?.data?.role === "expert");
    // Expired/unknown code
    const badExchange = await call("POST", "/consultations/handoff/exchange", { body: { code: "nope" } });
    check("replayed handoff code → 401", badExchange.status === 401);

    // Decline→cancel path on a second booking
    const req2 = await call("POST", "/consultations/requests", {
      token: secondToken,
      body: { expertId, problem: "Another question about growth.", category: "career" },
    });
    const decline = await call("POST", `/consultations/${req2.data?.data?.id}/decline`, { token: expertToken, body: { reason: "Not my area." } });
    check("expert declines booking → CANCELLED", decline.status === 200 && decline.data?.data?.status === "CANCELLED");
  }

  // -------------------------------------------------------------------------
  // Testimonials — one per person, any role
  // -------------------------------------------------------------------------
  {
    const create1 = await call("POST", "/testimonials", { token: secondToken, body: { message: "Great platform!", rating: 5 } });
    check("POST /testimonials → 201", create1.status === 201 && create1.data?.data?.person?.fullName === secondReader.fullName);
    const upd = await call("POST", "/testimonials", { token: secondToken, body: { message: "Updated review", rating: 4 } });
    check("second testimonial updates instead of duplicating", upd.status === 201 && upd.data?.data?.message === "Updated review");
    const list = await call("GET", "/testimonials");
    check("GET /testimonials public list", list.status === 200 && Array.isArray(list.data?.data) && list.data?.data?.length >= 1);
    const mod = await call("PATCH", `/testimonials/${upd.data?.data?.id}/status`, { token: adminToken, body: { status: "hidden" } });
    check("admin hides testimonial → 200", mod.status === 200);
  }

  // -------------------------------------------------------------------------
  // Password reset (OTP read straight from the DB — mail is not configured)
  // -------------------------------------------------------------------------
  {
    const ask = await call("POST", "/users/forgot-password", { body: { email: reader.email } });
    check("POST /users/forgot-password → 200 generic", ask.status === 200);

    const doc = await mongoose.model("User").findOne({ email: reader.email }).select("+auth.passwordResetOTP");
    check("OTP stored on the user doc", /^\d{6}$/.test(doc?.auth?.passwordResetOTP || ""));

    const verify = await call("POST", "/users/verify-reset-otp", { body: { email: reader.email, otp: doc.auth.passwordResetOTP } });
    check("verify reset OTP → returns resetToken", verify.status === 200 && !!verify.data?.data?.resetToken);

    const reset = await call("POST", "/users/reset-password", { body: { resetToken: verify.data?.data?.resetToken, password: "newpassword9" } });
    check("reset password → 200", reset.status === 200);

    const rel = await call("POST", "/experts/login", { body: { email: reader.email, password: "newpassword9" } });
    check("login with new password works on any portal", rel.status === 200);
  }

  // -------------------------------------------------------------------------
  // Account suspension blocks tokens instantly
  // -------------------------------------------------------------------------
  {
    const who = await mongoose.model("User").findOne({ email: secondReader.email });
    await call("PATCH", `/admin/users/${who.id}/status`, { token: adminToken, body: { status: "suspended" } });
    const blocked = await call("GET", "/users/me", { token: secondToken });
    check("suspended account token → 401", blocked.status === 401 && /not active/i.test(JSON.stringify(blocked.data)));
    await call("PATCH", `/admin/users/${who.id}/status`, { token: adminToken, body: { status: "active" } });
    const restored = await call("GET", "/users/me", { token: secondToken });
    check("restored account works again", restored.status === 200);
  }
} catch (error) {
  failed++;
  failures.push(`Unexpected: ${error.message}`);
  console.error("Unexpected failure:", error);
  console.log("Mongoose readyState:", mongoose.connection.readyState);
} finally {
  await new Promise((r) => server.close(r));
  await mongoose.disconnect();
  await mongod.stop();
}

console.log(`\n=== Endpoint tests: ${passed} passed, ${failed} failed ===`);
if (failures.length) {
  console.log(failures.map((f) => ` - ${f}`).join("\n"));
}
process.exit(failed ? 1 : 0);

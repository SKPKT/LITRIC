const origin = process.env.LITRIC_PRODUCTION_URL;
if (
  !origin ||
  new URL(origin).origin !== origin ||
  !origin.startsWith("https://") ||
  /chatgpt\.site/.test(origin)
)
  throw new Error(
    "Set LITRIC_PRODUCTION_URL to the exact independent HTTPS Cloudflare origin.",
  );
const page = await fetch(origin + "/");
if (!page.ok || !(await page.text()).includes("LITRIC"))
  throw new Error("Live frontend failed.");
const health = await fetch(origin + "/health");
const status = await health.json();
if (!health.ok || !status.ok)
  throw new Error("Live Worker health failed.");
const data = await fetch(origin + "/api/state");
if (data.status !== 401)
  throw new Error("Student endpoint must require authentication.");
if (status.loginEnabled === false) {
  const login = await fetch(origin + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "GPM", password: "" }) });
  if (login.status !== 503) throw new Error("Free pilot must block login before password hashing.");
  console.log("Free pilot frontend, health, disabled login (503) and student protection (401) verified. Authenticated modules are NOT live or accepted for production.");
} else console.log(
  "Live frontend, Worker health and unauthenticated denial verified. Protected GPM login still requires the school acceptance test; this script does not claim it.",
);

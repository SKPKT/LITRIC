import fs from "node:fs";
const id = process.env.CLOUDFLARE_D1_ID;
if (
  !id ||
  !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id) ||
  id === "00000000-0000-4000-8000-000000000000"
)
  throw new Error(
    "Set CLOUDFLARE_D1_ID to the NEW school-controlled D1 database ID.",
  );
const config = JSON.parse(fs.readFileSync("standalone/wrangler.jsonc", "utf8"));
config.d1_databases[0].database_id = id;
if (process.env.LITRIC_PILOT_MODE === "true") {
  delete config.limits;
  config.vars.LITRIC_LOGIN_ENABLED = "false";
}
if (process.env.LITRIC_WORKER_NAME) {
  if (!/^[a-z0-9-]{1,63}$/.test(process.env.LITRIC_WORKER_NAME))
    throw new Error("Invalid Worker name.");
  config.name = process.env.LITRIC_WORKER_NAME;
}
fs.writeFileSync(
  "standalone/wrangler.generated.jsonc",
  JSON.stringify(config, null, 2) + "\n",
);
console.log("School Worker configuration prepared. No credentials written.");

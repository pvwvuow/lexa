// Probe live Supabase: which Lexa tables / storage buckets exist?
// Usage: node scripts/qa-supabase-state.mjs
const SB = "https://tldjbpfcibangzmvzwfw.supabase.co";
const KEY = "sb_publishable_IaPGLBkmRkcsGlVE865PZw_krAWWmsz";

const tables = [
  "lexa_profiles", "lexa_orgs", "lexa_org_members", "lexa_teacher_requests",
  "lexa_articles", "lexa_posts", "lexa_tcourses", "lexa_follows", "lexa_comments",
  "lexa_post_ratings", "lexa_usernames",
];

(async () => {
  console.log("── REST tables ──");
  for (const t of tables) {
    try {
      const r = await fetch(`${SB}/rest/v1/${t}?select=*&limit=1`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      });
      console.log(t.padEnd(24), r.status === 200 ? "EXISTS" : `MISSING(${r.status})`);
    } catch (e) {
      console.log(t.padEnd(24), "ERR", e.message);
    }
  }
  console.log("── auth reachability ──");
  try {
    const r = await fetch(`${SB}/auth/v1/health`, { headers: { apikey: KEY } });
    console.log("auth/v1/health:", r.status);
  } catch (e) {
    console.log("auth health ERR:", e.message);
  }
  console.log("── storage (lexa-media bucket public listing) ──");
  try {
    const r = await fetch(`${SB}/storage/v1/object/public/lexa-media/__probe__.txt`);
    console.log("public object probe:", r.status, "(400/404 = bucket policy live; 403/дenied shape may vary)");
  } catch (e) {
    console.log("storage probe ERR:", e.message);
  }
})();

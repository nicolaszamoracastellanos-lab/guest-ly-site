// Resolves the first id for every dynamic route and writes .part9/ids.json.
//
//   node scripts/part9/resolve-ids.mjs
//
// Read only. Signs in as the demo couple and the demo planner (one password
// grant each, spaced), asserts tenant demo-review for both, and lists what
// exists. A list that is still empty (before seed-demo.mjs) gives null, and
// walk.mjs then marks the route "skipped: no id" instead of guessing.
// Ids only: no token, no email, no phone is written.

import path from "node:path";
import { PART9, apiClient, assertDemoTenant, passwordGrant, sleep, writeJson } from "./lib.mjs";

const first = (list) => (Array.isArray(list) && list.length ? list[0].id ?? null : null);
const data = async (client, p) => {
  const r = await client.get(p);
  return r.ok ? r.data : null;
};

async function main() {
  const cs = await passwordGrant("couple");
  const c = apiClient({ bearer: cs.access_token });
  await assertDemoTenant(c);

  const guests = (await data(c, "/couple/guests"))?.items ?? [];
  const sofia = guests.find((g) => g.name === "Sofía Rojas") ?? guests.find((g) => /^Sof/.test(g.name));
  const inbox = (await data(c, "/couple/messages?filter=all"))?.items ?? [];
  const requests = (await data(c, "/couple/requests"))?.requests ?? [];
  const tasks = (await data(c, "/couple/tasks"))?.tasks ?? [];
  const board = (await data(c, "/couple/tasks/board"))?.tasks ?? [];
  const budget = (await data(c, "/couple/budget"))?.active ?? null;
  const vendors = (await data(c, "/couple/vendors"))?.vendors ?? [];
  const runsheet = (await data(c, "/couple/runsheet"))?.days ?? [];
  const seating = (await data(c, "/couple/seating"))?.tables ?? [];
  const broadcasts = (await data(c, "/couple/broadcasts"))?.history ?? [];
  const website = (await data(c, "/couple/website"))?.config ?? null;

  await sleep(2200);
  const ps = await passwordGrant("planner");
  const p = apiClient({ bearer: ps.access_token });
  await assertDemoTenant(p);
  const pReq = await data(p, "/planner/requests");
  const pTasks = (await data(p, "/planner/tasks"))?.tasks ?? [];
  const pBudget = (await data(p, "/planner/budget"))?.active ?? null;
  const pVendors = (await data(p, "/planner/vendors"))?.vendors ?? [];

  const ids = {
    resolved_at: new Date().toISOString(),
    tenant: "demo-review",
    guest: { self_guest_id: sofia?.id ?? null, invite_code: "CAMAND" },
    couple: {
      guest: sofia?.id ?? first(guests),
      conversation: first(inbox),
      request: first(requests),
      task: first(tasks),
      board_task: first(board),
      budget_category: first(budget?.categories),
      budget_item: first(budget?.items),
      vendor: first(vendors),
      runsheet_block: first(runsheet.flatMap((d) => d.blocks ?? [])),
      table: first(seating),
      broadcast: first(broadcasts),
      // Static keys from src/features/brain/sections.ts and src/features/website/hooks.ts.
      brain_sections: ["couple", "itinerary", "travel", "hotels", "transport", "planner", "money", "weather", "local", "food", "gifts", "faq"],
      website_sections: [...new Set([...(website?.sections ?? []).map((s) => s.type), "custom", "details"])],
    },
    planner: {
      request: first(pReq?.requests),
      task: first(pTasks),
      budget_category: first(pBudget?.categories),
      budget_item: first(pBudget?.items),
      vendor: first(pVendors),
    },
  };
  writeJson(path.join(PART9, "ids.json"), ids);
  const missing = [];
  for (const [role, group] of Object.entries({ couple: ids.couple, planner: ids.planner })) for (const [k, v] of Object.entries(group)) if (v === null) missing.push(`${role}.${k}`);
  console.log(`wrote .part9/ids.json. Guest id ${ids.guest.self_guest_id ? "found" : "MISSING"}. Empty lists (no id yet): ${missing.length ? missing.join(", ") : "none"}`);
}

main().catch((err) => {
  console.error(`resolve-ids failed: ${err.message}`);
  process.exit(1);
});

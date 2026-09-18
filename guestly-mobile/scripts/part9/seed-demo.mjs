// Demo content for the demo-review tenant, created THROUGH THE MOBILE API as
// the demo couple and the demo planner. No SQL, no service role.
//
//   node scripts/part9/seed-demo.mjs --dry-run        read only: fence, reminders check, what would be created
//   node scripts/part9/seed-demo.mjs --lang en        create what is missing, titles in English
//   node scripts/part9/seed-demo.mjs --lang es        retitle the seeded rows in place (never delete and recreate)
//   node scripts/part9/seed-demo.mjs --verify         re-read every seeded list and check the end state (EN titles)
//   node scripts/part9/seed-demo.mjs --remove         delete everything in the ledger (the budget is archived)
//
// Side-effect rules (plan section 2.6, C1). Read them before changing this file.
//   * Refuses to run unless /auth/me says tenant demo-review, for BOTH accounts.
//   * Task reminders must be OFF (they start an hourly email cron). If they are on, the task seed aborts.
//   * The planner request is created EXACTLY ONCE per wave, in English, and is never retitled or recreated.
//     The response flag emailSent must be false; if it is ever true seeding stops: a non-staff member exists.
//   * No collaborators, no assignees. Vendors carry no phone, only @test.guest-ly.com emails, fictional names.
//   * The RSVP question is optional, so the 24 existing RSVPs stay valid.
//   * Every created id goes to .part9/seed-ledger.json (ids only, never a token).

import path from "node:path";
import crypto from "node:crypto";
import { PART9, apiClient, assertDemoTenant, parseArgs, passwordGrant, readJson, sleep, writeJson } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const LEDGER = path.join(PART9, "seed-ledger.json");
const lang = args.lang === "es" ? "es" : "en";
const dry = !!args["dry-run"];

// ---------------------------------------------------------------- content

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const TASKS = [
  { key: "t-deposit", due: -8, status: "todo", priority: "high", category: "venue", en: ["Pay the venue deposit", "Second instalment, by bank transfer."], es: ["Pagar el anticipo del lugar", "Segunda cuota, por transferencia."] },
  { key: "t-menu", due: 0, status: "doing", priority: "high", category: "vendors", en: ["Confirm the tasting menu", "Three starters, two mains, one vegetarian option."], es: ["Confirmar el menú de degustación", "Tres entradas, dos platos fuertes y una opción vegetariana."] },
  { key: "t-shuttle", due: 2, status: "todo", priority: "normal", category: "travel", en: ["Book the guest shuttle", "Hotel to ceremony and back, two runs."], es: ["Reservar el transporte de invitados", "Del hotel a la ceremonia y de regreso, dos salidas."] },
  { key: "t-invites", due: 5, status: "todo", priority: "normal", category: "guests", en: ["Send the last invitations", "Six parties still have no invitation."], es: ["Enviar las últimas invitaciones", "Seis grupos aún no tienen invitación."] },
  { key: "t-rings", due: 40, status: "todo", priority: "normal", category: "attire", en: ["Pick up the rings", "Check the engraving before leaving the shop."], es: ["Recoger los anillos", "Revisar el grabado antes de salir de la joyería."] },
  { key: "t-vows", due: 95, status: "todo", priority: "low", category: "ceremony", en: ["Write the vows", "Two minutes each, no more."], es: ["Escribir los votos", "Dos minutos cada uno, no más."] },
  { key: "t-playlist", due: null, status: "todo", priority: "low", category: "day_of", en: ["Share the playlist with the band", "First dance, entrance and the last song."], es: ["Compartir la lista de canciones con la banda", "Primer baile, entrada y la última canción."] },
  { key: "t-photographer", due: -20, status: "done", priority: "normal", category: "vendors", en: ["Sign the photographer contract", "Signed and filed."], es: ["Firmar el contrato del fotógrafo", "Firmado y archivado."] },
];

const BOARD = [
  { key: "b-seating", assigned_to: "planner", en: ["Review the seating draft", "Tables 1 to 3 are done, the rest needs a second look."], es: ["Revisar el borrador de mesas", "Las mesas 1 a 3 están listas, el resto necesita otra mirada."] },
  { key: "b-allergies", assigned_to: "couple", en: ["Confirm allergies with the caterer", "Two guests marked gluten free."], es: ["Confirmar alergias con el catering", "Dos invitados marcaron sin gluten."] },
];

const BUDGET = { en: "Wedding budget", es: "Presupuesto de la boda", currency: "USD", guest_count: 80 };
const CATEGORIES = [
  { key: "c-venue", en: "Venue", es: "Lugar" },
  { key: "c-catering", en: "Food and drinks", es: "Comida y bebidas" },
  { key: "c-photo", en: "Photo and video", es: "Foto y video" },
  { key: "c-music", en: "Music", es: "Música" },
  { key: "c-flowers", en: "Flowers and decor", es: "Flores y decoración" },
];
const ITEMS = [
  { key: "i-venue-rent", cat: "c-venue", amount: 9500, status: "confirmed", vendor: "v-venue", en: "Hacienda rental, full day", es: "Alquiler de la hacienda, día completo" },
  { key: "i-venue-chairs", cat: "c-venue", qty: 90, unit: 6, status: "confirmed", en: "Chairs and tables", es: "Sillas y mesas" },
  { key: "i-catering-dinner", cat: "c-catering", qty: 80, unit: 78, status: "confirmed", vendor: "v-catering", en: "Seated dinner, three courses", es: "Cena servida, tres tiempos" },
  { key: "i-catering-bar", cat: "c-catering", amount: 3200, status: "quoted", en: "Open bar, five hours", es: "Barra libre, cinco horas" },
  { key: "i-catering-cake", cat: "c-catering", amount: 640, status: "pending", en: "Wedding cake", es: "Pastel de boda" },
  { key: "i-photo", cat: "c-photo", amount: 3800, status: "confirmed", en: "Photography, ten hours", es: "Fotografía, diez horas" },
  { key: "i-video", cat: "c-photo", amount: 2600, status: "quoted", en: "Highlight film", es: "Video resumen" },
  { key: "i-band", cat: "c-music", amount: 2900, status: "confirmed", en: "Live band, two sets", es: "Banda en vivo, dos sets" },
  { key: "i-dj", cat: "c-music", amount: 900, status: "pending", en: "DJ until close", es: "DJ hasta el cierre" },
  { key: "i-flowers-ceremony", cat: "c-flowers", amount: 1850, status: "quoted", en: "Ceremony arch and aisle", es: "Arco y pasillo de la ceremonia" },
  { key: "i-flowers-tables", cat: "c-flowers", qty: 10, unit: 95, status: "quoted", en: "Table centrepieces", es: "Centros de mesa" },
  { key: "i-lighting", cat: "c-flowers", amount: 1200, status: "pending", en: "Courtyard lighting", es: "Iluminación del patio" },
];
const PAYMENTS = [
  { item: "i-venue-rent", amount: 4750, days: -60, kind: "paid", en: "Deposit", es: "Anticipo" },
  { item: "i-photo", amount: 1140, days: -30, kind: "paid", en: "Booking fee", es: "Reserva" },
  { item: "i-catering-dinner", amount: 3120, days: 45, kind: "planned", en: "Half before the tasting", es: "Mitad antes de la degustación" },
];

// Fictional businesses. No phone numbers, test-domain emails only.
const VENDORS = [
  { key: "v-venue", name: "Hacienda Los Tilos Demo", category: "venue", status: "booked", price: 9500, rating: 5, email: "hacienda@test.guest-ly.com", en: "Courtyard ceremony, dinner in the main hall.", es: "Ceremonia en el patio, cena en el salón principal." },
  { key: "v-catering", name: "Mesa Larga Catering Demo", category: "catering", status: "booked", price: 6240, rating: 4, email: "mesalarga@test.guest-ly.com", en: "Tasting on the calendar.", es: "Degustación ya agendada." },
  { key: "v-photo", name: "Luz Clara Foto Demo", category: "photo", status: "quoted", price: 3800, rating: 5, email: "", en: "Quote valid for thirty days.", es: "Cotización válida por treinta días." },
  { key: "v-music", name: "Quinteto Aurora Demo", category: "music", status: "contacted", price: null, rating: null, email: "", en: "Waiting for their set list.", es: "Esperando su lista de canciones." },
  { key: "v-flowers", name: "Flor de Abril Demo", category: "flowers", status: "shortlist", price: null, rating: null, email: "", en: "Recommended by the venue.", es: "Recomendada por el lugar." },
];

const TABLES = [
  { key: "tb-1", capacity: 8, shape: "round", en: "Table 1", es: "Mesa 1" },
  { key: "tb-2", capacity: 8, shape: "round", en: "Table 2", es: "Mesa 2" },
  { key: "tb-3", capacity: 8, shape: "round", en: "Table 3", es: "Mesa 3" },
  { key: "tb-4", capacity: 8, shape: "round", en: "Table 4", es: "Mesa 4" },
  { key: "tb-5", capacity: 10, shape: "rect", en: "Family table", es: "Mesa de la familia" },
  { key: "tb-6", capacity: 6, shape: "round", en: "Friends from school", es: "Amigos del colegio" },
];

const BLOCKS = [
  { key: "r-hair", at: "09:00", end: "11:30", status: "confirmed", en: ["Hair and makeup", "Bridal suite"], es: ["Peinado y maquillaje", "Suite nupcial"] },
  { key: "r-photos", at: "13:00", end: "14:30", status: "confirmed", vendor: "v-photo", en: ["First look and portraits", "Gardens"], es: ["Primer encuentro y retratos", "Jardines"] },
  { key: "r-shuttle", at: "15:15", end: null, status: "planned", en: ["Guest shuttle leaves the hotel", "Hotel lobby"], es: ["Sale el transporte de invitados", "Lobby del hotel"] },
  { key: "r-ceremony", at: "16:00", end: "16:45", status: "confirmed", vendor: "v-venue", en: ["Ceremony", "Courtyard"], es: ["Ceremonia", "Patio"] },
  { key: "r-cocktail", at: "17:00", end: "18:15", status: "planned", en: ["Cocktail hour", "Terrace"], es: ["Cóctel", "Terraza"] },
  { key: "r-dinner", at: "18:30", end: "20:15", status: "planned", vendor: "v-catering", en: ["Dinner and toasts", "Main hall"], es: ["Cena y brindis", "Salón principal"] },
  { key: "r-dance", at: "20:30", end: null, status: "planned", en: ["First dance", "Main hall"], es: ["Primer baile", "Salón principal"] },
  { key: "r-close", at: "01:30", end: null, status: "planned", en: ["Last song and farewell", "Main hall"], es: ["Última canción y despedida", "Salón principal"] },
];

const QUESTION = {
  id: "part9-meal",
  kind: "select",
  label: { en: "Meal choice", es: "Elección de plato" },
  options: [
    { id: "beef", label: { en: "Beef", es: "Res" } },
    { id: "fish", label: { en: "Fish", es: "Pescado" } },
    { id: "vegetarian", label: { en: "Vegetarian", es: "Vegetariano" } },
  ],
  event_id: null,
  required: false,
};

const REQUEST_NOTE = "Her partner confirmed yesterday. Could you add one seat for him?";

// ---------------------------------------------------------------- helpers

function must(r, what) {
  if (!r.ok) throw new Error(`${what} failed with HTTP ${r.status}${r.error?.code ? ` (${r.error.code})` : ""}`);
  return r.data;
}

const ledger = readJson(LEDGER, { tasks: [], board: [], budget: null, vendors: [], tables: [], blocks: [], question: null, request: null });
const save = () => {
  if (!dry) writeJson(LEDGER, ledger);
};
const idOf = (list, key) => list.find((x) => x.key === key)?.id ?? null;
const log = (...a) => console.log(...a);

async function clients() {
  const cs = await passwordGrant("couple");
  const couple = apiClient({ bearer: cs.access_token, lang });
  await assertDemoTenant(couple);
  await sleep(2200);
  const ps = await passwordGrant("planner");
  const planner = apiClient({ bearer: ps.access_token, lang: "en" });
  await assertDemoTenant(planner);
  return { couple, planner };
}

// ---------------------------------------------------------------- seed

async function seedTasks(c) {
  const surface = must(await c.get("/couple/tasks"), "read tasks");
  if (surface.pending) return log("tasks: pending_db, skipped");
  if (surface.settings?.reminders_enabled) throw new Error("task reminders are ON for demo-review. Seeding overdue tasks would start reminder emails. Aborting the task seed; tell the lead.");
  if (surface.tasks.length && !ledger.tasks.length) return log(`tasks: list already has ${surface.tasks.length} rows that are not ours, skipped`);
  const cats = new Set(surface.options?.categories ?? []);
  for (const t of TASKS) {
    if (idOf(ledger.tasks, t.key)) continue;
    const body = { title: t[lang][0], notes: t[lang][1], category: cats.has(t.category) ? t.category : "other", status: t.status, priority: t.priority, due_date: t.due === null ? null : addDays(surface.today, t.due), recurrence: "none", remind_offsets_days: [], assignee: null };
    if (dry) { log(`tasks: would create ${t.key}`); continue; }
    const r = must(await c.post("/couple/tasks", body), `create task ${t.key}`);
    ledger.tasks.push({ key: t.key, id: r.task.id });
    save();
  }
  log(`tasks: ${ledger.tasks.length} seeded`);
}

async function seedBoard(c) {
  const board = must(await c.get("/couple/tasks/board"), "read shared board");
  if (board.pending) return log("board: pending_db, skipped");
  if (board.tasks.length && !ledger.board.length) return log("board: not empty and not ours, skipped");
  for (const b of BOARD) {
    if (idOf(ledger.board, b.key)) continue;
    if (dry) { log(`board: would create ${b.key}`); continue; }
    const r = must(await c.post("/couple/tasks/board", { title: b[lang][0], detail: b[lang][1], assigned_to: b.assigned_to, guest_ids: [] }), `create board task ${b.key}`);
    ledger.board.push({ key: b.key, id: r.id });
    save();
  }
  log(`board: ${ledger.board.length} seeded`);
}

async function seedVendors(c) {
  const v = must(await c.get("/couple/vendors"), "read vendors");
  if (v.pending) return log("vendors: pending_db, skipped");
  if (v.vendors.length && !ledger.vendors.length) return log("vendors: not empty and not ours, skipped");
  for (const x of VENDORS) {
    if (idOf(ledger.vendors, x.key)) continue;
    if (dry) { log(`vendors: would create ${x.key}`); continue; }
    const body = { name: x.name, category: x.category, status: x.status, contact_name: "", phone: "", email: x.email, website: "", instagram: "", address: "", price_quoted: x.price, currency: BUDGET.currency, rating: x.rating, notes: x[lang] };
    const r = must(await c.post("/couple/vendors", body), `create vendor ${x.key}`);
    ledger.vendors.push({ key: x.key, id: r.id });
    save();
  }
  log(`vendors: ${ledger.vendors.length} seeded`);
}

async function seedBudget(c) {
  const b = must(await c.get("/couple/budget"), "read budget");
  if (b.pending) return log("budget: pending_db, skipped");
  if (b.budgets.length && !ledger.budget) return log("budget: a budget exists that is not ours, skipped");
  if (dry && !ledger.budget) return log("budget: would create 1 budget, 5 categories, 12 lines, 3 payments");
  if (!ledger.budget) {
    const r = must(await c.post("/couple/budget", { name: BUDGET[lang], currency: BUDGET.currency, guest_count: BUDGET.guest_count, notes: "" }), "create budget");
    ledger.budget = { id: r.id, categories: [], items: [], payments: [], links: [] };
    save();
  }
  const L = ledger.budget;
  for (const cat of CATEGORIES) {
    if (idOf(L.categories, cat.key)) continue;
    const r = must(await c.post("/couple/budget/categories", { budget_id: L.id, name: cat[lang] }), `create category ${cat.key}`);
    L.categories.push({ key: cat.key, id: r.id });
    save();
  }
  for (const it of ITEMS) {
    if (idOf(L.items, it.key)) continue;
    const body = { budget_id: L.id, title: it[lang], category_id: idOf(L.categories, it.cat), status: it.status, currency: BUDGET.currency };
    if (it.qty) Object.assign(body, { qty: it.qty, unit_price: it.unit });
    else Object.assign(body, { qty: 1, unit_price: it.amount });
    const r = must(await c.post("/couple/budget/items", body), `create line ${it.key}`);
    L.items.push({ key: it.key, id: r.id });
    save();
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const p of PAYMENTS) {
    if (L.payments.find((x) => x.key === `${p.item}:${p.days}`)) continue;
    const r = must(await c.post("/couple/budget/payments", { budget_id: L.id, item_id: idOf(L.items, p.item), amount: p.amount, paid_on: addDays(today, p.days), kind: p.kind, currency: BUDGET.currency, note: p[lang] }), `create payment on ${p.item}`);
    L.payments.push({ key: `${p.item}:${p.days}`, id: r.id });
    save();
  }
  // Two vendors linked to budget lines.
  for (const it of ITEMS.filter((x) => x.vendor)) {
    const vendorId = idOf(ledger.vendors, it.vendor);
    const itemId = idOf(L.items, it.key);
    if (!vendorId || !itemId || L.links.includes(it.key)) continue;
    const r = await c.post(`/couple/vendors/${vendorId}/link`, { item_id: itemId });
    if (r.ok) { L.links.push(it.key); save(); } else log(`budget: link ${it.key} answered HTTP ${r.status}, left unlinked`);
  }
  log(`budget: 1 budget, ${L.categories.length} categories, ${L.items.length} lines, ${L.payments.length} payments, ${L.links.length} vendor links`);
}

async function seedSeating(c) {
  const s = must(await c.get("/couple/seating"), "read seating");
  if (s.tables.length && !ledger.tables.length) return log("seating: tables exist that are not ours, skipped");
  if (ledger.tables.length) return log(`seating: ${ledger.tables.length} tables already seeded`);
  if (dry) return log("seating: would create 6 tables and seat about half of the attending parties");
  const tables = TABLES.map((t) => ({ key: t.key, id: `t_${crypto.randomBytes(5).toString("hex")}`, label: t[lang], capacity: t.capacity, shape: t.shape }));
  // Seat about half of the confirmed parties, never splitting a party, never over capacity.
  const confirmed = s.parties.filter((p) => p.confirmed);
  const target = Math.ceil(confirmed.reduce((n, p) => n + p.size, 0) / 2);
  const assignments = Object.fromEntries(tables.map((t) => [t.id, []]));
  let seated = 0;
  for (const p of confirmed) {
    if (seated >= target) break;
    const table = tables.find((t) => t.capacity - assignments[t.id].length >= p.size);
    if (!table) continue;
    for (const person of p.people.slice(0, p.size)) assignments[table.id].push({ rsvp_id: p.rsvp_id, person: person.name, kind: person.kind });
    seated += p.size;
  }
  const out = must(await c.post("/couple/seating", { tables: tables.map(({ id, label, capacity, shape }) => ({ id, label, capacity, shape })), assignments }), "save seating");
  // The server may re-issue ids; match by label.
  ledger.tables = TABLES.map((t) => ({ key: t.key, id: out.tables.find((x) => x.label === t[lang])?.id ?? null }));
  save();
  log(`seating: ${out.tables.length} tables, ${out.stats.seated} people seated of ${out.stats.confirmed_seats}`);
}

async function seedRunsheet(c) {
  const r = must(await c.get("/couple/runsheet"), "read run sheet");
  if (r.pending) return log("runsheet: pending_db, skipped");
  if (r.blocks_total && !ledger.blocks.length) return log("runsheet: blocks exist that are not ours, skipped");
  const day = r.wedding_date;
  if (!day) return log("runsheet: the tenant has no wedding date, skipped");
  for (const b of BLOCKS) {
    if (idOf(ledger.blocks, b.key)) continue;
    if (dry) { log(`runsheet: would create ${b.key}`); continue; }
    // 01:30 belongs to the night after the wedding day.
    const blockDay = b.at < "06:00" ? addDays(day, 1) : day;
    const body = { day: blockDay, starts_at: b.at, title: b[lang][0], location: b[lang][1], status: b.status };
    if (b.end) body.ends_at = b.end;
    const vendorId = b.vendor ? idOf(ledger.vendors, b.vendor) : null;
    if (vendorId) body.vendor_id = vendorId;
    const out = must(await c.post("/couple/runsheet", body), `create block ${b.key}`);
    ledger.blocks.push({ key: b.key, id: out.block.id });
    save();
  }
  log(`runsheet: ${ledger.blocks.length} blocks seeded`);
}

async function seedQuestion(c) {
  const q = must(await c.get("/couple/rsvps/questions"), "read RSVP questions");
  if (q.questions.find((x) => x.id === QUESTION.id) || ledger.question) return log("rsvp question: already there");
  if (q.questions.length) return log("rsvp question: questions exist that are not ours, skipped");
  if (dry) return log("rsvp question: would add 1 optional question");
  const out = must(await c.post("/couple/rsvps/questions", { questions: [QUESTION] }), "save RSVP question");
  ledger.question = { id: out.questions?.[0]?.id ?? QUESTION.id };
  save();
  log("rsvp question: 1 optional question added");
}

async function seedRequest(p, couple) {
  if (ledger.request) return log("planner request: already created in this wave, never recreated");
  const list = must(await p.get("/planner/requests"), "read planner requests");
  if (list.pending) return log("planner request: pending_db, skipped");
  if (list.requests.length) return log("planner request: requests exist that are not ours, skipped");
  if (dry) return log("planner request: would create 1 open plus_one request (English note)");
  // A pending party of one, so the request reads naturally. Never Sofia Rojas: her RSVP is the audit's edit target.
  const guests = must(await couple.get("/couple/guests"), "read guests").items;
  const target = guests.find((g) => g.status === "attending" && g.party_size === 1 && !/Sof/.test(g.name)) ?? guests.find((g) => !/Sof/.test(g.name));
  const r = must(await p.post("/planner/requests", { kind: "plus_one", guest_ids: [target.id], payload: { kind: "plus_one", additional_seats: 1 }, note: REQUEST_NOTE }), "create planner request");
  ledger.request = { id: r.id, guest_id: target.id, email_sent: r.emailSent === true };
  save();
  if (r.emailSent === true) throw new Error("STOP: the planner request reported emailSent=true. A non-staff owner or admin exists on demo-review. Tell the lead; no more seeding.");
  log("planner request: 1 open request created, emailSent=false");
}

// ---------------------------------------------------------------- retitle, verify, remove

async function retitle(c) {
  for (const t of TASKS) {
    const id = idOf(ledger.tasks, t.key);
    if (id) must(await c.post(`/couple/tasks/${id}`, { title: t[lang][0], notes: t[lang][1] }), `retitle task ${t.key}`);
  }
  for (const b of BOARD) {
    const id = idOf(ledger.board, b.key);
    if (id) must(await c.post(`/couple/tasks/board/${id}`, { title: b[lang][0], detail: b[lang][1] }), `retitle board task ${b.key}`);
  }
  for (const v of VENDORS) {
    const id = idOf(ledger.vendors, v.key);
    if (id) must(await c.post(`/couple/vendors/${id}`, { name: v.name, category: v.category, status: v.status, email: v.email, price_quoted: v.price, currency: BUDGET.currency, rating: v.rating, notes: v[lang] }), `retitle vendor ${v.key}`);
  }
  if (ledger.budget) {
    const L = ledger.budget;
    must(await c.post(`/couple/budget/${L.id}`, { name: BUDGET[lang], currency: BUDGET.currency, guest_count: BUDGET.guest_count, notes: "" }), "retitle budget");
    for (const cat of CATEGORIES) {
      const id = idOf(L.categories, cat.key);
      if (id) must(await c.post(`/couple/budget/categories/${id}`, { name: cat[lang] }), `retitle category ${cat.key}`);
    }
    for (const it of ITEMS) {
      const id = idOf(L.items, it.key);
      if (!id) continue;
      const body = { budget_id: L.id, title: it[lang], category_id: idOf(L.categories, it.cat), status: it.status, currency: BUDGET.currency };
      if (it.qty) Object.assign(body, { qty: it.qty, unit_price: it.unit });
      else Object.assign(body, { qty: 1, unit_price: it.amount });
      must(await c.post(`/couple/budget/items/${id}`, body), `retitle line ${it.key}`);
    }
  }
  if (ledger.tables.length) {
    const s = must(await c.get("/couple/seating"), "read seating");
    const tables = s.tables.map((t) => {
      const key = ledger.tables.find((x) => x.id === t.id)?.key;
      const spec = TABLES.find((x) => x.key === key);
      return { id: t.id, label: spec ? spec[lang] : t.label, capacity: t.capacity, shape: t.shape };
    });
    must(await c.post("/couple/seating", { tables }), "retitle tables");
  }
  for (const b of BLOCKS) {
    const id = idOf(ledger.blocks, b.key);
    if (id) must(await c.post(`/couple/runsheet/${id}`, { title: b[lang][0], location: b[lang][1] }), `retitle block ${b.key}`);
  }
  ledger.lang = lang;
  save();
  log(`retitled seeded rows to ${lang}. The planner request note is never touched.`);
}

async function verify(c, p) {
  const problems = [];
  const tasks = must(await c.get("/couple/tasks"), "read tasks");
  if (tasks.settings?.reminders_enabled) problems.push("task reminders are ON");
  for (const t of TASKS) {
    const row = tasks.tasks.find((x) => x.id === idOf(ledger.tasks, t.key));
    if (!row) problems.push(`task ${t.key} missing`);
    else if (row.title !== t.en[0]) problems.push(`task ${t.key} is not in English`);
  }
  const vendors = must(await c.get("/couple/vendors"), "read vendors");
  for (const v of VENDORS) if (!vendors.vendors.find((x) => x.id === idOf(ledger.vendors, v.key))) problems.push(`vendor ${v.key} missing`);
  const budget = must(await c.get("/couple/budget"), "read budget");
  if (ledger.budget && budget.active?.budget?.name !== BUDGET.en) problems.push("budget name is not the English one");
  const seating = must(await c.get("/couple/seating"), "read seating");
  for (const t of TABLES) {
    const row = seating.tables.find((x) => x.id === idOf(ledger.tables, t.key));
    if (!row) problems.push(`table ${t.key} missing`);
    else if (row.label !== t.en) problems.push(`table ${t.key} is not in English`);
  }
  const run = must(await c.get("/couple/runsheet"), "read run sheet");
  const blocks = run.days.flatMap((d) => d.blocks);
  for (const b of BLOCKS) {
    const row = blocks.find((x) => x.id === idOf(ledger.blocks, b.key));
    if (!row) problems.push(`block ${b.key} missing`);
    else if (row.title !== b.en[0]) problems.push(`block ${b.key} is not in English`);
  }
  const q = must(await c.get("/couple/rsvps/questions"), "read RSVP questions");
  if (ledger.question && !q.questions.find((x) => x.id === ledger.question.id)) problems.push("RSVP question missing");
  if (q.questions.some((x) => x.required)) problems.push("an RSVP question is required");
  const reqs = must(await p.get("/planner/requests"), "read planner requests");
  const open = reqs.requests.filter((r) => r.status === "open");
  if (open.length !== 1) problems.push(`expected exactly one open planner request, found ${open.length}`);
  log(problems.length ? `VERIFY FAILED:\n - ${problems.join("\n - ")}` : "verify: end state is the English seed, one open request, reminders off");
  if (problems.length) process.exitCode = 1;
}

async function remove(c, p) {
  for (const t of ledger.tasks) await c.del(`/couple/tasks/${t.id}`);
  for (const b of ledger.board) await c.del(`/couple/tasks/board/${b.id}`);
  for (const b of ledger.blocks) await c.del(`/couple/runsheet/${b.id}`);
  if (ledger.budget) {
    for (const x of ledger.budget.payments) await c.del(`/couple/budget/payments/${x.id}`);
    for (const x of ledger.budget.items) await c.del(`/couple/budget/items/${x.id}`);
    for (const x of ledger.budget.categories) await c.del(`/couple/budget/categories/${x.id}`);
    await c.post(`/couple/budget/${ledger.budget.id}/archive`);
  }
  for (const v of ledger.vendors) await c.del(`/couple/vendors/${v.id}`);
  if (ledger.tables.length) {
    const s = must(await c.get("/couple/seating"), "read seating");
    const ours = new Set(ledger.tables.map((t) => t.id));
    const keep = s.tables.filter((t) => !ours.has(t.id)).map((t) => ({ id: t.id, label: t.label, capacity: t.capacity, shape: t.shape }));
    await c.post("/couple/seating", { tables: keep });
  }
  if (ledger.question) {
    const q = must(await c.get("/couple/rsvps/questions"), "read RSVP questions");
    await c.post("/couple/rsvps/questions", { questions: q.questions.filter((x) => x.id !== ledger.question.id) });
  }
  if (ledger.request) await p.post(`/planner/requests/${ledger.request.id}/cancel`);
  writeJson(LEDGER, { tasks: [], board: [], budget: null, vendors: [], tables: [], blocks: [], question: null, request: null, removed_at: new Date().toISOString() });
  log("removed everything in the ledger (the budget is archived, the API has no budget delete)");
}

// ---------------------------------------------------------------- main

async function main() {
  const { couple, planner } = await clients();
  if (args.remove) return remove(couple, planner);
  if (args.verify) return verify(couple, planner);
  const alreadySeeded = ledger.tasks.length || ledger.vendors.length || ledger.budget;
  if (alreadySeeded && ledger.lang && ledger.lang !== lang && !dry) return retitle(couple);

  log(`seed ${dry ? "(dry run) " : ""}on demo-review, lang=${lang}, ${new Date().toISOString()}`);
  await seedTasks(couple);
  await seedBoard(couple);
  await seedVendors(couple); // before the budget (links) and the run sheet (vendor_id)
  await seedBudget(couple);
  await seedSeating(couple);
  await seedRunsheet(couple);
  await seedQuestion(couple);
  await seedRequest(planner, couple);
  if (!dry) {
    ledger.lang = lang;
    ledger.applied_at = ledger.applied_at ?? new Date().toISOString();
    save();
    log(`ledger: ${LEDGER}`);
  }
}

main().catch((err) => {
  console.error(`seed-demo: ${err.message}`);
  process.exit(1);
});

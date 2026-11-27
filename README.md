# Workbook

Inventory, pick sheets, and job cost for **Endless Poxybilities Concrete Coating**. It replaces the InventorySync subscription the shop is paying for: installers weigh material out of a warehouse for a job, weigh leftovers back in, and the office sees usage, stock, and what the floor cost.

This repository is public. It ships with fake sample data only. Do not commit `.env`, API keys, real customer exports, or real passwords.

## Stack

- Next.js (App Router) and React
- Prisma with SQLite for local development
- Cookie sessions (password hashed with bcrypt)
- Tailwind CSS, dark by default, with a light toggle
- Vitest for pick-sheet math and inventory balances

The schema uses only portable column types. Production can switch the Prisma provider to PostgreSQL (Vercel + hosted Postgres) without a model rewrite. See [Deploy](#deploy).

## Setup

```bash
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open http://localhost:3000.

`npm test` runs the pick-sheet and inventory tests. `npm run build` produces the production build.

### Sample sign-in

Every sample user shares `SEED_PASSWORD` from `.env`. The default in `.env.example` is `demo-pass-7783`. Change it before any real deployment.

| Person | Email | Role |
| --- | --- | --- |
| Avery Quinn | avery.quinn@epoxy.example | Admin, all warehouses |
| Casey Nguyen | casey.nguyen@epoxy.example | Team lead, North crew |
| Riley Brooks | riley.brooks@epoxy.example | Team lead, Metro crew |
| Quinn Alvarez | quinn.alvarez@epoxy.example | Team lead, South crew |
| Morgan Hale | morgan.hale@epoxy.example | Installer |
| Reese Patel | reese.patel@epoxy.example | Warehouse, Phoenix |
| Drew Kim | drew.kim@epoxy.example | Warehouse, Midwest shops |
| Parker Olsen | parker.olsen@epoxy.example | Office |
| Samir Cole | samir.cole@epoxy.example | Auditor (custom view-only role) |

Warehouses: Phoenix, Sioux Falls, Clarkfield, Lakeville, Cokato, Zimmerman. Addresses are fictional.

### Try the core loop

1. Sign in as Avery.
2. Open job **EP-7070** (707 sq ft, 1/4 inch Cabin Fever, Lakeville, scheduled today).
3. Open **Edit pick sheet**. The live quantities should read flake **101 lb**, Base A **26.7**, Base B **13.4**, Top A **34**, Top B **34**. Those rates live in Admin → Coverage rates, not in code.
4. Open **Check Out / Check In**. Type pounds checked out and checked in. They save on their own. Used = out − in. The first checkout moves a New job to In progress.
5. Lakeville demo containers you can scan or type: `IS-DEMO0001-A001` (Basecoat A, 48 lb), `IS-DEMO0002-B001` (Basecoat B, 52.5 lb), `IS-DEMO0003-F001` (Cabin Fever, 40 lb).
6. **Job cost** shows planned vs taken vs returned vs used, dollars, and Over / Under / On target (default tolerance 5%).
7. **Transactions** and **Inventory → Records** show the balance change. **Count stock** writes an adjustment.

Admin → Builder Prime → **Sync Jobs** imports mock sold projects (EP-3101 and friends) with no API key. EP-3106 is already in the database with a stale address so the sync also shows an update.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Local default `file:./dev.db` (path is relative to `prisma/`). |
| `AUTH_SECRET` | Required in production so a deploy fails closed if the environment was not configured. |
| `SEED_PASSWORD` | Password the seed script assigns to every sample user. |
| `BUILDER_PRIME_API_KEY` | Server-only. Leave empty to stay in mock mode. |
| `BUILDER_PRIME_SUBDOMAIN` | Default `endlesspoxybilities`. The database setting overrides this after you save the admin form. |
| `BUILDER_PRIME_WEBHOOK_SECRET` | Required before `POST /api/webhooks/builder-prime` accepts anything. |
| `CRON_SECRET` | Required before `/api/cron/builder-prime` runs the nightly sync. |

## Builder Prime

Public docs used for the client:

- [Open API overview](https://help.builderprime.com/bp-knowledgebase/open-api-documentation) — key is created under Admin → Integrations → Open API and shown once.
- [Projects API](https://help.builderprime.com/bp-knowledgebase/working-with-clients-through-the-api-0) — `GET/POST https://{subdomain}.builderprime.com/api/projects/v1`, header `x-api-key`, scope `projects.read` to list. Query: `limit` (max 100), `page` (starts at 0), `project-status`, `last-modified-since` (epoch ms, not older than one year).
- [Employees API](https://help.builderprime.com/bp-knowledgebase/working-with-clients-through-the-api-1-0) — not called yet. Crew matching uses the foreman name on the project.
- [Webhook field list](https://help.builderprime.com/bp-knowledgebase/how-to-integrate-with-review-services) — project-context payload (`projectId`, `projectNumber`, `projectStatus`, worksite address, `salesPerson`, `foreman`, and so on). Square footage and flake color are read from custom fields. Default names: Square Footage, Flake Color, Flake Size, Verticals, Stairs. Change them under Admin → Builder Prime.

There is no API key in this repo. Mock mode serves `src/lib/bp-fixtures.ts`. Switch the admin page to **Live** only after `BUILDER_PRIME_API_KEY` is set on the server. The key is never sent to the browser.

Nightly sync: `vercel.json` schedules `GET /api/cron/builder-prime` at 11:00 UTC. Vercel sends `Authorization: Bearer $CRON_SECRET`. A manual caller can send `x-cron-secret` instead.

Webhook: point a Builder Prime “Send Webhook” automation (on the sold status) at:

```text
https://YOUR_HOST/api/webhooks/builder-prime?secret=YOUR_WEBHOOK_SECRET
```

The secret may also be the `x-webhook-secret` header or a `webhookSecret` field in the JSON body. Builder Prime’s own webhook UI can add extra key/value pairs; it does not sign the body, so the shared secret is the check.

```bash
curl -X POST "http://localhost:3000/api/webhooks/builder-prime?secret=$BUILDER_PRIME_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"910199","projectNumber":"EP-3199","projectStatus":"Sold","foreman":"Jordan Ellis","salesPerson":"Parker Olsen","worksiteAddressLine1":"5 Fictional Pine Ct","worksiteAddressCity":"Sioux Falls","worksiteAddressState":"SD","worksiteAddressPostalCode":"57104","customFields":[{"customFieldName":"Square Footage","customFieldValue":"640"},{"customFieldName":"Flake Color","customFieldValue":"Creekbed"}]}'
```

A job is assigned to a crew when the foreman name matches that crew’s lead or a member.

## What the app covers

Roles (Installer, Team Lead, Warehouse, Office, Admin, plus custom roles) with per-section none/view/edit. Users can see every warehouse or a subset.

Warehouses have a ship-to address and a location manager. Master data covers chemicals, supplies, and flake colors, with CSV import, search, and merge. Seeded products include Basecoat A/B at $4.10/lb (48 lb and 52.5 lb boxes), Topcoat A/B at $60/lb, Mender, Tracbite, Crack Fill, and the 1/4 inch colors at $2.00/lb in 40 lb boxes. Prices that the shop did not specify are tagged “sample price”.

Jobs have number, Builder Prime id, type, status, address, salesperson, foreman, warehouse, dates, square footage, flake color and size, and “needs a look” flags. Lists filter and export CSV. Archive and delete are soft.

The pick sheet uses admin-edited coverage rates (floor, verticals, stairs, season, location). Optional lines: moisture barrier, Gator/Shark Bite (mapped to Tracbite), Base C/D, Top C/D. Mender is weigh-only. Each line maps to a stocked product, shows about N boxes, and warns when nothing is on hand. PDF download is on the job.

Inventory is a weight balance per product per warehouse, plus barcoded containers (`IS-XXXXXXXX-XXXX`) with printable labels. Count stock saves each change as an adjustment.

Transactions record time, barcode, product, event (DRAWN, RETURNED, ADJUSTED, TRASHED, RECEIVED), signed weight change, new balance, warehouse, job, and user. The event activity log records who changed jobs, stock, products, and settings.

Dashboard counts and the production calendar (day/week/month, filter by warehouse, status, color, square feet) use the scheduled date.

Reporting covers stock health, upcoming pick-sheet demand versus on hand, shelf-minimum ordering, usage, material still checked out, and crew variance against the plan.

## Stubbed on purpose

- **Email.** Low stock, sync reports, and purchase orders are written to an outbox (`Admin → Purchasing`) with status `SKIPPED_NO_SMTP`. Nothing is emailed.
- **Reorder automation** generates a draft PO from reorder points and shelf minimums. It does not send it.
- **CompanyCam** is a link stored on the job, not an API sync.
- **Live Builder Prime** is implemented (list, map, upsert, webhook, cron) but stays in mock mode until a key exists. Employee directory sync is not built.
- **Measure sheets** are not a separate Builder Prime endpoint in the public docs. Square footage is read from custom fields, which you can rename in settings.

## Deploy

1. Create a Postgres database and set `DATABASE_URL` to its pooled URL.
2. In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`.
3. Run `npx prisma db push` (or generate a SQL migration with `npx prisma migrate diff`) against that database, then `npm run db:seed` once for sample data. Skip the seed on a database that already has real jobs.
4. Set `AUTH_SECRET`, `CRON_SECRET`, and `BUILDER_PRIME_WEBHOOK_SECRET` to long random strings. Leave `BUILDER_PRIME_API_KEY` empty until the shop generates one (`projects.read`).
5. Deploy the Next.js app (Vercel works). The cron in `vercel.json` calls the sync route daily. Confirm Vercel’s cron invocation is allowed to send `Authorization: Bearer $CRON_SECRET`.

Replace the sample passwords and remove or deactivate the `@epoxy.example` users before the team uses it with real jobs.

## Tests

```bash
npm test
```

`tests/pick-sheet.test.ts` locks the 707 sq ft / 1/4 inch reference and checks that rates, season, location, and optional components come from the coverage config. `tests/inventory.test.ts` checks draw, return, corrections, counts, trash, receive, and the first-checkout status rule.

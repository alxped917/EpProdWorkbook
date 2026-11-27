# Workbook

Inventory, pick sheets, and job cost for Endless Poxybilities Concrete Coating. Installers weigh material out of a warehouse for a job and weigh the leftovers back in.

This GitHub repo is public. Do not put passwords, API keys, or real customer lists in it.

## Put Workbook on the internet

These steps are for the owner. You do not need to write code.

1. Go to [vercel.com](https://vercel.com) and create an account with **Continue with GitHub**. Use the GitHub user that can open `alxped917/EpProdWorkbook`.
2. Click **Add New… → Project** and import **EpProdWorkbook**. Leave the framework as Next.js. Do not change the build command. The first deploy may fail. That is expected, because the database is not connected yet.
3. In the Vercel project, open the **Storage** tab (sometimes called **Integrations** or **Marketplace**). Add **Neon**. Connect it to this project and accept the prompts. Vercel fills in `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for you. You do not type those.
4. Open **Settings → Environment Variables**. Add every row in the table below. Choose **Production** for each one. Skip any row that Neon already created.
5. Open **Deployments**, open the latest one, and click **Redeploy**. Wait until it says **Ready**.
6. Open the site link Vercel shows (it ends in `.vercel.app`). You should see **Create the first account**. Type the setup code you saved as `SETUP_SECRET` and click the button.
7. Sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

If the page says the database is not ready, the deploy is still running or it failed. Open the failed deploy and read the last lines. The usual fix is a missing variable from the table, then redeploy.

The nightly Builder Prime sync is already scheduled (11:00 UTC). It does nothing useful until you add a Builder Prime API key, and it stays locked behind `CRON_SECRET`.

### Environment variables

Generate three random secrets. On a Mac or Linux computer, open Terminal and run this three times. Each line it prints is one secret. Save them in a password manager. Do not put them in GitHub.

```bash
openssl rand -base64 32
```

| Name | What to put | Who sets it |
| --- | --- | --- |
| `DATABASE_URL` | Neon’s pooled connection. The host name usually contains `-pooler`. | Neon, automatically |
| `DATABASE_URL_UNPOOLED` | Neon’s direct connection. The host name does **not** contain `-pooler`. Migrations use this. | Neon, automatically |
| `DIRECT_URL` | Only if the deploy says `DIRECT_URL` is missing. Paste the same value as `DATABASE_URL_UNPOOLED`. | You, only if the log asks |
| `AUTH_SECRET` | One of the random strings from the command above. At least 32 characters. Not the example in this file. | You |
| `CRON_SECRET` | A second random string. Vercel sends it automatically when the nightly sync runs. | You |
| `SETUP_SECRET` | A third random string. You type this once on the setup page. At least 16 characters. | You |
| `ADMIN_EMAIL` | The email you will use to sign in. | You |
| `ADMIN_PASSWORD` | The password you will type to sign in. At least 12 characters. Do not use `demo-pass-7783`. | You |
| `ADMIN_NAME` | Optional. Your name as it should appear in the app. | You |
| `BUILDER_PRIME_API_KEY` | Leave blank until Builder Prime shows you a key. Create it in Builder Prime under Admin → Integrations → Open API, with permission `projects.read`. The key is shown only once. | You, later |
| `BUILDER_PRIME_SUBDOMAIN` | `endlesspoxybilities` | You, optional |
| `BUILDER_PRIME_WEBHOOK_SECRET` | Another random string, only when you turn on Builder Prime’s webhook. | You, later |
| `SEED_SAMPLE_DATA` | Leave this off. Set it to `true` only if you want the fake practice jobs in the live database. | You, almost never |
| `SEED_PASSWORD` | Not used on the live site unless `SEED_SAMPLE_DATA` is `true`. | Leave unset |

Apply the variables to **Production**. If Vercel also builds preview sites and those builds fail, add the same variables to **Preview**.

After setup, change a ship-to address under **Warehouses**. The starter addresses say “Update this ship-to address” on purpose.

If you saved the wrong admin password and you have not given the site to the crew yet: fix `ADMIN_PASSWORD` in Vercel, redeploy, then in the Neon SQL editor run `DELETE FROM "User";` and open `/setup` again.

## Work on it locally

Local development uses the same Postgres database type as Vercel, in Docker.

```bash
cp .env.example .env
# Put a long random AUTH_SECRET in .env. The placeholder is fine only on your computer.
docker compose up -d
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open http://localhost:3000. Sample sign-in is `avery.quinn@epoxy.example` / `demo-pass-7783` (or whatever you set as `SEED_PASSWORD`). That password is for the fake local users only.

`npm test` checks pick-sheet math, inventory balances, and the production seed rules. `npm run build` applies migrations and builds the app, the same command Vercel runs.

Job **EP-7070** is the 707 sq ft practice job. Lakeville barcodes: `IS-DEMO0001-A001`, `IS-DEMO0002-B001`, `IS-DEMO0003-F001`.

## What is included

- Roles (Installer, Team Lead, Warehouse, Office, Admin, plus custom roles) and warehouse assignments
- Six warehouses, chemicals, supplies, flake colors, CSV import, and merge
- Jobs, pick sheets from editable coverage rates, PDF, check-out / check-in, barcodes, counts, transactions, job cost, calendar, and reports
- Builder Prime in **mock mode** until `BUILDER_PRIME_API_KEY` is set. Live mode calls `GET https://{subdomain}.builderprime.com/api/projects/v1` with header `x-api-key` (scope `projects.read`). Docs: [Open API](https://help.builderprime.com/bp-knowledgebase/open-api-documentation), [projects](https://help.builderprime.com/bp-knowledgebase/working-with-clients-through-the-api-0), [webhook fields](https://help.builderprime.com/bp-knowledgebase/how-to-integrate-with-review-services).

Square footage and flake color are read from Builder Prime custom fields. Rename those fields under Admin → Builder Prime.

Webhook, after you set the secret:

```bash
curl -X POST "https://YOUR_APP.vercel.app/api/webhooks/builder-prime?secret=$BUILDER_PRIME_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"910199","projectNumber":"EP-3199","projectStatus":"Sold"}'
```

## Not emailed yet

Low-stock notes, sync reports, and purchase orders are stored in the app and are not sent. CompanyCam is a link you paste on a job.

## Deploy notes for a developer

- Schema provider is `postgresql` in local and production. `DATABASE_URL` is the runtime (pooled) URL. `DIRECT_URL` is the direct URL Prisma uses for `prisma migrate deploy`.
- `scripts/vercel-build.mjs` copies `DATABASE_URL_UNPOOLED` or `POSTGRES_URL_NON_POOLING` into `DIRECT_URL` when Neon used a different name, then runs `prisma generate`, `prisma migrate deploy`, and `next build`.
- The Prisma client is cached on `globalThis` and, on Vercel or a `-pooler` host, adds `connection_limit=1` and `pgbouncer=true`.
- Sessions are httpOnly, `SameSite=Lax`, and `Secure` in production. The cookie name is `__Host-ep_session`. The value is an HMAC using `AUTH_SECRET`. The build fails on Vercel if `AUTH_SECRET` or `CRON_SECRET` is missing or still a placeholder.
- Nothing in the app writes to the local disk. PDFs and labels are built in memory.

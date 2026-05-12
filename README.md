# RxLedger

Operational pharmacy inventory app for Nigerian pharmacies and medical sites. RxLedger tracks medicines by account, branch/site, batch, expiry date, barcode, supplier, NAFDAC number, and immutable stock ledger movements.

## What Is Included

- Vercel serverless API backed by Postgres
- Shared inventory data across devices/users
- Server-side password hashing and session tokens
- First-run account setup for the company/pharmacy account and first branch/site
- Permanent first administrator for each account, protected from downgrade or suspension
- Branch/site register for outlets, dispensaries, and medical locations
- Main account dashboard with cross-branch stock overview
- Staff access requests with no default demo accounts
- Admin-controlled role assignment and account activation/suspension
- Role-aware access for Admin, Pharmacist, Inventory Officer, and Viewer/Auditor
- Medicine catalog with SKU, barcode, manufacturer, NAFDAC number, reorder level, and active status
- Supplier register with contact, address, and license reference
- Goods receiving workflow with mandatory batch, expiry, quantity, unit cost, supplier, and invoice reference
- Branch-aware goods receiving and stock issue workflows
- Stock issue workflow with FEFO allocation and expired-batch blocking
- Backend receiving validation that blocks expired batches and selling prices below unit cost
- Adjustments, supplier returns, customer returns, and write-offs with mandatory reasons
- Dashboard for stock value, low stock, near expiry, expired batches, access approvals, and daily movements
- Reports for stock on hand, stock movement ledger, expiry, and reorder needs
- CSV export and browser Print/PDF workflow
- Audit trail for critical create/update/post actions

## First Use

1. Open the deployed app.
2. Complete the first-run setup form with the account/company name, first branch/site, and permanent admin.
3. The first user becomes the active Admin and cannot be downgraded or suspended.
4. Other staff should use **Request access**.
5. Admin reviews requests in **Users**, assigns a role, then activates the account.
6. Admin can add more branches/sites in **Branches**.

## Account Model

RxLedger currently treats the main account as the company dashboard. Stock belongs to branches/sites, not to the main account itself. This keeps the current MVP simple while preparing the product for future billing plans and full multi-tenant SaaS isolation.

## UI Development Rule

Scrollable panels should scroll independently, like an analytics dashboard with many components. The sidebar/control panel, dropdown lists, dashboard cards, tables, and chat timelines should contain their own scrolling when the pointer is over them; the main workspace should only scroll when the pointer is on the main page.

Only Admin users can see global medication cost/value across all branches. Non-admin users must see medication cost/value only for the active branch workspace they are viewing. Branch switching should show a loading transition so each branch feels like a separate operating entity.

Whenever a medicine is displayed, show the brand/medicine name, generic name, dosage form, and strength together. The brand/medicine name should be the bold primary line, while generic, form, and strength remain secondary supporting text.

## Run Locally

```bash
npm install
npm run dev
```

Create a `.env.local` file before using API-backed flows locally:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/database?sslmode=require"
```

For local API testing, run through Vercel's local runtime:

```bash
npx vercel dev
```

Open the local URL shown by Vite or Vercel, usually:

```text
http://127.0.0.1:5173/
```

## Validate

```bash
npm run lint
npm run build
```

## Production Note

Set `DATABASE_URL` or `POSTGRES_URL` in Vercel project environment variables. Neon Postgres works well for this deployment style. The API automatically creates the required `app_state` and `sessions` tables on first request.

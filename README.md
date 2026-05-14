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

Admin users keep the global stock value on the dashboard, but the Medicines page must always show the selected branch value, even for Admins. This keeps catalog/value work tied to the branch being operated.

Whenever a medicine is displayed, show the brand/medicine name, generic name, dosage form, and strength together. The brand/medicine name should be the bold primary line, while generic, form, and strength remain secondary supporting text.

Forgot-password recovery is user-owned, not admin-approved. The user requests a reset code, verifies ownership through email, and changes the password directly. Admin users can view password reset requests, completions, new-device sign-ins, panic actions, and email failures in the security events log, but they do not approve the reset.

Only the permanent first admin is global and should not have an assigned branch label. Branch managers and branch-scoped admin users keep delegated admin-style power only inside their assigned/managed branch; outside it they are view-only. Login should default non-super-admin users to their assigned branch, and branch selectors should keep the assigned branch visibly marked and listed first.

Refreshing the browser should preserve a valid active session. Users should only be forced to re-enter their password after explicit logout, server/session expiry, or the 30-minute inactivity timeout.

Staff should have one active working branch at a time. A branch manager can assign free staff into their own branch and can release staff from that branch. Another branch manager cannot pull a staff member until the current branch manager releases them; the permanent admin can override normal staff transfers when needed.

The permanent super admin is the company owner role and is not assigned to a branch. They can create branches, assign or reassign branch managers, change user roles, and override ordinary branch transfers. Branch managers are delegated administrators for only their own branch. Branch access can be indefinite or can carry an optional expiry date; expired branch access should behave like view-only access.

Users can request access to a branch without being granted write access automatically. The request notifies the target branch manager and the super admin within that branch workspace; the branch manager grants access only when the staff member is free, while the super admin can still assign or override directly from the access controls.

In-app notifications should be scoped to the current branch workspace. Super admin keeps global access rights but should see branch operational alerts only for the branch they are currently viewing; account-level alerts such as pending staff approval remain super-admin-only. Branch managers, pharmacists, inventory officers, and viewers should see low-stock, reorder, expiry, expired-batch, and requisition notifications for the branch they are viewing according to their access.

## Access Rights Draft

- Super Admin: global account control, branch creation, branch manager assignment, user activation/suspension, transfer override, all reports, all audit/security visibility.
- Branch Manager: delegated branch control, staff assignment/release for their branch, branch receiving, issuing, adjustment/returns, branch reports, branch alerts, and requisition handling.
- Pharmacist: assigned-branch medicine operations, issue/dispense stock, receive where allowed by branch workflow, adjustments/returns, requisitions, branch reports, and branch alerts.
- Inventory Officer: assigned-branch inventory operations, receiving, stock counts/adjustment support, requisitions, branch reports, and branch alerts. Super admin may later grant temporary pharmacist-like authority when policy allows.
- Viewer/Auditor: view-only branch data, branch reports, and branch alerts. No stock-changing actions.

Password forms should support show/hide controls. Signup, setup, and password reset must require password confirmation before submission; the new-password eye icon controls both new and confirm fields.

Internal medicine requisitions should stay lightweight and modal-based. Users can request available stock from other branches even when they only have view access there; the request is sent to the supplying branch team, does not deduct stock until fulfilled, and remains visible in history to the concerned branches. Admins can view all requisitions globally.

Reports should support operational filtering. Supplier reports must show what each supplier supplied and support supplier/date filters. Movement ledger reports must support date, movement type, medicine, and generic filters, and every movement should clearly show where stock moved from and where it moved to.

## Run Locally

Use Vite only when you want to work on the frontend shell:

```bash
npm install
npm run dev
```

For login, setup, password reset, stock posting, and every API-backed workflow, create a `.env.local` file first:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/database?sslmode=require"
RESEND_API_KEY="re_xxxxxxxxx"
EMAIL_FROM="RxLedger <security@yourdomain.com>"
APP_URL="http://127.0.0.1:5173"
SUPPORT_EMAIL="support@yourdomain.com"
```

`RESEND_API_KEY`, `EMAIL_FROM`, and `APP_URL` activate real password-reset and security alert emails. Without them, RxLedger still records security events, but no email is delivered.

For local API testing, run through Vercel's local runtime:

```bash
npm run dev:api
```

Open the local URL shown by Vite or Vercel.


## Validate

```bash
npm run lint
npm run build
```

## Production Note

Set `DATABASE_URL` or `POSTGRES_URL` in Vercel project environment variables. Neon Postgres works well for this deployment style. The API automatically creates the required `app_state` and `sessions` tables on first request.

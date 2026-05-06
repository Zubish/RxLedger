# Pharmacy Inventory Web App

Browser-based MVP for a single-branch pharmacy inventory system in Nigeria. It tracks medicines by batch, expiry date, barcode, supplier, and immutable stock ledger movements.

## What Is Included

- Login with demo roles: Admin, Pharmacist, Inventory Officer, Viewer/Auditor
- Medicine catalog with SKU, barcode, manufacturer, NAFDAC number, reorder level, and active status
- Supplier register with contact, address, and license reference
- Goods receiving workflow with mandatory batch, expiry, quantity, unit cost, supplier, and invoice reference
- Stock issue workflow with FEFO allocation and expired-batch blocking
- Adjustments, supplier returns, customer returns, and write-offs with mandatory reasons
- Dashboard for stock value, low stock, near expiry, expired batches, and recent operational alerts
- Reports for stock on hand, stock movement ledger, expiry, and reorder needs
- CSV export and browser Print/PDF workflow
- Audit trail for critical create/update/post actions
- Local browser persistence using `localStorage`

## Demo Login

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@pharmacy.local` | `admin123` |
| Pharmacist | `pharmacist@pharmacy.local` | `pharm123` |
| Inventory Officer | `inventory@pharmacy.local` | `stock123` |
| Viewer/Auditor | `viewer@pharmacy.local` | `view123` |

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite, usually:

```text
http://127.0.0.1:5173/
```

## Validate

```bash
npm run lint
npm run build
```

## Notes For The Next Phase

This MVP uses browser storage so it can run immediately without a backend. For production, replace `localStorage` with an API and database layer while keeping the same domain rules:

- `stock_ledger` remains the source of truth
- posted movements are reversed, not deleted
- stock-in requires batch and expiry
- expired batches cannot be issued
- FEFO remains the default stock-out allocation
- role checks must be enforced on the backend, not only in the UI

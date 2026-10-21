# Sales Reconciliation — Financial Snapshots

Implemented 2026-10-21. Reports → Sales reconciliation reads the complete saved period from the server, independent of loaded POS/ledger history pages. The server authenticates the user and filters authorised workspace branches before returning financial rows without patient names, phone numbers or clinical notes. Optional selected branch must be permitted. Dates use UTC, with a maximum 366-day period and 10,000 sales; larger selections fail explicitly rather than silently truncate. Date changes clear the previous result; exports use exactly the displayed result.

## Money and historical evidence

New sale lines store the medicine batch or retail-product unit cost at checkout. Later catalogue/stock repricing cannot rewrite the recorded cost of goods. NGN line totals and discounts are rounded to two decimal places; reports add integer kobo. Server recording rejects invalid payment methods, non-finite/negative discounts, unsupported currency magnitudes and entered cash below the total. The persisted total is gross less discount. Current POS sends its quoted total; a different server total blocks confirmation and asks for a price review, rather than silently charging more or less. Legacy batch-price fallbacks or split-line rounding may require a reviewed current catalogue price; no automatic price override is introduced. Supported methods are cash, card and transfer; legacy mixed records are retained but flagged because no split was recorded.

When cash tender is entered, save tender and change. When omitted, report it as not recorded; do not infer it. Payment-method totals describe recorded sales, not verified cash drawer balances or bank/payment-provider settlement. Checkout operation replay remains idempotent and preserves the original financial snapshot.

Each report checks line arithmetic, subtotal less discount, entered cash/change and signed POS stock quantities. It reports cost of goods and gross margin (net sales less cost, before operating expenses). If any sale lacks historical cost snapshots, aggregate cost/margin are explicitly unavailable; do not substitute today's cost or silently exclude those sales. Historical amounts are not rewritten. Missing or inconsistent stock references are flagged for review. Matching checks are evidence only for those checks, not accounting certification.

## Tax, returns and limitations

The previous UI-only hard-coded 7.5% VAT display had no persisted tax calculation or configured product eligibility. It is removed. Tax is explicitly unconfigured on new sales; historical tax is not recorded. No claim of correct VAT treatment is made. A tax policy needs jurisdiction/product eligibility, inclusive/exclusive handling, settings, persisted snapshots and professional review before enabling.

Physical customer/supplier returns and write-offs remain inventory movements. They do not create a financial refund, credit note or sales reversal. Financial refund/void workflows, settlement, stock valuation methods for retail products, tax configuration and operating-expense accounting remain separate work. Do not present this release as full accounting software.

The existing movement report's sales-value column describes gross inventory movement value, not net sales after discounts. Use Sales reconciliation for net sales/payment totals. Its screen, CSV and print cover the same selected data. Current tenant JSON loading and full-period response are not enterprise load benchmarks.

## Verification

`npm run test:financial` uses actual handlers and isolated PostgreSQL to check cash/discount/change/cost persistence, catalogue-change independence, card/transfer totals, rejected requests, line rounding, physical returns, missing legacy costs, more than one history page, stock mismatch flags, date validation and branch/workspace/session boundaries. Existing checkout tests cover repeated-operation recovery.

`npm run test:financial:browser` runs POS → actual API → PostgreSQL → Reports → downloaded CSV at 390px and 1440px. Checkout browser regressions run at both widths. Production smoke checks confirm delivery and unauthenticated protection; no pharmacy test transactions are inserted in production.

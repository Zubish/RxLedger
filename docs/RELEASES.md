# Named RxLedger Releases

Use descriptive commit subjects and annotated production tags. Report the release name and tag first; Git hashes and Vercel deployment IDs are secondary technical references. Git's generated hash is not the release name. Never reuse an existing production tag for different code.

For a new release, update `public/release.json`, its change record and this list. Link the annotated tag to the exact verified commit and confirm that production serves the named release manifest and tested assets. A named tag identifies code; deployment readiness and owner acceptance are recorded separately.

## Checkout Reliability — Duplicate Sale Protection

- Version: **checkout-reliability-v1.0.0**
- Annotated tag: **release/checkout-reliability-v1.0.0**
- Change record: **RXLEDGER-CHECKOUT-RELIABILITY-01** in [CHANGE_RECORD.md](CHANGE_RECORD.md).
- Behaviour: repeated/uncertain checkout confirmation recovers the original receipt and deducts stock once; processing and recovery states are clear; refresh recovery stores only an opaque ID; cancelling an unconfirmed checkout blocks delayed submission safely.
- Contract, checks and recovery limits: [CHECKOUT_RELIABILITY.md](CHECKOUT_RELIABILITY.md).
- Deployment evidence is reported after verifying the exact tag/commit, production alias, public release manifest, served assets and unauthenticated API guards. No production pharmacy transactions are inserted by release tests.

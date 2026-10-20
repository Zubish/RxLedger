# Working on RxLedger

Read [the app blueprint](docs/APP_BLUEPRINT.md) and [the maintenance and collaboration guide](docs/MAINTENANCE_AND_COLLABORATION.md) before substantive work. Use the relevant [skill-library modules](docs/SKILL_LIBRARY.md) and specialised specifications linked there.

- Inspect the current implementation and working tree; preserve unrelated user changes.
- Trace affected workflows, server permissions, data ownership and dependencies before editing. Keep patient and operational records branch-scoped.
- Scale verification to risk. A passing build or screenshot is not proof of transactional correctness, owner acceptance or production verification.
- Separate implementation, technical verification, deployment and owner acceptance in reporting. Never mark owner acceptance without explicit feedback for that result.
- Proceed within the user's current and prior authorisation. Discussion-only requests remain discussion-only; do not add approval meetings or repeatedly ask for already-authorised routine work. An unconfirmed source-document proposal does not override an explicit user instruction or an accepted product rule.
- For material changes, update existing authoritative documents and the [change record](docs/CHANGE_RECORD.md). Record precise checks and limitations; do not claim a test or recovery exercise was run when it was not.
- Never commit credentials, production patient data, private test sessions or environment secret values. Use synthetic fixtures and document configuration names/purposes only.

- Use descriptive commit subjects and named annotated production tags under the [release naming policy](docs/RELEASES.md). Lead release reports with the name/tag; generated hashes are secondary references.

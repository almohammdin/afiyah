# Afiyah 2

## Release boundary

This release lives at `/afiyah/v2/`. The existing main application and its records remain available at `/afiyah/`. It uses `carePatients` and `careMemberships`; no migration, deletion, or alteration of existing patient records is performed automatically.

Before using real patient data, publish the complete `firestore-v2.rules` file to project `afiyah-92974`, database `(default)`. This file preserves the existing v1 rules and adds the v2 namespace. GitHub Pages deployment **does not deploy Firebase rules**. There is no billing change. Do not replace the root application until authenticated saving and sharing have been verified against the deployed rules and a migration plan has been approved.

## Implemented

- Session-based Google authentication, explicit per-patient viewing/editing permissions, verified email checks and invitation acceptance
- Multiple daily medication times, start/end dates, stopping treatment, instructions and prescription-entered limits
- Transactional, deterministic dose slots; append-only audit snapshots with server time and authenticated actor UID
- Correction reason retained in a new revision; original dose audit retained
- Patient timezone, allergies (unknown / no known allergy / known), conditions, emergency contact
- Role edits preserve acceptance; participants can leave; tasks can be assigned to accepted participants
- Journal, visit questions and visit summary; dated printable health/current-medication summary
- Owner JSON export; paginated deletion with root last and resumable deleting state
- Privacy notice and authority-to-manage declaration; no analytics scripts or persistent Firestore cache
- Latin date/time fields and digit normalization, compact responsive UI, escaped user content, original creator footer
- User-supplied social preview image retained byte-for-byte

## Medication warnings: scope and limitations

Warnings cover duplicate recorded names/ingredients, duplicate dose slots, minimum interval and maximum count entered by the caregiver from a prescription. These are documentation checks, **not clinical interaction screening** or dose recommendations. No dosage thresholds are invented. `0` means the corresponding prescription limit has not been provided. A caregiver can acknowledge a warning to document a dose that has already been given; this never recommends administering it.

Corrected events retain their guard count conservatively; they do not automatically permit an additional dose. The time guard measures server recording times, not independently verified administration times. Client timezone selection drives the displayed date; rules validate the dose format, schedule and immutable identity, but cannot independently authenticate a claimed administration date. Unrecorded treatment, alternate brands/spellings and clinical contraindications are outside these checks.

Clinical interaction lookup is deferred pending a maintained and licensed medical source. The former NLM RxNav drug interaction service was discontinued: https://www.lhncbc.nlm.nih.gov/RxNav/index.html

## Verification

`node --test v2/tests/*.test.js` covers dates, digits, dose schedules, duplicate/correction behavior, sharing acceptance, deletion and UI HTML escaping.

GitHub Actions runs the Firestore emulator suite in `v2/tests/rules.test.mjs`, including anonymous/unverified/outsider denial, read-only versus editor access, profile segregation, ownership escalation, audit tampering, payload validation, invitation acceptance/revocation, concurrent caregivers, and deletion isolation.

Auth popup behavior on actual mobile browsers and production end-to-end persistence require a signed-in user after rules publication. No automated test signs in as the patient or creates real medical records.

## Deferred

Clinical drug-drug interactions, autonomous appointment booking, push reminders, attachments, AI advice, legacy data migration, and automatic backup/restore are not implemented in this release. The journal/report sections store text. Existing v1 data remains governed by its original rules until migration.

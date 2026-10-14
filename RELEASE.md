# Afiyah

One application is served at `/afiyah/`. The versioned directory has been removed. Existing patient records are read in the same workspace without deleting or moving data. Older record shapes are normalized for display; the original snapshot is retained on first edit.

Includes a day dashboard, combined timeline, week/month calendar, Latin-digit date selection, recording chart, hospital file numbers, profile, medications, reports, tasks, journal, sharing and print/export. Historical unrecorded doses are not inferred from current prescriptions. Clinical drug interaction screening is not implemented.

Run `npm test` and the Firestore emulator tests in `tests/rules.test.mjs`. Production rules use `firestore.rules`. No billing change is required.

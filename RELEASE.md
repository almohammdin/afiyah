# Afiyah

One application is served at `/afiyah/`. The versioned directory has been removed. Existing patient records are read in the same workspace without deleting or moving data. Older record shapes are normalized for display; the original snapshot is retained on first edit.

Includes a day dashboard, combined timeline, week/month calendar, Latin-digit date selection, recording chart, hospital file numbers, profile, medications, reports, tasks, journal, sharing and print/export. Historical unrecorded doses are not inferred from current prescriptions. Clinical drug interaction screening is not implemented.

Run `npm test` and the Firestore emulator tests in `tests/rules.test.mjs`. Production rules use `firestore.rules`. No billing change is required.

Care recording supports today and yesterday with a separate actual occurrence time, correction and reasoned rerecording. Every cloud dose mutation advances a transaction lock and writes an immutable audit snapshot. Prescription-limit warnings use current given events, excluding corrected entries; these are reminders, not clinical interaction checking or dosage recommendations.

Medication permission includes only a derived allergy summary, synchronized atomically when the owner saves the health profile. Older profiles show unknown allergy status to shared medication readers until saved once. Full profile access remains separate.

Owners can edit patient name, relationship and timezone. Appointments can be exported to a calendar with a 30-minute alarm; notification delivery depends on the user's calendar settings. No background notification service is enabled.

Deploy the matching firestore.rules before using the changed cloud writes. GitHub Pages deployment does not deploy Firebase rules. Tests use a demo emulator project, never production patient data.

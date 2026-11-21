# NexaFilm Security Readiness Checklist

This checklist is a planning and verification aid. A checkbox is not marked complete until evidence is recorded. Do not perform Production changes as part of this checklist.

## Deployment and secret hygiene
- [ ] Confirm Vercel Preview and Production environment scopes are separated.
- [ ] Confirm required runtime secrets are configured in the provider dashboard without exposing their values.
- [ ] Confirm no secret values, tokens, or credential-bearing connection strings appear in tracked files, logs, screenshots, or build output.
- [ ] Confirm NEXTAUTH_URL and public application URL match the intended environment.
- [ ] Confirm HTTPS is used for deployed environments.

## Database safeguards
- [ ] Confirm Preview uses a Preview database/branch, not Production.
- [ ] Confirm migration execution is reviewed and approved before any Production execution.
- [ ] Confirm least-privilege database roles and permissions are documented.
- [ ] Record migration status and evidence; do not manually edit migration history to bypass recovery.

## Authentication and authorization
- [ ] Review credential validation, password hashing, and session handling.
- [ ] Verify protected server routes enforce authorization on the server.
- [ ] Verify administrative privileges are granted only through controlled server-side checks.
- [ ] Review account recovery and verification flows before enabling them.

## Media and legal safeguards
- [ ] Keep playback disabled until distribution rights and secure media delivery are verified.
- [ ] Use authorized backend access and short-lived signed URLs for private media.
- [ ] Confirm public pages use demo/sample metadata only where rights are not established.

## Evidence log
For each completed item, record date, environment (Preview/Production), test method, result (PASS/FAIL/BLOCKED), and a redacted evidence link. Do not include secret values or personal data.

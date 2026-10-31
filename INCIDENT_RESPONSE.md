# Incident Response

## Scope
This runbook covers production incidents for auth, payments, video playback, licensing, and administrative actions.

## Immediate response
1. Confirm whether the issue is auth, billing, media access, or platform availability.
2. Capture incident time, user impact, and affected routes.
3. Freeze unsafe admin actions if needed.
4. Preserve logs and relevant request metadata.

## Escalation
- Security issue: escalate to platform security/contact owner immediately.
- Payment issue: pause checkout and validate webhook/system logs.
- Video access issue: disable private URL exposure and verify signed URL configuration.
- Admin compromise: revoke tokens, review audit logs, and reset admin credentials.

## Avoid logging
- passwords
- payment secrets
- tokens
- private media URLs
- raw customer PII beyond what is required for incident handling

## Recovery checklist
- [ ] Confirm root cause
- [ ] Apply fix or revert affected deployment
- [ ] Verify production behavior
- [ ] Communicate with affected users if required
- [ ] Document the incident and lessons learned


# Deployed Preview Security Header Verification — NexaFilm

- **Checkpoint:** Phase 5.39 — Recheck of deployed Preview security headers
- **Review date:** 2026-11-24
- **Branch:** `phase-5/consolidated-security-ops`
- **PR:** #15 — OPEN / UNMERGED
- **Target deployment:** `dpl_8z7vLVRRmx3tMLJ8s2ALDHmRHrqi`
- **Target commit:** `fb6b6f72a5d7f8969de096641cbaac48e3c3076b`
- **Target URL:** `https://movieshub-632nb5nwp-nexa-cead.vercel.app`
- **CI run:** #587 — completed successfully (dependencies, Prisma, isolated integration DB, database integration tests, unit tests, TypeScript, Next.js build, Playwright browser E2E)
- **Vercel Preview:** READY
- **Result:** **SOURCE CONFIGURATION PASS; DEPLOYED RESPONSE HEADER VERIFICATION BLOCKED BY PREVIEW SSO ACCESS**

## 1. Source configuration inspected

The current branch's `next.config.mjs` defines the following response headers for `/:path*`:

| Header | Configured value | Source status |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | **PRESENT** |
| `X-Frame-Options` | `DENY` | **PRESENT** |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | **PRESENT** |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | **PRESENT** |
| `X-Permitted-Cross-Domain-Policies` | `none` | **PRESENT** |
| `Origin-Agent-Cluster` | `?1` | **PRESENT** |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` when `NODE_ENV=production` | **CONDITIONAL SOURCE CONFIGURATION** |

Repository file: `next.config.mjs`; reviewed at current branch head `fb6b6f72a5d7f8969de096641cbaac48e3c3076b`.

Source configuration and passing build demonstrate that the application compiles with these rules. They do not prove the headers arrive unchanged on the deployed HTTP response.

## 2. Current deployment and protection evidence

Read-only Vercel project inspection returned:
- Project: `movieshub` (`prj_fzYKrmWIPPwkzQIr1APBvSU9gnlV`).
- Deployment SSO protection: **enabled**, with `deploymentType=all_except_custom_domains`.
- Password protection: disabled.
- Trusted-IP protection: disabled.
- The target Preview URL is a generated `.vercel.app` deployment hostname.
- The returned project custom domains include `www.nexafilm.in`, `nexafilm.in` (redirect to `www.nexafilm.in`), and `movieshub-blue.vercel.app`. The project-domain listing does not return a custom domain assigned to branch `phase-5/consolidated-security-ops`; the returned domain records have `gitBranch=null`.

Therefore, the current Preview deployment's generated hostname is within the SSO-protected non-custom-domain scope. The listed custom domains are not recorded as branch-specific Preview domains; using them risks checking the live/default deployment rather than the exact PR Preview.

## 3. Why no bypass was used

The project has an existing Vercel Protection Bypass for Automation credential. Its previously approved purpose is limited to the Preview Razorpay webhook URL. The secret and query URL are credentials and are not copied into this report.

The existing project-wide bypass was **not** reused for general page/header testing. No new bypass secret was generated, no SSO/protection settings were changed, and no custom domain/DNS routing was created. The unauthenticated Preview response headers were therefore not obtained during this checkpoint.

Vercel's published documentation describes protected Preview access for automated agents using the `x-vercel-protection-bypass` header or a query parameter. Those methods require possession/use of a bypass credential and are not an independent unprotected test route:
- https://vercel.com/docs/deployment-protection/automated-agent-access
- https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation

A direct public browser-tool attempt to open the protected target did not return an inspectable response; no header values are inferred from that failed access attempt.

## 4. Evidence required to close the gate

Use one of the following only after separate explicit approval:
1. A dedicated branch-specific Preview custom domain, with DNS/domain ownership and protection scope reviewed, routed specifically to `phase-5/consolidated-security-ops`; or
2. A separately approved, narrowly scoped temporary Preview access method for header verification, with a new limited-purpose credential and immediate revocation after the test. Do not reuse the Razorpay webhook bypass URL/secret.

Then issue unauthenticated and authorised requests to the exact branch Preview root and representative application/API routes. Capture the actual HTTP status and response headers, verify every value in Section 1, and retain evidence showing the tested host, deployment commit and timestamp. Confirm HSTS is present only under the intended HTTPS/production conditions, and ensure no security header is overwritten or duplicated inconsistently by the hosting edge.

## 5. Gate result

| Gate | Result |
|---|---|
| Current Next.js header source configuration | **PASS** |
| Current commit's CI and browser E2E | **PASS — run #587** |
| Exact target Preview deployment availability | **PASS — READY** |
| SSO protection scope inspected | **PASS — confirmed enabled for non-custom domains** |
| Branch-specific unprotected Preview custom domain | **NOT AVAILABLE IN INSPECTED DOMAIN LIST** |
| Actual deployed application HTTP response headers | **NOT VERIFIED** |
| Reuse of webhook bypass credential | **NOT USED** |
| Protection/DNS changes | **NONE** |

**Phase 5.39 result: BLOCKED — deployed response header verification cannot be performed safely with the currently available Preview access route.** Source configuration remains present, but do not mark the deployed-header release gate PASS. The next enabling action requires owner approval of a dedicated branch Preview access method; no bypass or DNS change is authorised by this report.

No source code, security headers, Vercel SSO settings, bypass credential, domain/DNS record, environment variable, database, payment setup, Cloudflare resource, media upload, playback flag or Production resource was changed.

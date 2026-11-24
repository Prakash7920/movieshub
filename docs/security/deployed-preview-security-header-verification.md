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
- **Result:** **PASS — DEPLOYED RESPONSE HEADERS VERIFIED ON THREE ROUTES USING VERCEL'S TEMPORARY PROTECTED-DEPLOYMENT FETCH; SSO AND PRODUCTION ROUTING UNCHANGED**

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

Source configuration was then compared with actual deployed HTTP response headers on the exact Preview deployment, using Vercel's protected-deployment fetch mechanism. The values below were returned on `/`, `/movies`, and `/api/health`.

## 2. Current deployment and protection evidence

Read-only Vercel project inspection returned:
- Project: `movieshub` (`prj_fzYKrmWIPPwkzQIr1APBvSU9gnlV`).
- Deployment SSO protection: **enabled**, with `deploymentType=all_except_custom_domains`.
- Password protection: disabled.
- Trusted-IP protection: disabled.
- The target Preview URL is a generated `.vercel.app` deployment hostname.
- The returned project custom domains include `www.nexafilm.in`, `nexafilm.in` (redirect to `www.nexafilm.in`), and `movieshub-blue.vercel.app`. The project-domain listing does not return a custom domain assigned to branch `phase-5/consolidated-security-ops`; the returned domain records have `gitBranch=null`.

Therefore, the current Preview deployment's generated hostname is within the SSO-protected non-custom-domain scope. The listed custom domains are not recorded as branch-specific Preview domains; using them risks checking the live/default deployment rather than the exact PR Preview.

## 3. Protected Preview fetch and actual response evidence

Vercel's protected-deployment fetch tool was used against the exact Preview deployment URL. The tool creates or reuses a temporary share link for the protected deployment and returns the HTTP response; newly created links expire after 23 hours. The tool did not require reuse of the existing Razorpay webhook bypass secret. No SSO or project protection setting was changed.

The same Preview deployment was queried on three routes:

| Route | HTTP status | X-Content-Type-Options | X-Frame-Options | Referrer-Policy | Permissions-Policy | X-Permitted-Cross-Domain-Policies | Origin-Agent-Cluster | Strict-Transport-Security |
|---|---:|---|---|---|---|---|---|---|
| `/` | **200** | `nosniff` | `DENY` | `strict-origin-when-cross-origin` | `camera=(), microphone=(), geolocation=()` | `none` | `?1` | `max-age=31536000; includeSubDomains` |
| `/movies` | **200** | `nosniff` | `DENY` | `strict-origin-when-cross-origin` | `camera=(), microphone=(), geolocation=()` | `none` | `?1` | `max-age=31536000; includeSubDomains` |
| `/api/health` | **200** | `nosniff` | `DENY` | `strict-origin-when-cross-origin` | `camera=(), microphone=(), geolocation=()` | `none` | `?1` | `max-age=31536000; includeSubDomains` |

Additional observed header on all three responses: `X-Robots-Tag: noindex`. The responses were from Vercel and included the same security-header values across the HTML page, catalogue route and health API route. This is direct deployed response evidence for this deployment/commit and these paths, not a claim that every route/path has been separately probed.

The following access conditions remained intact:
- Project SSO protection remains enabled with `deploymentType=all_except_custom_domains`.
- The existing Razorpay webhook bypass secret was not reused or exposed.
- No new bypass credential was created.
- No Vercel SSO/protection setting was changed.

## 4. Dedicated hostname attempt — added but deliberately not routed

As approved, `phase5-preview.nexafilm.in` was added to project `movieshub` and bound to Git branch `phase-5/consolidated-security-ops`. Vercel reports the project-domain association as `verified=true` and returns the intended `gitBranch`.

However:
- The domain's authoritative nameservers are `ns31.domaincontrol.com` and `ns32.domaincontrol.com` (external DNS service, not Vercel DNS).
- Vercel's domain config reports the new host as `misconfigured=true`, with no CNAME/A record detected for the new hostname. Its current recommended CNAME target is `6d36e5e7b4238d74.vercel-dns-017.com.`.
- An alias assignment failed with `cert_missing`; the subsequent certificate request failed with `http_pretest_domain_not_resolving_to_vercel_error`.
- No DNS record was added or changed; no alias was assigned and no TLS certificate was issued.
- Crucially, current project SSO configuration is `all_except_custom_domains`, so a custom hostname would be excluded from Vercel SSO. We did not make the hostname resolve or expose the Preview app through it.

Because protected Preview fetch successfully returned the actual headers, a DNS change/public custom-domain route is not needed for this checkpoint. Keep the new project-domain association inert; do not add the CNAME unless a separate access-control design and explicit approval are agreed. The hostname is not currently a working public route.

## 5. Gate result

| Gate | Result |
|---|---|
| Current Next.js header source configuration | **PASS** |
| Current commit's CI and browser E2E | **PASS — run #587** |
| Exact target Preview deployment availability | **PASS — READY** |
| SSO protection scope inspected | **PASS — confirmed enabled for non-custom domains** |
| Dedicated branch-specific hostname project binding | **PASS — added to exact Preview branch** |
| Dedicated hostname DNS/TLS route | **NOT ACTIVE — no DNS record or TLS certificate; deliberately not exposed** |
| Actual deployed application response headers on `/`, `/movies`, `/api/health` | **PASS — HTTP 200 on all three; all seven security headers match** |
| Reuse of Razorpay webhook bypass credential | **NOT USED** |
| SSO/protection settings | **UNCHANGED** |
| Production DNS, aliases, routing or resources | **UNCHANGED** |

**Phase 5.39 result: PASS — deployed response headers independently observed on three paths of the exact Preview deployment.** The protected-deployment fetch used Vercel's temporary access-link mechanism; Preview SSO remained enabled, and the Razorpay webhook bypass secret was not reused. The separately approved custom hostname is registered against the intended branch but remains non-resolving and unaliased because DNS is external and custom domains are excluded from the current SSO scope. No DNS change or public route was activated.

No source code, application security headers, Vercel SSO/protection setting, bypass credential, DNS record, environment variable, database, payment setup, Cloudflare resource, media upload, playback flag or Production resource was changed.

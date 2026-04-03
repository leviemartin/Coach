# Garmin Data Sync Automation — Design Spec

**Date:** 2026-04-03
**Status:** Draft
**Approach:** Phased — automate local sync now, migrate to official API later

## Problem

Garmin data sync is fully manual. Martin must remember to SSH into terminal and run `npx tsx scripts/garmin-sync-local.ts` before every Sunday checkin. This is easy to forget and has no failure notification. The system needs hands-off weekly sync with a clear fallback when things go wrong.

### Constraints

- **Railway cannot call Garmin APIs.** Cloudflare blocks datacenter IPs (SSO) and increasingly uses TLS fingerprinting on `connectapi.garmin.com` data endpoints.
- **Multi-user is a future goal.** The local sync approach doesn't scale to multiple users — each would need their own Mac/tokens. The official Garmin Developer Program API is the only sustainable multi-user path.
- **The unofficial API (`connectapi.garmin.com`) is fragile.** Garmin deployed Cloudflare TLS fingerprinting in late 2025. Third-party clients are getting 403'd even with valid OAuth tokens. The current local script works from Martin's Mac but this will break eventually.

### History of Failed Approaches

1. **Pure TypeScript sync on Railway** — Cloudflare blocks SSO + MFA from datacenter IPs. Tokens lost on ephemeral filesystem.
2. **Local sync script (current)** — Works but manual. No scheduling, no failure notification.
3. **Resilience patches** — Added retry/backoff, didn't solve the core manual problem.

## Solution Overview

Three phases:

| Phase | What | When |
|-------|------|------|
| **Phase 1** | Automate local sync with macOS launchd + dashboard help mode | Now (this implementation) |
| **Phase 2** | Apply for Garmin Connect Developer Program | After Phase 1 ships |
| **Phase 3** | Migrate to official Push API for multi-user | When Developer Program access is granted |

**Phase 1 is the only implementation scope.** Phases 2 and 3 are documented for future reference.

---

## Phase 1: Automated Local Sync

### 1.1 — launchd Scheduling

A macOS Launch Agent that runs the sync script every Sunday at 19:30, giving fresh data 30 minutes before the checkin window opens at 20:00.

**Plist:** `~/Library/LaunchAgents/com.coach.garmin-sync.plist`

Configuration:
- `StartCalendarInterval`: Weekday 0 (Sunday), Hour 19, Minute 30
- `Program`: Shell wrapper at `<project-root>/scripts/garmin-sync-wrapper.sh`
- `StandardOutPath` / `StandardErrorPath`: `~/Library/Logs/garmin-sync/sync.log`
- `RunAtLoad`: false (don't run on login, only on schedule)

If the Mac is asleep at 19:30, launchd runs the job on next wake. If the Mac is off for the entire Sunday, the sync is missed — the dashboard help modal covers this case.

**Installation:** A one-time setup script `scripts/install-garmin-launchd.sh` that:
1. Creates the log directory (`~/Library/Logs/garmin-sync/`)
2. Copies the plist to `~/Library/LaunchAgents/`
3. Runs `launchctl load` to activate
4. Verifies with `launchctl list | grep garmin`
5. Prints confirmation with next scheduled run time

**Uninstall:** `launchctl unload ~/Library/LaunchAgents/com.coach.garmin-sync.plist`

### 1.2 — Shell Wrapper

`scripts/garmin-sync-wrapper.sh` — thin wrapper that handles environment setup and notifications. launchd doesn't source shell profiles, so the wrapper must set up PATH and working directory explicitly.

Responsibilities:
1. Set PATH to include Homebrew node (`/opt/homebrew/bin` or `/usr/local/bin`)
2. `cd` to the `dashboard/` directory
3. Run `npx tsx ../scripts/garmin-sync-local.ts`
4. Capture exit code
5. Send macOS notification via `osascript`:
   - **Success:** "Garmin sync complete — data pushed to Railway"
   - **Failure:** "Garmin sync failed — run manually before checkin. Check ~/Library/Logs/garmin-sync/sync.log"
6. Log timestamped output to the log file
7. Rotate logs: keep last 4 weeks of logs (delete files older than 28 days)

### 1.3 — Data Pipeline (Unchanged)

The existing sync script and data extraction are not modified:

- **Script:** `scripts/garmin-sync-local.ts`
- **Extraction:** `dashboard/lib/garmin-extract.ts` → `buildExport()` fetches 28-day rolling window
- **API calls:** ~200 calls per sync (7 per day × 28 days + activity details + body comp + training status)
- **Throttle:** 200ms between days to avoid Garmin rate limits
- **Output:** JSON written to `garmin/garmin_coach_data.json` (local) + pushed to Railway via `POST /api/garmin/data/upload`
- **Sync report:** `_sync_report` field in JSON tracks total calls, failed calls, success rate, failed endpoints

The 28-day window ensures no data gaps with weekly syncs — each pull overlaps the previous 3 weeks.

### 1.4 — Token Lifecycle (Unchanged)

- **OAuth1 token:** ~1 year lifetime, bootstrapped via `scripts/garmin-token-bootstrap.py` (interactive, requires MFA)
- **OAuth2 access token:** Short-lived, auto-refreshed via OAuth1→OAuth2 exchange in `garmin-api.ts`
- **Token storage:** `~/.garth/oauth1_token.json` and `~/.garth/oauth2_token.json`
- **Expiry detection:** `isOAuth2RefreshExpired()` check at script start, fails with clear message pointing to bootstrap script
- **When tokens expire:** macOS notification fires with failure message, Martin runs bootstrap script manually (~once per year)

### 1.5 — Dashboard Sync Button (Help Mode)

The existing sync button on the dashboard is rewired from "attempt server-side sync" to "show instructions modal." This replaces the current `/api/garmin/sync` route behavior.

**Trigger:** User clicks the sync/refresh button on the dashboard.

**Modal content:**

The modal is a multi-section help dialog with clear step-by-step instructions, copy-paste commands, and troubleshooting guidance. It should feel like a quick-reference card, not a wall of text.

#### Modal Structure

**Header:** "Sync Garmin Data"

**Section 1 — Status**
- Current data freshness: "Last synced: [timestamp] ([X hours/days] ago)"
- Freshness indicator: green (<4h), amber (4-12h), red (>12h)
- If data is fresh (green): "Your data is up to date. No sync needed."

**Section 2 — Automatic Sync**
- "Garmin data syncs automatically every Sunday at 19:30 via your Mac."
- "If your Mac was asleep or off, the sync runs when you next open it."
- "If the automatic sync fails, you'll get a macOS notification."

**Section 3 — Manual Sync**
Step-by-step instructions with numbered steps and copy-paste commands:

> **Step 1: Open Terminal**
> Open Terminal on your Mac (Cmd+Space → type "Terminal" → Enter)
>
> **Step 2: Run the sync**
> Copy and paste this command:
> ```
> cd ~/AI/Coach/dashboard && npx tsx ../scripts/garmin-sync-local.ts
> ```
> [Copy] button
>
> **Step 3: Verify**
> The script will print a sync report. Look for:
> - "Push successful" — data is on Railway
> - "Done." — sync complete
>
> Then refresh this page to see updated data.

**Section 4 — Troubleshooting**

> **"ERROR: No tokens found"**
> Your Garmin authentication tokens are missing. Run:
> ```
> python3 ~/AI/Coach/scripts/garmin-token-bootstrap.py
> ```
> [Copy] button
>
> This will ask for your Garmin email, password, and MFA code (check your email).
> After tokens are saved, re-run the sync command from Step 2.
>
> **"ERROR: Tokens expired"**
> Same fix as above — re-run the token bootstrap script. This happens roughly once per year.
>
> **"Push failed (401)"**
> The upload secret doesn't match. Check that `GARMIN_UPLOAD_SECRET` in your `.env` file matches the Railway environment variable.
>
> **"Garmin API failed: 429"**
> Garmin rate-limited the sync. Wait 15 minutes and try again. If it persists for more than an hour, Garmin may have temporarily blocked your IP — wait 24 hours.
>
> **"Garmin API failed: 403"**
> Cloudflare is blocking the request. This may mean Garmin has tightened TLS fingerprinting. Check the garth GitHub repo for updates. If persistent, this is the trigger to accelerate Phase 2 (official API migration).
>
> **Sync succeeded but data looks wrong**
> Check the sync report in terminal output. It shows how many API calls failed and which endpoints. Partial failures are normal — the coaching system handles missing fields gracefully.

**Section 5 — Logs**

> Automatic sync logs are at:
> ```
> ~/Library/Logs/garmin-sync/sync.log
> ```
> [Copy] button

**Footer:** "This sync runs locally on your Mac because Garmin blocks server-side API calls. See Phase 2 in the design spec for the long-term multi-user solution."

#### API Route Change

`dashboard/app/api/garmin/sync/route.ts` — the current POST handler that tries to sync from Railway is replaced with a GET handler that returns sync metadata:

```typescript
// GET /api/garmin/sync/status
{
  last_synced: string | null,      // ISO timestamp from _meta.generated_at
  freshness: 'green' | 'amber' | 'red',
  hours_ago: number | null,
  auto_sync_enabled: true,
  auto_sync_schedule: 'Sunday 19:30'
}
```

The frontend reads this to populate the modal's status section.

---

## Phase 2: Garmin Connect Developer Program (Future)

**Not implementation scope. Documented for reference.**

The Garmin Connect Developer Program is the only sustainable path to multi-user Garmin data sync. Key details:

- **Cost:** Free for approved business developers. Some metrics may require license fees for commercial use.
- **Application:** Request at garmin.com → 2 business days for approval confirmation.
- **APIs available:**
  - Health API: steps, HR, sleep, stress, Body Battery, body composition, respiration, pulse ox
  - Activity API: all activity types including strength training, FIT files
  - Training API: push workouts to Garmin devices (future coaching feature)
- **Architecture:** Push (Garmin sends data to your webhook) or Ping/Pull (Garmin notifies you, you pull data)
- **Auth:** Standard OAuth 2.0 PKCE — no Cloudflare issues, works server-to-server
- **Multi-user:** Each user grants consent via OAuth flow in their browser

### Data Coverage Gap Analysis (To Do After Approval)

Verify these fields are available in the official API (they exist in the unofficial API but may not be in the Developer Program):

- Training readiness score + component breakdowns (sleep%, recovery%, HRV%, etc.)
- HRV daily/weekly averages + baseline
- Training load focus (anaerobic, high aerobic, low aerobic) + targets
- ACWR (acute:chronic workload ratio)
- Training effects (aerobic/anaerobic) per activity
- Exercise sets for strength activities (weight, reps, set type)
- HR time-in-zones per activity

### Migration Strategy

When approved:
1. Build a Railway webhook endpoint that receives Garmin Push notifications
2. Transform the official API data format into the existing JSON schema (keep `garmin-extract.ts` output shape)
3. Run both systems in parallel for 2-4 weeks to verify data parity
4. Deprecate local sync, remove launchd schedule
5. Update dashboard sync button from help modal to real-time status

---

## Phase 3: Multi-User Architecture (Future)

**Not implementation scope. Documented for reference.**

With Developer Program access:
- Each user connects their Garmin account via OAuth 2.0 PKCE flow in the dashboard
- Garmin pushes data per-user to Railway webhook
- Per-user token storage in database (not filesystem)
- Per-user data isolation
- No local Mac dependency for any user

---

## Files Changed (Phase 1)

| File | Change |
|------|--------|
| `scripts/garmin-sync-wrapper.sh` | **New** — shell wrapper for launchd |
| `scripts/install-garmin-launchd.sh` | **New** — one-time setup script |
| `scripts/com.coach.garmin-sync.plist` | **New** — launchd plist (copied to ~/Library/LaunchAgents/ by install script) |
| `dashboard/app/api/garmin/sync/route.ts` | **Modified** — replace POST sync with GET status endpoint |
| `dashboard/app/page.tsx` | **Modified** — sync button opens help modal instead of POSTing to /api/garmin/sync |
| `dashboard/components/checkin/WeeklyReview.tsx` | **Modified** — sync button opens help modal instead of POSTing to /api/garmin/sync |
| `dashboard/components/GarminSyncModal.tsx` | **New** — instructions modal with status, steps, troubleshooting, copy buttons |
| `scripts/garmin-sync-local.ts` | **Unchanged** |
| `dashboard/lib/garmin-extract.ts` | **Unchanged** |
| `dashboard/lib/garmin-api.ts` | **Unchanged** |
| `dashboard/lib/garmin-auth.ts` | **Unchanged** |
| `dashboard/lib/garmin-tokens.ts` | **Unchanged** |
| `dashboard/app/api/garmin/data/upload/route.ts` | **Unchanged** |

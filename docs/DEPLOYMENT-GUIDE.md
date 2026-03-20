# Deployment Guide — OCR Coach Dashboard

All code is on `main`, build verified. Follow these steps in order.

---

## Step 1: Push to GitHub

```bash
cd /Users/martinlevie/AI/Coach
git push origin main
```

---

## Step 2: Google Cloud Console — OAuth Credentials

1. Go to https://console.cloud.google.com
2. Create a new project (or use existing)
3. Navigate to **APIs & Services > OAuth consent screen**
   - User type: External
   - App name: "OCR Coach Dashboard"
   - Add your email as a test user
4. Navigate to **APIs & Services > Credentials**
   - Click **Create Credentials > OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Name: "Coach Dashboard"
   - **Authorized redirect URIs**: Leave blank for now (you'll add the Railway URL after Step 3)
5. Copy the **Client ID** and **Client Secret** — you'll need them in Step 4

---

## Step 3: Railway — Create Project

1. Go to https://railway.app and sign in
2. Click **New Project > Deploy from GitHub Repo**
3. Select the `Coach` repository
4. Railway will detect the Dockerfile. Configure:
   - **Dockerfile path**: `dashboard/Dockerfile`
   - **Build context**: `/` (repo root)
5. Add a **Volume**:
   - Mount path: `/data`
   - Size: 1 GB

---

## Step 4: Railway — Set Environment Variables

Add ALL of these in the Railway service settings:

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | Your Claude API key |
| `GOOGLE_CLIENT_ID` | From Step 2 |
| `GOOGLE_CLIENT_SECRET` | From Step 2 |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` to generate |
| `NEXTAUTH_URL` | `https://<your-app>.up.railway.app` (get this from Railway's Settings > Networking after first deploy) |
| `ALLOWED_EMAIL` | Your Google email address |
| `COACH_ROOT` | `/data` |
| `DB_PATH` | `/data/trends.db` |
| `GARMIN_DATA_PATH` | `/data/garmin/garmin_coach_data.json` |
| `GARMIN_CONNECTOR_DIR` | `/app/garmin-coach` |
| `GARMIN_TOKEN_DIR` | `/data/garmin/.tokens` |
| `GARMIN_EMAIL` | Your Garmin Connect email |
| `GARMIN_PASSWORD` | Your Garmin Connect password |

---

## Step 5: Railway — First Deploy

1. Trigger a deploy (push to main or click Deploy in Railway)
2. Watch the build logs — the multi-stage Docker build should complete
3. The container will **fail to start** with: `ERROR: Data migration not complete.`
   - This is expected! The volume is empty.

---

## Step 6: Run Data Migration

In Railway, open a shell to your service (or use `railway run`):

```bash
/app/scripts/migrate-to-volume.sh
```

You should see:
```
=== Data Migration ===
Source: /app/init-data
Target: /data

Copying state files...
Copying coach personas...
Copying database...

=== Verifying Checksums ===
  OK: athlete_profile.md
  OK: training_history.md
  ... (all files OK)

=== SQLite Integrity Check ===
  Integrity: OK

=== Table Row Counts ===
  weekly_metrics: N rows
  plan_items: N rows
  ...

=== Migration Complete ===
```

If any checksums fail, the migration aborts — re-run after investigating.

---

## Step 7: Restart Service

Redeploy or restart the Railway service. It should now start successfully:
```
=== OCR Coach Dashboard — Starting ===
Starting cron daemon...
Starting Next.js on port 3000...
```

---

## Step 8: Update Google OAuth Redirect URI

1. Get your Railway URL from Settings > Networking (e.g., `https://coach-production-xxxx.up.railway.app`)
2. Go back to Google Cloud Console > Credentials > your OAuth Client
3. Add **Authorized redirect URI**: `https://<your-railway-url>/api/auth/callback/google`
4. Save
5. Update `NEXTAUTH_URL` in Railway env vars to match this URL (if not already set)

---

## Step 9: Bootstrap Garmin Authentication

The Garmin connector needs an interactive MFA login the first time. In Railway shell:

```bash
cd /app/garmin-coach
python3 garmin_connector.py --output /data/garmin/garmin_coach_data.json --token-dir /data/garmin/.tokens
```

- It will prompt for an MFA code sent to your email
- Enter the code
- Tokens are saved to `/data/garmin/.tokens/` (persistent volume)
- Subsequent cron runs will use the saved tokens

---

## Step 10: Verify Everything

Open your Railway URL in a browser and verify:

- [ ] **Auth**: Redirects to Google sign-in
- [ ] **Login**: Your email works, you see the dashboard
- [ ] **Wrong email**: A different Google account sees "Access Denied"
- [ ] **Dashboard**: All pages load with data from the volume
- [ ] **Daily Log**: `/log` page loads, checkboxes toggle and auto-save
- [ ] **Sick day**: Toggle works, hides workout sections
- [ ] **Bedtime**: Time picker works, after-midnight shows note
- [ ] **Plan table**: Read-only (no checkboxes)
- [ ] **Check-in** (laptop): Submit a test check-in, verify SSE streaming completes
- [ ] **Garmin data**: `/api/garmin` returns fresh data
- [ ] **Manual sync**: Trigger sync from check-in page
- [ ] **Mobile**: Open on phone, verify responsive layout
- [ ] **Breadcrumbs**: All sub-pages show breadcrumb navigation
- [ ] **Error states**: Block network in DevTools, verify error alerts appear with retry

### Cron verification (wait 6 hours or check logs):

```bash
# In Railway shell:
cat /var/log/garmin-sync.log    # Should show successful sync
cat /var/log/backup.log         # Should show backup complete
ls /data/backups/               # Should have trends-YYYYMMDD.db + state-YYYYMMDD.tar.gz
```

---

## Custom Domain (Optional)

If you want a custom domain instead of `*.up.railway.app`:

1. In Railway: Settings > Networking > Custom Domain
2. Add your domain (e.g., `coach.yourdomain.com`)
3. Add a CNAME record in your DNS pointing to Railway's provided target
4. Update `NEXTAUTH_URL` env var to match
5. Update the Google OAuth redirect URI to the new domain

---

## Troubleshooting

**Container won't start — missing env var**
Check Railway logs. The entrypoint validates all 13 required env vars and tells you which one is missing.

**Google login fails**
- Check `NEXTAUTH_URL` matches your actual Railway URL exactly (including https://)
- Check redirect URI in Google Console matches `<NEXTAUTH_URL>/api/auth/callback/google`
- Check `ALLOWED_EMAIL` matches the email you're signing in with

**Garmin cron fails silently**
Check `/var/log/garmin-sync.log`. If it says "MFA re-authentication needed," run the interactive bootstrap again (Step 9).

**Database is empty after deploy**
Run the migration script (Step 6). The container intentionally refuses to start without it.

**Check-in SSE times out**
The heartbeat keeps the connection alive. If it still times out, check Railway's request timeout setting (should be > 5 minutes).

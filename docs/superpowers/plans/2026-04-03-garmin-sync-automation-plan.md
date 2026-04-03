# Garmin Sync Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate weekly Garmin data sync via macOS launchd and replace the broken dashboard sync button with a detailed help modal.

**Architecture:** A macOS Launch Agent runs the existing `garmin-sync-local.ts` every Sunday at 19:30. The dashboard sync button is rewired to open an instructions modal (with status, copy-paste commands, and troubleshooting) instead of attempting server-side sync. A new `/api/garmin/sync/status` endpoint provides freshness metadata for the modal.

**Tech Stack:** macOS launchd, bash, Next.js API routes, MUI Dialog, React

**Spec:** `docs/superpowers/specs/2026-04-03-garmin-sync-automation-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `scripts/com.coach.garmin-sync.plist` | Create | launchd plist — Sunday 19:30 schedule |
| `scripts/garmin-sync-wrapper.sh` | Create | Shell wrapper — PATH setup, run sync, macOS notification, logging |
| `scripts/install-garmin-launchd.sh` | Create | One-time installer — copies plist, loads agent, verifies |
| `dashboard/app/api/garmin/sync/route.ts` | Rewrite | Replace POST sync with GET status endpoint |
| `dashboard/components/GarminSyncModal.tsx` | Create | Instructions modal with status, steps, troubleshooting, copy buttons |
| `dashboard/app/page.tsx` | Modify | Sync button opens modal instead of POSTing |
| `dashboard/components/checkin/WeeklyReview.tsx` | Modify | Sync button opens modal instead of POSTing |

---

## Task 1: launchd Plist

**Files:**
- Create: `scripts/com.coach.garmin-sync.plist`

- [ ] **Step 1: Create the plist file**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.coach.garmin-sync</string>

  <key>Program</key>
  <string>/Users/martinlevie/AI/Coach/scripts/garmin-sync-wrapper.sh</string>

  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key>
    <integer>0</integer>
    <key>Hour</key>
    <integer>19</integer>
    <key>Minute</key>
    <integer>30</integer>
  </dict>

  <key>StandardOutPath</key>
  <string>/Users/martinlevie/Library/Logs/garmin-sync/sync.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/martinlevie/Library/Logs/garmin-sync/sync.log</string>

  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
```

- [ ] **Step 2: Validate plist syntax**

Run: `plutil -lint scripts/com.coach.garmin-sync.plist`
Expected: `scripts/com.coach.garmin-sync.plist: OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/com.coach.garmin-sync.plist
git commit -m "feat: add launchd plist for Sunday 19:30 Garmin sync"
```

---

## Task 2: Shell Wrapper

**Files:**
- Create: `scripts/garmin-sync-wrapper.sh`

- [ ] **Step 1: Create the wrapper script**

```bash
#!/bin/bash
# garmin-sync-wrapper.sh — launchd wrapper for Garmin data sync
# Handles PATH setup, logging, and macOS notifications.
# Called by com.coach.garmin-sync.plist every Sunday 19:30.

set -euo pipefail

# --- Config ---
PROJECT_DIR="/Users/martinlevie/AI/Coach"
LOG_DIR="$HOME/Library/Logs/garmin-sync"
LOG_FILE="$LOG_DIR/sync.log"
MAX_LOG_AGE_DAYS=28

# --- PATH setup (launchd doesn't source shell profiles) ---
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# --- Ensure log dir exists ---
mkdir -p "$LOG_DIR"

# --- Rotate old logs ---
find "$LOG_DIR" -name "*.log.*" -mtime +$MAX_LOG_AGE_DAYS -delete 2>/dev/null || true

# --- Rotate current log if > 1MB ---
if [ -f "$LOG_FILE" ] && [ "$(stat -f%z "$LOG_FILE" 2>/dev/null || echo 0)" -gt 1048576 ]; then
  mv "$LOG_FILE" "$LOG_FILE.$(date +%Y%m%d-%H%M%S)"
fi

# --- Run sync ---
echo "" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Garmin sync" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

cd "$PROJECT_DIR/dashboard"

if npx tsx ../scripts/garmin-sync-local.ts >> "$LOG_FILE" 2>&1; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Sync completed successfully" >> "$LOG_FILE"
  osascript -e 'display notification "Data pushed to Railway. Ready for checkin." with title "Garmin Sync Complete" sound name "Glass"'
else
  EXIT_CODE=$?
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Sync FAILED (exit code $EXIT_CODE)" >> "$LOG_FILE"
  osascript -e 'display notification "Run manually before checkin. Check ~/Library/Logs/garmin-sync/sync.log" with title "Garmin Sync Failed" sound name "Basso"'
  exit $EXIT_CODE
fi
```

- [ ] **Step 2: Make executable**

Run: `chmod +x scripts/garmin-sync-wrapper.sh`

- [ ] **Step 3: Dry-run the wrapper to verify it works**

Run: `./scripts/garmin-sync-wrapper.sh`
Expected: Sync runs, notification appears, log written to `~/Library/Logs/garmin-sync/sync.log`

- [ ] **Step 4: Commit**

```bash
git add scripts/garmin-sync-wrapper.sh
git commit -m "feat: add shell wrapper for launchd Garmin sync with notifications"
```

---

## Task 3: Install Script

**Files:**
- Create: `scripts/install-garmin-launchd.sh`

- [ ] **Step 1: Create the install script**

```bash
#!/bin/bash
# install-garmin-launchd.sh — one-time setup for automatic Garmin sync
# Installs the Launch Agent and verifies it's active.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_SRC="$SCRIPT_DIR/com.coach.garmin-sync.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.coach.garmin-sync.plist"
LOG_DIR="$HOME/Library/Logs/garmin-sync"
WRAPPER="$SCRIPT_DIR/garmin-sync-wrapper.sh"

echo "=== Garmin Sync — LaunchAgent Installer ==="
echo ""

# Check prerequisites
if [ ! -f "$PLIST_SRC" ]; then
  echo "ERROR: Plist not found at $PLIST_SRC"
  exit 1
fi

if [ ! -x "$WRAPPER" ]; then
  echo "ERROR: Wrapper script not executable at $WRAPPER"
  echo "  Fix: chmod +x $WRAPPER"
  exit 1
fi

if ! command -v npx &>/dev/null; then
  echo "ERROR: npx not found. Install Node.js via Homebrew: brew install node"
  exit 1
fi

# Create log directory
mkdir -p "$LOG_DIR"
echo "✓ Log directory: $LOG_DIR"

# Unload existing agent if present
if launchctl list 2>/dev/null | grep -q "com.coach.garmin-sync"; then
  echo "  Unloading existing agent..."
  launchctl unload "$PLIST_DST" 2>/dev/null || true
fi

# Copy plist
cp "$PLIST_SRC" "$PLIST_DST"
echo "✓ Plist installed: $PLIST_DST"

# Load agent
launchctl load "$PLIST_DST"
echo "✓ Agent loaded"

# Verify
if launchctl list 2>/dev/null | grep -q "com.coach.garmin-sync"; then
  echo "✓ Agent active"
else
  echo "WARNING: Agent may not be active. Check: launchctl list | grep garmin"
fi

echo ""
echo "=== Setup Complete ==="
echo "Schedule: Every Sunday at 19:30"
echo "Logs:     $LOG_DIR/sync.log"
echo "Uninstall: launchctl unload $PLIST_DST && rm $PLIST_DST"
```

- [ ] **Step 2: Make executable**

Run: `chmod +x scripts/install-garmin-launchd.sh`

- [ ] **Step 3: Run the installer**

Run: `./scripts/install-garmin-launchd.sh`
Expected: All checkmarks, agent active

- [ ] **Step 4: Verify agent is loaded**

Run: `launchctl list | grep garmin`
Expected: A line containing `com.coach.garmin-sync`

- [ ] **Step 5: Commit**

```bash
git add scripts/install-garmin-launchd.sh
git commit -m "feat: add one-time installer for Garmin sync LaunchAgent"
```

---

## Task 4: Sync Status API Endpoint

**Files:**
- Rewrite: `dashboard/app/api/garmin/sync/route.ts`

- [ ] **Step 1: Replace the sync route with a status endpoint**

Replace the entire contents of `dashboard/app/api/garmin/sync/route.ts` with:

```typescript
import { NextResponse } from 'next/server';
import { GARMIN_DATA_PATH } from '@/lib/constants';
import fs from 'fs';

interface SyncStatus {
  last_synced: string | null;
  freshness: 'green' | 'amber' | 'red';
  hours_ago: number | null;
  auto_sync_schedule: string;
}

export async function GET(): Promise<NextResponse<SyncStatus>> {
  let lastSynced: string | null = null;
  let hoursAgo: number | null = null;
  let freshness: SyncStatus['freshness'] = 'red';

  try {
    const raw = fs.readFileSync(GARMIN_DATA_PATH, 'utf-8');
    const data = JSON.parse(raw);
    const generatedAt = data._meta?.generated_at;
    if (generatedAt) {
      lastSynced = generatedAt;
      const ageMs = Date.now() - new Date(generatedAt).getTime();
      hoursAgo = Math.round((ageMs / (1000 * 60 * 60)) * 10) / 10;
      if (hoursAgo < 4) freshness = 'green';
      else if (hoursAgo < 12) freshness = 'amber';
      else freshness = 'red';
    }
  } catch {
    // No data file or invalid JSON — leave defaults
  }

  return NextResponse.json({
    last_synced: lastSynced,
    freshness,
    hours_ago: hoursAgo,
    auto_sync_schedule: 'Sunday 19:30',
  });
}
```

- [ ] **Step 2: Verify the endpoint works locally**

Run: `curl http://localhost:3000/api/garmin/sync`
Expected: JSON with `last_synced`, `freshness`, `hours_ago`, `auto_sync_schedule` fields.

Note: If not running locally, deploy and test on Railway. The endpoint reads from `GARMIN_DATA_PATH` which exists on Railway.

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/api/garmin/sync/route.ts
git commit -m "feat: replace Garmin sync POST with GET status endpoint"
```

---

## Task 5: Garmin Sync Modal Component

**Files:**
- Create: `dashboard/components/GarminSyncModal.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Button,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { borders, semanticColors } from '@/lib/design-tokens';

interface SyncStatus {
  last_synced: string | null;
  freshness: 'green' | 'amber' | 'red';
  hours_ago: number | null;
  auto_sync_schedule: string;
}

interface GarminSyncModalProps {
  open: boolean;
  onClose: () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={copied ? <CheckCircleIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
      onClick={handleCopy}
      sx={{ fontSize: '0.7rem', py: 0.25, px: 1, mt: 0.5 }}
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        component="pre"
        sx={{
          bgcolor: '#18181b',
          color: '#e4e4e7',
          p: 1.5,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '0.8rem',
          lineHeight: 1.5,
          border: `3px solid ${borders.hard}`,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {children}
      </Box>
      <CopyButton text={children} />
    </Box>
  );
}

function freshnessColor(freshness: SyncStatus['freshness']): string {
  switch (freshness) {
    case 'green': return semanticColors.recovery.good;
    case 'amber': return semanticColors.recovery.caution;
    case 'red': return semanticColors.recovery.problem;
  }
}

function formatAge(hoursAgo: number): string {
  if (hoursAgo < 1) return 'just now';
  if (hoursAgo < 24) return `${Math.round(hoursAgo)}h ago`;
  const days = Math.round(hoursAgo / 24);
  return `${days}d ago`;
}

export default function GarminSyncModal({ open, onClose }: GarminSyncModalProps) {
  const [status, setStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch('/api/garmin/sync')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { border: `3px solid ${borders.hard}`, borderRadius: 0 },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Sync Garmin Data</Typography>
        <IconButton onClick={onClose} size="small" sx={{ borderRadius: 0 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: borders.hard }}>
        {/* Section 1: Status */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem', color: '#71717a' }}>
            Status
          </Typography>
          {status ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 10, height: 10, bgcolor: freshnessColor(status.freshness), flexShrink: 0 }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {status.last_synced
                  ? `Last synced: ${new Date(status.last_synced).toLocaleString()} (${formatAge(status.hours_ago!)})`
                  : 'No Garmin data found'}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">Loading status...</Typography>
          )}
        </Box>

        <Divider sx={{ borderColor: borders.soft, mb: 3 }} />

        {/* Section 2: Automatic Sync */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem', color: '#71717a' }}>
            Automatic Sync
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Garmin data syncs automatically every <strong>Sunday at 19:30</strong> via your Mac.
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            If your Mac was asleep or off, the sync runs when you next open it.
          </Typography>
          <Typography variant="body2">
            If the automatic sync fails, you&apos;ll get a macOS notification.
          </Typography>
        </Box>

        <Divider sx={{ borderColor: borders.soft, mb: 3 }} />

        {/* Section 3: Manual Sync */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem', color: '#71717a' }}>
            Manual Sync
          </Typography>

          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Step 1: Open Terminal
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            On your Mac: Cmd+Space, type &quot;Terminal&quot;, press Enter.
          </Typography>

          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Step 2: Run the sync
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary' }}>
            Copy and paste this command:
          </Typography>
          <CodeBlock>cd ~/AI/Coach/dashboard && npx tsx ../scripts/garmin-sync-local.ts</CodeBlock>
          <Box sx={{ mb: 2 }} />

          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Step 3: Verify
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Look for &quot;Push successful&quot; and &quot;Done.&quot; in the terminal output. Then refresh this page.
          </Typography>
        </Box>

        <Divider sx={{ borderColor: borders.soft, mb: 2 }} />

        {/* Section 4: Troubleshooting */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem', color: '#71717a' }}>
            Troubleshooting
          </Typography>

          <Accordion disableGutters elevation={0} sx={{ border: `2px solid ${borders.soft}`, '&:before': { display: 'none' }, borderRadius: '0 !important' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: semanticColors.recovery.problem }}>
                &quot;ERROR: No tokens found&quot; or &quot;ERROR: Tokens expired&quot;
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Your Garmin authentication has expired. This happens roughly once per year. Run:
              </Typography>
              <CodeBlock>python3 ~/AI/Coach/scripts/garmin-token-bootstrap.py</CodeBlock>
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                This will ask for your Garmin email, password, and an MFA code (check your email). After tokens are saved, re-run the sync command from Step 2 above.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion disableGutters elevation={0} sx={{ border: `2px solid ${borders.soft}`, borderTop: 0, '&:before': { display: 'none' }, borderRadius: '0 !important' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: semanticColors.recovery.problem }}>
                &quot;Push failed (401)&quot;
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                The upload secret doesn&apos;t match. Check that <code>GARMIN_UPLOAD_SECRET</code> in your <code>.env</code> file matches the Railway environment variable.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion disableGutters elevation={0} sx={{ border: `2px solid ${borders.soft}`, borderTop: 0, '&:before': { display: 'none' }, borderRadius: '0 !important' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: semanticColors.recovery.caution }}>
                &quot;Garmin API failed: 429&quot;
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                Garmin rate-limited the sync. Wait 15 minutes and try again. If it persists for over an hour, Garmin may have temporarily blocked your IP — wait 24 hours.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion disableGutters elevation={0} sx={{ border: `2px solid ${borders.soft}`, borderTop: 0, '&:before': { display: 'none' }, borderRadius: '0 !important' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: semanticColors.recovery.problem }}>
                &quot;Garmin API failed: 403&quot;
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                Cloudflare is blocking the request. This may mean Garmin has tightened TLS fingerprinting. Check the garth GitHub repo for updates. If persistent, this is the trigger to accelerate migration to the official Garmin Developer Program API.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion disableGutters elevation={0} sx={{ border: `2px solid ${borders.soft}`, borderTop: 0, '&:before': { display: 'none' }, borderRadius: '0 !important' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Sync succeeded but data looks wrong
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                Check the sync report in the terminal output. It shows how many API calls failed and which endpoints. Partial failures are normal — the coaching system handles missing fields gracefully.
              </Typography>
            </AccordionDetails>
          </Accordion>
        </Box>

        <Divider sx={{ borderColor: borders.soft, mb: 2 }} />

        {/* Section 5: Logs */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem', color: '#71717a' }}>
            Logs
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Automatic sync logs are saved at:
          </Typography>
          <CodeBlock>~/Library/Logs/garmin-sync/sync.log</CodeBlock>
        </Box>

        {/* Footer */}
        <Typography variant="caption" sx={{ display: 'block', mt: 3, color: 'text.secondary', textAlign: 'center' }}>
          Sync runs locally on your Mac because Garmin blocks server-side API calls.
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/GarminSyncModal.tsx
git commit -m "feat: add GarminSyncModal with status, instructions, and troubleshooting"
```

---

## Task 6: Wire Sync Button on Dashboard Page

**Files:**
- Modify: `dashboard/app/page.tsx`

- [ ] **Step 1: Add modal state and import**

At the top of `dashboard/app/page.tsx`, add the import alongside the existing imports:

```typescript
import GarminSyncModal from '@/components/GarminSyncModal';
```

Inside the `DashboardHome` component, add state for the modal. Place it after the existing `syncAbortRef` line (line 40):

```typescript
const [syncModalOpen, setSyncModalOpen] = useState(false);
```

- [ ] **Step 2: Replace the sync button onClick and remove old sync logic**

Remove the following state and logic that are no longer needed:
- `syncing` state (line 38)
- `syncResult` state (line 39)
- `syncAbortRef` ref (line 40)
- The `useEffect` cleanup for `syncAbortRef` (lines 76-78)
- The entire `handleSync` function (lines 80-104)
- The `Snackbar` at the bottom of the component that shows `syncResult`

Replace the sync `IconButton` (currently around lines 128-140) with:

```tsx
<Tooltip title="Sync Garmin data">
  <IconButton
    onClick={() => setSyncModalOpen(true)}
    size="small"
    sx={{ borderRadius: 0, border: `2px solid ${borders.hard}`, width: 36, height: 36 }}
  >
    <SyncIcon sx={{ fontSize: 18 }} />
  </IconButton>
</Tooltip>
```

Add the modal just before the closing `</Box>` of the component's return:

```tsx
<GarminSyncModal open={syncModalOpen} onClose={() => setSyncModalOpen(false)} />
```

- [ ] **Step 3: Clean up unused imports**

Remove these imports that are no longer used:
- `useRef` from React (if no other refs remain)
- `Snackbar` and `Alert` from MUI (if only used by sync result)

Keep `SyncIcon` — it's still used in the button.

- [ ] **Step 4: Verify the page compiles**

Run: `cd dashboard && npx next build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/page.tsx
git commit -m "feat: wire dashboard sync button to open help modal"
```

---

## Task 7: Wire Sync Button on WeeklyReview

**Files:**
- Modify: `dashboard/components/checkin/WeeklyReview.tsx`

- [ ] **Step 1: Add modal state and import**

At the top of `dashboard/components/checkin/WeeklyReview.tsx`, add the import:

```typescript
import GarminSyncModal from '@/components/GarminSyncModal';
```

- [ ] **Step 2: Modify GarminBadge to open modal instead of syncing**

Replace the `GarminBadge` component's props and behavior. Change the props interface from:

```typescript
{
  status: 'fresh' | 'stale' | 'old';
  ageHours: number;
  hasData: boolean;
  onSync: () => void;
  syncing: boolean;
}
```

To:

```typescript
{
  status: 'fresh' | 'stale' | 'old';
  ageHours: number;
  hasData: boolean;
  onOpenSyncModal: () => void;
}
```

Replace the `Button` inside `GarminBadge` (currently around line 157-165) with:

```tsx
<Button
  size="small"
  variant="outlined"
  startIcon={<SyncIcon sx={{ fontSize: 14 }} />}
  onClick={onOpenSyncModal}
  sx={{ ml: 'auto', fontSize: '0.75rem', py: 0.25, px: 1 }}
>
  Sync
</Button>
```

- [ ] **Step 3: Update the main WeeklyReview component**

In the main `WeeklyReview` function (around line 185):

Remove:
- `syncing` state (line 189)
- `syncError` state (line 190)
- The entire `handleSync` function (lines 212-227)
- The `syncError` display JSX

Add:
```typescript
const [syncModalOpen, setSyncModalOpen] = useState(false);
```

Update the `GarminBadge` usage (around line 504) from:

```tsx
onSync={handleSync}
syncing={syncing}
```

To:

```tsx
onOpenSyncModal={() => setSyncModalOpen(true)}
```

Add the modal just before the component's closing return:

```tsx
<GarminSyncModal open={syncModalOpen} onClose={() => setSyncModalOpen(false)} />
```

- [ ] **Step 4: Clean up unused imports**

Remove `CircularProgress` from MUI imports if it was only used by the sync spinner in `GarminBadge`. Keep `SyncIcon`.

- [ ] **Step 5: Verify the build**

Run: `cd dashboard && npx next build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add dashboard/components/checkin/WeeklyReview.tsx
git commit -m "feat: wire WeeklyReview sync button to open help modal"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Run the full build**

Run: `cd dashboard && npx next build`
Expected: Build succeeds.

- [ ] **Step 2: Manual test — dashboard sync button**

Open the dashboard. Click the sync icon button in the header. Verify:
- Modal opens with "Sync Garmin Data" title
- Status section shows last sync time and freshness color
- Automatic sync section describes Sunday 19:30 schedule
- Manual sync section has 3 numbered steps with copy buttons
- Troubleshooting section has 5 expandable accordions
- Logs section shows the log file path
- Copy buttons work (click, text changes to "Copied")
- Close button works

- [ ] **Step 3: Manual test — checkin sync button**

Navigate to the checkin flow. Verify the sync button in the weekly review section opens the same modal.

- [ ] **Step 4: Verify launchd is installed and active**

Run: `launchctl list | grep garmin`
Expected: Shows `com.coach.garmin-sync`

- [ ] **Step 5: Run the wrapper script manually to verify end-to-end**

Run: `./scripts/garmin-sync-wrapper.sh`
Expected: Sync runs, macOS notification appears, log file updated at `~/Library/Logs/garmin-sync/sync.log`

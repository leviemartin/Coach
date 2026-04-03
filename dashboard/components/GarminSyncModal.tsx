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

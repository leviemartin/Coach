'use client';

import { Accordion, AccordionSummary, AccordionDetails, Typography, Box } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface DashboardSectionProps {
  title: string;
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  icon?: React.ReactNode;
}

export default function DashboardSection({
  title,
  summary,
  children,
  defaultExpanded = true,
  icon,
}: DashboardSectionProps) {
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      sx={{
        '&:before': { display: 'none' },
        bgcolor: 'background.paper',
        overflow: 'hidden',
        mb: 3,
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          px: 2,
          '& .MuiAccordionSummary-content': {
            alignItems: 'center',
            gap: 2,
            my: 1,
          },
        }}
      >
        {icon && <Box sx={{ display: 'flex', color: 'text.secondary' }}>{icon}</Box>}
        <Typography variant="subtitle1" fontWeight={600} sx={{ minWidth: 'fit-content' }}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto', flexWrap: 'wrap' }}>
          {summary}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
        {children}
      </AccordionDetails>
    </Accordion>
  );
}

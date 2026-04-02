'use client';

import { Accordion, AccordionSummary, AccordionDetails, Typography, Box } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { borders } from '@/lib/design-tokens';

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
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });

  return (
    <Accordion
      defaultExpanded={defaultExpanded && !isXs}
      disableGutters
      sx={{
        '&:before': { display: 'none' },
        bgcolor: 'background.paper',
        overflow: 'hidden',
        mb: 3,
        border: `2px solid ${borders.hard}`,
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

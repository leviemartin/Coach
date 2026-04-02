import { Breadcrumbs, Typography } from '@mui/material';
import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageBreadcrumbProps {
  items: BreadcrumbItem[];
}

const breadcrumbTypography = {
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '1.5px',
};

export default function PageBreadcrumb({ items }: PageBreadcrumbProps) {
  return (
    <Breadcrumbs
      sx={{
        mb: 2,
        '& .MuiBreadcrumbs-separator': {
          ...breadcrumbTypography,
          color: 'text.disabled',
        },
      }}
    >
      {items.map((item, i) =>
        i < items.length - 1 && item.href ? (
          <Link
            key={item.label}
            href={item.href}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Typography
              color="text.secondary"
              sx={{ ...breadcrumbTypography, '&:hover': { textDecoration: 'underline' } }}
            >
              {item.label}
            </Typography>
          </Link>
        ) : (
          <Typography key={item.label} color="text.primary" sx={breadcrumbTypography}>
            {item.label}
          </Typography>
        )
      )}
    </Breadcrumbs>
  );
}

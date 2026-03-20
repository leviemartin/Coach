import { Breadcrumbs, Typography } from '@mui/material';
import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageBreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function PageBreadcrumb({ items }: PageBreadcrumbProps) {
  return (
    <Breadcrumbs sx={{ mb: 2 }}>
      {items.map((item, i) =>
        i < items.length - 1 && item.href ? (
          <Link
            key={item.label}
            href={item.href}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ '&:hover': { textDecoration: 'underline' } }}
            >
              {item.label}
            </Typography>
          </Link>
        ) : (
          <Typography key={item.label} variant="body2" color="text.primary">
            {item.label}
          </Typography>
        )
      )}
    </Breadcrumbs>
  );
}

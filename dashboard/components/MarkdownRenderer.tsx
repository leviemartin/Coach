'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Box } from '@mui/material';
import type { Components } from 'react-markdown';

function processBrTags(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      const parts = child.split(/<br\s*\/?>/gi);
      if (parts.length === 1) return child;
      return parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < parts.length - 1 && <br />}
        </React.Fragment>
      ));
    }
    return child;
  });
}

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const components: Components = {
    h1: ({ children }) => (
      <Typography variant="h4" gutterBottom sx={{ mt: 3 }}>
        {children}
      </Typography>
    ),
    h2: ({ children }) => (
      <Typography variant="h5" gutterBottom sx={{ mt: 2.5 }}>
        {children}
      </Typography>
    ),
    h3: ({ children }) => (
      <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
        {children}
      </Typography>
    ),
    p: ({ children }) => (
      <Typography variant="body1" paragraph>
        {children}
      </Typography>
    ),
    li: ({ children }) => (
      <Typography component="li" variant="body1" sx={{ mb: 0.5 }}>
        {children}
      </Typography>
    ),
    table: ({ children }) => (
      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto', mb: 2 }}>
        <Table size="small" sx={{ '& td, & th': { fontSize: { xs: '0.65rem', sm: '0.75rem' } } }}>{children}</Table>
      </TableContainer>
    ),
    thead: ({ children }) => <TableHead>{children}</TableHead>,
    tbody: ({ children }) => <TableBody>{children}</TableBody>,
    tr: ({ children }) => <TableRow>{children}</TableRow>,
    th: ({ children }) => (
      <TableCell sx={{ fontWeight: 600 }}>{processBrTags(children)}</TableCell>
    ),
    td: ({ children }) => <TableCell>{processBrTags(children)}</TableCell>,
    code: ({ children, className }) => {
      const isBlock = className?.startsWith('language-');
      if (isBlock) {
        return (
          <Box
            component="pre"
            sx={{
              bgcolor: 'action.hover',
              p: 2,
              borderRadius: 2,
              overflow: 'auto',
              my: 1,
              fontSize: '0.875rem',
              fontFamily: 'monospace',
            }}
          >
            <code>{children}</code>
          </Box>
        );
      }
      return (
        <Box
          component="code"
          sx={{
            bgcolor: 'action.hover',
            px: 0.5,
            borderRadius: 0.5,
            fontSize: '0.875rem',
            fontFamily: 'monospace',
          }}
        >
          {children}
        </Box>
      );
    },
    strong: ({ children }) => (
      <Box component="strong" sx={{ fontWeight: 700 }}>
        {children}
      </Box>
    ),
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}

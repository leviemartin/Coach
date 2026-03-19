'use client';

import React, { useState } from 'react';
import { Typography, Box } from '@mui/material';
import { useRouter } from 'next/navigation';
import CheckInForm from '@/components/CheckInForm';
import type { CheckInFormData } from '@/lib/types';

export default function CheckInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: CheckInFormData) => {
    setLoading(true);
    // Store form data in sessionStorage for the results page
    sessionStorage.setItem('checkin_form_data', JSON.stringify(formData));
    router.push('/checkin/results');
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h3" fontWeight={700} sx={{ mb: 4 }}>
        Sunday Check-In
      </Typography>
      <CheckInForm onSubmit={handleSubmit} loading={loading} />
    </Box>
  );
}

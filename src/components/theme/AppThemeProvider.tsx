'use client';

import { CssBaseline, ThemeProvider } from '@mui/material';
import { ReactNode } from 'react';
import { clicTheme } from '@/theme';

export default function AppThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={clicTheme}><CssBaseline />{children}</ThemeProvider>;
}

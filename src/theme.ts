import { createTheme } from '@mui/material/styles';

const ink = '#101418';
const muted = '#5B6474';
const sky = '#2F5BFF';
const skyDark = '#2449E0';
const skySoft = '#EEF2FF';
const lilac = '#AF52DE';
const lilacDark = '#8940B4';
const pink = '#FF375F';
const mint = '#2FB592';
const yellow = '#FFCC00';
const line = '#E6EBF2';
const surface = '#FFFFFF';
const surfaceAlt = '#F7F8FA';
const borderStrong = '#D3DAE5';

export const clicTheme = createTheme({
  palette: {
    primary: { main: sky, dark: skyDark, light: '#5AC8FA', contrastText: '#FFFFFF' },
    secondary: { main: lilac, dark: lilacDark, light: '#E5B8FF', contrastText: '#FFFFFF' },
    success: { main: mint, dark: '#248A3D', light: '#B7EFC5', contrastText: '#FFFFFF' },
    error: { main: pink, dark: '#D7002F', light: '#FFB8C5', contrastText: '#FFFFFF' },
    warning: { main: '#B88600', dark: '#8A6500', light: yellow, contrastText: '#FFFFFF' },
    info: { main: skyDark, dark: '#2644AF', light: skySoft, contrastText: '#FFFFFF' },
    background: { default: surfaceAlt, paper: surface },
    text: { primary: ink, secondary: muted, disabled: '#8B95A7' },
    divider: line,
  },
  shape: { borderRadius: 14 },
  spacing: 8,
  shadows: [
    'none',
    '0 1px 2px rgba(31, 41, 55, 0.04)',
    '0 2px 6px rgba(31, 41, 55, 0.05)',
    '0 4px 12px rgba(31, 41, 55, 0.06)',
    '0 8px 20px rgba(31, 41, 55, 0.07)',
    '0 12px 28px rgba(31, 41, 55, 0.08)',
    '0 16px 36px rgba(31, 41, 55, 0.09)',
    '0 20px 44px rgba(31, 41, 55, 0.10)',
    '0 24px 52px rgba(31, 41, 55, 0.11)',
    '0 24px 52px rgba(31, 41, 55, 0.11)',
    '0 24px 52px rgba(31, 41, 55, 0.11)',
    '0 24px 52px rgba(31, 41, 55, 0.11)',
    '0 24px 52px rgba(31, 41, 55, 0.11)',
    '0 24px 52px rgba(31, 41, 55, 0.11)',
    '0 24px 52px rgba(31, 41, 55, 0.11)',
    '0 24px 52px rgba(31, 41, 55, 0.11)',
    '0 24px 52px rgba(31, 41, 55, 0.11)',
    '0 24px 52px rgba(31, 41, 55, 0.11)',
    '0 24px 52px rgba(31, 41, 55, 0.11)',
    '0 24px 52px rgba(31, 41, 55, 0.11)',
    '0 24px 52px rgba(31, 41, 55, 0.11)',
    '0 24px 52px rgba(31, 41, 55, 0.11)',
    '0 24px 52px rgba(31, 41, 55, 0.11)',
    '0 24px 52px rgba(31, 41, 55, 0.11)',
    '0 24px 52px rgba(31, 41, 55, 0.11)',
  ],
  typography: {
    fontFamily: 'var(--font-geist), "Segoe UI", system-ui, -apple-system, sans-serif',
    h1: { fontSize: 'clamp(1.75rem, 2.6vw, 2.15rem)', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.035em' },
    h2: { fontSize: '1.3rem', fontWeight: 650, lineHeight: 1.2, letterSpacing: '-0.025em' },
    h3: { fontSize: '1.0625rem', fontWeight: 650, lineHeight: 1.34, letterSpacing: '-0.014em' },
    body1: { fontSize: '0.96875rem', fontWeight: 400, lineHeight: 1.48 },
    body2: { fontSize: '0.90625rem', fontWeight: 400, lineHeight: 1.48 },
    subtitle1: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4 },
    subtitle2: { fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.4 },
    caption: { fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.35 },
    overline: { fontSize: '0.72rem', fontWeight: 650, lineHeight: 1.35, letterSpacing: '.085em' },
    button: { fontSize: '0.9375rem', fontWeight: 650, textTransform: 'none', letterSpacing: '-0.004em' },
  },
  components: {
    MuiCssBaseline: { styleOverrides: { html: { backgroundColor: surfaceAlt }, body: { minHeight: '100dvh', backgroundColor: surfaceAlt, color: ink, textRendering: 'optimizeLegibility' }, 'button, input, textarea, select': { font: 'inherit' }, ':focus-visible': { outline: `3px solid ${sky}`, outlineOffset: 3 }, '@media (prefers-reduced-motion: reduce)': { '*, *::before, *::after': { animationDuration: '0.01ms !important', animationIterationCount: '1 !important', transitionDuration: '0.01ms !important', scrollBehavior: 'auto !important' } } } },
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { minHeight: 44, borderRadius: 12, paddingInline: 16, fontSize: '0.9375rem', fontWeight: 650, transition: 'background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease, box-shadow 160ms ease', '&:hover': { transform: 'translateY(-1px)' }, '&:active': { transform: 'scale(.985)' }, '&.Mui-disabled': { opacity: 0.48 } }, containedPrimary: { backgroundColor: sky, backgroundImage: 'none', boxShadow: '0 6px 16px rgba(47,91,255,.20)', '&:hover': { backgroundColor: skyDark, backgroundImage: 'none', boxShadow: '0 8px 20px rgba(36,73,224,.26)' } }, containedSecondary: { backgroundColor: lilac, backgroundImage: 'none', '&:hover': { backgroundColor: lilacDark, boxShadow: '0 8px 18px rgba(185, 140, 255, 0.22)' } }, outlined: { borderColor: borderStrong, backgroundColor: 'rgba(255,255,255,.88)', '&:hover': { borderColor: sky, backgroundColor: skySoft } }, text: { '&:hover': { backgroundColor: skySoft } } } },
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiIconButton: { styleOverrides: { root: { minWidth: 40, minHeight: 40, borderRadius: 10, transition: 'background-color 160ms ease, color 160ms ease, transform 160ms ease', '&:hover': { backgroundColor: skySoft, color: skyDark }, '&:active': { transform: 'scale(.96)' } } } },
    MuiTextField: { defaultProps: { size: 'small', variant: 'outlined' } },
    MuiInputLabel: { styleOverrides: { root: { fontSize: '0.8125rem', fontWeight: 600, color: muted, '&.Mui-focused': { color: skyDark } } } },
    MuiInputBase: { styleOverrides: { root: { color: ink, fontSize: '1rem', '&.Mui-focused': { color: ink } } } },
    MuiOutlinedInput: { styleOverrides: { root: { minHeight: 48, borderRadius: 12, backgroundColor: surface, transition: 'background-color 160ms ease, box-shadow 160ms ease, border-color 160ms ease', '&:hover': { backgroundColor: '#F7FAFF' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#A8B9D4' }, '&.Mui-focused': { backgroundColor: surface, boxShadow: '0 0 0 3px rgba(47,91,255,.12)' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 1.5 } }, notchedOutline: { borderColor: borderStrong } } },
    MuiCard: { styleOverrides: { root: { border: `1px solid ${line}`, borderRadius: 18, boxShadow: '0 1px 2px rgba(16, 20, 24, 0.04)', transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease', '&:has(.MuiCardActionArea-root:hover)': { borderColor: '#C7D2E4', boxShadow: '0 10px 26px rgba(16, 20, 24, 0.07)', transform: 'translateY(-2px)' } } } },
    MuiCardActionArea: { styleOverrides: { root: { borderRadius: 'inherit', '&:hover .MuiCardActionArea-focusHighlight': { opacity: 0.035 }, '&:focus-visible .MuiCardActionArea-focusHighlight': { opacity: 0.08 } } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' }, outlined: { borderColor: line, borderRadius: 18 } } },
    MuiChip: { styleOverrides: { root: { minHeight: 30, borderRadius: 999, fontSize: '0.8125rem', fontWeight: 650, '&.MuiChip-colorPrimary': { backgroundColor: '#EAF4FF', color: skyDark }, '&.MuiChip-outlined': { borderColor: borderStrong, backgroundColor: 'rgba(255,255,255,.6)' } }, label: { paddingInline: 11 } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 16, alignItems: 'flex-start' }, icon: { paddingTop: 2 } } },
    MuiDialog: { styleOverrides: { paper: { margin: 16, borderRadius: 20, border: `1px solid ${line}`, boxShadow: '0 24px 80px rgba(31, 41, 55, 0.16)' }, paperFullWidth: { width: 'calc(100% - 32px)' } } },
    MuiTooltip: { defaultProps: { arrow: true, enterDelay: 250 }, styleOverrides: { tooltip: { borderRadius: 8, padding: '7px 10px', backgroundColor: ink, fontSize: '.75rem' }, arrow: { color: ink } } },
    MuiTable: { styleOverrides: { root: { borderCollapse: 'separate', borderSpacing: 0 } } },
    MuiTableCell: { styleOverrides: { head: { color: muted, backgroundColor: surfaceAlt, fontSize: '.72rem', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }, body: { borderColor: '#EDF0F2', color: ink } } },
    MuiTableRow: { styleOverrides: { root: { '&:hover': { backgroundColor: '#FBFDFF' } } } },
    MuiDrawer: { styleOverrides: { paper: { backgroundImage: 'none', boxShadow: 'none' } } },
    MuiAppBar: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiListItemButton: { styleOverrides: { root: { transition: 'background-color 160ms ease, color 160ms ease, transform 160ms ease', '&:hover': { backgroundColor: surfaceAlt } } } },
    MuiSkeleton: { defaultProps: { animation: 'wave' } },
    MuiTabs: { styleOverrides: { root: { minHeight: 44, backgroundColor: surfaceAlt, borderRadius: 12, padding: 4 }, indicator: { height: 'calc(100% - 8px)', top: 4, bottom: 'auto', borderRadius: 9, backgroundColor: surface, boxShadow: '0 2px 8px rgba(31,41,55,.08)', zIndex: 0 } } },
    MuiTab: { styleOverrides: { root: { minHeight: 36, zIndex: 1, borderRadius: 9, fontSize: '0.875rem', fontWeight: 650, textTransform: 'none', color: muted, '&.Mui-selected': { color: skyDark } } } },
    MuiStepper: { styleOverrides: { root: { '& .MuiStepLabel-label': { fontWeight: 550, color: muted }, '& .MuiStepLabel-label.Mui-active, & .MuiStepLabel-label.Mui-completed': { color: skyDark, fontWeight: 700 } } } },
    MuiStepIcon: { styleOverrides: { root: { color: '#D9E2EC', '&.Mui-active, &.Mui-completed': { color: sky } }, text: { fontWeight: 800 } } },
    MuiToggleButtonGroup: { styleOverrides: { root: { gap: 8 } } },
    MuiToggleButton: { styleOverrides: { root: { border: `1px solid ${borderStrong} !important`, borderRadius: '12px !important', color: muted, textTransform: 'none', fontWeight: 650, paddingInline: 14, transition: 'all 160ms ease', '&:hover': { borderColor: `${sky} !important`, backgroundColor: skySoft }, '&.Mui-selected': { color: `${skyDark} !important`, backgroundColor: `${skySoft} !important`, borderColor: `${sky} !important`, boxShadow: '0 3px 10px rgba(65,105,216,.10)' } } } },
    MuiSlider: { styleOverrides: { root: { color: sky, '& .MuiSlider-thumb': { boxShadow: '0 0 0 5px rgba(65,105,216,.12)' } }, rail: { opacity: 1, backgroundColor: '#D9E2EC' } } },
    MuiMenu: { styleOverrides: { paper: { border: `1px solid ${line}`, borderRadius: 12, boxShadow: '0 12px 32px rgba(31, 41, 55, 0.12)' } } },
    MuiMenuItem: { styleOverrides: { root: { minHeight: 44, '&:hover': { backgroundColor: skySoft }, '&.Mui-selected': { backgroundColor: skySoft } } } },
    MuiSnackbarContent: { styleOverrides: { root: { borderRadius: 12 } } },
  },
});

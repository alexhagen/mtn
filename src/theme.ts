import { createTheme } from '@mui/material/styles';

// alexhagen.github.io inspired theme
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#919789', // Sage green - primary accent
      light: '#a8aea0',
      dark: '#7a8071',
    },
    secondary: {
      main: '#FC8D82', // Coral/salmon - hover accent
      light: '#fda59d',
      dark: '#fb7568',
    },
    background: {
      default: '#f9f9f9', // Warm light gray
      paper: '#f9f9f9',
    },
    text: {
      primary: '#142735', // Dark blue-gray
      secondary: '#285668', // Teal-blue for highlights
    },
    divider: '#d9d9d9', // Subtle gray divider
  },
  typography: {
    fontFamily: [
      '"Crimson Text"',
      'Georgia',
      'serif',
    ].join(','),
    h1: {
      fontFamily: '"Source Sans Pro", "Helvetica Neue", Arial, sans-serif',
      fontSize: '3.5rem',
      fontWeight: 700,
      letterSpacing: '0.02em',
      lineHeight: 1.1,
      textTransform: 'uppercase',
    },
    h2: {
      fontFamily: '"Source Sans Pro", "Helvetica Neue", Arial, sans-serif',
      fontSize: '2.75rem',
      fontWeight: 700,
      letterSpacing: '0.02em',
      lineHeight: 1.2,
      textTransform: 'uppercase',
    },
    h3: {
      fontFamily: '"Source Sans Pro", "Helvetica Neue", Arial, sans-serif',
      fontSize: '2rem',
      fontWeight: 700,
      letterSpacing: '0.02em',
      lineHeight: 1.3,
      textTransform: 'uppercase',
    },
    h4: {
      fontFamily: '"Source Sans Pro", "Helvetica Neue", Arial, sans-serif',
      fontSize: '1.5rem',
      fontWeight: 700,
      lineHeight: 1.4,
      textTransform: 'uppercase',
    },
    h5: {
      fontFamily: '"Source Sans Pro", "Helvetica Neue", Arial, sans-serif',
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
      textTransform: 'uppercase',
    },
    h6: {
      fontFamily: '"Source Sans Pro", "Helvetica Neue", Arial, sans-serif',
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.4,
      textTransform: 'uppercase',
    },
    body1: {
      fontSize: '1.375rem', // 22px
      lineHeight: 1.5,
      letterSpacing: '0.01em',
    },
    body2: {
      fontSize: '1rem', // 16px
      lineHeight: 1.5,
      letterSpacing: '0.01em',
    },
    subtitle1: {
      fontFamily: '"Source Sans Pro", "Helvetica Neue", Arial, sans-serif',
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    subtitle2: {
      fontSize: '0.9375rem',
      fontWeight: 500,
      lineHeight: 1.5,
      fontStyle: 'italic',
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          padding: '6px 12px',
          borderRadius: 4,
          fontSize: '0.875rem',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        outlined: {
          borderWidth: '2px',
          '&:hover': {
            borderWidth: '2px',
            backgroundColor: 'rgba(145, 151, 137, 0.08)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputBase-root': {
            fontSize: '0.875rem',
          },
          '& .MuiInputLabel-root': {
            fontSize: '0.875rem',
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
        },
        input: {
          fontSize: '0.875rem',
          padding: '8px 12px',
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
        },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        label: {
          fontSize: '0.875rem',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          border: 'none',
          borderRadius: 4,
          backgroundColor: '#f9f9f9',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          border: 'none',
          borderRadius: 4,
          backgroundColor: '#f9f9f9',
        },
        outlined: {
          border: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderBottom: 'none',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#d9d9d9',
          borderWidth: '0px',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'uppercase',
          fontWeight: 600,
          fontSize: '0.875rem',
          minHeight: 48,
          fontFamily: '"Source Sans Pro", "Helvetica Neue", Arial, sans-serif',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 4,
        },
      },
    },
  },
});

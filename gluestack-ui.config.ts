import { config as defaultConfig } from '@gluestack-ui/config';

export const config = {
  ...defaultConfig,
  tokens: {
    ...defaultConfig.tokens,
    colors: {
      ...defaultConfig.tokens.colors,
      // Primary: Sage green
      primary50: '#f5f6f5',
      primary100: '#e8eae7',
      primary200: '#d1d5ce',
      primary300: '#a8aea0',
      primary400: '#919789',
      primary500: '#7a8071',
      primary600: '#6a7062',
      primary700: '#5a5f53',
      primary800: '#4a4f44',
      primary900: '#3a3f35',
      
      // Secondary: Coral/salmon
      secondary50: '#fff5f4',
      secondary100: '#ffe8e6',
      secondary200: '#ffd1cd',
      secondary300: '#fda59d',
      secondary400: '#FC8D82',
      secondary500: '#fb7568',
      secondary600: '#e2695e',
      secondary700: '#c95d54',
      secondary800: '#b0514a',
      secondary900: '#974540',
      
      // Text colors
      textDark: '#142735',
      textSecondary: '#285668',
      
      // Background
      backgroundLight: '#f9f9f9',
    },
    radii: {
      ...defaultConfig.tokens.radii,
      none: 0,
      xs: 2,
      sm: 4,
      md: 4,
      lg: 6,
      xl: 8,
      '2xl': 12,
      '3xl': 16,
      full: 9999,
    },
  },
};

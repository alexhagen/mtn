import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Avatar from '@mui/material/Avatar';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LoginIcon from '@mui/icons-material/Login';
import SettingsIcon from '@mui/icons-material/Settings';

import { theme } from './theme';
import DailySummary from './routes/DailySummary';
import ReadingList from './routes/ReadingList';
import Books from './routes/Books';
import Settings from './routes/Settings';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import SignInDialog from './components/SignInDialog';
import { isSupabaseConfigured } from './services/supabase';

function UserMenu() {
  const { user, isAuthenticated, signOut } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [signInDialogOpen, setSignInDialogOpen] = useState(false);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      handleMenuClose();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Don't show auth UI if Supabase is not configured
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <>
        <Button
          startIcon={<LoginIcon />}
          onClick={() => setSignInDialogOpen(true)}
          size="small"
          variant="outlined"
        >
          Sign In
        </Button>
        <SignInDialog
          open={signInDialogOpen}
          onClose={() => setSignInDialogOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <IconButton onClick={handleMenuOpen} size="small">
        {user?.user_metadata?.avatar_url ? (
          <Avatar
            src={user.user_metadata.avatar_url}
            alt={user.email || 'User'}
            sx={{ width: 32, height: 32 }}
          />
        ) : (
          <AccountCircleIcon />
        )}
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem disabled>
          <Typography variant="body2">{user?.email}</Typography>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleSignOut}>Sign Out</MenuItem>
      </Menu>
    </>
  );
}

function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentDate, setCurrentDate] = useState('');
  const [volumeNumber, setVolumeNumber] = useState(1);
  const [issueNumber, setIssueNumber] = useState(1);

  useEffect(() => {
    const date = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    setCurrentDate(date.toLocaleDateString('en-US', options));

    // Calculate volume (quarter number: 1-4)
    const month = date.getMonth();
    const quarter = Math.floor(month / 3) + 1;
    setVolumeNumber(quarter);

    // Calculate issue number (summaries read this quarter)
    loadIssueNumber(date);
  }, []);

  async function loadIssueNumber(now: Date) {
    try {
      const { getAllSummaries } = await import('./services/storage/index');
      const allSummaries = await getAllSummaries();
      
      // Get start of current quarter
      const month = now.getMonth();
      const quarter = Math.floor(month / 3);
      const quarterStartMonth = quarter * 3;
      const quarterStart = new Date(now.getFullYear(), quarterStartMonth, 1).getTime();
      
      // Filter summaries to current quarter and count unique dates
      const quarterlySummaries = allSummaries.filter(s => s.generatedAt >= quarterStart);
      
      // Count unique dates (multiple topics on same day = 1 issue)
      const uniqueDates = new Set(
        quarterlySummaries.map(s => {
          const date = new Date(s.generatedAt);
          return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        })
      );
      
      setIssueNumber(uniqueDates.size || 1);
    } catch (error) {
      console.error('Error loading issue number:', error);
      setIssueNumber(1);
    }
  }

  const sections = [
    { path: '/', label: 'Daily Summary' },
    { path: '/reading-list', label: 'Reading List' },
    { path: '/books', label: 'Books' },
  ];

  return (
    <Box sx={{ bgcolor: 'background.paper', py: 3, px: 2 }}>
      {/* Masthead with logo */}
      <Box sx={{ textAlign: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 1 }}>
          <Box
            component="img"
            src="/mtn-logo.svg"
            alt="MTN Logo"
            sx={{
              height: { xs: 40, sm: 50 },
              width: 'auto',
            }}
          />
          <Typography 
            variant="h1" 
            component="h1"
            sx={{ 
              fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
              fontWeight: 700,
              letterSpacing: '0.02em',
              lineHeight: 1,
              m: 0,
            }}
          >
            Multi-Timescale News
          </Typography>
        </Box>
        <Typography 
          variant="caption" 
          sx={{ 
            display: 'block', 
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'text.secondary'
          }}
        >
          Vol. {volumeNumber}, No. {issueNumber} • {currentDate}
        </Typography>
      </Box>

      {/* Navigation sections with user menu */}
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center',
          alignItems: 'center',
          gap: { xs: 2, sm: 4 },
          py: 1.5,
          px: 2,
          flexWrap: 'wrap',
          position: 'relative',
        }}
      >
        <Box sx={{ display: 'flex', gap: { xs: 2, sm: 4 }, flexWrap: 'wrap' }}>
          {sections.map((section) => (
            <Link
              key={section.path}
              onClick={() => navigate(section.path)}
              sx={{
                cursor: 'pointer',
                textDecoration: 'none',
                color: location.pathname === section.path ? 'primary.main' : 'text.primary',
                fontWeight: location.pathname === section.path ? 700 : 600,
                fontSize: '0.875rem',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                fontFamily: '"Source Sans Pro", "Helvetica Neue", Arial, sans-serif',
                transition: 'color 0.2s ease',
                '&:hover': {
                  color: 'secondary.main',
                },
              }}
            >
              {section.label}
            </Link>
          ))}
        </Box>
        <Box sx={{ position: 'absolute', right: 16, display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => navigate('/settings')} size="small" title="Settings">
            <SettingsIcon />
          </IconButton>
          <UserMenu />
        </Box>
      </Box>
    </Box>
  );
}

function AppContent() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navigation />
      <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: 'background.default' }}>
        <Routes>
          <Route path="/" element={<DailySummary />} />
          <Route path="/reading-list" element={<ReadingList />} />
          <Route path="/books" element={<Books />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Avatar from '@mui/material/Avatar';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LoginIcon from '@mui/icons-material/Login';
import SettingsIcon from '@mui/icons-material/Settings';

import { theme } from './theme';
import TopicGrid from './routes/TopicGrid';
import TopicDetail from './routes/TopicDetail';
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

  return (
    <Box sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', py: 2, px: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1200px', mx: 'auto' }}>
        {/* Logo and title */}
        <Box 
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          <Box
            component="img"
            src="/mtn-logo.svg"
            alt="MTN Logo"
            sx={{
              height: 32,
              width: 'auto',
            }}
          />
          <Typography 
            variant="h6" 
            component="h1"
            sx={{ 
              fontSize: '1.25rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
              fontFamily: '"Source Sans Pro", "Helvetica Neue", Arial, sans-serif',
              textTransform: 'uppercase',
            }}
          >
            MTN
          </Typography>
        </Box>

        {/* User menu and settings */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default' }}>
        <Routes>
          <Route path="/" element={<TopicGrid />} />
          <Route path="/topic/:topicId" element={<TopicDetail />} />
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

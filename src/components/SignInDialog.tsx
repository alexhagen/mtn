// Sign-in dialog with OAuth providers
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import GitHubIcon from '@mui/icons-material/GitHub';
import AppleIcon from '@mui/icons-material/Apple';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface SignInDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SignInDialog({ open, onClose }: SignInDialogProps) {
  const { signInWithGoogle, signInWithGitHub, signInWithApple } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (provider: 'google' | 'github' | 'apple') => {
    setLoading(true);
    setError(null);

    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else if (provider === 'github') {
        await signInWithGitHub();
      } else if (provider === 'apple') {
        await signInWithApple();
      }
      // OAuth redirect will happen, so we don't need to close the dialog
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
        Sign In to MTN
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
          Sign in to sync your data across devices
        </Typography>

        {error && (
          <Typography variant="body2" color="error" sx={{ mb: 2, textAlign: 'center' }}>
            {error}
          </Typography>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button
            variant="outlined"
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : <GoogleIcon />}
            onClick={() => handleSignIn('google')}
            disabled={loading}
            fullWidth
          >
            Continue with Google
          </Button>

          <Button
            variant="outlined"
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : <GitHubIcon />}
            onClick={() => handleSignIn('github')}
            disabled={loading}
            fullWidth
          >
            Continue with GitHub
          </Button>

          <Button
            variant="outlined"
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : <AppleIcon />}
            onClick={() => handleSignIn('apple')}
            disabled={loading}
            fullWidth
          >
            Continue with Apple
          </Button>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block', textAlign: 'center' }}>
          By signing in, you agree to sync your settings, articles, and book lists to the cloud.
        </Typography>
      </DialogContent>
    </Dialog>
  );
}

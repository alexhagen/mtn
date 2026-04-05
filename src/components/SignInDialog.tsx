// Sign-in dialog with OAuth providers
import { useState } from 'react';
import { Modal as RNModal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Box,
  Text,
  Button,
  ButtonText,
  Spinner,
} from '@gluestack-ui/themed';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../theme';

interface SignInDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SignInDialog({ open, onClose }: SignInDialogProps) {
  const { signInWithGoogle, signInWithGitHub, signInWithApple } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (provider: 'google' | 'github' | 'apple') => {
    setLoadingProvider(provider);
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
      setLoadingProvider(null);
    }
  };

  return (
    <RNModal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: 'white',
            borderRadius: 8,
            padding: 24,
            maxWidth: 400,
            width: '90%',
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <Text fontSize="$xl" fontWeight="$bold" textAlign="center" mb="$2">
            Sign In to MTN
          </Text>
          <Text fontSize="$sm" color="$textSecondary" textAlign="center" mb="$6">
            Sign in to sync your data across devices
          </Text>

          {error && (
            <Text fontSize="$sm" color="$error600" textAlign="center" mb="$4">
              {error}
            </Text>
          )}

          <Box gap="$3">
            <Button
              variant="outline"
              size="lg"
              onPress={() => handleSignIn('google')}
              isDisabled={loadingProvider !== null}
            >
              {loadingProvider === 'google' ? (
                <Spinner size="small" mr="$2" />
              ) : (
                <Ionicons name="logo-google" size={20} color={theme.colors.textPrimary} style={{ marginRight: 8 }} />
              )}
              <ButtonText>Continue with Google</ButtonText>
            </Button>

            <Button
              variant="outline"
              size="lg"
              onPress={() => handleSignIn('github')}
              isDisabled={loadingProvider !== null}
            >
              {loadingProvider === 'github' ? (
                <Spinner size="small" mr="$2" />
              ) : (
                <Ionicons name="logo-github" size={20} color={theme.colors.textPrimary} style={{ marginRight: 8 }} />
              )}
              <ButtonText>Continue with GitHub</ButtonText>
            </Button>

            <Button
              variant="outline"
              size="lg"
              onPress={() => handleSignIn('apple')}
              isDisabled={loadingProvider !== null}
            >
              {loadingProvider === 'apple' ? (
                <Spinner size="small" mr="$2" />
              ) : (
                <Ionicons name="logo-apple" size={20} color={theme.colors.textPrimary} style={{ marginRight: 8 }} />
              )}
              <ButtonText>Continue with Apple</ButtonText>
            </Button>
          </Box>

          <Text fontSize="$xs" color="$textSecondary" textAlign="center" mt="$6">
            By signing in, you agree to sync your settings, articles, and book lists to the cloud.
          </Text>
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

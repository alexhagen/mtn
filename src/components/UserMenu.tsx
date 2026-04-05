import { Avatar, AvatarImage, AvatarFallbackText } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";
// User menu for authentication
import { useState } from 'react';
import { Pressable, Alert as RNAlert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import SignInDialog from './SignInDialog';
import { isSupabaseConfigured } from '../services/supabase';
import { theme } from '../theme/index';

export default function UserMenu() {
  const { user, isAuthenticated, signOut } = useAuth();
  const [signInDialogOpen, setSignInDialogOpen] = useState(false);

  // Don't show auth UI if Supabase is not configured
  if (!isSupabaseConfigured()) {
    return null;
  }

  const handleSignOut = async () => {
    RNAlert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Error signing out:', error);
              RNAlert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (!isAuthenticated) {
    return (
      <>
        <Pressable
          onPress={() => setSignInDialogOpen(true)}
          style={{ marginRight: 16, padding: 8 }}
        >
          <Ionicons name="person-circle-outline" size={24} color={theme.colors.primary} />
        </Pressable>
        <SignInDialog
          open={signInDialogOpen}
          onClose={() => setSignInDialogOpen(false)}
        />
      </>
    );
  }

  // Get user initials for fallback
  const getInitials = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <Pressable
      onPress={handleSignOut}
      style={{ marginRight: 16, padding: 8 }}
    >
      {user?.user_metadata?.avatar_url ? (
        <Avatar size="sm" className="bg-primary-400">
          <AvatarImage
            source={{ uri: user.user_metadata.avatar_url }}
            alt={user.email || 'User'}
          />
          <AvatarFallbackText>{getInitials()}</AvatarFallbackText>
        </Avatar>
      ) : (
        <Avatar size="sm" className="bg-primary-400">
          <AvatarFallbackText>{getInitials()}</AvatarFallbackText>
        </Avatar>
      )}
    </Pressable>
  );
}

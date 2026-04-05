// Authentication context for Supabase
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { makeRedirectUri } from 'expo-auth-session';
import { getSupabaseClient } from '../services/supabase';

// Web app URL for OAuth callback relay (Expo Go workaround)
const WEB_APP_URL = 'https://mtn.mtn-app.workers.dev';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = getSupabaseClient();

  useEffect(() => {
    // Complete the auth session for web browser (must be called early in component lifecycle)
    WebBrowser.maybeCompleteAuthSession();

    // Skip auth if Supabase is not configured
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signInWithGoogle = async () => {
    if (!supabase) throw new Error('Supabase not configured');
    
    if (Platform.OS === 'web') {
      // Web: use simple redirect
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } else {
      // Native: use external browser with relay through web app
      await signInWithOAuthNative('google', supabase);
    }
  };

  const signInWithGitHub = async () => {
    if (!supabase) throw new Error('Supabase not configured');
    
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } else {
      // Native: use external browser with relay through web app
      await signInWithOAuthNative('github', supabase);
    }
  };

  const signInWithApple = async () => {
    if (!supabase) throw new Error('Supabase not configured');
    
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } else {
      // Native: use external browser with relay through web app
      await signInWithOAuthNative('apple', supabase);
    }
  };

  const signOut = async () => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        signInWithGoogle,
        signInWithGitHub,
        signInWithApple,
        signOut,
        isLoading,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Native OAuth flow using external browser and web app relay
 * This is a workaround for Expo Go's dynamic redirect URL issue
 */
async function signInWithOAuthNative(
  provider: 'google' | 'github' | 'apple',
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>
) {
  // 1. Generate a cryptographically secure nonce
  const nonce = Crypto.randomUUID();

  // 2. Set redirect to web app callback with nonce
  const redirectTo = `${WEB_APP_URL}/auth/callback?nonce=${nonce}`;

  // 3. Get OAuth URL from Supabase
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error('No auth URL returned');

  // 4. Open in external browser (user leaves app briefly)
  const canOpen = await Linking.canOpenURL(data.url);
  if (!canOpen) throw new Error('Cannot open browser');
  
  await Linking.openURL(data.url);

  // 5. Poll auth_pending table for session tokens
  const session = await pollForSession(nonce, supabase);

  // 6. Set session in Supabase client
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
}

/**
 * Poll the auth_pending table for session tokens
 * Polls every 2 seconds for up to 3 minutes
 */
async function pollForSession(
  nonce: string,
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>
): Promise<{ access_token: string; refresh_token: string }> {
  const maxAttempts = 90; // 3 minutes (90 * 2 seconds)
  const pollInterval = 2000; // 2 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Query auth_pending table
    const { data, error } = await supabase
      .from('auth_pending')
      .select('access_token, refresh_token')
      .eq('nonce', nonce)
      .maybeSingle();

    if (error) {
      console.error('Error polling for session:', error);
      // Continue polling even on error (might be transient)
    }

    if (data) {
      // Found tokens! Clean up the row
      await supabase.from('auth_pending').delete().eq('nonce', nonce);
      
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      };
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error('Sign in timed out. Please try again.');
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    // Return safe defaults instead of throwing to prevent cascading failures
    console.warn('useAuth called outside AuthProvider - returning safe defaults');
    return {
      user: null,
      session: null,
      signInWithGoogle: async () => { throw new Error('Auth not initialized'); },
      signInWithGitHub: async () => { throw new Error('Auth not initialized'); },
      signInWithApple: async () => { throw new Error('Auth not initialized'); },
      signOut: async () => { throw new Error('Auth not initialized'); },
      isLoading: false,
      isAuthenticated: false,
    };
  }
  return context;
};


// OAuth callback handler for web and Expo Go relay
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { getSupabaseClient } from '../../src/services/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Completing sign in...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase not configured');
      }

      // Get the code from URL params (Supabase PKCE flow)
      const code = typeof params.code === 'string' ? params.code : params.code?.[0];
      const nonce = typeof params.nonce === 'string' ? params.nonce : params.nonce?.[0];

      if (!code) {
        throw new Error('No authorization code received');
      }

      // Exchange code for session
      const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
      
      if (sessionError) throw sessionError;
      if (!sessionData?.session) throw new Error('No session returned');

      const { access_token, refresh_token } = sessionData.session;

      // If nonce is present, this is an Expo Go relay request
      if (nonce) {
        // Save tokens to auth_pending table for native app to poll
        const { error: insertError } = await supabase
          .from('auth_pending')
          .insert({
            nonce,
            access_token,
            refresh_token,
          });

        if (insertError) throw insertError;

        setStatus('success');
        setMessage('✓ Signed in! You can return to the app.');
        
        // Redirect to home after 3 seconds
        setTimeout(() => {
          router.replace('/');
        }, 3000);
      } else {
        // Regular web sign-in (no nonce)
        setStatus('success');
        setMessage('✓ Signed in successfully!');
        
        // Redirect to home immediately
        setTimeout(() => {
          router.replace('/');
        }, 1000);
      }
    } catch (error) {
      console.error('Auth callback error:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Failed to complete sign in');
      
      // Redirect to home after 5 seconds even on error
      setTimeout(() => {
        router.replace('/');
      }, 5000);
    }
  };

  return (
    <View className="flex-1 items-center justify-center p-6 bg-background">
      <View className="max-w-md w-full items-center">
        {status === 'processing' && (
          <>
            <Spinner size="large" className="mb-4" />
            <Text className="text-lg text-center text-textPrimary">{message}</Text>
          </>
        )}
        
        {status === 'success' && (
          <>
            <Text className="text-4xl mb-4">✓</Text>
            <Text className="text-lg text-center text-textPrimary font-semibold mb-2">
              {message}
            </Text>
            <Text className="text-sm text-center text-textSecondary">
              Redirecting...
            </Text>
          </>
        )}
        
        {status === 'error' && (
          <>
            <Text className="text-4xl mb-4">✗</Text>
            <Text className="text-lg text-center text-error-600 font-semibold mb-2">
              Sign In Failed
            </Text>
            <Text className="text-sm text-center text-textSecondary mb-4">
              {message}
            </Text>
            <Text className="text-xs text-center text-textSecondary">
              Redirecting to home...
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

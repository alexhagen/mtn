import { Box } from "@/components/ui/box";
import { Alert, AlertText } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { useState } from 'react';
import { View, Modal, Pressable, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { theme } from '../theme/index';

interface MarkdownRendererProps {
  content: string;
  onSaveArticle?: (url: string, title: string) => Promise<{ success: boolean; error?: string; articlesCount?: number }>;
}

interface LinkWithModalProps {
  href: string;
  children: React.ReactNode;
  onSaveArticle?: (url: string, title: string) => Promise<{ success: boolean; error?: string; articlesCount?: number }>;
}

function LinkWithModal({ href, children, onSaveArticle }: LinkWithModalProps) {
  const handleShortPress = async () => {
    if (onSaveArticle) {
      // Short press saves the article
      const title = typeof children === 'string' ? children : 'Article';
      await onSaveArticle(href, title);
    } else {
      // If no save handler, just open the link
      Linking.openURL(href);
    }
  };

  const handleLongPress = () => {
    // Long press opens the URL in browser
    Linking.openURL(href);
  };

  return (
    <Text
      onPress={handleShortPress}
      onLongPress={handleLongPress}
      style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}
    >
      {children}
    </Text>
  );
}

export default function MarkdownRenderer({ content, onSaveArticle }: MarkdownRendererProps) {
  return (
    <View>
      <Markdown
        style={{
          body: { 
            color: theme.colors.textPrimary, 
            fontSize: 16, 
            lineHeight: 24,
          },
          heading1: { 
            fontSize: 24, 
            fontWeight: '700', 
            marginTop: 16, 
            marginBottom: 8,
            color: theme.colors.textPrimary,
          },
          heading2: { 
            fontSize: 20, 
            fontWeight: '700', 
            marginTop: 12, 
            marginBottom: 6,
            color: theme.colors.textPrimary,
          },
          heading3: { 
            fontSize: 18, 
            fontWeight: '700', 
            marginTop: 10, 
            marginBottom: 4,
            color: theme.colors.textPrimary,
          },
          link: { 
            color: theme.colors.primary,
            textDecorationLine: 'underline',
          },
          paragraph: {
            marginBottom: 12,
            lineHeight: 24,
          },
          list_item: {
            marginBottom: 4,
          },
          blockquote: {
            backgroundColor: '#ececec',
            borderLeftColor: theme.colors.primary,
            borderLeftWidth: 4,
            paddingLeft: 12,
            paddingVertical: 8,
            marginVertical: 8,
          },
          code_inline: {
            backgroundColor: '#ececec',
            paddingHorizontal: 4,
            paddingVertical: 2,
            borderRadius: 4,
            fontFamily: 'monospace',
          },
          code_block: {
            backgroundColor: '#ececec',
            padding: 12,
            borderRadius: 4,
            marginVertical: 8,
            fontFamily: 'monospace',
          },
        }}
      >
        {content}
      </Markdown>
    </View>
  );
}

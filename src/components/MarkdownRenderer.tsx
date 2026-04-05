import { useState } from 'react';
import { View, Modal, Pressable, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Button, ButtonText, Text, Spinner, Alert, AlertText, Box } from '@gluestack-ui/themed';
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
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenModal = () => {
    setModalVisible(true);
    setError(null);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    if (saved) {
      setSaved(false);
    }
  };

  const handleSave = async () => {
    if (!onSaveArticle || !href) return;

    setSaving(true);
    setError(null);

    try {
      const title = typeof children === 'string' ? children : 'Article';
      const result = await onSaveArticle(href, title);
      
      if (result.success) {
        setSaved(true);
        setTimeout(() => {
          handleCloseModal();
        }, 1500);
      } else {
        setError(result.error || 'Failed to save article');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  const handleLinkPress = () => {
    if (onSaveArticle) {
      handleOpenModal();
    } else {
      Linking.openURL(href);
    }
  };

  return (
    <>
      <Text
        onPress={handleLinkPress}
        style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}
      >
        {children}
      </Text>
      
      {onSaveArticle && (
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={handleCloseModal}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={handleCloseModal}
          >
            <Pressable
              style={{
                backgroundColor: 'white',
                borderRadius: 8,
                padding: 20,
                maxWidth: 320,
                width: '90%',
              }}
              onPress={(e) => e.stopPropagation()}
            >
              {saved ? (
                <Box>
                  <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
                    ✓ Saved to Reading List!
                  </Text>
                </Box>
              ) : (
                <>
                  <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
                    Save to Reading List
                  </Text>
                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginBottom: 16 }}>
                    {typeof children === 'string' ? children : 'Article'}
                  </Text>
                  {error && (
                    <Alert action="error" variant="solid" mb="$4">
                      <AlertText>{error}</AlertText>
                    </Alert>
                  )}
                  <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={handleCloseModal}
                      isDisabled={saving}
                    >
                      <ButtonText>Cancel</ButtonText>
                    </Button>
                    <Button
                      size="sm"
                      onPress={handleSave}
                      isDisabled={saving}
                      bg="$primary400"
                    >
                      {saving ? <Spinner size="small" color="white" /> : <ButtonText>Save</ButtonText>}
                    </Button>
                  </View>
                </>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
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

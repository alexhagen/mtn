import { Badge, BadgeText } from "@/components/ui/badge";
import { Alert, AlertText } from "@/components/ui/alert";
import { Input, InputField } from "@/components/ui/input";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";
import { useState, useEffect } from 'react';
import { ScrollView, View, Pressable, FlatList, Linking, Modal as RNModal, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';
import {
  getCurrentMonthArticles,
  saveArticle,
  deleteArticle,
  getSettings,
  getStorageDomain,
} from '../../src/services/storage/index';
import { isLongForm } from '../../src/services/readability';
import UserMenu from '../../src/components/UserMenu';
import { 
  ArticleSaveService, 
  ReadabilityContentExtractor, 
  WordBudgetPolicy,
  type ArticleStorage 
} from '../../src/services/article-save';
import type { Article, Settings } from '../../src/types';
import { theme } from '../../src/theme/index';

export default function ReadingListScreen() {
  const router = useRouter();
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const { width } = useWindowDimensions();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [articleUrl, setArticleUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalWords, setTotalWords] = useState(0);

  // Golden ratio for article reader
  const contentWidth = width * 0.618;
  const marginHorizontal = (width - contentWidth) / 2;

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    loadArticles();
  }, [topicId, settings]);

  useEffect(() => {
    async function getTotalWords() {
      // Get all articles for current month (no topic filter for total count)
      const allArticles = await getCurrentMonthArticles();
      const total = allArticles.reduce((sum, article) => sum + article.wordCount, 0);
      setTotalWords(total);
    }
    getTotalWords();
  }, [articles]);

  async function loadSettings() {
    const stored = await getSettings();
    setSettings(stored);
  }

  async function loadArticles() {
    if (!settings) {
      setArticles([]);
      return;
    }
    
    // Get articles for current month filtered by selected topic
    const filtered = await getCurrentMonthArticles(topicId as string);
    setArticles(filtered);
  }

  async function handleSaveArticle() {
    if (!articleUrl.trim() || !settings) return;

    setLoading(true);
    setError(null);

    try {
      // Create storage adapter using domain
      const domain = getStorageDomain();
      const storage: ArticleStorage = {
        saveArticle,
        getArticlesByMonth: (monthKey) => domain.backend.getArticlesByMonth(monthKey),
        getMonthKey: () => domain.getMonthKey(),
        generateId: () => domain.generateId(),
      };

      // Create service with WordBudgetPolicy (12,000 words)
      const extractor = new ReadabilityContentExtractor(settings.corsProxyUrl);
      const policy = new WordBudgetPolicy(12000, storage);
      const saver = new ArticleSaveService(extractor, policy, storage);

      // Save article
      const result = await saver.saveArticle(articleUrl, undefined, topicId as string);

      if (result.success) {
        await loadArticles();
        setSaveDialogOpen(false);
        setArticleUrl('');
      } else {
        setError(result.error || 'Failed to save article');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save article');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteArticle(id: string) {
    await deleteArticle(id);
    await loadArticles();
    if (selectedArticle?.id === id) {
      setSelectedArticle(null);
    }
  }

  async function handleMarkAsRead(id: string) {
    await deleteArticle(id);
    await loadArticles();
    setSelectedArticle(null);
  }

  if (!settings) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const topic = settings.topics.find((t) => t.id === topicId);

  // If viewing an article, show immersive reader
  if (selectedArticle) {
    return (
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        {/* Close button - always visible for article reader */}
        <View
          style={{
            position: 'absolute',
            top: 50,
            right: 20,
            zIndex: 1000,
          }}
        >
          <Pressable
            onPress={() => setSelectedArticle(null)}
            style={{
              backgroundColor: 'rgba(20, 39, 53, 0.9)',
              borderRadius: 24,
              padding: 12,
            }}
          >
            <Ionicons name="close" size={24} color="#f9f9f9" />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: marginHorizontal,
            paddingVertical: 60,
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: 28,
              fontWeight: '600',
              marginBottom: 16,
              color: theme.colors.textPrimary,
            }}
          >
            {selectedArticle.title}
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: 14,
              color: theme.colors.textSecondary,
              marginBottom: 32,
            }}
          >
            {selectedArticle.wordCount.toLocaleString()} words
          </Text>
          <RenderHtml
            contentWidth={contentWidth}
            source={{ html: selectedArticle.content }}
            tagsStyles={{
              body: {
                fontFamily: theme.fonts.body,
                fontSize: 19,
                lineHeight: 33.25, // 1.75 line height
                color: theme.colors.textPrimary,
              },
              h1: { fontSize: 28, fontWeight: '600', marginTop: 32, marginBottom: 16 },
              h2: { fontSize: 24, fontWeight: '600', marginTop: 28, marginBottom: 12 },
              h3: { fontSize: 20, fontWeight: '600', marginTop: 24, marginBottom: 8 },
              p: { marginBottom: 20, lineHeight: 33.25 },
              a: { color: theme.colors.primary, textDecorationLine: 'none' },
              ul: { marginBottom: 20, paddingLeft: 24 },
              ol: { marginBottom: 20, paddingLeft: 24 },
              img: { maxWidth: '100%' },
            }}
          />
          
          {/* Done Reading button at bottom */}
          <Box className="items-center" style={{ marginTop: 40, marginBottom: 40 }}>
            <Button
              onPress={() => handleMarkAsRead(selectedArticle.id)}
              className="bg-success-600"
            >
              <ButtonText>Done Reading</ButtonText>
            </Button>
          </Box>
        </ScrollView>
      </View>
    );
  }

  // Article list view
  const renderArticleItem = ({ item, index }: { item: Article; index: number }) => (
    <Pressable
      onPress={() => setSelectedArticle(item)}
      style={{
        padding: 16,
        borderBottomWidth: index < articles.length - 1 ? 1 : 0,
        borderBottomColor: theme.colors.border,
        backgroundColor: 'transparent',
      }}
    >
      <Text style={{ fontFamily: 'serif' }} className="text-xl font-bold mb-2">
        {item.title}
      </Text>
      <Box className="flex-row gap-2 mb-2 flex-wrap">
        <Text className="text-sm text-textSecondary">
          {item.wordCount.toLocaleString()} words
        </Text>
        {isLongForm(item.wordCount) && (
          <Text className="text-sm text-primary-600 font-semibold">
            Long-form
          </Text>
        )}
        <Text className="text-sm text-textSecondary">
          • Saved {new Date(item.savedAt).toLocaleDateString()}
        </Text>
      </Box>
      <Box className="flex-row gap-3">
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            Linking.openURL(item.url);
          }}
        >
          <Text className="text-sm text-primary-600 underline">
            Open Original
          </Text>
        </Pressable>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            handleDeleteArticle(item.id);
          }}
        >
          <Text className="text-sm text-error-600 underline">
            Remove
          </Text>
        </Pressable>
      </Box>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Custom Header */}
      <View
        style={{
          backgroundColor: '#142735',
          paddingTop: 50,
          paddingBottom: 16,
          paddingHorizontal: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={28} color="#f9f9f9" />
          </Pressable>
          <Text
            style={{
              fontFamily: theme.fonts.heading,
              fontSize: 16,
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: '#f9f9f9',
            }}
          >
            Reading List
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => router.push('/modal')}
            style={{ padding: 8 }}
          >
            <Ionicons name="settings-outline" size={24} color={theme.colors.primary} />
          </Pressable>
          <UserMenu />
        </View>
      </View>

      <Box className="p-4 pb-2">
        <Box className="flex-row justify-end items-center gap-2 mb-2">
          <Button
            size="sm"
            variant="outline"
            onPress={() => setSaveDialogOpen(true)}
            isDisabled={totalWords >= 12000}
          >
            <Ionicons name="bookmark" size={16} color={theme.colors.primary} style={{ marginRight: 4 }} />
            <ButtonText>Save Article</ButtonText>
          </Button>
          <Badge size="sm" variant="outline" className="rounded-full">
            <BadgeText className="text-xs">
              {totalWords.toLocaleString()}/12,000
            </BadgeText>
          </Badge>
        </Box>
      </Box>

      {articles.length === 0 ? (
        <Box className="p-4">
          <Alert action="info" variant="solid">
            <AlertText>
              No articles saved for this month. Save articles from the Daily Summary or add them manually.
            </AlertText>
          </Alert>
        </Box>
      ) : (
        <FlatList
          data={articles}
          renderItem={renderArticleItem}
          keyExtractor={(item) => item.id}
        />
      )}

      {/* Save Article Modal */}
      <RNModal
        visible={saveDialogOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveDialogOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setSaveDialogOpen(false)}
        >
          <Pressable
            style={{
              backgroundColor: 'white',
              borderRadius: 8,
              padding: 24,
              maxWidth: 500,
              width: '90%',
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-xl font-bold mb-4">
              Save Article for Later
            </Text>

            {error && (
              <Alert action="error" variant="solid" className="mb-4">
                <AlertText>{error}</AlertText>
              </Alert>
            )}

            <Input className="mb-3">
              <InputField
                placeholder="https://example.com/article"
                value={articleUrl}
                onChangeText={setArticleUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Input>

            <Text className="text-xs text-textSecondary mb-4">
              The article will be extracted and saved for reading. Word count will be displayed.
            </Text>

            <Box className="flex-row gap-2 justify-end">
              <Button
                variant="outline"
                onPress={() => setSaveDialogOpen(false)}
              >
                <ButtonText>Cancel</ButtonText>
              </Button>
              <Button
                onPress={handleSaveArticle}
                isDisabled={loading || !articleUrl.trim()}
                className="bg-primary-400"
              >
                <ButtonText>{loading ? 'Saving...' : 'Save'}</ButtonText>
              </Button>
            </Box>
          </Pressable>
        </Pressable>
      </RNModal>
    </View>
  );
}

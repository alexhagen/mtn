import { useState, useEffect } from 'react';
import { ScrollView, View, Pressable, FlatList, Linking, Modal as RNModal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';
import {
  Box,
  Text,
  Button,
  ButtonText,
  Input,
  InputField,
  Alert,
  AlertText,
  Badge,
  BadgeText,
} from '@gluestack-ui/themed';
import {
  getCurrentMonthArticles,
  saveArticle,
  deleteArticle,
  getSettings,
  getStorageDomain,
} from '../../src/services/storage/index';
import { isLongForm } from '../../src/services/readability';
import TopicTabs from '../../src/components/TopicTabs';
import { 
  ArticleSaveService, 
  ReadabilityContentExtractor, 
  WordBudgetPolicy,
  type ArticleStorage 
} from '../../src/services/article-save';
import type { Article, Settings } from '../../src/types';
import { theme } from '../../src/theme/index';

export default function ReadingListScreen() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [articleUrl, setArticleUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalWords, setTotalWords] = useState(0);
  const { width } = useWindowDimensions();

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    loadArticles();
  }, [selectedTopicIndex, settings]);

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
    if (!settings || settings.topics.length === 0) {
      setArticles([]);
      return;
    }
    
    // Get articles for current month filtered by selected topic
    const topic = settings.topics[selectedTopicIndex];
    const filtered = await getCurrentMonthArticles(topic.id);
    setArticles(filtered);
  }

  async function handleSaveArticle() {
    if (!articleUrl.trim() || !settings) return;

    setLoading(true);
    setError(null);

    try {
      const topic = settings.topics[selectedTopicIndex];
      
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
      const result = await saver.saveArticle(articleUrl, undefined, topic.id);

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

  if (settings.topics.length === 0) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        <Alert action="info" variant="solid">
          <AlertText>
            Please configure at least one topic in Settings to get started.
          </AlertText>
        </Alert>
      </ScrollView>
    );
  }

  const renderArticleItem = ({ item, index }: { item: Article; index: number }) => (
    <Pressable
      onPress={() => setSelectedArticle(item)}
      style={{
        padding: 16,
        borderBottomWidth: index < articles.length - 1 ? 1 : 0,
        borderBottomColor: theme.colors.border,
        backgroundColor: selectedArticle?.id === item.id ? '#f5f5f5' : 'transparent',
      }}
    >
      <Text
        fontSize="$xl"
        fontWeight="$bold"
        mb="$2"
        style={{ fontFamily: 'serif' }}
      >
        {item.title}
      </Text>
      <Box flexDirection="row" gap="$2" mb="$2" flexWrap="wrap">
        <Text fontSize="$sm" color="$textSecondary">
          {item.wordCount.toLocaleString()} words
        </Text>
        {isLongForm(item.wordCount) && (
          <Text fontSize="$sm" color="$primary600" fontWeight="$semibold">
            Long-form
          </Text>
        )}
        <Text fontSize="$sm" color="$textSecondary">
          • Saved {new Date(item.savedAt).toLocaleDateString()}
        </Text>
      </Box>
      <Box flexDirection="row" gap="$3">
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            Linking.openURL(item.url);
          }}
        >
          <Text fontSize="$sm" color="$primary600" textDecorationLine="underline">
            Open Original
          </Text>
        </Pressable>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            handleDeleteArticle(item.id);
          }}
        >
          <Text fontSize="$sm" color="$error600" textDecorationLine="underline">
            Remove
          </Text>
        </Pressable>
      </Box>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Box p="$4" pb="$2">
        <Box flexDirection="row" justifyContent="flex-end" alignItems="center" gap="$2" mb="$2">
          <Button
            size="sm"
            variant="outline"
            onPress={() => setSaveDialogOpen(true)}
            isDisabled={totalWords >= 12000}
          >
            <Ionicons name="bookmark" size={16} color={theme.colors.primary} style={{ marginRight: 4 }} />
            <ButtonText>Save Article</ButtonText>
          </Button>
          <Badge size="sm" variant="outline" borderRadius="$full">
            <BadgeText fontSize="$xs">
              {totalWords.toLocaleString()}/12,000
            </BadgeText>
          </Badge>
        </Box>

        <TopicTabs
          topics={settings.topics}
          selectedTopicIndex={selectedTopicIndex}
          onChange={setSelectedTopicIndex}
        />
      </Box>

      {articles.length === 0 ? (
        <Box p="$4">
          <Alert action="info" variant="solid">
            <AlertText>
              No articles saved for this month. Save articles from the Daily Summary or add them manually.
            </AlertText>
          </Alert>
        </Box>
      ) : (
        <Box flex={1} flexDirection={width > 768 && selectedArticle ? 'row' : 'column'}>
          <Box flex={width > 768 && selectedArticle ? 1 : undefined} style={{ maxHeight: selectedArticle && width <= 768 ? '40%' : undefined }}>
            <FlatList
              data={articles}
              renderItem={renderArticleItem}
              keyExtractor={(item) => item.id}
            />
          </Box>

          {selectedArticle && (
            <ScrollView
              style={{
                flex: width > 768 ? 2 : 1,
                backgroundColor: 'white',
                borderLeftWidth: width > 768 ? 1 : 0,
                borderTopWidth: width <= 768 ? 1 : 0,
                borderColor: theme.colors.border,
              }}
            >
              <Box p="$4">
                <Box flexDirection="row" justifyContent="space-between" alignItems="flex-start" mb="$4">
                  <Text fontSize="$xl" fontWeight="$bold" flex={1} mr="$2">
                    {selectedArticle.title}
                  </Text>
                  <Button
                    size="sm"
                    bg="$success600"
                    onPress={() => handleMarkAsRead(selectedArticle.id)}
                  >
                    <ButtonText>Done Reading</ButtonText>
                  </Button>
                </Box>
                <Text fontSize="$xs" color="$textSecondary" mb="$4">
                  {selectedArticle.wordCount.toLocaleString()} words
                </Text>
                <RenderHtml
                  contentWidth={width - 32}
                  source={{ html: selectedArticle.content }}
                  tagsStyles={{
                    h1: { fontSize: 28, fontWeight: '600', marginTop: 24, marginBottom: 16 },
                    h2: { fontSize: 24, fontWeight: '600', marginTop: 24, marginBottom: 12 },
                    h3: { fontSize: 20, fontWeight: '600', marginTop: 16, marginBottom: 8 },
                    p: { marginBottom: 16, lineHeight: 28.8 },
                    a: { color: theme.colors.primary, textDecorationLine: 'none' },
                    ul: { marginBottom: 16, paddingLeft: 24 },
                    ol: { marginBottom: 16, paddingLeft: 24 },
                    img: { maxWidth: '100%' },
                  }}
                />
              </Box>
            </ScrollView>
          )}
        </Box>
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
            <Text fontSize="$xl" fontWeight="$bold" mb="$4">
              Save Article for Later
            </Text>

            {error && (
              <Alert action="error" variant="solid" mb="$4">
                <AlertText>{error}</AlertText>
              </Alert>
            )}

            <Input mb="$3">
              <InputField
                placeholder="https://example.com/article"
                value={articleUrl}
                onChangeText={setArticleUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Input>

            <Text fontSize="$xs" color="$textSecondary" mb="$4">
              The article will be extracted and saved for reading. Word count will be displayed.
            </Text>

            <Box flexDirection="row" gap="$2" justifyContent="flex-end">
              <Button
                variant="outline"
                onPress={() => setSaveDialogOpen(false)}
              >
                <ButtonText>Cancel</ButtonText>
              </Button>
              <Button
                bg="$primary400"
                onPress={handleSaveArticle}
                isDisabled={loading || !articleUrl.trim()}
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

import { useState, useEffect } from 'react';
import { ScrollView, View, Pressable, Alert as RNAlert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Box,
  Text,
  Heading,
  Button,
  ButtonText,
  Spinner,
  Alert,
  AlertText,
  Badge,
  BadgeText,
} from '@gluestack-ui/themed';
import { 
  getSettings, 
  getTodaysSummary,
  saveSummaryWithCleanup,
  generateId, 
  saveArticle, 
  getArticlesByMonth, 
  getMonthKey,
} from '../../src/services/storage/index';
import { fetchMultipleFeeds, filterArticlesByDate } from '../../src/services/rss';
import { createPipeline } from '../../src/services/generation-pipeline';
import MarkdownRenderer from '../../src/components/MarkdownRenderer';
import TopicTabs from '../../src/components/TopicTabs';
import { 
  ArticleSaveService, 
  ReadabilityContentExtractor, 
  ArticleCountPolicy,
  type ArticleStorage 
} from '../../src/services/article-save';
import type { Settings, DailySummary as DailySummaryType, AgentProgress } from '../../src/types';
import { theme } from '../../src/theme/index';

export default function DailySummaryScreen() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);
  const [summary, setSummary] = useState<DailySummaryType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<AgentProgress | null>(null);
  const [showThinking, setShowThinking] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings && settings.topics.length > 0) {
      loadSummary();
    }
  }, [settings, selectedTopicIndex]);

  // Auto-hide toast after 4 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  async function loadSettings() {
    const stored = await getSettings();
    setSettings(stored);
    
    if (!stored || !stored.anthropicApiKey || stored.topics.length === 0) {
      setError('Please configure your settings first');
    }
  }

  async function loadSummary() {
    if (!settings || settings.topics.length === 0) return;
    
    const topic = settings.topics[selectedTopicIndex];
    const cached = await getTodaysSummary(topic.id);
    
    if (cached) {
      setSummary(cached);
    } else {
      setSummary(null);
    }
  }

  async function handleSaveArticle(url: string, title: string): Promise<{ success: boolean; error?: string; articlesCount?: number }> {
    if (!settings) {
      return { success: false, error: 'Settings not loaded' };
    }

    try {
      const topic = settings.topics[selectedTopicIndex];
      
      // Create storage adapter
      const storage: ArticleStorage = {
        saveArticle,
        getArticlesByMonth,
        getMonthKey,
        generateId,
      };

      // Create service with ArticleCountPolicy (4 articles)
      const extractor = new ReadabilityContentExtractor(settings.corsProxyUrl);
      const policy = new ArticleCountPolicy(4, storage);
      const saver = new ArticleSaveService(extractor, policy, storage);

      // Save article
      const result = await saver.saveArticle(url, title, topic.id);

      if (result.success) {
        const count = result.usage?.type === 'count' ? result.usage.count + 1 : undefined;
        setToastMessage({
          text: `Article saved to Reading List${count ? ` (${count}/4)` : ''}`,
          type: 'success',
        });
        return { success: true, articlesCount: count };
      } else {
        setToastMessage({
          text: result.error || 'Failed to save article',
          type: 'error',
        });
        return { success: false, error: result.error };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save article';
      setToastMessage({
        text: errorMessage,
        type: 'error',
      });
      return { success: false, error: errorMessage };
    }
  }

  async function generateSummary(forceRefresh = false) {
    if (!settings) return;
    
    const topic = settings.topics[selectedTopicIndex];
    
    if (!forceRefresh) {
      const cached = await getTodaysSummary(topic.id);
      if (cached) {
        setSummary(cached);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setProgress(null);
    setShowThinking(true);

    try {
      // Fetch RSS feeds
      const allArticles = await fetchMultipleFeeds(topic.rssFeeds, settings.corsProxyUrl);
      
      console.log('Fetched articles:', allArticles.length);
      console.log('Sample article:', allArticles[0]);
      
      const recentArticles = filterArticlesByDate(allArticles, 24);

      console.log('Recent articles after filtering:', recentArticles.length);

      if (allArticles.length === 0) {
        setError('No articles could be fetched from the feeds');
        setLoading(false);
        return;
      }

      const articlesToUse = recentArticles.length > 0 ? recentArticles : allArticles;
      
      if (recentArticles.length === 0) {
        setError(`Found ${allArticles.length} articles, but none from the last 24 hours. Using all available articles instead.`);
      }

      // Generate summary with streaming using pipeline
      const pipeline = createPipeline(settings.anthropicApiKey, {
        dailySummarySystemPrompt: settings.dailySummarySystemPrompt,
        dailySummaryUserPrompt: settings.dailySummaryUserPrompt,
      });

      const result = await pipeline.generate({
        type: 'daily-summary',
        topicName: topic.name,
        articles: articlesToUse,
        onProgress: (prog) => {
          setProgress(prog);
          if (prog.type === 'final') {
            setShowThinking(false);
          }
        },
      });

      // Save to cache
      const newSummary: DailySummaryType = {
        id: generateId(),
        topicId: topic.id,
        topicName: topic.name,
        summary: result.content,
        generatedAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        cost: result.cost,
      };

      await saveSummaryWithCleanup(newSummary);
      setSummary(newSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  if (!settings) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Spinner size="large" />
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

  const selectedTopic = settings.topics[selectedTopicIndex];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Box p="$4">
        <Box flexDirection="row" justifyContent="flex-end" mb="$2">
          <Pressable
            onPress={() => generateSummary(true)}
            disabled={loading}
            style={{ padding: 8 }}
          >
            <Ionicons name="refresh" size={24} color={loading ? '#ccc' : theme.colors.primary} />
          </Pressable>
        </Box>

        <TopicTabs
          topics={settings.topics}
          selectedTopicIndex={selectedTopicIndex}
          onChange={setSelectedTopicIndex}
        />

        {error && (
          <Alert action="error" variant="solid" mb="$4">
            <AlertText>{error}</AlertText>
          </Alert>
        )}

        {loading && (
          <Box bg="$backgroundLight" p="$4" borderRadius="$xs" mb="$4">
            <Box flexDirection="row" alignItems="center" gap="$2" mb="$4">
              <Spinner size="small" />
              <Text>Generating summary...</Text>
            </Box>
            
            {progress && showThinking && progress.type === 'thinking' && (
              <Box bg="$gray50" p="$3" borderRadius="$xs" borderWidth={1} borderColor="$gray200">
                <Text fontSize="$xs" color="$textSecondary" mb="$2">
                  Agent thinking...
                </Text>
                <Text fontSize="$xs" fontFamily="monospace" style={{ whiteSpace: 'pre-wrap' }}>
                  {progress.content}
                </Text>
              </Box>
            )}

            {progress && progress.type === 'final' && (
              <Box bg="$backgroundLight" p="$3" borderRadius="$xs" borderWidth={1} borderColor="$gray200">
                <MarkdownRenderer content={progress.content} />
              </Box>
            )}
          </Box>
        )}

        {!loading && !summary && (
          <Box bg="$backgroundLight" p="$6" borderRadius="$xs" alignItems="center">
            <Text color="$textSecondary" mb="$4" textAlign="center">
              No summary available for {selectedTopic.name}
            </Text>
            <Button
              onPress={() => generateSummary()}
              bg="$primary400"
            >
              <ButtonText>Generate Summary</ButtonText>
            </Button>
          </Box>
        )}

        {!loading && summary && (
          <Box bg="$backgroundLight" p="$4" borderRadius="$xs">
            <Box flexDirection="row" alignItems="center" gap="$2" mb="$2" flexWrap="wrap">
              <Text fontSize="$xs" color="$textSecondary">
                Generated {new Date(summary.generatedAt).toLocaleString()}
              </Text>
              {summary.cost && (
                <Badge size="sm" variant="outline" borderRadius="$full">
                  <BadgeText fontSize="$xs">
                    ~${summary.cost.estimatedCost.toFixed(4)}
                  </BadgeText>
                </Badge>
              )}
            </Box>
            <MarkdownRenderer content={summary.summary} onSaveArticle={handleSaveArticle} />
          </Box>
        )}

        {/* Toast notification */}
        {toastMessage && (
          <Box
            position="absolute"
            bottom={20}
            left={16}
            right={16}
            bg={toastMessage.type === 'success' ? '$success500' : '$error500'}
            p="$3"
            borderRadius="$xs"
            style={{ zIndex: 1000 }}
          >
            <Text color="white" textAlign="center">
              {toastMessage.text}
            </Text>
          </Box>
        )}
      </Box>
    </ScrollView>
  );
}

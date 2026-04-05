import { Badge, BadgeText } from "@/components/ui/badge";
import { Alert, AlertText } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";
import { useState, useEffect, useRef } from 'react';
import { ScrollView, View, Pressable, Animated, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
import { 
  ArticleSaveService, 
  ReadabilityContentExtractor, 
  ArticleCountPolicy,
  type ArticleStorage 
} from '../../src/services/article-save';
import type { Settings, DailySummary as DailySummaryType, AgentProgress } from '../../src/types';
import { theme } from '../../src/theme/index';

export default function SummaryScreen() {
  const router = useRouter();
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const { width } = useWindowDimensions();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [summary, setSummary] = useState<DailySummaryType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<AgentProgress | null>(null);
  const [showThinking, setShowThinking] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const controlsOpacity = useRef(new Animated.Value(0)).current;
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  // Golden ratio: content width = 61.8% of screen width
  const contentWidth = width * 0.618;
  const marginHorizontal = (width - contentWidth) / 2;

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      loadSummary();
    }
  }, [settings, topicId]);

  // Auto-hide toast after 4 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    if (showControls && !isAtBottom) {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
      hideControlsTimer.current = setTimeout(() => {
        hideControls();
      }, 3000);
    }
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
    };
  }, [showControls, isAtBottom]);

  async function loadSettings() {
    const stored = await getSettings();
    setSettings(stored);
    
    if (!stored || !stored.anthropicApiKey) {
      setError('Please configure your settings first');
    }
  }

  async function loadSummary() {
    if (!settings) return;
    
    const cached = await getTodaysSummary(topicId as string);
    
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
      const result = await saver.saveArticle(url, title, topicId as string);

      if (result.success) {
        const count = result.usage?.type === 'count' ? result.usage.count + 1 : undefined;
        setToastMessage({
          text: `Saved to Reading List${count ? ` (${count}/4)` : ''}`,
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
    
    const topic = settings.topics.find((t) => t.id === topicId);
    if (!topic) return;
    
    if (!forceRefresh) {
      const cached = await getTodaysSummary(topicId as string);
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
      const recentArticles = filterArticlesByDate(allArticles, 24);

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

  function handleTap() {
    if (showControls) {
      hideControls();
    } else {
      revealControls();
    }
  }

  function revealControls() {
    setShowControls(true);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }

  function hideControls() {
    Animated.timing(controlsOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowControls(false);
    });
  }

  function handleScroll(event: any) {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
    
    if (isBottom && !isAtBottom) {
      setIsAtBottom(true);
      revealControls();
    } else if (!isBottom && isAtBottom) {
      setIsAtBottom(false);
    }
  }

  if (!settings) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <Spinner size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      {/* Tap-to-reveal controls */}
      {(showControls || isAtBottom) && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 50,
            right: 20,
            zIndex: 1000,
            opacity: controlsOpacity,
            flexDirection: 'row',
            gap: 12,
          }}
        >
          {summary && (
            <Pressable
              onPress={() => generateSummary(true)}
              disabled={loading}
              style={{
                backgroundColor: 'rgba(20, 39, 53, 0.9)',
                borderRadius: 24,
                padding: 12,
              }}
            >
              <Ionicons name="refresh" size={24} color={loading ? '#ccc' : '#f9f9f9'} />
            </Pressable>
          )}
          <Pressable
            onPress={() => router.back()}
            style={{
              backgroundColor: 'rgba(20, 39, 53, 0.9)',
              borderRadius: 24,
              padding: 12,
            }}
          >
            <Ionicons name="close" size={24} color="#f9f9f9" />
          </Pressable>
        </Animated.View>
      )}

      <Pressable onPress={handleTap} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: marginHorizontal,
            paddingVertical: 60,
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {error && (
            <Alert action="error" variant="solid" className="mb-4">
              <AlertText>{error}</AlertText>
            </Alert>
          )}

          {loading && (
            <Box>
              <Box className="flex-row items-center justify-center gap-2 mb-6">
                <Spinner size="small" />
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 16 }}>
                  Generating summary...
                </Text>
              </Box>
              
              {progress && showThinking && progress.type === 'thinking' && (
                <Box className="bg-gray-50 p-4 rounded-xs border border-gray-200 mb-4">
                  <Text className="text-xs text-textSecondary mb-2">
                    Agent thinking...
                  </Text>
                  <Text style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}>
                    {progress.content}
                  </Text>
                </Box>
              )}

              {progress && progress.type === 'final' && (
                <MarkdownRenderer content={progress.content} onSaveArticle={handleSaveArticle} />
              )}
            </Box>
          )}

          {!loading && !summary && (
            <Box className="items-center" style={{ paddingTop: 100 }}>
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: 18,
                  color: theme.colors.textSecondary,
                  marginBottom: 24,
                  textAlign: 'center',
                }}
              >
                No summary available for today
              </Text>
              <Button
                onPress={() => generateSummary()}
                className="bg-primary-400"
              >
                <ButtonText>Generate Summary</ButtonText>
              </Button>
            </Box>
          )}

          {!loading && summary && (
            <Box>
              {summary.cost && (
                <Box className="flex-row items-center justify-center gap-2 mb-4">
                  <Text
                    style={{
                      fontFamily: theme.fonts.body,
                      fontSize: 12,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Generated {new Date(summary.generatedAt).toLocaleString()}
                  </Text>
                  <Badge size="sm" variant="outline" className="rounded-full">
                    <BadgeText className="text-xs">
                      ~${summary.cost.estimatedCost.toFixed(4)}
                    </BadgeText>
                  </Badge>
                </Box>
              )}
              <View
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: 19,
                  lineHeight: 33.25, // 1.75 line height
                  color: theme.colors.textPrimary,
                }}
              >
                <MarkdownRenderer content={summary.summary} onSaveArticle={handleSaveArticle} />
              </View>
            </Box>
          )}
        </ScrollView>
      </Pressable>

      {/* Toast notification */}
      {toastMessage && (
        <Box
          style={{ zIndex: 1000 }}
          className={` ${toastMessage.type === 'success' ? "bg-success-500" : "bg-error-500"} absolute bottom-20 left-16 right-16 p-3 rounded-xs `}>
          <Text className="text-white text-center">
            {toastMessage.text}
          </Text>
        </Box>
      )}
    </View>
  );
}

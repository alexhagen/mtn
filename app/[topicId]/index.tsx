import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { useState, useEffect } from 'react';
import { ScrollView, Pressable, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { 
  getSettings, 
  getTodaysSummary, 
  getCurrentMonthArticles,
  getCurrentQuarterBooks,
} from '../../src/services/storage/index';
import UserMenu from '../../src/components/UserMenu';
import type { Settings, Topic } from '../../src/types';
import { theme } from '../../src/theme/index';

export default function TopicScreen() {
  const router = useRouter();
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [summaryMetadata, setSummaryMetadata] = useState<string>('');
  const [readingListMetadata, setReadingListMetadata] = useState<string>('');
  const [booksMetadata, setBooksMetadata] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [topicId]);

  async function loadData() {
    const stored = await getSettings();
    setSettings(stored);
    
    if (!stored) return;
    
    const foundTopic = stored.topics.find((t) => t.id === topicId);
    setTopic(foundTopic || null);
    
    if (!foundTopic) return;

    // Load summary metadata
    const summary = await getTodaysSummary(foundTopic.id);
    if (summary) {
      const hours = Math.floor((Date.now() - summary.generatedAt) / (1000 * 60 * 60));
      setSummaryMetadata(hours === 0 ? 'Generated just now' : hours === 1 ? 'Generated 1 hour ago' : `Generated ${hours} hours ago`);
    } else {
      setSummaryMetadata('Tap to generate');
    }

    // Load reading list metadata
    const articles = await getCurrentMonthArticles(foundTopic.id);
    const totalWords = articles.reduce((sum, article) => sum + article.wordCount, 0);
    setReadingListMetadata(`${articles.length} ${articles.length === 1 ? 'article' : 'articles'} · ${totalWords.toLocaleString()} words`);

    // Load books metadata
    const books = await getCurrentQuarterBooks(foundTopic.id);
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    const quarterStr = `${now.getFullYear()}-Q${quarter}`;
    if (books && books.books.length > 0) {
      setBooksMetadata(`${quarterStr} · ${books.books.length} ${books.books.length === 1 ? 'book' : 'books'}`);
    } else {
      setBooksMetadata(`${quarterStr} · No recommendations yet`);
    }
  }

  if (!topic) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Topic not found</Text>
      </View>
    );
  }

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
            {topic.name}
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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
        <Box className="gap-4">
          {/* Daily Summary Card */}
          <Pressable
            onPress={() => router.push(`/${topicId}/summary`)}
            style={{
              backgroundColor: theme.colors.backgroundLight,
              borderRadius: 12,
              padding: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 28, marginRight: 12 }}>📰</Text>
              <Text
                style={{
                  fontFamily: theme.fonts.heading,
                  fontSize: 20,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: theme.colors.textPrimary,
                }}
              >
                Daily Summary
              </Text>
            </View>
            <Text
              style={{
                fontSize: 14,
                color: theme.colors.textSecondary,
              }}
            >
              {summaryMetadata}
            </Text>
          </Pressable>

          {/* Reading List Card */}
          <Pressable
            onPress={() => router.push(`/${topicId}/reading-list`)}
            style={{
              backgroundColor: theme.colors.backgroundLight,
              borderRadius: 12,
              padding: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 28, marginRight: 12 }}>🔖</Text>
              <Text
                style={{
                  fontFamily: theme.fonts.heading,
                  fontSize: 20,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: theme.colors.textPrimary,
                }}
              >
                Reading List
              </Text>
            </View>
            <Text
              style={{
                fontSize: 14,
                color: theme.colors.textSecondary,
              }}
            >
              {readingListMetadata}
            </Text>
          </Pressable>

          {/* Books Card */}
          <Pressable
            onPress={() => router.push(`/${topicId}/books`)}
            style={{
              backgroundColor: theme.colors.backgroundLight,
              borderRadius: 12,
              padding: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 28, marginRight: 12 }}>📚</Text>
              <Text
                style={{
                  fontFamily: theme.fonts.heading,
                  fontSize: 20,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: theme.colors.textPrimary,
                }}
              >
                Book Recommendations
              </Text>
            </View>
            <Text
              style={{
                fontSize: 14,
                color: theme.colors.textSecondary,
              }}
            >
              {booksMetadata}
            </Text>
          </Pressable>
        </Box>
      </ScrollView>
    </View>
  );
}

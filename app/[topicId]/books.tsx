import { Badge, BadgeText } from "@/components/ui/badge";
import { Alert, AlertText } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";
import { useState, useEffect } from 'react';
import { ScrollView, View, Pressable, Linking, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getSettings,
  getCurrentQuarterBooks,
  saveQuarterBooks,
  generateId,
} from '../../src/services/storage/index';
import { createPipeline } from '../../src/services/generation-pipeline';
import UserMenu from '../../src/components/UserMenu';
import type { Settings, QuarterlyBookList, Book, AgentProgress } from '../../src/types';
import { theme } from '../../src/theme/index';

export default function BooksScreen() {
  const router = useRouter();
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [bookList, setBookList] = useState<QuarterlyBookList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuarter, setCurrentQuarter] = useState('');
  const [progress, setProgress] = useState<AgentProgress | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    async function loadBooksForTopic() {
      if (!settings) return;
      
      const books = await getCurrentQuarterBooks(topicId as string);
      setBookList(books);
    }
    
    loadBooksForTopic();
  }, [topicId, settings]);

  async function loadData() {
    const stored = await getSettings();
    setSettings(stored);
    
    if (!stored) {
      return;
    }

    // Get current quarter for display
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const quarter = Math.floor(month / 3) + 1;
    const quarterStr = `${year}-Q${quarter}`;
    setCurrentQuarter(quarterStr);

    // Load books for topic
    const books = await getCurrentQuarterBooks(topicId as string);
    setBookList(books);
  }

  async function generateBooks(forceRefresh = false) {
    if (!settings) return;

    const topic = settings.topics.find((t) => t.id === topicId);
    if (!topic) return;
    
    if (!forceRefresh && bookList && bookList.topicId === topicId) {
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(null);

    try {
      const pipeline = createPipeline(settings.anthropicApiKey, {
        bookRecommendationsSystemPrompt: settings.bookRecommendationsSystemPrompt,
        bookRecommendationsUserPrompt: settings.bookRecommendationsUserPrompt,
      });

      const result = await pipeline.generate({
        type: 'book-recommendations',
        topics: [topic.name],
        onProgress: (prog) => setProgress(prog),
      });

      // Get current quarter
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const quarter = Math.floor(month / 3) + 1;
      const quarterStr = `${year}-Q${quarter}`;

      const newBookList: QuarterlyBookList = {
        id: generateId(),
        quarter: quarterStr,
        topicId: topic.id,
        topicName: topic.name,
        books: result.books || [],
        generatedAt: Date.now(),
        cost: result.cost,
      };

      await saveQuarterBooks(newBookList);
      setBookList(newBookList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate book recommendations');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  async function toggleReadStatus(bookId: string) {
    if (!bookList) return;

    const updatedBooks = bookList.books.map((book) =>
      book.id === bookId ? { ...book, isRead: !book.isRead } : book
    );

    const updatedList = { ...bookList, books: updatedBooks };
    await saveQuarterBooks(updatedList);
    setBookList(updatedList);
  }

  if (!settings) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Spinner size="large" />
      </View>
    );
  }

  const topic = settings.topics.find((t) => t.id === topicId);

  const renderBookItem = ({ item }: { item: Book }) => (
    <Box className="bg-backgroundLight rounded-xs border border-gray-200 p-4 mb-3">
      <Box className="flex-row justify-between items-start mb-2">
        <Box className="flex-1 mr-2">
          <Text className="text-lg font-bold mb-1">
            {item.title}
          </Text>
          <Text className="text-sm text-textSecondary mb-2">
            by {item.author}
          </Text>
          <Text className="text-sm mb-3">
            {item.description}
          </Text>
        </Box>
        {item.isRead && (
          <Badge size="sm" action="success" variant="solid" className="rounded-full">
            <BadgeText>Read</BadgeText>
          </Badge>
        )}
      </Box>

      <Box className="flex-row justify-between items-center flex-wrap gap-2">
        <Box className="flex-row gap-2 flex-wrap">
          {item.purchaseLinks.amazon && (
            <Button
              size="sm"
              variant="outline"
              onPress={() => Linking.openURL(item.purchaseLinks.amazon!)}
            >
              <ButtonText>Amazon</ButtonText>
            </Button>
          )}
          {item.purchaseLinks.bookshop && (
            <Button
              size="sm"
              variant="outline"
              onPress={() => Linking.openURL(item.purchaseLinks.bookshop!)}
            >
              <ButtonText>Bookshop</ButtonText>
            </Button>
          )}
        </Box>

        <Pressable
          onPress={() => toggleReadStatus(item.id)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 8,
          }}
        >
          <Ionicons
            name={item.isRead ? 'checkbox' : 'square-outline'}
            size={20}
            color={theme.colors.primary}
          />
          <Text className="text-sm">Mark as read</Text>
        </Pressable>
      </Box>
    </Box>
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
            Books
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

      <ScrollView style={{ flex: 1 }}>
        <Box className="p-4">
          <Box className="flex-row justify-end items-center gap-2 mb-4">
            <Text className="text-xs text-textSecondary">
              {currentQuarter}
            </Text>
            {bookList?.cost && (
              <Badge size="sm" variant="outline" className="rounded-full">
                <BadgeText className="text-xs">
                  ~${bookList.cost.estimatedCost.toFixed(4)}
                </BadgeText>
              </Badge>
            )}
            <Pressable
              onPress={() => generateBooks(true)}
              disabled={loading}
              style={{ padding: 8 }}
            >
              <Ionicons name="refresh" size={24} color={loading ? '#ccc' : theme.colors.primary} />
            </Pressable>
          </Box>

          {error && (
            <Alert action="error" variant="solid" className="mb-4">
              <AlertText>{error}</AlertText>
            </Alert>
          )}

          {loading && (
            <Box className="bg-backgroundLight p-4 rounded-xs mb-4">
              <Box className="flex-row items-center gap-2 mb-4">
                <Spinner size="small" />
                <Text>Generating book recommendations...</Text>
              </Box>
              
              {progress && (
                <Box className="bg-gray-50 p-3 rounded-xs border border-gray-200">
                  <Text style={{ whiteSpace: 'pre-wrap' }} className="text-sm">
                    {progress.content}
                  </Text>
                </Box>
              )}
            </Box>
          )}

          {!loading && !bookList && (
            <Box className="bg-backgroundLight p-6 rounded-xs items-center">
              <Text className="text-textSecondary mb-4 text-center">
                No book recommendations for this quarter yet
              </Text>
              <Button
                onPress={() => generateBooks()}
                className="bg-primary-400"
              >
                <ButtonText>Generate Recommendations</ButtonText>
              </Button>
            </Box>
          )}

          {!loading && bookList && bookList.books.length > 0 && (
            <FlatList
              data={bookList.books}
              renderItem={renderBookItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}
        </Box>
      </ScrollView>
    </View>
  );
}

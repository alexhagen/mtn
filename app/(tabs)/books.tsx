import { useState, useEffect } from 'react';
import { ScrollView, View, Pressable, Linking, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Box,
  Text,
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
  getCurrentQuarterBooks,
  saveQuarterBooks,
  generateId,
} from '../../src/services/storage/index';
import { createPipeline } from '../../src/services/generation-pipeline';
import TopicTabs from '../../src/components/TopicTabs';
import type { Settings, QuarterlyBookList, Book, AgentProgress } from '../../src/types';
import { theme } from '../../src/theme/index';

export default function BooksScreen() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);
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
      if (!settings || settings.topics.length === 0) return;
      
      const selectedTopic = settings.topics[selectedTopicIndex];
      const books = await getCurrentQuarterBooks(selectedTopic.id);
      setBookList(books);
    }
    
    loadBooksForTopic();
  }, [selectedTopicIndex, settings]);

  async function loadData() {
    const stored = await getSettings();
    setSettings(stored);
    
    if (!stored || stored.topics.length === 0) {
      return;
    }

    // Get current quarter for display
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const quarter = Math.floor(month / 3) + 1;
    const quarterStr = `${year}-Q${quarter}`;
    setCurrentQuarter(quarterStr);

    // Load books for first topic by default
    const books = await getCurrentQuarterBooks(stored.topics[0].id);
    setBookList(books);
  }

  async function generateBooks(forceRefresh = false) {
    if (!settings) return;

    const selectedTopic = settings.topics[selectedTopicIndex];
    
    if (!forceRefresh && bookList && bookList.topicId === selectedTopic.id) {
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(null);

    try {
      if (settings.topics.length === 0) {
        setError('Please configure at least one topic in Settings');
        setLoading(false);
        return;
      }

      const pipeline = createPipeline(settings.anthropicApiKey, {
        bookRecommendationsSystemPrompt: settings.bookRecommendationsSystemPrompt,
        bookRecommendationsUserPrompt: settings.bookRecommendationsUserPrompt,
      });

      const result = await pipeline.generate({
        type: 'book-recommendations',
        topics: [selectedTopic.name],
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
        topicId: selectedTopic.id,
        topicName: selectedTopic.name,
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

  const renderBookItem = ({ item }: { item: Book }) => (
    <Box
      bg="$backgroundLight"
      borderRadius="$xs"
      borderWidth={1}
      borderColor="$gray200"
      p="$4"
      mb="$3"
    >
      <Box flexDirection="row" justifyContent="space-between" alignItems="flex-start" mb="$2">
        <Box flex={1} mr="$2">
          <Text fontSize="$lg" fontWeight="$bold" mb="$1">
            {item.title}
          </Text>
          <Text fontSize="$sm" color="$textSecondary" mb="$2">
            by {item.author}
          </Text>
          <Text fontSize="$sm" mb="$3">
            {item.description}
          </Text>
        </Box>
        {item.isRead && (
          <Badge size="sm" action="success" variant="solid" borderRadius="$full">
            <BadgeText>Read</BadgeText>
          </Badge>
        )}
      </Box>

      <Box flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
        <Box flexDirection="row" gap="$2" flexWrap="wrap">
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
          <Text fontSize="$sm">Mark as read</Text>
        </Pressable>
      </Box>
    </Box>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Box p="$4">
        <Box flexDirection="row" justifyContent="flex-end" alignItems="center" gap="$2" mb="$2">
          <Text fontSize="$xs" color="$textSecondary">
            {currentQuarter}
          </Text>
          {bookList?.cost && (
            <Badge size="sm" variant="outline" borderRadius="$full">
              <BadgeText fontSize="$xs">
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
              <Text>Generating book recommendations...</Text>
            </Box>
            
            {progress && (
              <Box bg="$gray50" p="$3" borderRadius="$xs" borderWidth={1} borderColor="$gray200">
                <Text fontSize="$sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {progress.content}
                </Text>
              </Box>
            )}
          </Box>
        )}

        {!loading && !bookList && (
          <Box bg="$backgroundLight" p="$6" borderRadius="$xs" alignItems="center">
            <Text color="$textSecondary" mb="$4" textAlign="center">
              No book recommendations for this quarter yet
            </Text>
            <Button
              onPress={() => generateBooks()}
              bg="$primary400"
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
  );
}

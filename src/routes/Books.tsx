import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Button,
  Box,
  Card,
  CardContent,
  CardActions,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  getSettings,
  getCurrentQuarterBooks,
  saveQuarterBooks,
  generateId,
} from '../services/storage/index';
import { createPipeline } from '../services/generation-pipeline';
import TopicTabs from '../components/TopicTabs';
import type { Settings, QuarterlyBookList, Book, AgentProgress } from '../types';

export default function Books() {
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
      <Container maxWidth="md">
        <CircularProgress />
      </Container>
    );
  }

  if (settings.topics.length === 0) {
    return (
      <Container maxWidth="md">
        <Alert severity="info">
          Please configure at least one topic in Settings to get started.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, mb: 2, mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          {currentQuarter}
        </Typography>
        {bookList?.cost && (
          <Chip
            label={`~$${bookList.cost.estimatedCost.toFixed(4)}`}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.7rem', height: '20px' }}
          />
        )}
        <IconButton
          onClick={() => generateBooks(true)}
          disabled={loading}
          size="small"
          title="Refresh"
        >
          <RefreshIcon />
        </IconButton>
      </Box>

      <TopicTabs
        topics={settings.topics}
        selectedTopicIndex={selectedTopicIndex}
        onChange={setSelectedTopicIndex}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Paper sx={{ p: 3, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <CircularProgress size={24} />
            <Typography>Generating book recommendations...</Typography>
          </Box>
          
          {progress && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {progress.content}
              </Typography>
            </Paper>
          )}
        </Paper>
      )}

      {!loading && !bookList && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            No book recommendations for this quarter yet
          </Typography>
          <Button
            variant="contained"
            onClick={() => generateBooks()}
            sx={{ mt: 2 }}
          >
            Generate Recommendations
          </Button>
        </Paper>
      )}

      {!loading && bookList && bookList.books.length > 0 && (
        <Box>
          {bookList.books.map((book) => (
            <Card key={book.id} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      {book.title}
                    </Typography>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      by {book.author}
                    </Typography>
                    <Typography variant="body2" paragraph>
                      {book.description}
                    </Typography>
                  </Box>
                  {book.isRead && (
                    <Chip label="Read" color="success" size="small" sx={{ ml: 2 }} />
                  )}
                </Box>
              </CardContent>
              <CardActions>
                {book.purchaseLinks.amazon && (
                  <Button size="small" onClick={() => window.open(book.purchaseLinks.amazon, '_blank')}>
                    Amazon
                  </Button>
                )}
                {book.purchaseLinks.bookshop && (
                  <Button size="small" onClick={() => window.open(book.purchaseLinks.bookshop, '_blank')}>
                    Bookshop
                  </Button>
                )}
                <Box sx={{ flexGrow: 1 }} />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={book.isRead}
                      onChange={() => toggleReadStatus(book.id)}
                    />
                  }
                  label="Mark as read"
                />
              </CardActions>
            </Card>
          ))}
        </Box>
      )}
    </Container>
  );
}

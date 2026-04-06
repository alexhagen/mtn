import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  Box,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  getCurrentQuarterBooks,
  saveQuarterBooks,
  generateId,
} from '../services/storage/index';
import { createPipeline } from '../services/generation-pipeline';
import type { Settings, Topic, QuarterlyBookList, AgentProgress } from '../types';

interface TopicContext {
  topic: Topic;
  settings: Settings;
}

export default function Books() {
  const { topic, settings } = useOutletContext<TopicContext>();
  const [bookList, setBookList] = useState<QuarterlyBookList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuarter, setCurrentQuarter] = useState('');
  const [progress, setProgress] = useState<AgentProgress | null>(null);

  useEffect(() => {
    loadData();
  }, [topic.id]);

  async function loadData() {
    // Get current quarter for display
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const quarter = Math.floor(month / 3) + 1;
    const quarterStr = `${year}-Q${quarter}`;
    setCurrentQuarter(quarterStr);

    // Load books for topic
    const books = await getCurrentQuarterBooks(topic.id);
    setBookList(books);
  }

  async function generateBooks(forceRefresh = false) {
    if (!forceRefresh && bookList && bookList.topicId === topic.id) {
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

  if (!settings.anthropicApiKey) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="info">
          Please configure your Anthropic API key in Settings to generate book recommendations.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
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

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ p: 3, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <CircularProgress size={24} />
            <Typography>Generating book recommendations...</Typography>
          </Box>
          
          {progress && (
            <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {progress.content}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {!loading && !bookList && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
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
        </Box>
      )}

      {!loading && bookList && bookList.books.length > 0 && (
        <Box sx={{ maxWidth: '42em', mx: 'auto' }}>
          {bookList.books.map((book) => (
            <Box 
              key={book.id} 
              sx={{ 
                mb: 4, 
                pb: 4, 
                borderBottom: '1px solid', 
                borderColor: 'divider',
                '&:last-child': { borderBottom: 'none' }
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography 
                    variant="h5" 
                    gutterBottom
                    sx={{
                      fontFamily: '"Crimson Text", Georgia, serif',
                      fontWeight: 600,
                      fontSize: '1.5rem',
                      textTransform: 'none',
                    }}
                  >
                    {book.title}
                  </Typography>
                  <Typography 
                    variant="subtitle2" 
                    color="text.secondary" 
                    gutterBottom
                    sx={{
                      fontFamily: '"Source Sans Pro", "Helvetica Neue", Arial, sans-serif',
                      fontSize: '0.875rem',
                      fontStyle: 'italic',
                    }}
                  >
                    by {book.author}
                  </Typography>
                  <Typography 
                    variant="body1" 
                    paragraph
                    sx={{
                      lineHeight: 1.7,
                      fontSize: '1rem',
                    }}
                  >
                    {book.description}
                  </Typography>
                </Box>
                {book.isRead && (
                  <Chip label="Read" color="success" size="small" sx={{ ml: 2 }} />
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                {book.purchaseLinks.amazon && (
                  <Button 
                    size="small" 
                    variant="text"
                    onClick={() => window.open(book.purchaseLinks.amazon, '_blank')}
                    sx={{ textDecoration: 'underline', p: 0 }}
                  >
                    Amazon
                  </Button>
                )}
                {book.purchaseLinks.bookshop && (
                  <Button 
                    size="small" 
                    variant="text"
                    onClick={() => window.open(book.purchaseLinks.bookshop, '_blank')}
                    sx={{ textDecoration: 'underline', p: 0 }}
                  >
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
                  sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
                />
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Container>
  );
}

import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
} from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import {
  getCurrentMonthArticles,
  saveArticle,
  deleteArticle,
  getStorageDomain,
} from '../services/storage/index';
import { isLongForm } from '../services/readability';
import { 
  ArticleSaveService, 
  ReadabilityContentExtractor, 
  WordBudgetPolicy,
  type ArticleStorage 
} from '../services/article-save';
import type { Article, Settings, Topic } from '../types';

interface TopicContext {
  topic: Topic;
  settings: Settings;
}

export default function ReadingList() {
  const { topic, settings } = useOutletContext<TopicContext>();
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [articleUrl, setArticleUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalWords, setTotalWords] = useState(0);

  useEffect(() => {
    loadArticles();
  }, [topic.id]);

  useEffect(() => {
    async function getTotalWords() {
      // Get all articles for current month (no topic filter for total count)
      const allArticles = await getCurrentMonthArticles();
      const total = allArticles.reduce((sum, article) => sum + article.wordCount, 0);
      setTotalWords(total);
    }
    getTotalWords();
  }, [articles]);

  async function loadArticles() {
    // Get articles for current month filtered by selected topic
    const filtered = await getCurrentMonthArticles(topic.id);
    setArticles(filtered);
  }

  async function handleSaveArticle() {
    if (!articleUrl.trim()) return;

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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, mb: 2, mt: 2 }}>
        <Button
          variant="text"
          size="small"
          startIcon={<BookmarkIcon />}
          onClick={() => setSaveDialogOpen(true)}
          disabled={totalWords >= 12000}
        >
          Save Article
        </Button>
        <Chip 
          label={`${totalWords.toLocaleString()}/12,000`} 
          size="small" 
          variant="outlined"
        />
      </Box>

      {articles.length === 0 && (
        <Alert severity="info">
          No articles saved for this month. Save articles from the Daily Summary or add them manually.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: selectedArticle ? '1fr 2fr' : '1fr', gap: 4 }}>
        <Box>
          {articles.map((article, index) => (
            <Box
              key={article.id}
              sx={{
                mb: 3,
                pb: 3,
                borderBottom: index < articles.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
                cursor: 'pointer',
                bgcolor: selectedArticle?.id === article.id ? 'action.hover' : 'transparent',
                p: 2,
                transition: 'background-color 0.2s ease',
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
              onClick={() => setSelectedArticle(article)}
            >
              <Typography 
                variant="h5" 
                gutterBottom
                sx={{ 
                  fontFamily: '"Crimson Text", Georgia, serif',
                  fontWeight: 600,
                  fontSize: '1.5rem',
                  mb: 1,
                  textTransform: 'none',
                }}
              >
                {article.title}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" color="text.secondary">
                  {article.wordCount.toLocaleString()} words
                </Typography>
                {isLongForm(article.wordCount) && (
                  <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600 }}>
                    Long-form
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                  • Saved {new Date(article.savedAt).toLocaleDateString()}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                <Button 
                  size="small" 
                  variant="text"
                  onClick={(e) => { e.stopPropagation(); window.open(article.url, '_blank'); }}
                  sx={{ minWidth: 'auto', p: 0, textDecoration: 'underline' }}
                >
                  Open Original
                </Button>
                <Button
                  size="small"
                  variant="text"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteArticle(article.id);
                  }}
                  sx={{ minWidth: 'auto', p: 0, textDecoration: 'underline' }}
                >
                  Remove
                </Button>
              </Box>
            </Box>
          ))}
        </Box>

        {selectedArticle && (
          <Box sx={{ maxHeight: '80vh', overflow: 'auto', px: 2 }}>
            <Box sx={{ maxWidth: '38em', mx: 'auto' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 3 }}>
                <Typography 
                  variant="h4" 
                  gutterBottom
                  sx={{
                    fontFamily: '"Crimson Text", Georgia, serif',
                    fontWeight: 600,
                    fontSize: '2rem',
                    textTransform: 'none',
                  }}
                >
                  {selectedArticle.title}
                </Typography>
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => handleMarkAsRead(selectedArticle.id)}
                  sx={{ ml: 2, flexShrink: 0 }}
                >
                  Done Reading
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom sx={{ mb: 3, textAlign: 'center' }}>
                {selectedArticle.wordCount.toLocaleString()} words
              </Typography>
              <Box
                sx={{
                  '& h1': { 
                    fontFamily: '"Crimson Text", Georgia, serif',
                    fontSize: '1.75rem', 
                    fontWeight: 600, 
                    mt: 3, 
                    mb: 2,
                    textTransform: 'none',
                  },
                  '& h2': { 
                    fontFamily: '"Crimson Text", Georgia, serif',
                    fontSize: '1.5rem', 
                    fontWeight: 600, 
                    mt: 3, 
                    mb: 2,
                    textTransform: 'none',
                  },
                  '& h3': { 
                    fontFamily: '"Crimson Text", Georgia, serif',
                    fontSize: '1.25rem', 
                    fontWeight: 600, 
                    mt: 2, 
                    mb: 1,
                    textTransform: 'none',
                  },
                  '& p': { 
                    mb: 2, 
                    lineHeight: 1.8,
                    fontSize: '1.125rem',
                    textAlign: 'justify',
                  },
                  '& a': { color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
                  '& ul, & ol': { mb: 2, pl: 3, fontSize: '1.125rem' },
                  '& img': { maxWidth: '100%', height: 'auto' },
                }}
                dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
              />
            </Box>
          </Box>
        )}
      </Box>

      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save Article for Later</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            label="Article URL"
            value={articleUrl}
            onChange={(e) => setArticleUrl(e.target.value)}
            placeholder="https://example.com/article"
            margin="normal"
            autoFocus
          />
          <Typography variant="caption" color="text.secondary">
            The article will be extracted and saved for reading. Word count will be displayed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveArticle}
            disabled={loading || !articleUrl.trim()}
          >
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

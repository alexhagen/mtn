import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import {
  getArticlesByMonth,
  saveArticle,
  deleteArticle,
  getMonthKey,
  generateId,
  getSettings,
} from '../services/storage/index';
import { extractArticleContent, countWords, isLongForm } from '../services/readability';
import type { Article } from '../types';

export default function ReadingList() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [articleUrl, setArticleUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadArticles();
  }, []);

  async function loadArticles() {
    const monthKey = getMonthKey();
    const stored = await getArticlesByMonth(monthKey);
    setArticles(stored);
  }

  async function handleSaveArticle() {
    if (!articleUrl.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const settings = await getSettings();
      if (!settings) {
        throw new Error('Please configure settings first');
      }

      // Check if already at limit
      const monthKey = getMonthKey();
      const currentArticles = await getArticlesByMonth(monthKey);
      
      if (currentArticles.length >= 4) {
        setError('You already have 4 articles saved for this month. Please remove one first.');
        setLoading(false);
        return;
      }

      // Extract article content
      const extracted = await extractArticleContent(articleUrl, settings.corsProxyUrl);
      const wordCount = countWords(extracted.textContent);

      const newArticle: Article = {
        id: generateId(),
        title: extracted.title,
        url: articleUrl,
        content: extracted.content,
        wordCount,
        savedAt: Date.now(),
        monthKey,
      };

      await saveArticle(newArticle);
      await loadArticles();
      setSaveDialogOpen(false);
      setArticleUrl('');
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
    <Container maxWidth="lg">
      <Box sx={{ textAlign: 'center', mb: 4, mt: 2 }}>
        <Typography 
          variant="h3" 
          component="h2"
          sx={{ 
            fontWeight: 700,
            mb: 2,
          }}
        >
          Reading List
        </Typography>
        <Button
          variant="outlined"
          startIcon={<BookmarkIcon />}
          onClick={() => setSaveDialogOpen(true)}
          disabled={articles.length >= 4}
          sx={{ mt: 2 }}
        >
          Save Article ({articles.length}/4)
        </Button>
      </Box>

      {articles.length === 0 && (
        <Alert severity="info">
          No articles saved for this month. Save articles from the Daily Summary or add them manually.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: selectedArticle ? '1fr 2fr' : '1fr', gap: 3 }}>
        <Box>
          {articles.map((article, index) => (
            <Box
              key={article.id}
              sx={{
                mb: 2,
                pb: 2,
                borderBottom: index < articles.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
                cursor: 'pointer',
                bgcolor: selectedArticle?.id === article.id ? 'action.hover' : 'transparent',
                p: 2,
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
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontWeight: 700,
                  fontSize: '1.5rem',
                  mb: 1,
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
          <Paper sx={{ p: 3, maxHeight: '80vh', overflow: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
              <Typography variant="h5" gutterBottom>
                {selectedArticle.title}
              </Typography>
              <Button
                variant="contained"
                color="success"
                onClick={() => handleMarkAsRead(selectedArticle.id)}
              >
                Done Reading
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              {selectedArticle.wordCount.toLocaleString()} words
            </Typography>
            <Box
              sx={{
                '& h1': { fontSize: '1.75rem', fontWeight: 600, mt: 3, mb: 2 },
                '& h2': { fontSize: '1.5rem', fontWeight: 600, mt: 3, mb: 2 },
                '& h3': { fontSize: '1.25rem', fontWeight: 600, mt: 2, mb: 1 },
                '& p': { mb: 2, lineHeight: 1.8 },
                '& a': { color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
                '& ul, & ol': { mb: 2, pl: 3 },
                '& img': { maxWidth: '100%', height: 'auto' },
              }}
              dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
            />
          </Paper>
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

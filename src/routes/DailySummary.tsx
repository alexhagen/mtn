import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  Box,
  CircularProgress,
  Alert,
  Collapse,
  Snackbar,
  IconButton,
  Chip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { 
  getTodaysSummary,
  saveSummaryWithCleanup,
  generateId, 
  saveArticle, 
  getArticlesByMonth, 
  getMonthKey,
} from '../services/storage/index';
import { fetchMultipleFeeds, filterArticlesByDate } from '../services/rss';
import { createPipeline } from '../services/generation-pipeline';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { 
  ArticleSaveService, 
  ReadabilityContentExtractor, 
  ArticleCountPolicy,
  type ArticleStorage 
} from '../services/article-save';
import type { Settings, Topic, DailySummary as DailySummaryType, AgentProgress } from '../types';

interface TopicContext {
  topic: Topic;
  settings: Settings;
}

export default function DailySummary() {
  const { topic, settings } = useOutletContext<TopicContext>();
  const [summary, setSummary] = useState<DailySummaryType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<AgentProgress | null>(null);
  const [showThinking, setShowThinking] = useState(true);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  useEffect(() => {
    loadSummary();
  }, [topic.id]);

  async function loadSummary() {
    const cached = await getTodaysSummary(topic.id);
    
    if (cached) {
      setSummary(cached);
    } else {
      setSummary(null);
    }
  }

  async function handleSaveArticle(url: string, title: string): Promise<{ success: boolean; error?: string; articlesCount?: number }> {
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
      const result = await saver.saveArticle(url, title, topic.id);

      if (result.success) {
        const count = result.usage?.type === 'count' ? result.usage.count + 1 : undefined;
        setSnackbarMessage(`Article saved to Reading List${count ? ` (${count}/4)` : ''}`);
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        return { success: true, articlesCount: count };
      } else {
        setSnackbarMessage(result.error || 'Failed to save article');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return { success: false, error: result.error };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save article';
      setSnackbarMessage(errorMessage);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return { success: false, error: errorMessage };
    }
  }

  async function generateSummary(forceRefresh = false) {
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
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
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

  if (!settings.anthropicApiKey) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="info">
          Please configure your Anthropic API key in Settings to generate summaries.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <IconButton
          onClick={() => generateSummary(true)}
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
            <Typography>Generating summary...</Typography>
          </Box>
          
          {progress && showThinking && progress.type === 'thinking' && (
            <Collapse in={showThinking}>
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Agent thinking...
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {progress.content}
                </Typography>
              </Box>
            </Collapse>
          )}

          {progress && progress.type === 'final' && (
            <Box sx={{ p: 2 }}>
              <MarkdownRenderer content={progress.content} />
            </Box>
          )}
        </Box>
      )}

      {!loading && !summary && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            No summary available for {topic.name}
          </Typography>
          <Button
            variant="contained"
            onClick={() => generateSummary()}
            sx={{ mt: 2 }}
          >
            Generate Summary
          </Button>
        </Box>
      )}

      {!loading && summary && (
        <Box sx={{ maxWidth: '38em', mx: 'auto', py: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, justifyContent: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              Generated {new Date(summary.generatedAt).toLocaleString()}
            </Typography>
            {summary.cost && (
              <Chip
                label={`~$${summary.cost.estimatedCost.toFixed(4)}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: '20px' }}
              />
            )}
          </Box>
          <MarkdownRenderer content={summary.summary} onSaveArticle={handleSaveArticle} />
        </Box>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
}

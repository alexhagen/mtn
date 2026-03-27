import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
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
  getSettings, 
  getSummaryByTopic, 
  saveSummary, 
  generateId, 
  saveArticle, 
  getArticlesByMonth, 
  getMonthKey,
  cleanupExpiredSummaries
} from '../services/storage/index';
import { fetchMultipleFeeds, filterArticlesByDate } from '../services/rss';
import { createPipeline } from '../services/generation-pipeline';
import { extractArticleContent, countWords } from '../services/readability';
import MarkdownRenderer from '../components/MarkdownRenderer';
import TopicTabs from '../components/TopicTabs';
import type { Settings, DailySummary as DailySummaryType, AgentProgress, Article } from '../types';

export default function DailySummary() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);
  const [summary, setSummary] = useState<DailySummaryType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<AgentProgress | null>(null);
  const [showThinking, setShowThinking] = useState(true);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  useEffect(() => {
    loadSettings();
    // Cleanup expired summaries on mount
    cleanupExpiredSummaries().catch(err => {
      console.error('Failed to cleanup expired summaries:', err);
    });
  }, []);

  useEffect(() => {
    if (settings && settings.topics.length > 0) {
      loadSummary();
    }
  }, [settings, selectedTopicIndex]);

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
    const cached = await getSummaryByTopic(topic.id);
    
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
      // Check if already at limit
      const monthKey = getMonthKey();
      const currentArticles = await getArticlesByMonth(monthKey);
      
      if (currentArticles.length >= 4) {
        return { 
          success: false, 
          error: 'Reading list is full (4/4). Please remove an article first.',
          articlesCount: currentArticles.length 
        };
      }

      // Extract article content
      const extracted = await extractArticleContent(url, settings.corsProxyUrl);
      const wordCount = countWords(extracted.textContent);

      const topic = settings.topics[selectedTopicIndex];
      const newArticle: Article = {
        id: generateId(),
        title: title || extracted.title,
        url,
        content: extracted.content,
        wordCount,
        savedAt: Date.now(),
        monthKey,
        topicId: topic.id,
      };

      await saveArticle(newArticle);
      
      setSnackbarMessage(`Article saved to Reading List (${currentArticles.length + 1}/4)`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);

      return { success: true, articlesCount: currentArticles.length + 1 };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save article';
      setSnackbarMessage(errorMessage);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return { success: false, error: errorMessage };
    }
  }

  async function generateSummary(forceRefresh = false) {
    if (!settings) return;
    
    const topic = settings.topics[selectedTopicIndex];
    
    if (!forceRefresh) {
      const cached = await getSummaryByTopic(topic.id);
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

      await saveSummary(newSummary);
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

  const selectedTopic = settings.topics[selectedTopicIndex];

  return (
    <Container maxWidth="md">
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2, mt: 2 }}>
        <IconButton
          onClick={() => generateSummary(true)}
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
            <Typography>Generating summary...</Typography>
          </Box>
          
          {progress && showThinking && progress.type === 'thinking' && (
            <Collapse in={showThinking}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Agent thinking...
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {progress.content}
                </Typography>
              </Paper>
            </Collapse>
          )}

          {progress && progress.type === 'final' && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <MarkdownRenderer content={progress.content} />
            </Paper>
          )}
        </Paper>
      )}

      {!loading && !summary && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            No summary available for {selectedTopic.name}
          </Typography>
          <Button
            variant="contained"
            onClick={() => generateSummary()}
            sx={{ mt: 2 }}
          >
            Generate Summary
          </Button>
        </Paper>
      )}

      {!loading && summary && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
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
        </Paper>
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

import { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getSettings, saveSettings, generateId } from '../services/storage/index';
import type { Settings, Topic } from '../types';
import {
  DEFAULT_DAILY_SUMMARY_SYSTEM_PROMPT,
  DEFAULT_DAILY_SUMMARY_USER_PROMPT,
  DEFAULT_BOOK_RECOMMENDATIONS_SYSTEM_PROMPT,
  DEFAULT_BOOK_RECOMMENDATIONS_USER_PROMPT,
} from '../services/agent';

export default function Settings() {
  const [settings, setSettings] = useState<Settings>({
    anthropicApiKey: '',
    corsProxyUrl: 'https://your-worker.workers.dev',
    topics: [],
  });
  const [saved, setSaved] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const stored = await getSettings();
    if (stored) {
      setSettings(stored);
    }
  }

  async function handleSave() {
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleAddTopic() {
    if (!newTopicName.trim()) return;
    if (settings.topics.length >= 3) {
      alert('Maximum 3 topics allowed');
      return;
    }

    const newTopic: Topic = {
      id: generateId(),
      name: newTopicName.trim(),
      rssFeeds: [],
    };

    setSettings({
      ...settings,
      topics: [...settings.topics, newTopic],
    });
    setNewTopicName('');
    setSelectedTopicId(newTopic.id);
  }

  function handleDeleteTopic(topicId: string) {
    setSettings({
      ...settings,
      topics: settings.topics.filter((t) => t.id !== topicId),
    });
    if (selectedTopicId === topicId) {
      setSelectedTopicId(null);
    }
  }

  function handleAddFeed() {
    if (!selectedTopicId || !newFeedUrl.trim()) return;

    setSettings({
      ...settings,
      topics: settings.topics.map((topic) =>
        topic.id === selectedTopicId
          ? { ...topic, rssFeeds: [...topic.rssFeeds, newFeedUrl.trim()] }
          : topic
      ),
    });
    setNewFeedUrl('');
  }

  function handleDeleteFeed(topicId: string, feedUrl: string) {
    setSettings({
      ...settings,
      topics: settings.topics.map((topic) =>
        topic.id === topicId
          ? { ...topic, rssFeeds: topic.rssFeeds.filter((f) => f !== feedUrl) }
          : topic
      ),
    });
  }

  const selectedTopic = settings.topics.find((t) => t.id === selectedTopicId);

  return (
    <Container maxWidth="md">
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {saved && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Settings saved successfully!
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          API Configuration
        </Typography>
        <TextField
          fullWidth
          label="Anthropic API Key"
          type="password"
          value={settings.anthropicApiKey}
          onChange={(e) =>
            setSettings({ ...settings, anthropicApiKey: e.target.value })
          }
          margin="normal"
          helperText="Your API key is stored locally in your browser"
        />
        <TextField
          fullWidth
          label="CORS Proxy URL"
          value={settings.corsProxyUrl}
          onChange={(e) =>
            setSettings({ ...settings, corsProxyUrl: e.target.value })
          }
          margin="normal"
          helperText="URL of your Cloudflare Worker proxy (required for fetching RSS feeds and article content)"
        />
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Topics ({settings.topics.length}/3)
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Configure up to 3 topics with RSS feeds for each
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mt: 2, mb: 2 }}>
          <TextField
            fullWidth
            label="New Topic Name"
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            disabled={settings.topics.length >= 3}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddTopic}
            disabled={settings.topics.length >= 3 || !newTopicName.trim()}
          >
            Add
          </Button>
        </Box>

        <List>
          {settings.topics.map((topic) => (
            <ListItem
              key={topic.id}
              secondaryAction={
                <IconButton
                  edge="end"
                  onClick={() => handleDeleteTopic(topic.id)}
                >
                  <DeleteIcon />
                </IconButton>
              }
              sx={{
                bgcolor:
                  selectedTopicId === topic.id ? 'action.selected' : 'inherit',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedTopicId(topic.id)}
            >
              <ListItemText
                primary={topic.name}
                secondary={`${topic.rssFeeds.length} RSS feeds`}
              />
            </ListItem>
          ))}
        </List>
      </Paper>

      {selectedTopic && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            RSS Feeds for "{selectedTopic.name}"
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, mt: 2, mb: 2 }}>
            <TextField
              fullWidth
              label="RSS Feed URL"
              value={newFeedUrl}
              onChange={(e) => setNewFeedUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddFeed}
              disabled={!newFeedUrl.trim()}
            >
              Add
            </Button>
          </Box>

          <List>
            {selectedTopic.rssFeeds.map((feed, idx) => (
              <div key={idx}>
                <ListItem
                  secondaryAction={
                    <IconButton
                      edge="end"
                      onClick={() => handleDeleteFeed(selectedTopic.id, feed)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={feed}
                    primaryTypographyProps={{
                      sx: { wordBreak: 'break-all' },
                    }}
                  />
                </ListItem>
                {idx < selectedTopic.rssFeeds.length - 1 && <Divider />}
              </div>
            ))}
          </List>
        </Paper>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Prompt Customization</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Customize the AI prompts used for generating summaries and book recommendations. Leave empty to use defaults.
            </Typography>

            <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
              Daily Summary System Prompt
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={6}
              value={settings.dailySummarySystemPrompt ?? DEFAULT_DAILY_SUMMARY_SYSTEM_PROMPT}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  dailySummarySystemPrompt: e.target.value || undefined,
                })
              }
              helperText="Instructions for the AI when creating daily summaries"
            />
            {settings.dailySummarySystemPrompt && (
              <Button
                size="small"
                onClick={() =>
                  setSettings({ ...settings, dailySummarySystemPrompt: undefined })
                }
                sx={{ mt: 1 }}
              >
                Reset to Default
              </Button>
            )}

            <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
              Daily Summary User Prompt
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={6}
              value={settings.dailySummaryUserPrompt ?? DEFAULT_DAILY_SUMMARY_USER_PROMPT}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  dailySummaryUserPrompt: e.target.value || undefined,
                })
              }
              helperText="Template for the user message. Use {topicName} and {articles} as placeholders."
            />
            {settings.dailySummaryUserPrompt && (
              <Button
                size="small"
                onClick={() =>
                  setSettings({ ...settings, dailySummaryUserPrompt: undefined })
                }
                sx={{ mt: 1 }}
              >
                Reset to Default
              </Button>
            )}

            <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
              Book Recommendations System Prompt
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={6}
              value={settings.bookRecommendationsSystemPrompt ?? DEFAULT_BOOK_RECOMMENDATIONS_SYSTEM_PROMPT}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  bookRecommendationsSystemPrompt: e.target.value || undefined,
                })
              }
              helperText="Instructions for the AI when recommending books"
            />
            {settings.bookRecommendationsSystemPrompt && (
              <Button
                size="small"
                onClick={() =>
                  setSettings({
                    ...settings,
                    bookRecommendationsSystemPrompt: undefined,
                  })
                }
                sx={{ mt: 1 }}
              >
                Reset to Default
              </Button>
            )}

            <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
              Book Recommendations User Prompt
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={6}
              value={settings.bookRecommendationsUserPrompt ?? DEFAULT_BOOK_RECOMMENDATIONS_USER_PROMPT}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  bookRecommendationsUserPrompt: e.target.value || undefined,
                })
              }
              helperText="Template for the user message. Use {topics} as a placeholder."
            />
            {settings.bookRecommendationsUserPrompt && (
              <Button
                size="small"
                onClick={() =>
                  setSettings({
                    ...settings,
                    bookRecommendationsUserPrompt: undefined,
                  })
                }
                sx={{ mt: 1 }}
              >
                Reset to Default
              </Button>
            )}
          </AccordionDetails>
        </Accordion>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" size="large" onClick={handleSave}>
          Save Settings
        </Button>
      </Box>
    </Container>
  );
}

import { Alert, AlertText } from "@/components/ui/alert";
import { Button, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";
import { useState, useEffect } from 'react';
import { ScrollView, View, Pressable, Alert as RNAlert, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSettings, saveSettings, generateId } from '../src/services/storage/index';
import type { Settings, Topic } from '../src/types';
import {
  DEFAULT_DAILY_SUMMARY_SYSTEM_PROMPT,
  DEFAULT_DAILY_SUMMARY_USER_PROMPT,
  DEFAULT_BOOK_RECOMMENDATIONS_SYSTEM_PROMPT,
  DEFAULT_BOOK_RECOMMENDATIONS_USER_PROMPT,
} from '../src/services/agent';
import { theme } from '../src/theme/index';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<Settings>({
    anthropicApiKey: '',
    corsProxyUrl: 'https://your-worker.workers.dev',
    topics: [],
  });
  const [saved, setSaved] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [showPromptCustomization, setShowPromptCustomization] = useState(false);

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
      RNAlert.alert('Maximum Topics', 'Maximum 3 topics allowed');
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
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Box className="p-4">
        <Text className="text-2xl font-bold mb-4">
          Settings
        </Text>

        {saved && (
          <Alert action="success" variant="solid" className="mb-4">
            <AlertText>Settings saved successfully!</AlertText>
          </Alert>
        )}

        {/* API Configuration */}
        <Box className="bg-backgroundLight p-4 rounded-xs mb-4">
          <Text className="text-lg font-bold mb-3">
            API Configuration
          </Text>
          <Text className="text-sm mb-2">Anthropic API Key</Text>
          <Input className="mb-3">
            <InputField
              placeholder="sk-ant-..."
              value={settings.anthropicApiKey}
              onChangeText={(text) =>
                setSettings({ ...settings, anthropicApiKey: text })
              }
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Input>
          <Text className="text-xs text-textSecondary mb-4">
            Your API key is stored locally in your browser
          </Text>

          <Text className="text-sm mb-2">CORS Proxy URL</Text>
          <Input className="mb-3">
            <InputField
              placeholder="https://your-worker.workers.dev"
              value={settings.corsProxyUrl}
              onChangeText={(text) =>
                setSettings({ ...settings, corsProxyUrl: text })
              }
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Input>
          <Text className="text-xs text-textSecondary">
            URL of your Cloudflare Worker proxy (required for fetching RSS feeds and article content)
          </Text>
        </Box>

        {/* Topics */}
        <Box className="bg-backgroundLight p-4 rounded-xs mb-4">
          <Text className="text-lg font-bold mb-2">
            Topics ({settings.topics.length}/3)
          </Text>
          <Text className="text-sm text-textSecondary mb-3">
            Configure up to 3 topics with RSS feeds for each
          </Text>

          <Box className="flex-row gap-2 mb-3">
            <Box className="flex-1">
              <Input>
                <InputField
                  placeholder="New Topic Name"
                  value={newTopicName}
                  onChangeText={setNewTopicName}
                  editable={settings.topics.length < 3}
                />
              </Input>
            </Box>
            <Button
              onPress={handleAddTopic}
              isDisabled={settings.topics.length >= 3 || !newTopicName.trim()}
              className="bg-primary-400"
            >
              <Ionicons name="add" size={20} color="white" />
            </Button>
          </Box>

          {settings.topics.map((topic) => (
            <Pressable
              key={topic.id}
              onPress={() => setSelectedTopicId(topic.id)}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 12,
                backgroundColor: selectedTopicId === topic.id ? '#f0f0f0' : 'transparent',
                borderRadius: 8,
                marginBottom: 8,
              }}
            >
              <Box className="flex-1">
                <Text className="font-semibold">{topic.name}</Text>
                <Text className="text-xs text-textSecondary">
                  {topic.rssFeeds.length} RSS feeds
                </Text>
              </Box>
              <Pressable
                onPress={() => handleDeleteTopic(topic.id)}
                style={{ padding: 8 }}
              >
                <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
              </Pressable>
            </Pressable>
          ))}
        </Box>

        {/* RSS Feeds for Selected Topic */}
        {selectedTopic && (
          <Box className="bg-backgroundLight p-4 rounded-xs mb-4">
            <Text className="text-lg font-bold mb-3">
              RSS Feeds for "{selectedTopic.name}"
            </Text>

            <Box className="flex-row gap-2 mb-3">
              <Box className="flex-1">
                <Input>
                  <InputField
                    placeholder="https://example.com/feed.xml"
                    value={newFeedUrl}
                    onChangeText={setNewFeedUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </Input>
              </Box>
              <Button
                onPress={handleAddFeed}
                isDisabled={!newFeedUrl.trim()}
                className="bg-primary-400"
              >
                <Ionicons name="add" size={20} color="white" />
              </Button>
            </Box>

            {selectedTopic.rssFeeds.map((feed, idx) => (
              <Box
                key={idx}
                className={` ${idx < selectedTopic.rssFeeds.length - 1 ? "border" : "border-b-[0px]"} flex-row justify-between items-center p-3 border-b-gray-200 `}>
                <Text style={{ wordBreak: 'break-all' }} className="flex-1 text-sm">
                  {feed}
                </Text>
                <Pressable
                  onPress={() => handleDeleteFeed(selectedTopic.id, feed)}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                </Pressable>
              </Box>
            ))}
          </Box>
        )}

        {/* Prompt Customization */}
        <Box className="bg-backgroundLight p-4 rounded-xs mb-4">
          <Pressable
            onPress={() => setShowPromptCustomization(!showPromptCustomization)}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text className="text-lg font-bold">
              Prompt Customization
            </Text>
            <Ionicons
              name={showPromptCustomization ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={theme.colors.textPrimary}
            />
          </Pressable>

          {showPromptCustomization && (
            <Box className="mt-4">
              <Text className="text-sm text-textSecondary mb-4">
                Customize the AI prompts used for generating summaries and book recommendations. Leave empty to use defaults.
              </Text>

              <Text className="text-sm font-semibold mb-2">
                Daily Summary System Prompt
              </Text>
              <Input className="mb-2">
                <InputField
                  placeholder={DEFAULT_DAILY_SUMMARY_SYSTEM_PROMPT}
                  value={settings.dailySummarySystemPrompt ?? ''}
                  onChangeText={(text) =>
                    setSettings({
                      ...settings,
                      dailySummarySystemPrompt: text || undefined,
                    })
                  }
                  multiline
                  numberOfLines={4}
                />
              </Input>
              {settings.dailySummarySystemPrompt && (
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() =>
                    setSettings({ ...settings, dailySummarySystemPrompt: undefined })
                  }
                  className="mb-4"
                >
                  <ButtonText>Reset to Default</ButtonText>
                </Button>
              )}

              <Text className="text-sm font-semibold mb-2 mt-3">
                Daily Summary User Prompt
              </Text>
              <Input className="mb-2">
                <InputField
                  placeholder={DEFAULT_DAILY_SUMMARY_USER_PROMPT}
                  value={settings.dailySummaryUserPrompt ?? ''}
                  onChangeText={(text) =>
                    setSettings({
                      ...settings,
                      dailySummaryUserPrompt: text || undefined,
                    })
                  }
                  multiline
                  numberOfLines={4}
                />
              </Input>
              {settings.dailySummaryUserPrompt && (
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() =>
                    setSettings({ ...settings, dailySummaryUserPrompt: undefined })
                  }
                  className="mb-4"
                >
                  <ButtonText>Reset to Default</ButtonText>
                </Button>
              )}

              <Text className="text-sm font-semibold mb-2 mt-3">
                Book Recommendations System Prompt
              </Text>
              <Input className="mb-2">
                <InputField
                  placeholder={DEFAULT_BOOK_RECOMMENDATIONS_SYSTEM_PROMPT}
                  value={settings.bookRecommendationsSystemPrompt ?? ''}
                  onChangeText={(text) =>
                    setSettings({
                      ...settings,
                      bookRecommendationsSystemPrompt: text || undefined,
                    })
                  }
                  multiline
                  numberOfLines={4}
                />
              </Input>
              {settings.bookRecommendationsSystemPrompt && (
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() =>
                    setSettings({
                      ...settings,
                      bookRecommendationsSystemPrompt: undefined,
                    })
                  }
                  className="mb-4"
                >
                  <ButtonText>Reset to Default</ButtonText>
                </Button>
              )}

              <Text className="text-sm font-semibold mb-2 mt-3">
                Book Recommendations User Prompt
              </Text>
              <Input className="mb-2">
                <InputField
                  placeholder={DEFAULT_BOOK_RECOMMENDATIONS_USER_PROMPT}
                  value={settings.bookRecommendationsUserPrompt ?? ''}
                  onChangeText={(text) =>
                    setSettings({
                      ...settings,
                      bookRecommendationsUserPrompt: text || undefined,
                    })
                  }
                  multiline
                  numberOfLines={4}
                />
              </Input>
              {settings.bookRecommendationsUserPrompt && (
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() =>
                    setSettings({
                      ...settings,
                      bookRecommendationsUserPrompt: undefined,
                    })
                  }
                  className="mb-4"
                >
                  <ButtonText>Reset to Default</ButtonText>
                </Button>
              )}
            </Box>
          )}
        </Box>

        {/* Save Button */}
        <Box className="flex-row justify-end">
          <Button size="lg" onPress={handleSave} className="bg-primary-400">
            <ButtonText>Save Settings</ButtonText>
          </Button>
        </Box>
      </Box>
    </ScrollView>
  );
}

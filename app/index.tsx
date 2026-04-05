import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Alert, AlertText } from "@/components/ui/alert";
import { useState, useEffect } from 'react';
import { ScrollView, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSettings, getTodaysSummary } from '../src/services/storage/index';
import MtnLogo from '../components/MtnLogo';
import UserMenu from '../src/components/UserMenu';
import type { Settings } from '../src/types';
import { theme } from '../src/theme/index';

export default function HomeScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [topicMetadata, setTopicMetadata] = useState<Record<string, { lastGenerated?: string }>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings && settings.topics.length > 0) {
      loadTopicMetadata();
    }
  }, [settings]);

  async function loadSettings() {
    const stored = await getSettings();
    setSettings(stored);
  }

  async function loadTopicMetadata() {
    if (!settings) return;

    const metadata: Record<string, { lastGenerated?: string }> = {};
    
    for (const topic of settings.topics) {
      const summary = await getTodaysSummary(topic.id);
      if (summary) {
        const hours = Math.floor((Date.now() - summary.generatedAt) / (1000 * 60 * 60));
        metadata[topic.id] = {
          lastGenerated: hours === 0 ? 'just now' : hours === 1 ? '1 hour ago' : `${hours} hours ago`,
        };
      }
    }
    
    setTopicMetadata(metadata);
  }

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
        <MtnLogo size={32} />
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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
        {!settings || settings.topics.length === 0 ? (
          <Alert action="info" variant="solid">
            <AlertText>
              Welcome to MTN! Please configure your topics in Settings to get started.
            </AlertText>
          </Alert>
        ) : (
          <Box className="gap-4">
            {settings.topics.map((topic) => (
              <Pressable
                key={topic.id}
                onPress={() => router.push(`/${topic.id}`)}
                style={{
                  backgroundColor: theme.colors.backgroundLight,
                  borderRadius: 12,
                  padding: 24,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <Text
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 24,
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    marginBottom: 8,
                    color: theme.colors.textPrimary,
                  }}
                >
                  {topic.name}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: theme.colors.textSecondary,
                  }}
                >
                  {topic.rssFeeds.length} {topic.rssFeeds.length === 1 ? 'feed' : 'feeds'}
                  {topicMetadata[topic.id]?.lastGenerated
                    ? ` · Updated ${topicMetadata[topic.id].lastGenerated}`
                    : ' · No summary yet'}
                </Text>
              </Pressable>
            ))}
          </Box>
        )}
      </ScrollView>
    </View>
  );
}

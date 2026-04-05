import { Text } from "@/components/ui/text";
import { View, Pressable } from 'react-native';
import type { Topic } from '../types';

interface TopicTabsProps {
  topics: Topic[];
  selectedTopicIndex: number;
  onChange: (index: number) => void;
}

export default function TopicTabs({ topics, selectedTopicIndex, onChange }: TopicTabsProps) {
  if (topics.length <= 1) {
    return null;
  }

  return (
    <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
      {topics.map((topic, index) => (
        <Pressable
          key={topic.id}
          onPress={() => onChange(index)}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderBottomWidth: 2,
            borderBottomColor: selectedTopicIndex === index ? '#919789' : 'transparent',
          }}
        >
          <Text
            style={{
              textTransform: 'uppercase',
              letterSpacing: 1,
              fontFamily: 'Source Sans Pro, "Helvetica Neue", Arial, sans-serif',
            }}
            className={` ${selectedTopicIndex === index ? "text-primary-600" : "text-textSecondary"} ${selectedTopicIndex === index ? "font-bold" : "font-semibold"} text-sm `}>
            {topic.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

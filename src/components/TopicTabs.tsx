import { Tabs, Tab } from '@mui/material';
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
    <Tabs
      value={selectedTopicIndex}
      onChange={(_, newValue) => onChange(newValue)}
      sx={{ mb: 3 }}
    >
      {topics.map((topic) => (
        <Tab key={topic.id} label={topic.name} />
      ))}
    </Tabs>
  );
}

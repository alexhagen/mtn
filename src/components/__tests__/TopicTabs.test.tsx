import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import TopicTabs from '../TopicTabs'
import type { Topic } from '../../types'

describe('TopicTabs Component', () => {
  const mockTopics: Topic[] = [
    { id: '1', name: 'Technology', rssFeeds: ['https://example.com/tech'] },
    { id: '2', name: 'Science', rssFeeds: ['https://example.com/science'] },
    { id: '3', name: 'Politics', rssFeeds: ['https://example.com/politics'] },
  ]

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>)
  }

  it('should render all topic tabs', () => {
    renderWithRouter(<TopicTabs topics={mockTopics} />)
    
    expect(screen.getByText('Technology')).toBeInTheDocument()
    expect(screen.getByText('Science')).toBeInTheDocument()
    expect(screen.getByText('Politics')).toBeInTheDocument()
  })

  it('should render empty state when no topics provided', () => {
    renderWithRouter(<TopicTabs topics={[]} />)
    
    // Should not crash, may show empty tabs or placeholder
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('should handle single topic', () => {
    const singleTopic = [mockTopics[0]]
    renderWithRouter(<TopicTabs topics={singleTopic} />)
    
    expect(screen.getByText('Technology')).toBeInTheDocument()
    expect(screen.queryByText('Science')).not.toBeInTheDocument()
  })

  it('should render tabs with correct structure', () => {
    renderWithRouter(<TopicTabs topics={mockTopics} />)
    
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
  })
})

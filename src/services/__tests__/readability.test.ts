import { describe, it, expect } from 'vitest'
import { countWords, isLongForm } from '../readability'

describe('Readability Service', () => {
  describe('countWords', () => {
    it('should count words in plain text', () => {
      const text = 'This is a simple test'
      expect(countWords(text)).toBe(5)
    })

    it('should count words with HTML tags removed', () => {
      const html = '<p>This is <strong>bold</strong> text</p>'
      expect(countWords(html)).toBe(4)
    })

    it('should handle multiple spaces', () => {
      const text = 'This   has    multiple     spaces'
      expect(countWords(text)).toBe(4)
    })

    it('should handle empty string', () => {
      expect(countWords('')).toBe(0)
    })

    it('should handle only whitespace', () => {
      expect(countWords('   \n  \t  ')).toBe(0)
    })

    it('should handle complex HTML', () => {
      const html = `
        <div>
          <h1>Title</h1>
          <p>First paragraph with <a href="#">link</a>.</p>
          <p>Second paragraph.</p>
        </div>
      `
      expect(countWords(html)).toBe(7)
    })
  })

  describe('isLongForm', () => {
    it('should return true for articles over 4000 words', () => {
      expect(isLongForm(4001)).toBe(true)
      expect(isLongForm(5000)).toBe(true)
      expect(isLongForm(10000)).toBe(true)
    })

    it('should return false for articles under 4000 words', () => {
      expect(isLongForm(3999)).toBe(false)
      expect(isLongForm(2000)).toBe(false)
      expect(isLongForm(100)).toBe(false)
    })

    it('should return false for exactly 4000 words', () => {
      expect(isLongForm(4000)).toBe(false)
    })

    it('should handle zero words', () => {
      expect(isLongForm(0)).toBe(false)
    })
  })
})

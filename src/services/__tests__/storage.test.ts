import { describe, it, expect } from 'vitest'
import { getMonthKey, generateId, getCurrentQuarter } from '../storage'

describe('Storage Service', () => {
  describe('getMonthKey', () => {
    it('should generate month key for current date', () => {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const expected = `${year}-${month}`
      
      expect(getMonthKey()).toBe(expected)
    })

    it('should generate month key for specific date', () => {
      const date = new Date('2024-03-15')
      expect(getMonthKey(date)).toBe('2024-03')
    })

    it('should pad single digit months', () => {
      const date = new Date('2024-01-15')
      expect(getMonthKey(date)).toBe('2024-01')
    })

    it('should handle December', () => {
      const date = new Date('2024-12-31')
      expect(getMonthKey(date)).toBe('2024-12')
    })
  })

  describe('generateId', () => {
    it('should generate a unique ID', () => {
      const id1 = generateId()
      const id2 = generateId()
      
      expect(id1).not.toBe(id2)
    })

    it('should generate ID with timestamp and random part', () => {
      const id = generateId()
      
      expect(id).toMatch(/^\d+-[a-z0-9]+$/)
    })

    it('should generate IDs with different timestamps', async () => {
      const id1 = generateId()
      await new Promise(resolve => setTimeout(resolve, 10))
      const id2 = generateId()
      
      const timestamp1 = parseInt(id1.split('-')[0])
      const timestamp2 = parseInt(id2.split('-')[0])
      
      expect(timestamp2).toBeGreaterThanOrEqual(timestamp1)
    })
  })

  describe('getCurrentQuarter', () => {
    it('should return current quarter', async () => {
      const quarter = await getCurrentQuarter()
      const now = new Date()
      const year = now.getFullYear()
      const q = Math.floor(now.getMonth() / 3) + 1
      
      expect(quarter).toBe(`${year}-Q${q}`)
    })

    it('should format quarter correctly', async () => {
      const quarter = await getCurrentQuarter()
      expect(quarter).toMatch(/^\d{4}-Q[1-4]$/)
    })
  })
})

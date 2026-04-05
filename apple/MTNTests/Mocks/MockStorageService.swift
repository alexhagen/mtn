import Foundation
@testable import MTN

/// Mock storage service for testing
/// Stores all data in memory for fast, isolated tests
class MockStorageService: StorageProtocol {
    // In-memory storage
    private var settings: AppSettings?
    private var articles: [SavedArticle] = []
    private var summaries: [DailySummary] = []
    private var bookLists: [BookList] = []
    
    // MARK: - Settings
    
    func getSettings() async throws -> AppSettings? {
        return settings
    }
    
    func saveSettings(_ settings: AppSettings) async throws {
        self.settings = settings
    }
    
    // MARK: - Articles
    
    func saveArticle(_ article: SavedArticle) async throws {
        if let index = articles.firstIndex(where: { $0.id == article.id }) {
            articles[index] = article
        } else {
            articles.append(article)
        }
    }
    
    func getArticlesByMonth(_ monthKey: String) async throws -> [SavedArticle] {
        return articles.filter { $0.monthKey == monthKey }
    }
    
    func deleteArticle(_ article: SavedArticle) async throws {
        articles.removeAll { $0.id == article.id }
    }
    
    func getAllArticles() async throws -> [SavedArticle] {
        return articles
    }
    
    // MARK: - Summaries
    
    func saveSummary(_ summary: DailySummary) async throws {
        if let index = summaries.firstIndex(where: { $0.id == summary.id }) {
            summaries[index] = summary
        } else {
            summaries.append(summary)
        }
        // Remove expired
        summaries.removeAll { $0.isExpired }
    }
    
    func getSummaryByTopic(_ topicId: String) async throws -> DailySummary? {
        return summaries
            .filter { $0.topicId == topicId && !$0.isExpired }
            .sorted { $0.generatedAt > $1.generatedAt }
            .first
    }
    
    func getAllSummaries() async throws -> [DailySummary] {
        return summaries.filter { !$0.isExpired }
    }
    
    func deleteSummary(_ summary: DailySummary) async throws {
        summaries.removeAll { $0.id == summary.id }
    }
    
    func cleanupExpiredSummaries() async throws {
        summaries.removeAll { $0.isExpired }
    }
    
    // MARK: - Topic Activity
    
    private var topicActivities: [TopicActivity] = []
    
    func logTopicActivity(_ topicId: String, _ topicName: String) async throws {
        let today = ISO8601DateFormatter().string(from: Date()).prefix(10) // YYYY-MM-DD
        let id = "\(topicId)-\(today)"
        
        if let index = topicActivities.firstIndex(where: { $0.id == id }) {
            topicActivities[index] = TopicActivity(id: id, topicId: topicId, topicName: topicName, generatedAt: String(today))
        } else {
            topicActivities.append(TopicActivity(id: id, topicId: topicId, topicName: topicName, generatedAt: String(today)))
        }
    }
    
    func getActiveTopicIdsForQuarter(_ quarter: String) async throws -> [String] {
        // Parse quarter to get date range
        let components = quarter.split(separator: "-")
        guard components.count == 2,
              let year = Int(components[0]),
              let quarterNum = Int(components[1].dropFirst()) else {
            return []
        }
        
        let startMonth = (quarterNum - 1) * 3 + 1
        let endMonth = startMonth + 2
        
        let startDate = String(format: "%04d-%02d-01", year, startMonth)
        let endDate = String(format: "%04d-%02d-31", year, endMonth)
        
        let activeInQuarter = topicActivities.filter { activity in
            activity.generatedAt >= startDate && activity.generatedAt <= endDate
        }
        
        let uniqueTopicIds = Array(Set(activeInQuarter.map { $0.topicId }))
        return uniqueTopicIds
    }
    
    // MARK: - Book Lists
    
    func saveBookList(_ bookList: BookList) async throws {
        if let index = bookLists.firstIndex(where: { $0.id == bookList.id }) {
            bookLists[index] = bookList
        } else {
            bookLists.append(bookList)
        }
    }
    
    func getBookListByQuarterAndTopic(_ quarter: String, _ topicId: String) async throws -> BookList? {
        return bookLists.first { $0.quarter == quarter && $0.topicId == topicId }
    }
    
    func getBookListsByQuarter(_ quarter: String) async throws -> [BookList] {
        return bookLists.filter { $0.quarter == quarter }
    }
    
    // MARK: - Test Helpers
    
    func reset() {
        settings = nil
        articles = []
        summaries = []
        bookLists = []
        topicActivities = []
    }
}

// MARK: - Helper Models

private struct TopicActivity {
    let id: String
    let topicId: String
    let topicName: String
    let generatedAt: String // ISO date string (YYYY-MM-DD)
}

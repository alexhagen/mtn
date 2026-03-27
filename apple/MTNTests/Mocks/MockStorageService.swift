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
    
    // MARK: - Book Lists
    
    func saveBookList(_ bookList: BookList) async throws {
        if let index = bookLists.firstIndex(where: { $0.id == bookList.id }) {
            bookLists[index] = bookList
        } else {
            bookLists.append(bookList)
        }
    }
    
    func getBookListByQuarter(_ quarter: String) async throws -> BookList? {
        return bookLists.first { $0.quarter == quarter }
    }
    
    // MARK: - Test Helpers
    
    func reset() {
        settings = nil
        articles = []
        summaries = []
        bookLists = []
    }
}

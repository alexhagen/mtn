import XCTest
@testable import MTN

final class LocalStorageServiceTests: XCTestCase {
    var storage: LocalStorageService!
    var tempDirectory: URL!
    
    override func setUpWithError() throws {
        // Create a temporary directory for test files
        tempDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDirectory, withIntermediateDirectories: true)
        
        storage = LocalStorageService()
    }
    
    override func tearDownWithError() throws {
        // Clean up temporary directory
        if let tempDirectory = tempDirectory {
            try? FileManager.default.removeItem(at: tempDirectory)
        }
    }
    
    func testSaveAndRetrieveSettings() async throws {
        let settings = AppSettings(
            anthropicApiKey: "test-key",
            corsProxyUrl: "https://proxy.example.com",
            topics: [
                Topic(id: "1", name: "Technology", rssFeeds: ["https://example.com/feed"])
            ]
        )
        
        try await storage.saveSettings(settings)
        let retrieved = try await storage.getSettings()
        
        XCTAssertNotNil(retrieved)
        XCTAssertEqual(retrieved?.anthropicApiKey, "test-key")
        XCTAssertEqual(retrieved?.topics.count, 1)
        XCTAssertEqual(retrieved?.topics.first?.name, "Technology")
    }
    
    func testGetSettingsReturnsNilWhenNotExists() async throws {
        let settings = try await storage.getSettings()
        XCTAssertNil(settings)
    }
    
    func testSaveAndRetrieveArticle() async throws {
        let article = SavedArticle(
            id: "article-1",
            title: "Test Article",
            url: "https://example.com/article",
            content: "Article content",
            wordCount: 100,
            savedAt: Date(),
            monthKey: "2026-03"
        )
        
        try await storage.saveArticle(article)
        let articles = try await storage.getArticlesByMonth("2026-03")
        
        XCTAssertEqual(articles.count, 1)
        XCTAssertEqual(articles.first?.title, "Test Article")
    }
    
    func testGetArticlesByMonthFiltersCorrectly() async throws {
        let article1 = SavedArticle(
            id: "1",
            title: "March Article",
            url: "https://example.com/1",
            content: "Content",
            wordCount: 100,
            savedAt: Date(),
            monthKey: "2026-03"
        )
        
        let article2 = SavedArticle(
            id: "2",
            title: "April Article",
            url: "https://example.com/2",
            content: "Content",
            wordCount: 100,
            savedAt: Date(),
            monthKey: "2026-04"
        )
        
        try await storage.saveArticle(article1)
        try await storage.saveArticle(article2)
        
        let marchArticles = try await storage.getArticlesByMonth("2026-03")
        XCTAssertEqual(marchArticles.count, 1)
        XCTAssertEqual(marchArticles.first?.title, "March Article")
    }
    
    func testDeleteArticle() async throws {
        let article = SavedArticle(
            id: "article-1",
            title: "Test",
            url: "https://example.com",
            content: "Content",
            wordCount: 100,
            savedAt: Date(),
            monthKey: "2026-03"
        )
        
        try await storage.saveArticle(article)
        try await storage.deleteArticle(article)
        
        let articles = try await storage.getAllArticles()
        XCTAssertEqual(articles.count, 0)
    }
    
    func testSaveAndRetrieveSummary() async throws {
        let summary = DailySummary(
            id: "summary-1",
            topicId: "topic-1",
            topicName: "Technology",
            summary: "# Daily Summary\n\nContent",
            generatedAt: Date(),
            expiresAt: Date().addingTimeInterval(7 * 24 * 60 * 60)
        )
        
        try await storage.saveSummary(summary)
        let retrieved = try await storage.getSummaryByTopic("topic-1")
        
        XCTAssertNotNil(retrieved)
        XCTAssertEqual(retrieved?.topicName, "Technology")
    }
    
    func testGetSummaryByTopicReturnsNilForExpired() async throws {
        let summary = DailySummary(
            id: "summary-1",
            topicId: "topic-1",
            topicName: "Technology",
            summary: "Content",
            generatedAt: Date().addingTimeInterval(-10 * 24 * 60 * 60),
            expiresAt: Date().addingTimeInterval(-1 * 24 * 60 * 60) // Expired yesterday
        )
        
        try await storage.saveSummary(summary)
        let retrieved = try await storage.getSummaryByTopic("topic-1")
        
        XCTAssertNil(retrieved)
    }
    
    func testCleanupExpiredSummaries() async throws {
        let validSummary = DailySummary(
            id: "valid",
            topicId: "topic-1",
            topicName: "Tech",
            summary: "Valid",
            generatedAt: Date(),
            expiresAt: Date().addingTimeInterval(7 * 24 * 60 * 60)
        )
        
        let expiredSummary = DailySummary(
            id: "expired",
            topicId: "topic-2",
            topicName: "Science",
            summary: "Expired",
            generatedAt: Date().addingTimeInterval(-10 * 24 * 60 * 60),
            expiresAt: Date().addingTimeInterval(-1 * 24 * 60 * 60)
        )
        
        try await storage.saveSummary(validSummary)
        try await storage.saveSummary(expiredSummary)
        try await storage.cleanupExpiredSummaries()
        
        let summaries = try await storage.getAllSummaries()
        XCTAssertEqual(summaries.count, 1)
        XCTAssertEqual(summaries.first?.id, "valid")
    }
    
    func testSaveAndRetrieveBookList() async throws {
        let bookList = BookList(
            id: "2026-Q1",
            quarter: "2026-Q1",
            books: [
                BookItem(
                    id: "book-1",
                    title: "Test Book",
                    author: "Test Author",
                    description: "Description",
                    purchaseLinks: ["amazon": "https://amazon.com/book"],
                    isRead: false
                )
            ],
            generatedAt: Date()
        )
        
        try await storage.saveBookList(bookList)
        let retrieved = try await storage.getBookListByQuarter("2026-Q1")
        
        XCTAssertNotNil(retrieved)
        XCTAssertEqual(retrieved?.books.count, 1)
        XCTAssertEqual(retrieved?.books.first?.title, "Test Book")
    }
}

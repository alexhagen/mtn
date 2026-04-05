import Foundation

/// Local storage implementation using JSON files
/// This is the original storage implementation, now conforming to StorageProtocol
@MainActor
class LocalStorageService: StorageProtocol {
    private let fileManager = FileManager.default
    private let documentsDirectory: URL
    
    init() {
        documentsDirectory = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
    
    // MARK: - Settings
    
    func getSettings() async throws -> AppSettings? {
        return load(from: documentsDirectory.appendingPathComponent("settings.json"))
    }
    
    func saveSettings(_ settings: AppSettings) async throws {
        save(settings, to: documentsDirectory.appendingPathComponent("settings.json"))
    }
    
    // MARK: - Articles
    
    func saveArticle(_ article: SavedArticle) async throws {
        var articles = try await getAllArticles()
        
        if let index = articles.firstIndex(where: { $0.id == article.id }) {
            articles[index] = article
        } else {
            articles.append(article)
        }
        
        save(articles, to: documentsDirectory.appendingPathComponent("articles.json"))
    }
    
    func getArticlesByMonth(_ monthKey: String) async throws -> [SavedArticle] {
        let allArticles = try await getAllArticles()
        return allArticles.filter { $0.monthKey == monthKey }
    }
    
    func deleteArticle(_ article: SavedArticle) async throws {
        var articles = try await getAllArticles()
        articles.removeAll { $0.id == article.id }
        save(articles, to: documentsDirectory.appendingPathComponent("articles.json"))
    }
    
    func getAllArticles() async throws -> [SavedArticle] {
        return load(from: documentsDirectory.appendingPathComponent("articles.json")) ?? []
    }
    
    // MARK: - Summaries
    
    func saveSummary(_ summary: DailySummary) async throws {
        var summaries = try await getAllSummaries()
        
        if let index = summaries.firstIndex(where: { $0.id == summary.id }) {
            summaries[index] = summary
        } else {
            summaries.append(summary)
        }
        
        // Remove expired summaries
        summaries.removeAll { $0.isExpired }
        
        save(summaries, to: documentsDirectory.appendingPathComponent("summaries.json"))
    }
    
    func getSummaryByTopic(_ topicId: String) async throws -> DailySummary? {
        let summaries = try await getAllSummaries()
        return summaries
            .filter { $0.topicId == topicId && !$0.isExpired }
            .sorted { $0.generatedAt > $1.generatedAt }
            .first
    }
    
    func deleteSummary(_ summary: DailySummary) async throws {
        var summaries = try await getAllSummaries()
        summaries.removeAll { $0.id == summary.id }
        save(summaries, to: documentsDirectory.appendingPathComponent("summaries.json"))
    }
    
    func getAllSummaries() async throws -> [DailySummary] {
        let loaded: [DailySummary] = load(from: documentsDirectory.appendingPathComponent("summaries.json")) ?? []
        return loaded.filter { !$0.isExpired }
    }
    
    func cleanupExpiredSummaries() async throws {
        let loaded: [DailySummary] = load(from: documentsDirectory.appendingPathComponent("summaries.json")) ?? []
        let nonExpired = loaded.filter { !$0.isExpired }
        save(nonExpired, to: documentsDirectory.appendingPathComponent("summaries.json"))
    }
    
    // MARK: - Topic Activity
    
    func logTopicActivity(_ topicId: String, _ topicName: String) async throws {
        var activities = try await getAllTopicActivities()
        let today = ISO8601DateFormatter().string(from: Date()).prefix(10) // YYYY-MM-DD
        let id = "\(topicId)-\(today)"
        
        // Upsert - only one entry per topic per day
        if let index = activities.firstIndex(where: { $0.id == id }) {
            activities[index] = TopicActivity(id: id, topicId: topicId, topicName: topicName, generatedAt: String(today))
        } else {
            activities.append(TopicActivity(id: id, topicId: topicId, topicName: topicName, generatedAt: String(today)))
        }
        
        save(activities, to: documentsDirectory.appendingPathComponent("topicActivity.json"))
    }
    
    func getActiveTopicIdsForQuarter(_ quarter: String) async throws -> [String] {
        let activities = try await getAllTopicActivities()
        
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
        
        // Filter activities in date range
        let activeInQuarter = activities.filter { activity in
            activity.generatedAt >= startDate && activity.generatedAt <= endDate
        }
        
        // Return unique topic IDs
        let uniqueTopicIds = Array(Set(activeInQuarter.map { $0.topicId }))
        return uniqueTopicIds
    }
    
    private func getAllTopicActivities() async throws -> [TopicActivity] {
        return load(from: documentsDirectory.appendingPathComponent("topicActivity.json")) ?? []
    }
    
    // MARK: - Book Lists
    
    func saveBookList(_ bookList: BookList) async throws {
        var bookLists = try await getAllBookLists()
        
        if let index = bookLists.firstIndex(where: { $0.id == bookList.id }) {
            bookLists[index] = bookList
        } else {
            bookLists.append(bookList)
        }
        
        save(bookLists, to: documentsDirectory.appendingPathComponent("bookLists.json"))
    }
    
    func getBookListByQuarterAndTopic(_ quarter: String, _ topicId: String) async throws -> BookList? {
        let bookLists = try await getAllBookLists()
        return bookLists.first { $0.quarter == quarter && $0.topicId == topicId }
    }
    
    func getBookListsByQuarter(_ quarter: String) async throws -> [BookList] {
        let bookLists = try await getAllBookLists()
        return bookLists.filter { $0.quarter == quarter }
    }
    
    private func getAllBookLists() async throws -> [BookList] {
        return load(from: documentsDirectory.appendingPathComponent("bookLists.json")) ?? []
    }
    
    // MARK: - Private Helpers
    
    private func save<T: Codable>(_ value: T, to url: URL) {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = .prettyPrinted
            let data = try encoder.encode(value)
            try data.write(to: url, options: .atomic)
        } catch {
            print("Error saving to \(url.lastPathComponent): \(error)")
        }
    }
    
    private func load<T: Codable>(from url: URL) -> T? {
        guard fileManager.fileExists(atPath: url.path) else {
            return nil
        }
        
        do {
            let data = try Data(contentsOf: url)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(T.self, from: data)
        } catch {
            print("Error loading from \(url.lastPathComponent): \(error)")
            return nil
        }
    }
}

// MARK: - Helper Models

private struct TopicActivity: Codable {
    let id: String
    let topicId: String
    let topicName: String
    let generatedAt: String // ISO date string (YYYY-MM-DD)
}

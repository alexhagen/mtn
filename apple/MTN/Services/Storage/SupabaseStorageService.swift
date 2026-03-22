import Foundation
import Supabase

/// Supabase storage implementation
/// Syncs data to Supabase Postgres with Row-Level Security
/// Note: Summaries are kept local only for performance
@MainActor
class SupabaseStorageService: StorageProtocol {
    private let client: SupabaseClient
    private let localStorage: LocalStorageService
    
    init(client: SupabaseClient) {
        self.client = client
        // Use local storage for summaries (not synced)
        self.localStorage = LocalStorageService()
    }
    
    // MARK: - Settings
    
    func getSettings() async throws -> AppSettings? {
        let user = try await client.auth.user()
        
        // Fetch user settings
        let settingsResponse: [UserSettingsRow] = try await client
            .from("user_settings")
            .select()
            .eq("user_id", value: user.id.uuidString)
            .execute()
            .value
        
        guard let settingsRow = settingsResponse.first else {
            return nil
        }
        
        // Fetch topics
        let topicsResponse: [TopicRow] = try await client
            .from("topics")
            .select()
            .eq("user_id", value: user.id.uuidString)
            .order("position")
            .execute()
            .value
        
        // Decrypt API key
        let apiKey = try await decryptApiKey(settingsRow.anthropicApiKeyEncrypted, userId: user.id.uuidString)
        
        return AppSettings(
            anthropicApiKey: apiKey,
            corsProxyUrl: settingsRow.corsProxyUrl,
            topics: topicsResponse.map { Topic(id: $0.id, name: $0.name, rssFeeds: $0.rssFeeds) },
            dailySummarySystemPrompt: settingsRow.dailySummarySystemPrompt,
            dailySummaryUserPrompt: settingsRow.dailySummaryUserPrompt,
            bookRecommendationsSystemPrompt: settingsRow.bookRecSystemPrompt,
            bookRecommendationsUserPrompt: settingsRow.bookRecUserPrompt
        )
    }
    
    func saveSettings(_ settings: AppSettings) async throws {
        let user = try await client.auth.user()
        
        // Encrypt API key
        let encryptedApiKey = try await encryptApiKey(settings.anthropicApiKey, userId: user.id.uuidString)
        
        // Upsert user settings
        let settingsData = UserSettingsRow(
            userId: user.id.uuidString,
            anthropicApiKeyEncrypted: encryptedApiKey,
            corsProxyUrl: settings.corsProxyUrl,
            dailySummarySystemPrompt: settings.dailySummarySystemPrompt,
            dailySummaryUserPrompt: settings.dailySummaryUserPrompt,
            bookRecSystemPrompt: settings.bookRecommendationsSystemPrompt,
            bookRecUserPrompt: settings.bookRecommendationsUserPrompt,
            createdAt: Date(),
            updatedAt: Date()
        )
        
        try await client
            .from("user_settings")
            .upsert(settingsData)
            .execute()
        
        // Get existing topics to determine what to delete
        let existingTopics: [TopicRow] = try await client
            .from("topics")
            .select("id")
            .eq("user_id", value: user.id.uuidString)
            .execute()
            .value
        
        let existingIds = existingTopics.map { $0.id }
        let newIds = settings.topics.map { $0.id }
        let toDelete = existingIds.filter { !newIds.contains($0) }
        
        // Delete removed topics
        if !toDelete.isEmpty {
            try await client
                .from("topics")
                .delete()
                .in("id", values: toDelete)
                .execute()
        }
        
        // Upsert topics
        for (index, topic) in settings.topics.enumerated() {
            let topicData = TopicRow(
                id: topic.id,
                userId: user.id.uuidString,
                name: topic.name,
                rssFeeds: topic.rssFeeds,
                position: index,
                createdAt: Date(),
                updatedAt: Date()
            )
            
            try await client
                .from("topics")
                .upsert(topicData)
                .execute()
        }
    }
    
    // MARK: - Articles
    
    func saveArticle(_ article: SavedArticle) async throws {
        let user = try await client.auth.user()
        
        let articleData = ArticleRow(
            id: article.id,
            userId: user.id.uuidString,
            title: article.title,
            url: article.url,
            content: article.content,
            wordCount: article.wordCount,
            monthKey: article.monthKey,
            savedAt: article.savedAt
        )
        
        try await client
            .from("articles")
            .upsert(articleData)
            .execute()
    }
    
    func getArticlesByMonth(_ monthKey: String) async throws -> [SavedArticle] {
        let user = try await client.auth.user()
        
        let response: [ArticleRow] = try await client
            .from("articles")
            .select()
            .eq("user_id", value: user.id.uuidString)
            .eq("month_key", value: monthKey)
            .order("saved_at", ascending: false)
            .execute()
            .value
        
        return response.map { SavedArticle(from: $0) }
    }
    
    func deleteArticle(_ article: SavedArticle) async throws {
        let user = try await client.auth.user()
        
        try await client
            .from("articles")
            .delete()
            .eq("id", value: article.id)
            .eq("user_id", value: user.id.uuidString)
            .execute()
    }
    
    func getAllArticles() async throws -> [SavedArticle] {
        let user = try await client.auth.user()
        
        let response: [ArticleRow] = try await client
            .from("articles")
            .select()
            .eq("user_id", value: user.id.uuidString)
            .order("saved_at", ascending: false)
            .execute()
            .value
        
        return response.map { SavedArticle(from: $0) }
    }
    
    // MARK: - Summaries (delegated to local storage - not synced)
    
    func saveSummary(_ summary: DailySummary) async throws {
        try await localStorage.saveSummary(summary)
    }
    
    func getSummaryByTopic(_ topicId: String) async throws -> DailySummary? {
        try await localStorage.getSummaryByTopic(topicId)
    }
    
    func deleteSummary(_ summary: DailySummary) async throws {
        try await localStorage.deleteSummary(summary)
    }
    
    // MARK: - Book Lists
    
    func saveBookList(_ bookList: BookList) async throws {
        let user = try await client.auth.user()
        
        let bookListData = BookListRow(
            id: bookList.id,
            userId: user.id.uuidString,
            quarter: bookList.quarter,
            books: bookList.books,
            generatedAt: bookList.generatedAt
        )
        
        try await client
            .from("book_lists")
            .upsert(bookListData)
            .execute()
    }
    
    func getBookListByQuarter(_ quarter: String) async throws -> BookList? {
        let user = try await client.auth.user()
        
        let response: [BookListRow] = try await client
            .from("book_lists")
            .select()
            .eq("user_id", value: user.id.uuidString)
            .eq("quarter", value: quarter)
            .execute()
            .value
        
        guard let row = response.first else {
            return nil
        }
        
        return BookList(from: row)
    }
    
    // MARK: - Encryption Helpers
    
    private func encryptApiKey(_ apiKey: String, userId: String) async throws -> String {
        // TODO: Implement proper encryption using CryptoKit
        // For now, use base64 encoding as placeholder
        guard let data = apiKey.data(using: .utf8) else {
            throw NSError(domain: "EncryptionError", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to encode API key"])
        }
        return data.base64EncodedString()
    }
    
    private func decryptApiKey(_ encrypted: String, userId: String) async throws -> String {
        // TODO: Implement proper decryption using CryptoKit
        // For now, use base64 decoding as placeholder
        guard let data = Data(base64Encoded: encrypted),
              let decrypted = String(data: data, encoding: .utf8) else {
            // Fallback: assume it's already decrypted
            return encrypted
        }
        return decrypted
    }
}

// MARK: - Database Row Types

private struct UserSettingsRow: Codable {
    let userId: String
    let anthropicApiKeyEncrypted: String
    let corsProxyUrl: String
    let dailySummarySystemPrompt: String?
    let dailySummaryUserPrompt: String?
    let bookRecSystemPrompt: String?
    let bookRecUserPrompt: String?
    let createdAt: Date
    let updatedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case anthropicApiKeyEncrypted = "anthropic_api_key_encrypted"
        case corsProxyUrl = "cors_proxy_url"
        case dailySummarySystemPrompt = "daily_summary_system_prompt"
        case dailySummaryUserPrompt = "daily_summary_user_prompt"
        case bookRecSystemPrompt = "book_rec_system_prompt"
        case bookRecUserPrompt = "book_rec_user_prompt"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

private struct TopicRow: Codable {
    let id: String
    let userId: String
    let name: String
    let rssFeeds: [String]
    let position: Int
    let createdAt: Date
    let updatedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id, name, position
        case userId = "user_id"
        case rssFeeds = "rss_feeds"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

private struct ArticleRow: Codable {
    let id: String
    let userId: String
    let title: String
    let url: String
    let content: String
    let wordCount: Int
    let monthKey: String
    let savedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id, title, url, content
        case userId = "user_id"
        case wordCount = "word_count"
        case monthKey = "month_key"
        case savedAt = "saved_at"
    }
}

private struct BookListRow: Codable {
    let id: String
    let userId: String
    let quarter: String
    let books: [BookItem]
    let generatedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id, quarter, books
        case userId = "user_id"
        case generatedAt = "generated_at"
    }
}

// MARK: - Model Extensions

private extension SavedArticle {
    init(from row: ArticleRow) {
        self.init(
            id: row.id,
            title: row.title,
            url: row.url,
            content: row.content,
            wordCount: row.wordCount,
            savedAt: row.savedAt,
            monthKey: row.monthKey
        )
    }
}

private extension BookList {
    init(from row: BookListRow) {
        self.init(
            id: row.id,
            quarter: row.quarter,
            books: row.books,
            generatedAt: row.generatedAt
        )
    }
}

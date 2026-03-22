import Foundation

/// Supabase storage implementation using URLSession REST API directly
/// Syncs data to Supabase Postgres with Row-Level Security
/// Note: Summaries are kept local only for performance
/// Uses URLSession instead of supabase-swift SDK for Swift 5.7 / Xcode 14 compatibility
@MainActor
class SupabaseStorageService: StorageProtocol {
    private let supabaseURL: String
    private let supabaseAnonKey: String
    private let auth: AuthService
    private let localStorage: LocalStorageService

    init(auth: AuthService) {
        self.supabaseURL = Configuration.supabaseURL
        self.supabaseAnonKey = Configuration.supabaseAnonKey
        self.auth = auth
        self.localStorage = LocalStorageService()
    }

    // MARK: - Request Helpers

    private func makeRequest(
        path: String,
        method: String = "GET",
        body: Data? = nil,
        queryParams: [String: String] = [:]
    ) throws -> URLRequest {
        guard let accessToken = auth.getAccessToken() else {
            throw StorageError.notAuthenticated
        }

        var urlString = "\(supabaseURL)/rest/v1/\(path)"
        if !queryParams.isEmpty {
            let query = queryParams.map { "\($0.key)=\($0.value)" }.joined(separator: "&")
            urlString += "?\(query)"
        }

        guard let url = URL(string: urlString) else {
            throw StorageError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("return=representation", forHTTPHeaderField: "Prefer")

        if let body = body {
            request.httpBody = body
        }

        return request
    }

    private func getUserId() throws -> String {
        guard let userId = auth.getUserId() else {
            throw StorageError.notAuthenticated
        }
        return userId
    }

    private func performRequest(_ request: URLRequest) async throws -> Data {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw StorageError.httpError(statusCode)
        }
        return data
    }

    // MARK: - Settings

    func getSettings() async throws -> AppSettings? {
        let userId = try getUserId()

        // Fetch user settings
        var request = try makeRequest(
            path: "user_settings",
            queryParams: [
                "user_id": "eq.\(userId)",
                "select": "*"
            ]
        )
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let data = try await performRequest(request)
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601

        let settingsRows = try decoder.decode([UserSettingsRow].self, from: data)
        guard let settingsRow = settingsRows.first else {
            return nil
        }

        // Fetch topics
        var topicsRequest = try makeRequest(
            path: "topics",
            queryParams: [
                "user_id": "eq.\(userId)",
                "select": "*",
                "order": "position.asc"
            ]
        )
        topicsRequest.setValue("application/json", forHTTPHeaderField: "Accept")

        let topicsData = try await performRequest(topicsRequest)
        let topicsRows = try decoder.decode([TopicRow].self, from: topicsData)

        // Decrypt API key
        let apiKey = decryptApiKey(settingsRow.anthropicApiKeyEncrypted)

        return AppSettings(
            anthropicApiKey: apiKey,
            corsProxyUrl: settingsRow.corsProxyUrl,
            topics: topicsRows.map { Topic(id: $0.id, name: $0.name, rssFeeds: $0.rssFeeds) },
            dailySummarySystemPrompt: settingsRow.dailySummarySystemPrompt,
            dailySummaryUserPrompt: settingsRow.dailySummaryUserPrompt,
            bookRecommendationsSystemPrompt: settingsRow.bookRecSystemPrompt,
            bookRecommendationsUserPrompt: settingsRow.bookRecUserPrompt
        )
    }

    func saveSettings(_ settings: AppSettings) async throws {
        let userId = try getUserId()
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .iso8601

        // Encrypt API key
        let encryptedApiKey = encryptApiKey(settings.anthropicApiKey)

        // Upsert user settings
        let settingsData = UserSettingsRow(
            userId: userId,
            anthropicApiKeyEncrypted: encryptedApiKey,
            corsProxyUrl: settings.corsProxyUrl,
            dailySummarySystemPrompt: settings.dailySummarySystemPrompt,
            dailySummaryUserPrompt: settings.dailySummaryUserPrompt,
            bookRecSystemPrompt: settings.bookRecommendationsSystemPrompt,
            bookRecUserPrompt: settings.bookRecommendationsUserPrompt,
            createdAt: Date(),
            updatedAt: Date()
        )

        var upsertRequest = try makeRequest(path: "user_settings", method: "POST")
        upsertRequest.setValue("resolution=merge-duplicates", forHTTPHeaderField: "Prefer")
        upsertRequest.httpBody = try encoder.encode(settingsData)
        _ = try await performRequest(upsertRequest)

        // Get existing topics to determine what to delete
        var existingRequest = try makeRequest(
            path: "topics",
            queryParams: [
                "user_id": "eq.\(userId)",
                "select": "id"
            ]
        )
        existingRequest.setValue("application/json", forHTTPHeaderField: "Accept")
        let existingData = try await performRequest(existingRequest)

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let existingTopics = try decoder.decode([[String: String]].self, from: existingData)
        let existingIds = existingTopics.compactMap { $0["id"] }
        let newIds = settings.topics.map { $0.id }
        let toDelete = existingIds.filter { !newIds.contains($0) }

        // Delete removed topics
        for idToDelete in toDelete {
            let deleteRequest = try makeRequest(
                path: "topics",
                method: "DELETE",
                queryParams: ["id": "eq.\(idToDelete)"]
            )
            _ = try await performRequest(deleteRequest)
        }

        // Upsert topics
        for (index, topic) in settings.topics.enumerated() {
            let topicData = TopicRow(
                id: topic.id,
                userId: userId,
                name: topic.name,
                rssFeeds: topic.rssFeeds,
                position: index,
                createdAt: Date(),
                updatedAt: Date()
            )

            var topicRequest = try makeRequest(path: "topics", method: "POST")
            topicRequest.setValue("resolution=merge-duplicates", forHTTPHeaderField: "Prefer")
            topicRequest.httpBody = try encoder.encode(topicData)
            _ = try await performRequest(topicRequest)
        }
    }

    // MARK: - Articles

    func saveArticle(_ article: SavedArticle) async throws {
        let userId = try getUserId()
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .iso8601

        let articleData = ArticleRow(
            id: article.id,
            userId: userId,
            title: article.title,
            url: article.url,
            content: article.content,
            wordCount: article.wordCount,
            monthKey: article.monthKey,
            savedAt: article.savedAt
        )

        var request = try makeRequest(path: "articles", method: "POST")
        request.setValue("resolution=merge-duplicates", forHTTPHeaderField: "Prefer")
        request.httpBody = try encoder.encode(articleData)
        _ = try await performRequest(request)
    }

    func getArticlesByMonth(_ monthKey: String) async throws -> [SavedArticle] {
        let userId = try getUserId()

        var request = try makeRequest(
            path: "articles",
            queryParams: [
                "user_id": "eq.\(userId)",
                "month_key": "eq.\(monthKey)",
                "order": "saved_at.desc"
            ]
        )
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let data = try await performRequest(request)
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601

        let rows = try decoder.decode([ArticleRow].self, from: data)
        return rows.map { SavedArticle(from: $0) }
    }

    func deleteArticle(_ article: SavedArticle) async throws {
        let userId = try getUserId()

        let request = try makeRequest(
            path: "articles",
            method: "DELETE",
            queryParams: [
                "id": "eq.\(article.id)",
                "user_id": "eq.\(userId)"
            ]
        )
        _ = try await performRequest(request)
    }

    func getAllArticles() async throws -> [SavedArticle] {
        let userId = try getUserId()

        var request = try makeRequest(
            path: "articles",
            queryParams: [
                "user_id": "eq.\(userId)",
                "order": "saved_at.desc"
            ]
        )
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let data = try await performRequest(request)
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601

        let rows = try decoder.decode([ArticleRow].self, from: data)
        return rows.map { SavedArticle(from: $0) }
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
        let userId = try getUserId()
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .iso8601

        let bookListData = BookListRow(
            id: bookList.id,
            userId: userId,
            quarter: bookList.quarter,
            books: bookList.books,
            generatedAt: bookList.generatedAt
        )

        var request = try makeRequest(path: "book_lists", method: "POST")
        request.setValue("resolution=merge-duplicates", forHTTPHeaderField: "Prefer")
        request.httpBody = try encoder.encode(bookListData)
        _ = try await performRequest(request)
    }

    func getBookListByQuarter(_ quarter: String) async throws -> BookList? {
        let userId = try getUserId()

        var request = try makeRequest(
            path: "book_lists",
            queryParams: [
                "user_id": "eq.\(userId)",
                "quarter": "eq.\(quarter)"
            ]
        )
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let data = try await performRequest(request)
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601

        let rows = try decoder.decode([BookListRow].self, from: data)
        guard let row = rows.first else { return nil }
        return BookList(from: row)
    }

    // MARK: - Encryption Helpers

    private func encryptApiKey(_ apiKey: String) -> String {
        // Base64 encoding as a simple obfuscation layer
        // TODO: Replace with CryptoKit AES-GCM when targeting iOS 13.4+
        guard let data = apiKey.data(using: .utf8) else { return apiKey }
        return data.base64EncodedString()
    }

    private func decryptApiKey(_ encrypted: String) -> String {
        guard let data = Data(base64Encoded: encrypted),
              let decrypted = String(data: data, encoding: .utf8) else {
            return encrypted // Fallback: assume already decrypted
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
}

private struct TopicRow: Codable {
    let id: String
    let userId: String
    let name: String
    let rssFeeds: [String]
    let position: Int
    let createdAt: Date
    let updatedAt: Date
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
}

private struct BookListRow: Codable {
    let id: String
    let userId: String
    let quarter: String
    let books: [BookItem]
    let generatedAt: Date
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

// MARK: - Storage Errors

enum StorageError: LocalizedError {
    case notAuthenticated
    case invalidURL
    case httpError(Int)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated: return "Not authenticated"
        case .invalidURL: return "Invalid URL"
        case .httpError(let code): return "HTTP error: \(code)"
        }
    }
}

import Foundation
import CryptoKit
import CommonCrypto

/// Supabase storage implementation using URLSession REST API directly
/// Syncs data to Supabase Postgres with Row-Level Security
/// Summaries are synced to cloud with 7-day retention and local fallback
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
            if let body = String(data: data, encoding: .utf8) {
                print("HTTP error \(statusCode): \(body)")
            }
            throw StorageError.httpError(statusCode)
        }
        return data
    }

    /// JSONDecoder configured to handle Supabase's fractional-second ISO8601 timestamps
    private func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        // Supabase returns timestamps like "2026-03-21T15:30:00.123456+00:00"
        // Swift's built-in .iso8601 strategy does NOT handle fractional seconds,
        // so we use a custom formatter that does.
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)
            // Try with fractional seconds first
            if let date = formatter.date(from: dateString) {
                return date
            }
            // Fallback: try without fractional seconds
            let fallbackFormatter = ISO8601DateFormatter()
            fallbackFormatter.formatOptions = [.withInternetDateTime]
            if let date = fallbackFormatter.date(from: dateString) {
                return date
            }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot decode date: \(dateString)"
            )
        }
        return decoder
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
        let decoder = makeDecoder()

        do {
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

            do {
                let topicsRows = try decoder.decode([TopicRow].self, from: topicsData)

                // Decrypt API key
                let apiKey = decryptApiKey(settingsRow.anthropicApiKeyEncrypted, userId: userId)

                return AppSettings(
                    anthropicApiKey: apiKey,
                    corsProxyUrl: settingsRow.corsProxyUrl,
                    topics: topicsRows.map { Topic(id: $0.id, name: $0.name, rssFeeds: $0.rssFeeds) },
                    dailySummarySystemPrompt: settingsRow.dailySummarySystemPrompt,
                    dailySummaryUserPrompt: settingsRow.dailySummaryUserPrompt,
                    bookRecommendationsSystemPrompt: settingsRow.bookRecSystemPrompt,
                    bookRecommendationsUserPrompt: settingsRow.bookRecUserPrompt
                )
            } catch {
                print("Error decoding topics: \(error)")
                if let rawJson = String(data: topicsData, encoding: .utf8) {
                    print("Raw topics JSON: \(rawJson)")
                }
                // Return settings without topics rather than failing entirely
                let apiKey = decryptApiKey(settingsRow.anthropicApiKeyEncrypted, userId: userId)
                return AppSettings(
                    anthropicApiKey: apiKey,
                    corsProxyUrl: settingsRow.corsProxyUrl,
                    topics: [],
                    dailySummarySystemPrompt: settingsRow.dailySummarySystemPrompt,
                    dailySummaryUserPrompt: settingsRow.dailySummaryUserPrompt,
                    bookRecommendationsSystemPrompt: settingsRow.bookRecSystemPrompt,
                    bookRecommendationsUserPrompt: settingsRow.bookRecUserPrompt
                )
            }
        } catch {
            print("Error decoding user_settings: \(error)")
            if let rawJson = String(data: data, encoding: .utf8) {
                print("Raw settings JSON: \(rawJson)")
            }
            throw error
        }
    }

    func saveSettings(_ settings: AppSettings) async throws {
        let userId = try getUserId()
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .iso8601

        // Encrypt API key using AES-256-GCM to match web app
        let encryptedApiKey = encryptApiKey(settings.anthropicApiKey, userId: userId)

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
        let decoder = makeDecoder()

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
        let decoder = makeDecoder()

        let rows = try decoder.decode([ArticleRow].self, from: data)
        return rows.map { SavedArticle(from: $0) }
    }

    // MARK: - Summaries (synced to Supabase with 7-day retention, local fallback)

    func saveSummary(_ summary: DailySummary) async throws {
        do {
            let userId = try getUserId()
            let encoder = JSONEncoder()
            encoder.keyEncodingStrategy = .convertToSnakeCase
            encoder.dateEncodingStrategy = .iso8601

            let summaryData = DailySummaryRow(
                id: summary.id,
                userId: userId,
                topicId: summary.topicId,
                topicName: summary.topicName,
                summary: summary.summary,
                generatedAt: summary.generatedAt,
                expiresAt: summary.expiresAt
            )

            var request = try makeRequest(path: "daily_summaries", method: "POST")
            request.setValue("resolution=merge-duplicates", forHTTPHeaderField: "Prefer")
            request.httpBody = try encoder.encode(summaryData)
            _ = try await performRequest(request)

            // Also save locally for offline access
            try await localStorage.saveSummary(summary)
        } catch {
            print("Error saving summary to Supabase, falling back to local: \(error)")
            // Fallback to local storage
            try await localStorage.saveSummary(summary)
        }
    }

    func getSummaryByTopic(_ topicId: String) async throws -> DailySummary? {
        do {
            let userId = try getUserId()
            let now = ISO8601DateFormatter().string(from: Date())

            var request = try makeRequest(
                path: "daily_summaries",
                queryParams: [
                    "user_id": "eq.\(userId)",
                    "topic_id": "eq.\(topicId)",
                    "expires_at": "gt.\(now)",
                    "order": "generated_at.desc",
                    "limit": "1"
                ]
            )
            request.setValue("application/json", forHTTPHeaderField: "Accept")

            let data = try await performRequest(request)
            let decoder = makeDecoder()

            let rows = try decoder.decode([DailySummaryRow].self, from: data)
            guard let row = rows.first else {
                // No cloud summary, check local
                return try await localStorage.getSummaryByTopic(topicId)
            }

            let summary = DailySummary(
                id: row.id,
                topicId: row.topicId,
                topicName: row.topicName,
                summary: row.summary,
                generatedAt: row.generatedAt,
                expiresAt: row.expiresAt
            )

            // Cache locally for offline access
            try await localStorage.saveSummary(summary)
            return summary
        } catch {
            print("Error fetching summary from Supabase, falling back to local: \(error)")
            return try await localStorage.getSummaryByTopic(topicId)
        }
    }

    func getAllSummaries() async throws -> [DailySummary] {
        do {
            let userId = try getUserId()
            let now = ISO8601DateFormatter().string(from: Date())

            var request = try makeRequest(
                path: "daily_summaries",
                queryParams: [
                    "user_id": "eq.\(userId)",
                    "expires_at": "gt.\(now)",
                    "order": "generated_at.desc"
                ]
            )
            request.setValue("application/json", forHTTPHeaderField: "Accept")

            let data = try await performRequest(request)
            let decoder = makeDecoder()

            let rows = try decoder.decode([DailySummaryRow].self, from: data)
            return rows.map { row in
                DailySummary(
                    id: row.id,
                    topicId: row.topicId,
                    topicName: row.topicName,
                    summary: row.summary,
                    generatedAt: row.generatedAt,
                    expiresAt: row.expiresAt
                )
            }
        } catch {
            print("Error fetching summaries from Supabase, falling back to local: \(error)")
            return try await localStorage.getAllSummaries()
        }
    }

    func deleteSummary(_ summary: DailySummary) async throws {
        do {
            let userId = try getUserId()
            let request = try makeRequest(
                path: "daily_summaries",
                method: "DELETE",
                queryParams: [
                    "id": "eq.\(summary.id)",
                    "user_id": "eq.\(userId)"
                ]
            )
            _ = try await performRequest(request)
        } catch {
            print("Error deleting summary from Supabase: \(error)")
        }
        // Always delete locally too
        try await localStorage.deleteSummary(summary)
    }

    func cleanupExpiredSummaries() async throws {
        do {
            let userId = try getUserId()
            let now = ISO8601DateFormatter().string(from: Date())
            let request = try makeRequest(
                path: "daily_summaries",
                method: "DELETE",
                queryParams: [
                    "user_id": "eq.\(userId)",
                    "expires_at": "lt.\(now)"
                ]
            )
            _ = try await performRequest(request)
        } catch {
            print("Error cleaning up expired summaries from Supabase: \(error)")
        }
        // Also cleanup local
        try await localStorage.cleanupExpiredSummaries()
    }

    // MARK: - Topic Activity

    func logTopicActivity(_ topicId: String, _ topicName: String) async throws {
        let userId = try getUserId()
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .iso8601

        let today = ISO8601DateFormatter().string(from: Date()).prefix(10) // YYYY-MM-DD
        let id = "\(topicId)-\(today)"

        let activityData = TopicActivityRow(
            id: id,
            userId: userId,
            topicId: topicId,
            topicName: topicName,
            generatedAt: String(today)
        )

        var request = try makeRequest(path: "topic_activity", method: "POST")
        request.setValue("resolution=merge-duplicates", forHTTPHeaderField: "Prefer")
        request.httpBody = try encoder.encode(activityData)
        _ = try await performRequest(request)
    }

    func getActiveTopicIdsForQuarter(_ quarter: String) async throws -> [String] {
        let userId = try getUserId()

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

        var request = try makeRequest(
            path: "topic_activity",
            queryParams: [
                "user_id": "eq.\(userId)",
                "generated_at": "gte.\(startDate),lte.\(endDate)",
                "select": "topic_id"
            ]
        )
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let data = try await performRequest(request)
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        let rows = try decoder.decode([[String: String]].self, from: data)
        let topicIds = rows.compactMap { $0["topicId"] }
        return Array(Set(topicIds)) // Return unique IDs
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
            topicId: bookList.topicId,
            topicName: bookList.topicName,
            books: bookList.books,
            generatedAt: bookList.generatedAt
        )

        var request = try makeRequest(path: "book_lists", method: "POST")
        request.setValue("resolution=merge-duplicates", forHTTPHeaderField: "Prefer")
        request.httpBody = try encoder.encode(bookListData)
        _ = try await performRequest(request)
    }

    func getBookListByQuarterAndTopic(_ quarter: String, _ topicId: String) async throws -> BookList? {
        let userId = try getUserId()

        var request = try makeRequest(
            path: "book_lists",
            queryParams: [
                "user_id": "eq.\(userId)",
                "quarter": "eq.\(quarter)",
                "topic_id": "eq.\(topicId)"
            ]
        )
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let data = try await performRequest(request)
        let decoder = makeDecoder()

        let rows = try decoder.decode([BookListRow].self, from: data)
        guard let row = rows.first else { return nil }
        return BookList(from: row)
    }

    func getBookListsByQuarter(_ quarter: String) async throws -> [BookList] {
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
        let decoder = makeDecoder()

        let rows = try decoder.decode([BookListRow].self, from: data)
        return rows.map { BookList(from: $0) }
    }

    // MARK: - Encryption Helpers
    //
    // The web app uses AES-256-GCM with PBKDF2 key derivation (100,000 iterations,
    // SHA-256, 16-byte salt, 12-byte IV). The encrypted payload is stored as:
    //   base64(salt[16] + iv[12] + ciphertext)
    //
    // We replicate the same scheme here using CryptoKit so that keys saved by the
    // web app can be read by the Swift app and vice-versa.

    private static let pbkdf2Iterations: UInt32 = 100_000
    private static let saltLength = 16
    private static let ivLength = 12

    /// Derives a 256-bit AES key from the user ID using PBKDF2-SHA256.
    private func deriveKey(userId: String, salt: Data) throws -> SymmetricKey {
        guard let passwordData = userId.data(using: .utf8) else {
            throw StorageError.encryptionError("Invalid user ID")
        }

        var derivedKey = Data(count: 32) // 256 bits
        let result = derivedKey.withUnsafeMutableBytes { derivedKeyBytes in
            salt.withUnsafeBytes { saltBytes in
                passwordData.withUnsafeBytes { passwordBytes in
                    CCKeyDerivationPBKDF(
                        CCPBKDFAlgorithm(kCCPBKDF2),
                        passwordBytes.baseAddress, passwordData.count,
                        saltBytes.baseAddress, salt.count,
                        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                        Self.pbkdf2Iterations,
                        derivedKeyBytes.baseAddress, 32
                    )
                }
            }
        }

        guard result == kCCSuccess else {
            throw StorageError.encryptionError("PBKDF2 derivation failed: \(result)")
        }

        return SymmetricKey(data: derivedKey)
    }

    /// Encrypts an API key using AES-256-GCM, matching the web app's encryption scheme.
    /// Output: base64(salt[16] + iv[12] + ciphertext+tag)
    private func encryptApiKey(_ apiKey: String, userId: String) -> String {
        guard !apiKey.isEmpty else { return apiKey }

        do {
            guard let plaintext = apiKey.data(using: .utf8) else { return apiKey }

            // Generate random salt and IV
            var saltBytes = [UInt8](repeating: 0, count: Self.saltLength)
            var ivBytes = [UInt8](repeating: 0, count: Self.ivLength)
            guard SecRandomCopyBytes(kSecRandomDefault, Self.saltLength, &saltBytes) == errSecSuccess,
                  SecRandomCopyBytes(kSecRandomDefault, Self.ivLength, &ivBytes) == errSecSuccess else {
                print("Failed to generate random bytes for encryption")
                return apiKey
            }

            let salt = Data(saltBytes)
            let iv = Data(ivBytes)

            let key = try deriveKey(userId: userId, salt: salt)
            let nonce = try AES.GCM.Nonce(data: iv)
            let sealedBox = try AES.GCM.seal(plaintext, using: key, nonce: nonce)

            // Combine: salt + iv + ciphertext+tag (combined includes tag appended)
            var combined = Data()
            combined.append(salt)
            combined.append(iv)
            combined.append(sealedBox.ciphertext)
            combined.append(sealedBox.tag)

            return combined.base64EncodedString()
        } catch {
            print("Encryption error: \(error)")
            // Fallback to base64 if encryption fails
            return apiKey.data(using: .utf8)?.base64EncodedString() ?? apiKey
        }
    }

    /// Decrypts an API key encrypted by the web app (AES-256-GCM + PBKDF2).
    /// Also handles legacy base64-only encoding as a fallback.
    private func decryptApiKey(_ encrypted: String, userId: String) -> String {
        guard !encrypted.isEmpty else { return encrypted }

        // Try AES-256-GCM decryption first (web app format)
        if let decrypted = tryAESGCMDecrypt(encrypted, userId: userId) {
            return decrypted
        }

        // Fallback: try plain base64 (legacy Swift app format)
        if let data = Data(base64Encoded: encrypted),
           let decoded = String(data: data, encoding: .utf8),
           !decoded.isEmpty {
            // Only accept if it looks like a real API key (not binary garbage)
            let isPrintable = decoded.unicodeScalars.allSatisfy { $0.value >= 32 && $0.value < 127 }
            if isPrintable {
                return decoded
            }
        }

        // Last resort: return as-is (already plaintext)
        return encrypted
    }

    private func tryAESGCMDecrypt(_ encrypted: String, userId: String) -> String? {
        guard let combined = Data(base64Encoded: encrypted) else { return nil }

        let minLength = Self.saltLength + Self.ivLength + 16 // 16 = min ciphertext + tag
        guard combined.count >= minLength else { return nil }

        do {
            let salt = combined.prefix(Self.saltLength)
            let iv = combined[Self.saltLength..<(Self.saltLength + Self.ivLength)]
            // AES-GCM tag is 16 bytes, appended after ciphertext
            let tagLength = 16
            let ciphertextWithTag = combined[(Self.saltLength + Self.ivLength)...]
            guard ciphertextWithTag.count >= tagLength else { return nil }

            let ciphertext = ciphertextWithTag.dropLast(tagLength)
            let tag = ciphertextWithTag.suffix(tagLength)

            let key = try deriveKey(userId: userId, salt: Data(salt))
            let nonce = try AES.GCM.Nonce(data: Data(iv))
            let sealedBox = try AES.GCM.SealedBox(nonce: nonce, ciphertext: ciphertext, tag: tag)
            let decryptedData = try AES.GCM.open(sealedBox, using: key)

            return String(data: decryptedData, encoding: .utf8)
        } catch {
            print("AES-GCM decryption failed: \(error)")
            return nil
        }
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
    let content: String?   // nullable in Supabase schema
    let wordCount: Int?    // nullable in Supabase schema
    let monthKey: String
    let savedAt: Date
}

private struct DailySummaryRow: Codable {
    let id: String
    let userId: String
    let topicId: String
    let topicName: String
    let summary: String
    let generatedAt: Date
    let expiresAt: Date
}

private struct TopicActivityRow: Codable {
    let id: String
    let userId: String
    let topicId: String
    let topicName: String
    let generatedAt: String // ISO date string (YYYY-MM-DD)
}

private struct BookListRow: Codable {
    let id: String
    let userId: String
    let quarter: String
    let topicId: String
    let topicName: String
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
            content: row.content ?? "",
            wordCount: row.wordCount ?? 0,
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
            topicId: row.topicId,
            topicName: row.topicName,
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
    case encryptionError(String)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated: return "Not authenticated"
        case .invalidURL: return "Invalid URL"
        case .httpError(let code): return "HTTP error: \(code)"
        case .encryptionError(let msg): return "Encryption error: \(msg)"
        }
    }
}

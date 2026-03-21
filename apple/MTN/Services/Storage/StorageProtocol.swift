import Foundation

/// Protocol defining storage operations for MTN
/// Supports both local (JSON files) and cloud (Supabase) storage
protocol StorageProtocol {
    // MARK: - Settings
    func getSettings() async throws -> AppSettings?
    func saveSettings(_ settings: AppSettings) async throws
    
    // MARK: - Articles
    func saveArticle(_ article: SavedArticle) async throws
    func getArticlesByMonth(_ monthKey: String) async throws -> [SavedArticle]
    func deleteArticle(_ article: SavedArticle) async throws
    func getAllArticles() async throws -> [SavedArticle]
    
    // MARK: - Summaries (local only - not synced)
    func saveSummary(_ summary: DailySummary) async throws
    func getSummaryByTopic(_ topicId: String) async throws -> DailySummary?
    func deleteSummary(_ summary: DailySummary) async throws
    
    // MARK: - Book Lists
    func saveBookList(_ bookList: BookList) async throws
    func getBookListByQuarter(_ quarter: String) async throws -> BookList?
}

// MARK: - Utility Extensions

extension StorageProtocol {
    /// Get current month key in YYYY-MM format
    static func getCurrentMonthKey() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM"
        return formatter.string(from: Date())
    }
    
    /// Get current quarter in YYYY-Q# format
    static func getCurrentQuarter() -> String {
        let calendar = Calendar.current
        let month = calendar.component(.month, from: Date())
        let year = calendar.component(.year, from: Date())
        let quarter = (month - 1) / 3 + 1
        return "\(year)-Q\(quarter)"
    }
}

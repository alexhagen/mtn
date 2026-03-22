import Foundation

/// Storage service facade that delegates to protocol-based backends
/// Switches between local and cloud storage based on auth state
@MainActor
class StorageService: ObservableObject {
    static let shared = StorageService()

    @Published var settings: AppSettings
    @Published var articles: [SavedArticle] = []
    @Published var summaries: [DailySummary] = []
    @Published var bookLists: [BookList] = []

    // Storage backend (local or cloud)
    private var backend: StorageProtocol

    // Track current mode
    private(set) var isCloudMode = false

    private init() {
        // Start with local storage
        backend = LocalStorageService()
        settings = AppSettings()

        // Load initial data synchronously from local storage
        Task {
            await loadInitialData()
        }
    }

    private func loadInitialData() async {
        do {
            settings = try await backend.getSettings() ?? AppSettings()
            articles = try await backend.getAllArticles()
            bookLists = try await getAllBookListsFromBackend()
        } catch {
            print("Error loading initial data: \(error)")
            settings = AppSettings()
        }
    }

    /// Switch to cloud storage (when user signs in)
    func switchToCloud(auth: AuthService) async {
        guard !isCloudMode else { return }

        backend = SupabaseStorageService(auth: auth)
        isCloudMode = true
        Configuration.storageMode = .cloud

        // Reload data from cloud
        await reloadAllData()
    }

    /// Switch to local storage (when user signs out)
    func switchToLocal() async {
        guard isCloudMode else { return }

        backend = LocalStorageService()
        isCloudMode = false
        Configuration.storageMode = .local

        // Reload data from local storage
        await reloadAllData()
    }

    /// Reload all data from current backend
    private func reloadAllData() async {
        do {
            settings = try await backend.getSettings() ?? AppSettings()
            articles = try await backend.getAllArticles()
            bookLists = try await getAllBookListsFromBackend()
        } catch {
            print("Error reloading data: \(error)")
        }
    }

    // MARK: - Settings

    func saveSettings() {
        Task {
            do {
                try await backend.saveSettings(settings)
            } catch {
                print("Error saving settings: \(error)")
            }
        }
    }

    // MARK: - Articles

    func saveArticle(_ article: SavedArticle) {
        Task {
            do {
                try await backend.saveArticle(article)
                // Update local cache
                if let index = articles.firstIndex(where: { $0.id == article.id }) {
                    articles[index] = article
                } else {
                    articles.append(article)
                }
            } catch {
                print("Error saving article: \(error)")
            }
        }
    }

    func deleteArticle(_ article: SavedArticle) {
        Task {
            do {
                try await backend.deleteArticle(article)
                // Update local cache
                articles.removeAll { $0.id == article.id }
            } catch {
                print("Error deleting article: \(error)")
            }
        }
    }

    func getArticlesByMonth(_ monthKey: String) -> [SavedArticle] {
        articles.filter { $0.monthKey == monthKey }
    }

    // MARK: - Summaries (always local - not synced)

    func saveSummary(_ summary: DailySummary) {
        Task {
            do {
                try await backend.saveSummary(summary)
                // Update local cache
                if let index = summaries.firstIndex(where: { $0.id == summary.id }) {
                    summaries[index] = summary
                } else {
                    summaries.append(summary)
                }
                // Remove expired summaries
                summaries.removeAll { $0.isExpired }
            } catch {
                print("Error saving summary: \(error)")
            }
        }
    }

    func getSummaryByTopic(_ topicId: String) -> DailySummary? {
        summaries
            .filter { $0.topicId == topicId && !$0.isExpired }
            .sorted { $0.generatedAt > $1.generatedAt }
            .first
    }

    // MARK: - Book Lists

    func saveBookList(_ bookList: BookList) {
        Task {
            do {
                try await backend.saveBookList(bookList)
                // Update local cache
                if let index = bookLists.firstIndex(where: { $0.id == bookList.id }) {
                    bookLists[index] = bookList
                } else {
                    bookLists.append(bookList)
                }
            } catch {
                print("Error saving book list: \(error)")
            }
        }
    }

    func getBookListByQuarter(_ quarter: String) -> BookList? {
        bookLists.first { $0.quarter == quarter }
    }

    private func getAllBookListsFromBackend() async throws -> [BookList] {
        // Note: StorageProtocol doesn't have getAllBookLists, so we return cached bookLists
        return bookLists
    }

    // MARK: - Utilities

    static func getCurrentMonthKey() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM"
        return formatter.string(from: Date())
    }

    static func getCurrentQuarter() -> String {
        let calendar = Calendar.current
        let month = calendar.component(.month, from: Date())
        let year = calendar.component(.year, from: Date())
        let quarter = (month - 1) / 3 + 1
        return "\(year)-Q\(quarter)"
    }
}

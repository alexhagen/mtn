import Foundation

struct AppSettings: Codable {
    var anthropicApiKey: String
    var corsProxyUrl: String
    var topics: [Topic]
    var dailySummarySystemPrompt: String?
    var dailySummaryUserPrompt: String?
    var bookRecommendationsSystemPrompt: String?
    var bookRecommendationsUserPrompt: String?
    
    init(
        anthropicApiKey: String = "",
        corsProxyUrl: String = "https://your-worker.workers.dev",
        topics: [Topic] = [],
        dailySummarySystemPrompt: String? = nil,
        dailySummaryUserPrompt: String? = nil,
        bookRecommendationsSystemPrompt: String? = nil,
        bookRecommendationsUserPrompt: String? = nil
    ) {
        self.anthropicApiKey = anthropicApiKey
        self.corsProxyUrl = corsProxyUrl
        self.topics = topics
        self.dailySummarySystemPrompt = dailySummarySystemPrompt
        self.dailySummaryUserPrompt = dailySummaryUserPrompt
        self.bookRecommendationsSystemPrompt = bookRecommendationsSystemPrompt
        self.bookRecommendationsUserPrompt = bookRecommendationsUserPrompt
    }
}

import Foundation

struct DailySummary: Codable, Identifiable, Hashable {
    let id: String
    var topicId: String
    var topicName: String
    var summary: String
    var generatedAt: Date
    var expiresAt: Date
    
    init(
        id: String = UUID().uuidString,
        topicId: String,
        topicName: String,
        summary: String,
        generatedAt: Date = Date(),
        expiresAt: Date
    ) {
        self.id = id
        self.topicId = topicId
        self.topicName = topicName
        self.summary = summary
        self.generatedAt = generatedAt
        self.expiresAt = expiresAt
    }
    
    var isExpired: Bool {
        Date() > expiresAt
    }
}

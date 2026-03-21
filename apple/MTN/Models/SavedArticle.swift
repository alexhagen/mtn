import Foundation

struct SavedArticle: Codable, Identifiable, Hashable {
    let id: String
    var title: String
    var url: String
    var content: String
    var wordCount: Int
    var savedAt: Date
    var monthKey: String // Format: YYYY-MM
    
    init(
        id: String = UUID().uuidString,
        title: String,
        url: String,
        content: String,
        wordCount: Int,
        savedAt: Date = Date(),
        monthKey: String
    ) {
        self.id = id
        self.title = title
        self.url = url
        self.content = content
        self.wordCount = wordCount
        self.savedAt = savedAt
        self.monthKey = monthKey
    }
    
    var isLongForm: Bool {
        wordCount > 4000
    }
}

import Foundation

struct RSSFeedItem: Codable, Identifiable, Hashable {
    let id: String
    var title: String
    var link: String
    var description: String?
    var pubDate: Date?
    var content: String?
    
    init(
        id: String = UUID().uuidString,
        title: String,
        link: String,
        description: String? = nil,
        pubDate: Date? = nil,
        content: String? = nil
    ) {
        self.id = id
        self.title = title
        self.link = link
        self.description = description
        self.pubDate = pubDate
        self.content = content
    }
}

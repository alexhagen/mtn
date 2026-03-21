import Foundation

struct Topic: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var rssFeeds: [String]
    
    init(id: String = UUID().uuidString, name: String, rssFeeds: [String] = []) {
        self.id = id
        self.name = name
        self.rssFeeds = rssFeeds
    }
}

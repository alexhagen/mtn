import Foundation

struct BookItem: Codable, Identifiable, Hashable {
    let id: String
    var title: String
    var author: String
    var description: String
    var amazonLink: String?
    var bookshopLink: String?
    var isRead: Bool
    
    init(
        id: String = UUID().uuidString,
        title: String,
        author: String,
        description: String,
        amazonLink: String? = nil,
        bookshopLink: String? = nil,
        isRead: Bool = false
    ) {
        self.id = id
        self.title = title
        self.author = author
        self.description = description
        self.amazonLink = amazonLink
        self.bookshopLink = bookshopLink
        self.isRead = isRead
    }
}

struct BookList: Codable, Identifiable, Hashable {
    let id: String
    var quarter: String // Format: YYYY-Q1, YYYY-Q2, etc.
    var books: [BookItem]
    var generatedAt: Date
    
    init(
        id: String = UUID().uuidString,
        quarter: String,
        books: [BookItem] = [],
        generatedAt: Date = Date()
    ) {
        self.id = id
        self.quarter = quarter
        self.books = books
        self.generatedAt = generatedAt
    }
}

import SwiftUI

struct BooksView: View {
    @EnvironmentObject var storage: StorageService
    @State private var isGenerating = false
    @State private var errorMessage: String?
    @State private var progressText = ""
    @State private var currentQuarter = StorageService.getCurrentQuarter()
    
    private var currentBookList: BookList? {
        storage.getBookListByQuarter(currentQuarter)
    }
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if storage.settings.topics.isEmpty {
                    EmptyStateView(
                        title: "No Topics Configured",
                        systemImage: "books.vertical",
                        description: Text("Please configure at least one topic in Settings to get book recommendations.")
                    )
                } else if let error = errorMessage {
                    VStack(spacing: 12) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.largeTitle)
                            .foregroundColor(.red)
                        Text(error)
                            .foregroundColor(.red)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                } else if isGenerating {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            ProgressView()
                            Text("Generating book recommendations...")
                        }
                        
                        if !progressText.isEmpty {
                            GroupBox("AI is thinking...") {
                                Text(progressText)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .padding()
                } else if let bookList = currentBookList {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Generated \(bookList.generatedAt, style: .relative) ago")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)
                        
                        ForEach(bookList.books) { book in
                            BookCard(book: book) {
                                toggleReadStatus(for: book.id)
                            }
                        }
                    }
                } else {
                    EmptyStateView(
                        title: "No Recommendations Yet",
                        systemImage: "books.vertical",
                        description: Text("Tap Generate to get book recommendations for \(currentQuarter)")
                    )
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Books - \(currentQuarter)")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: { Task { await generateRecommendations() } }) {
                    Label("Generate", systemImage: "sparkles")
                }
                .disabled(isGenerating || storage.settings.topics.isEmpty)
            }
        }
    }
    
    private func generateRecommendations() async {
        isGenerating = true
        errorMessage = nil
        progressText = ""
        
        do {
            let topicNames = storage.settings.topics.map { $0.name }
            
            let recommendations = try await AnthropicService.shared.generateBookRecommendations(
                topics: topicNames,
                apiKey: storage.settings.anthropicApiKey,
                customSystemPrompt: storage.settings.bookRecommendationsSystemPrompt,
                customUserPrompt: storage.settings.bookRecommendationsUserPrompt,
                onProgress: { text, _ in
                    progressText = text
                }
            )
            
            // Parse recommendations into structured data
            let books = parseBookRecommendations(recommendations)
            
            let bookList = BookList(
                quarter: currentQuarter,
                books: books
            )
            
            storage.saveBookList(bookList)
            
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isGenerating = false
    }
    
    private func parseBookRecommendations(_ markdown: String) -> [BookItem] {
        var books: [BookItem] = []
        let lines = markdown.split(separator: "\n", omittingEmptySubsequences: false)
        
        var currentBook: (title: String, author: String)?
        var description = ""
        var amazonLink: String?
        var bookshopLink: String?
        
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            
            // Match: **Title** by Author
            if let titleMatch = trimmed.range(of: #"\*\*(.+?)\*\*\s+by\s+(.+)"#, options: .regularExpression) {
                // Save previous book
                if let (title, author) = currentBook {
                    books.append(BookItem(
                        title: title,
                        author: author,
                        description: description.trimmingCharacters(in: .whitespaces),
                        amazonLink: amazonLink,
                        bookshopLink: bookshopLink
                    ))
                }
                
                // Extract title and author
                let match = trimmed[titleMatch]
                if let regex = try? NSRegularExpression(pattern: #"\*\*(.+?)\*\*\s+by\s+(.+)"#),
                   let result = regex.firstMatch(in: String(match), range: NSRange(match.startIndex..., in: match)),
                   let titleRange = Range(result.range(at: 1), in: match),
                   let authorRange = Range(result.range(at: 2), in: match) {
                    currentBook = (String(match[titleRange]), String(match[authorRange]))
                    description = ""
                    amazonLink = nil
                    bookshopLink = nil
                }
            } else if trimmed.contains("[Amazon]") {
                // Extract Amazon link
                if let match = trimmed.range(of: #"\[Amazon\]\((.+?)\)"#, options: .regularExpression),
                   let regex = try? NSRegularExpression(pattern: #"\[Amazon\]\((.+?)\)"#),
                   let result = regex.firstMatch(in: String(trimmed), range: NSRange(trimmed.startIndex..., in: trimmed)),
                   let urlRange = Range(result.range(at: 1), in: trimmed) {
                    amazonLink = String(trimmed[urlRange])
                }
            } else if trimmed.contains("[Bookshop]") {
                // Extract Bookshop link
                if let match = trimmed.range(of: #"\[Bookshop\]\((.+?)\)"#, options: .regularExpression),
                   let regex = try? NSRegularExpression(pattern: #"\[Bookshop\]\((.+?)\)"#),
                   let result = regex.firstMatch(in: String(trimmed), range: NSRange(trimmed.startIndex..., in: trimmed)),
                   let urlRange = Range(result.range(at: 1), in: trimmed) {
                    bookshopLink = String(trimmed[urlRange])
                }
            } else if !trimmed.isEmpty && currentBook != nil && !trimmed.hasPrefix("#") && !trimmed.hasPrefix("-") {
                // Add to description
                description += trimmed + " "
            }
        }
        
        // Save last book
        if let (title, author) = currentBook {
            books.append(BookItem(
                title: title,
                author: author,
                description: description.trimmingCharacters(in: .whitespaces),
                amazonLink: amazonLink,
                bookshopLink: bookshopLink
            ))
        }
        
        return books
    }
    
    private func toggleReadStatus(for bookId: String) {
        guard var bookList = currentBookList else { return }
        
        if let index = bookList.books.firstIndex(where: { $0.id == bookId }) {
            bookList.books[index].isRead.toggle()
            storage.saveBookList(bookList)
        }
    }
}

struct BookCard: View {
    let book: BookItem
    let onToggleRead: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(book.title)
                        .font(.headline)
                    Text("by \(book.author)")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                if book.isRead {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                }
            }
            
            Text(book.description)
                .font(.body)
                .foregroundColor(.primary)
            
            HStack {
                if let amazonLink = book.amazonLink {
                    Link(destination: URL(string: amazonLink)!) {
                        Label("Amazon", systemImage: "cart")
                            .font(.caption)
                    }
                    .buttonStyle(.bordered)
                }
                
                if let bookshopLink = book.bookshopLink {
                    Link(destination: URL(string: bookshopLink)!) {
                        Label("Bookshop", systemImage: "book")
                            .font(.caption)
                    }
                    .buttonStyle(.bordered)
                }
                
                Spacer()
                
                Button(action: onToggleRead) {
                    Label(book.isRead ? "Mark Unread" : "Mark as Read", systemImage: book.isRead ? "circle" : "checkmark.circle")
                        .font(.caption)
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
        .padding(.horizontal)
    }
}

#Preview {
    NavigationStack {
        BooksView()
            .environmentObject(StorageService.shared)
    }
}

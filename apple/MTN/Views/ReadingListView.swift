import SwiftUI

struct ReadingListView: View {
    @EnvironmentObject var storage: StorageService
    @State private var showingSaveDialog = false
    @State private var articleUrl = ""
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var selectedArticle: SavedArticle?
    
    private var currentMonthArticles: [SavedArticle] {
        storage.getArticlesByMonth(StorageService.getCurrentMonthKey())
    }
    
    var body: some View {
        Group {
            if currentMonthArticles.isEmpty {
                EmptyStateView(
                    title: "No Articles Saved",
                    systemImage: "bookmark",
                    description: Text("Save articles from the web to read later. You can save up to 4 articles per month.")
                )
            } else {
                #if os(iOS)
                if selectedArticle != nil {
                    ArticleReaderView(article: $selectedArticle)
                } else {
                    articleList
                }
                #else
                NavigationSplitView {
                    articleList
                } detail: {
                    if let article = selectedArticle {
                        ArticleReaderView(article: .constant(article))
                    } else {
                        EmptyStateView(
                            title: "Select an Article",
                            systemImage: "doc.text",
                            description: Text("Choose an article from the list to read")
                        )
                    }
                }
                #endif
            }
        }
        .navigationTitle("Reading List")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: { showingSaveDialog = true }) {
                    Label("Save Article (\(currentMonthArticles.count)/4)", systemImage: "plus")
                }
                .disabled(currentMonthArticles.count >= 4)
            }
        }
        .sheet(isPresented: $showingSaveDialog) {
            saveArticleSheet
        }
    }
    
    private var articleList: some View {
        List(currentMonthArticles, selection: $selectedArticle) { article in
            Button(action: { selectedArticle = article }) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(article.title)
                        .font(.headline)
                    
                    HStack {
                        Label("\(article.wordCount) words", systemImage: "doc.text")
                            .font(.caption)
                            .foregroundColor(article.isLongForm ? .blue : .secondary)
                        
                        if article.isLongForm {
                            Text("Long-form")
                                .font(.caption)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.green.opacity(0.2))
                                .foregroundColor(.green)
                                .cornerRadius(4)
                        }
                    }
                    
                    Text("Saved \(article.savedAt, style: .relative) ago")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                .padding(.vertical, 4)
            }
            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                Button(role: .destructive) {
                    storage.deleteArticle(article)
                    if selectedArticle?.id == article.id {
                        selectedArticle = nil
                    }
                } label: {
                    Label("Delete", systemImage: "trash")
                }
            }
        }
    }
    
    private var saveArticleSheet: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Article URL", text: $articleUrl)
                        .textContentType(.URL)
                        .autocapitalization(.none)
                        .keyboardType(.URL)
                    
                    Text("The article will be extracted and saved for reading. Word count will be displayed.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                if let error = errorMessage {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                    }
                }
                
                if isSaving {
                    Section {
                        HStack {
                            ProgressView()
                            Text("Extracting article...")
                        }
                    }
                }
            }
            .navigationTitle("Save Article")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showingSaveDialog = false
                        articleUrl = ""
                        errorMessage = nil
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { await saveArticle() }
                    }
                    .disabled(articleUrl.isEmpty || isSaving)
                }
            }
        }
    }
    
    private func saveArticle() async {
        guard !articleUrl.isEmpty else { return }
        
        // Check limit
        if currentMonthArticles.count >= 4 {
            errorMessage = "You already have 4 articles saved for this month. Please remove one first."
            return
        }
        
        isSaving = true
        errorMessage = nil
        
        do {
            let (title, content, wordCount) = try await ReadabilityService.shared.extractArticle(
                url: articleUrl,
                proxyUrl: storage.settings.corsProxyUrl
            )
            
            let article = SavedArticle(
                title: title,
                url: articleUrl,
                content: content,
                wordCount: wordCount,
                monthKey: StorageService.getCurrentMonthKey()
            )
            
            storage.saveArticle(article)
            
            showingSaveDialog = false
            articleUrl = ""
            
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isSaving = false
    }
}

struct ArticleReaderView: View {
    @EnvironmentObject var storage: StorageService
    @Binding var article: SavedArticle?
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        Group {
            if let article = article {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(article.title)
                                .font(.title)
                                .fontWeight(.bold)
                            
                            HStack {
                                Text("\(article.wordCount) words")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                
                                if article.isLongForm {
                                    Text("• Long-form")
                                        .font(.caption)
                                        .foregroundColor(.green)
                                }
                            }
                        }
                        
                        Divider()
                        
                        Text(article.content)
                            .textSelection(.enabled)
                    }
                    .padding()
                }
                .navigationTitle("Reading")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    #if os(iOS)
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Back") {
                            self.article = nil
                        }
                    }
                    #endif
                    
                    ToolbarItem(placement: .primaryAction) {
                        Button("Done Reading") {
                            storage.deleteArticle(article)
                            #if os(iOS)
                            self.article = nil
                            #else
                            dismiss()
                            #endif
                        }
                    }
                    
                    ToolbarItem(placement: .secondaryAction) {
                        Button(action: {
                            #if os(iOS)
                            if let url = URL(string: article.url) {
                                UIApplication.shared.open(url)
                            }
                            #else
                            if let url = URL(string: article.url) {
                                NSWorkspace.shared.open(url)
                            }
                            #endif
                        }) {
                            Label("Open Original", systemImage: "safari")
                        }
                    }
                }
            }
        }
    }
}

struct ReadingListView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            ReadingListView()
                .environmentObject(StorageService.shared)
        }
    }
}

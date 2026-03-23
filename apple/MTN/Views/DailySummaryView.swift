import SwiftUI

struct DailySummaryView: View {
    @EnvironmentObject var storage: StorageService
    @State private var selectedTopicIndex = 0
    @State private var isGenerating = false
    @State private var errorMessage: String?
    @State private var progressText = ""
    @State private var isFinalContent = false
    @State private var showThinking = true
    @State private var toastMessage: String?
    @State private var toastIsError = false
    @State private var showToast = false
    
    var body: some View {
        VStack(spacing: 0) {
            if storage.settings.topics.count > 1 {
                Picker("Topic", selection: $selectedTopicIndex) {
                    ForEach(Array(storage.settings.topics.enumerated()), id: \.offset) { index, topic in
                        Text(topic.name).tag(index)
                    }
                }
                .pickerStyle(.segmented)
                .padding()
            }
            
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if storage.settings.topics.isEmpty {
                        EmptyStateView(
                            title: "No Topics Configured",
                            systemImage: "newspaper",
                            description: Text("Please configure at least one topic in Settings to get started.")
                        )
                    } else if isGenerating {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                ProgressView()
                                Text("Generating summary...")
                            }
                            
                            if showThinking && !isFinalContent && !progressText.isEmpty {
                                GroupBox("Agent thinking...") {
                                    Text(progressText)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                            
                            if isFinalContent && !progressText.isEmpty {
                                MarkdownView(markdown: progressText, onSaveArticle: handleSaveArticle)
                            }
                        }
                        .padding()
                    } else if let summary = currentSummary {
                        VStack(alignment: .leading, spacing: 8) {
                            if let error = errorMessage {
                                // Show warning (e.g., "no recent articles, using all")
                                HStack(spacing: 8) {
                                    Image(systemName: "exclamationmark.triangle")
                                        .foregroundColor(.orange)
                                    Text(error)
                                        .font(.caption)
                                        .foregroundColor(.orange)
                                }
                                .padding(.horizontal)
                            }
                            
                            Text("Generated \(summary.generatedAt, style: .relative) ago")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            MarkdownView(markdown: summary.summary, onSaveArticle: handleSaveArticle)
                                .textSelection(.enabled)
                        }
                        .padding()
                    } else {
                        VStack(spacing: 16) {
                            if let error = errorMessage {
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
                            } else {
                                EmptyStateView(
                                    title: "No Summary Available",
                                    systemImage: "doc.text",
                                    description: Text("Tap Generate to create a summary for \(currentTopic?.name ?? "this topic")")
                                )
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Daily Summary")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: { Task { await generateSummary(forceRefresh: true) } }) {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .disabled(isGenerating || storage.settings.topics.isEmpty)
            }
        }
        .task {
            if currentSummary == nil && !storage.settings.topics.isEmpty {
                await generateSummary(forceRefresh: false)
            }
        }
        .overlay(alignment: .bottom) {
            if showToast, let message = toastMessage {
                HStack(spacing: 8) {
                    Image(systemName: toastIsError ? "xmark.circle.fill" : "checkmark.circle.fill")
                        .foregroundColor(toastIsError ? .red : .green)
                    Text(message)
                        .font(.subheadline)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 10)
                        .fill(.background)
                        .shadow(color: .black.opacity(0.15), radius: 8, x: 0, y: 4)
                )
                .padding(.bottom, 24)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.3), value: showToast)
    }
    
    private var currentTopic: Topic? {
        guard selectedTopicIndex < storage.settings.topics.count else { return nil }
        return storage.settings.topics[selectedTopicIndex]
    }
    
    private var currentSummary: DailySummary? {
        guard let topic = currentTopic else { return nil }
        return storage.getSummaryByTopic(topic.id)
    }
    
    private func handleSaveArticle(url: String, title: String) async -> (success: Bool, error: String?) {
        let monthKey = StorageService.getCurrentMonthKey()
        let currentArticles = storage.getArticlesByMonth(monthKey)
        
        if currentArticles.count >= 4 {
            return (false, "Reading list is full (4/4). Please remove an article first.")
        }
        
        do {
            let (extractedTitle, content, wordCount) = try await ReadabilityService.shared.extractArticle(
                url: url,
                proxyUrl: storage.settings.corsProxyUrl
            )
            
            let article = SavedArticle(
                title: title.isEmpty ? extractedTitle : title,
                url: url,
                content: content,
                wordCount: wordCount,
                monthKey: monthKey
            )
            
            storage.saveArticle(article)
            
            let newCount = currentArticles.count + 1
            showToastMessage("Article saved to Reading List (\(newCount)/4)", isError: false)
            return (true, nil)
        } catch {
            let message = error.localizedDescription
            showToastMessage(message, isError: true)
            return (false, message)
        }
    }
    
    private func showToastMessage(_ message: String, isError: Bool) {
        toastMessage = message
        toastIsError = isError
        withAnimation {
            showToast = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
            withAnimation {
                showToast = false
            }
        }
    }
    
    private func generateSummary(forceRefresh: Bool) async {
        guard let topic = currentTopic else { return }
        
        // Check cache first
        if !forceRefresh, let _ = storage.getSummaryByTopic(topic.id) {
            return
        }
        
        isGenerating = true
        errorMessage = nil
        progressText = ""
        isFinalContent = false
        showThinking = true
        
        do {
            // Fetch RSS feeds
            let allArticles = try await RSSService.shared.fetchMultipleFeeds(
                urls: topic.rssFeeds,
                proxyUrl: storage.settings.corsProxyUrl
            )
            
            if allArticles.isEmpty {
                errorMessage = "No articles could be fetched from the feeds"
                isGenerating = false
                return
            }
            
            let recentArticles = RSSService.shared.filterArticlesByDate(allArticles, hoursAgo: 24)
            
            // Use all articles as fallback if none are recent (matching web app behavior)
            let articlesToSummarize: [RSSFeedItem]
            if recentArticles.isEmpty {
                errorMessage = "Found \(allArticles.count) articles, but none from the last 24 hours. Using all available articles instead."
                articlesToSummarize = allArticles
            } else {
                errorMessage = nil
                articlesToSummarize = recentArticles
            }
            
            // Generate summary with streaming
            let summaryText = try await AnthropicService.shared.generateDailySummary(
                topicName: topic.name,
                articles: articlesToSummarize,
                apiKey: storage.settings.anthropicApiKey,
                customSystemPrompt: storage.settings.dailySummarySystemPrompt,
                customUserPrompt: storage.settings.dailySummaryUserPrompt,
                onProgress: { text, isFinal in
                    progressText = text
                    isFinalContent = isFinal
                    if isFinal {
                        showThinking = false
                    }
                }
            )
            
            // Save to cache
            let summary = DailySummary(
                topicId: topic.id,
                topicName: topic.name,
                summary: summaryText,
                expiresAt: Date().addingTimeInterval(24 * 3600)
            )
            
            storage.saveSummary(summary)
            
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isGenerating = false
    }
}

struct DailySummaryView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            DailySummaryView()
                .environmentObject(StorageService.shared)
        }
    }
}

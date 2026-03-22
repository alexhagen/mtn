import SwiftUI

struct DailySummaryView: View {
    @EnvironmentObject var storage: StorageService
    @State private var selectedTopicIndex = 0
    @State private var isGenerating = false
    @State private var errorMessage: String?
    @State private var progressText = ""
    @State private var isFinalContent = false
    @State private var showThinking = true
    
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
                                MarkdownView(markdown: progressText)
                            }
                        }
                        .padding()
                    } else if let summary = currentSummary {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Generated \(summary.generatedAt, style: .relative) ago")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            MarkdownView(markdown: summary.summary)
                                .textSelection(.enabled)
                        }
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
    }
    
    private var currentTopic: Topic? {
        guard selectedTopicIndex < storage.settings.topics.count else { return nil }
        return storage.settings.topics[selectedTopicIndex]
    }
    
    private var currentSummary: DailySummary? {
        guard let topic = currentTopic else { return nil }
        return storage.getSummaryByTopic(topic.id)
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
            
            let recentArticles = RSSService.shared.filterArticlesByDate(allArticles, hoursAgo: 24)
            
            guard !recentArticles.isEmpty else {
                errorMessage = "No articles found in the last 24 hours"
                isGenerating = false
                return
            }
            
            // Generate summary with streaming
            let summaryText = try await AnthropicService.shared.generateDailySummary(
                topicName: topic.name,
                articles: recentArticles,
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

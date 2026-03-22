import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var auth: AuthService
    @EnvironmentObject var storage: StorageService
    @State private var showingSaved = false
    @State private var showingSignIn = false
    @State private var newTopicName = ""
    @State private var selectedTopicId: String?
    @State private var newFeedUrl = ""
    
    var body: some View {
        Form {
            // Account Section
            Section("Account") {
                if auth.isAuthenticated {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(auth.user?.email ?? "Signed In")
                                .font(.body)
                            Text("Storage: Cloud")
                                .font(.caption)
                                .foregroundColor(.green)
                        }
                        
                        Spacer()
                        
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                    }
                    
                    Button(role: .destructive, action: signOut) {
                        HStack {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                            Text("Sign Out")
                        }
                    }
                } else {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Local Only")
                                .font(.body)
                            Text("Storage: Device")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        Spacer()
                        
                        Image(systemName: "iphone")
                            .foregroundColor(.secondary)
                    }
                    
                    Button(action: { showingSignIn = true }) {
                        HStack {
                            Image(systemName: "cloud.fill")
                            Text("Sign In for Cloud Sync")
                        }
                    }
                    .disabled(!Configuration.isSupabaseConfigured)
                    
                    if !Configuration.isSupabaseConfigured {
                        Text("Cloud sync requires Supabase configuration in Info.plist")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            Section("API Configuration") {
                SecureField("Anthropic API Key", text: $storage.settings.anthropicApiKey)
                    .textContentType(.password)
                
                TextField("CORS Proxy URL", text: $storage.settings.corsProxyUrl)
                    .textContentType(.URL)
                    .autocapitalization(.none)
                
                Text("Your API key is stored locally on your device")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Section {
                HStack {
                    Text("Topics")
                        .font(.headline)
                    Spacer()
                    Text("\(storage.settings.topics.count)/3")
                        .foregroundColor(.secondary)
                }
                
                Text("Configure up to 3 topics with RSS feeds for each")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                HStack {
                    TextField("New Topic Name", text: $newTopicName)
                    Button(action: addTopic) {
                        Image(systemName: "plus.circle.fill")
                    }
                    .disabled(storage.settings.topics.count >= 3 || newTopicName.isEmpty)
                }
                
                ForEach(storage.settings.topics) { topic in
                    Button(action: { selectedTopicId = topic.id }) {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(topic.name)
                                    .foregroundColor(.primary)
                                Text("\(topic.rssFeeds.count) RSS feeds")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            if selectedTopicId == topic.id {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.accentColor)
                            }
                        }
                    }
                }
                .onDelete(perform: deleteTopics)
            }
            
            if let topicId = selectedTopicId,
               let topic = storage.settings.topics.first(where: { $0.id == topicId }) {
                Section("RSS Feeds for \"\(topic.name)\"") {
                    HStack {
                        TextField("RSS Feed URL", text: $newFeedUrl)
                            .textContentType(.URL)
                            .autocapitalization(.none)
                        Button(action: { addFeed(to: topicId) }) {
                            Image(systemName: "plus.circle.fill")
                        }
                        .disabled(newFeedUrl.isEmpty)
                    }
                    
                    ForEach(topic.rssFeeds, id: \.self) { feed in
                        Text(feed)
                            .font(.caption)
                    }
                    .onDelete { indexSet in
                        deleteFeed(from: topicId, at: indexSet)
                    }
                }
            }
            
            Section {
                DisclosureGroup("Prompt Customization") {
                    Text("Customize the AI prompts used for generating summaries and book recommendations. Leave empty to use defaults.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.bottom, 8)
                    
                    VStack(alignment: .leading, spacing: 16) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Daily Summary System Prompt")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            TextEditor(text: Binding(
                                get: { storage.settings.dailySummarySystemPrompt ?? "" },
                                set: { storage.settings.dailySummarySystemPrompt = $0.isEmpty ? nil : $0 }
                            ))
                            .frame(height: 120)
                            .font(.caption)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                            )
                            Text("Instructions for the AI when creating daily summaries")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                            if storage.settings.dailySummarySystemPrompt != nil {
                                Button("Reset to Default") {
                                    storage.settings.dailySummarySystemPrompt = nil
                                }
                                .font(.caption)
                            }
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Daily Summary User Prompt")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            TextEditor(text: Binding(
                                get: { storage.settings.dailySummaryUserPrompt ?? "" },
                                set: { storage.settings.dailySummaryUserPrompt = $0.isEmpty ? nil : $0 }
                            ))
                            .frame(height: 120)
                            .font(.caption)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                            )
                            Text("Template for the user message. Use {topicName} and {articles} as placeholders.")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                            if storage.settings.dailySummaryUserPrompt != nil {
                                Button("Reset to Default") {
                                    storage.settings.dailySummaryUserPrompt = nil
                                }
                                .font(.caption)
                            }
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Book Recommendations System Prompt")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            TextEditor(text: Binding(
                                get: { storage.settings.bookRecommendationsSystemPrompt ?? "" },
                                set: { storage.settings.bookRecommendationsSystemPrompt = $0.isEmpty ? nil : $0 }
                            ))
                            .frame(height: 120)
                            .font(.caption)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                            )
                            Text("Instructions for the AI when recommending books")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                            if storage.settings.bookRecommendationsSystemPrompt != nil {
                                Button("Reset to Default") {
                                    storage.settings.bookRecommendationsSystemPrompt = nil
                                }
                                .font(.caption)
                            }
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Book Recommendations User Prompt")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            TextEditor(text: Binding(
                                get: { storage.settings.bookRecommendationsUserPrompt ?? "" },
                                set: { storage.settings.bookRecommendationsUserPrompt = $0.isEmpty ? nil : $0 }
                            ))
                            .frame(height: 120)
                            .font(.caption)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                            )
                            Text("Template for the user message. Use {topics} as a placeholder.")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                            if storage.settings.bookRecommendationsUserPrompt != nil {
                                Button("Reset to Default") {
                                    storage.settings.bookRecommendationsUserPrompt = nil
                                }
                                .font(.caption)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Settings")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Save") {
                    storage.saveSettings()
                    showingSaved = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        showingSaved = false
                    }
                }
            }
        }
        .overlay(alignment: .top) {
            if showingSaved {
                Text("Settings saved!")
                    .padding()
                    .background(Color.green.opacity(0.9))
                    .foregroundColor(.white)
                    .cornerRadius(8)
                    .padding(.top, 50)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeInOut, value: showingSaved)
        .sheet(isPresented: $showingSignIn) {
            SignInView()
                .environmentObject(auth)
        }
    }
    
    private func signOut() {
        Task {
            do {
                try await auth.signOut()
            } catch {
                print("Error signing out: \(error)")
            }
        }
    }
    
    private func addTopic() {
        guard !newTopicName.isEmpty, storage.settings.topics.count < 3 else { return }
        
        let topic = Topic(name: newTopicName)
        storage.settings.topics.append(topic)
        selectedTopicId = topic.id
        newTopicName = ""
    }
    
    private func deleteTopics(at offsets: IndexSet) {
        storage.settings.topics.remove(atOffsets: offsets)
        if let topicId = selectedTopicId,
           !storage.settings.topics.contains(where: { $0.id == topicId }) {
            selectedTopicId = nil
        }
    }
    
    private func addFeed(to topicId: String) {
        guard !newFeedUrl.isEmpty else { return }
        
        if let index = storage.settings.topics.firstIndex(where: { $0.id == topicId }) {
            storage.settings.topics[index].rssFeeds.append(newFeedUrl)
            newFeedUrl = ""
        }
    }
    
    private func deleteFeed(from topicId: String, at offsets: IndexSet) {
        if let index = storage.settings.topics.firstIndex(where: { $0.id == topicId }) {
            storage.settings.topics[index].rssFeeds.remove(atOffsets: offsets)
        }
    }
}

struct SettingsView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            SettingsView()
                .environmentObject(AuthService.shared)
                .environmentObject(StorageService.shared)
        }
    }
}

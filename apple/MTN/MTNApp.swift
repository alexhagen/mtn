import SwiftUI
import Supabase

@main
struct MTNApp: App {
    @StateObject private var auth = AuthService.shared
    @StateObject private var storage = StorageService.shared
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(auth)
                .environmentObject(storage)
                .onOpenURL { url in
                    handleOAuthCallback(url)
                }
                .task {
                    // Switch storage mode based on auth state
                    await syncStorageWithAuth()
                }
                .onChange(of: auth.isAuthenticated) { _, isAuthenticated in
                    Task {
                        await syncStorageWithAuth()
                    }
                }
        }
    }
    
    /// Handle OAuth callback URL
    private func handleOAuthCallback(_ url: URL) {
        guard url.scheme == Configuration.oauthRedirectScheme else { return }
        
        Task {
            do {
                try await auth.handleOAuthCallback(url: url)
            } catch {
                print("OAuth callback error: \(error)")
            }
        }
    }
    
    /// Sync storage mode with authentication state
    private func syncStorageWithAuth() async {
        if auth.isAuthenticated, let client = auth.getClient() {
            // User signed in - switch to cloud storage
            await storage.switchToCloud(client: client)
        } else if storage.isCloudMode {
            // User signed out - switch back to local storage
            await storage.switchToLocal()
        }
    }
}

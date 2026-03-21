import Foundation
import Supabase
import SwiftUI

/// Authentication service for MTN
/// Manages user authentication via Supabase (Google, GitHub, Apple)
@MainActor
class AuthService: ObservableObject {
    static let shared = AuthService()
    
    @Published var user: User?
    @Published var session: Session?
    @Published var isLoading = true
    @Published var error: String?
    
    private var client: SupabaseClient?
    
    var isAuthenticated: Bool {
        user != nil && session != nil
    }
    
    private init() {
        // Only initialize if Supabase is configured
        guard Configuration.isSupabaseConfigured else {
            isLoading = false
            return
        }
        
        do {
            client = try SupabaseClient(
                supabaseURL: URL(string: Configuration.supabaseURL)!,
                supabaseKey: Configuration.supabaseAnonKey
            )
            
            Task {
                await loadSession()
                await listenToAuthChanges()
            }
        } catch {
            self.error = "Failed to initialize Supabase: \(error.localizedDescription)"
            isLoading = false
        }
    }
    
    /// Load existing session on app launch
    func loadSession() async {
        guard let client = client else {
            isLoading = false
            return
        }
        
        do {
            session = try await client.auth.session
            user = session?.user
        } catch {
            // No active session - this is normal for first launch
            print("No active session: \(error)")
        }
        
        isLoading = false
    }
    
    /// Listen for auth state changes
    private func listenToAuthChanges() async {
        guard let client = client else { return }
        
        for await state in await client.auth.authStateChanges {
            switch state {
            case .signedIn(let session):
                self.session = session
                self.user = session.user
                self.error = nil
            case .signedOut:
                self.session = nil
                self.user = nil
            case .userUpdated(let session):
                self.session = session
                self.user = session.user
            case .tokenRefreshed(let session):
                self.session = session
                self.user = session.user
            default:
                break
            }
        }
    }
    
    /// Sign in with Google
    func signInWithGoogle() async throws {
        guard let client = client else {
            throw NSError(domain: "AuthService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Supabase not configured"])
        }
        
        try await client.auth.signInWithOAuth(
            provider: .google,
            redirectTo: URL(string: "\(Configuration.oauthRedirectScheme)://auth/callback")
        )
    }
    
    /// Sign in with GitHub
    func signInWithGitHub() async throws {
        guard let client = client else {
            throw NSError(domain: "AuthService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Supabase not configured"])
        }
        
        try await client.auth.signInWithOAuth(
            provider: .github,
            redirectTo: URL(string: "\(Configuration.oauthRedirectScheme)://auth/callback")
        )
    }
    
    /// Sign in with Apple
    func signInWithApple() async throws {
        guard let client = client else {
            throw NSError(domain: "AuthService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Supabase not configured"])
        }
        
        try await client.auth.signInWithOAuth(
            provider: .apple,
            redirectTo: URL(string: "\(Configuration.oauthRedirectScheme)://auth/callback")
        )
    }
    
    /// Sign out
    func signOut() async throws {
        guard let client = client else {
            throw NSError(domain: "AuthService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Supabase not configured"])
        }
        
        try await client.auth.signOut()
        user = nil
        session = nil
    }
    
    /// Handle OAuth callback URL
    func handleOAuthCallback(url: URL) async throws {
        guard let client = client else {
            throw NSError(domain: "AuthService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Supabase not configured"])
        }
        
        try await client.auth.session(from: url)
    }
    
    /// Get Supabase client (for storage service)
    func getClient() -> SupabaseClient? {
        return client
    }
}

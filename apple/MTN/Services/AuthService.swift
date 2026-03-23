import Foundation
import SwiftUI
import AuthenticationServices

// MARK: - Simple user/session models (replacing Supabase SDK types)

struct SupabaseUser {
    let id: String
    let email: String?
}

struct SupabaseSession {
    let accessToken: String
    let refreshToken: String
    let user: SupabaseUser
}

/// Authentication service for MTN
/// Manages user authentication via Supabase REST API (Google, GitHub, Apple)
/// Uses URLSession directly instead of the supabase-swift SDK for Swift 5.7 compatibility
@MainActor
class AuthService: NSObject, ObservableObject {
    static let shared = AuthService()

    @Published var user: SupabaseUser?
    @Published var session: SupabaseSession?
    @Published var isLoading = true
    @Published var error: String?

    var isAuthenticated: Bool {
        user != nil && session != nil
    }

    private let supabaseURL: String
    private let supabaseAnonKey: String

    private override init() {
        self.supabaseURL = Configuration.supabaseURL
        self.supabaseAnonKey = Configuration.supabaseAnonKey
        super.init()

        guard Configuration.isSupabaseConfigured else {
            isLoading = false
            return
        }

        Task {
            await loadSession()
        }
    }

    // MARK: - Session Management

    /// Load existing session from UserDefaults on app launch
    func loadSession() async {
        guard Configuration.isSupabaseConfigured else {
            isLoading = false
            return
        }

        // Try to restore session from UserDefaults
        if let _ = UserDefaults.standard.string(forKey: "supabase_access_token"),
           let refreshToken = UserDefaults.standard.string(forKey: "supabase_refresh_token") {
            // Try to refresh the session
            do {
                let newSession = try await refreshSession(refreshToken: refreshToken)
                self.session = newSession
                self.user = newSession.user
            } catch {
                // Session expired or invalid - clear it
                clearStoredSession()
                print("Session refresh failed: \(error)")
            }
        }

        isLoading = false
    }

    /// Refresh an existing session using the refresh token
    private func refreshSession(refreshToken: String) async throws -> SupabaseSession {
        guard let url = URL(string: "\(supabaseURL)/auth/v1/token?grant_type=refresh_token") else {
            throw AuthError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")

        let body = ["refresh_token": refreshToken]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw AuthError.sessionRefreshFailed
        }

        return try parseSession(from: data)
    }

    // MARK: - OAuth Sign In

    /// Sign in with Google via Supabase OAuth
    func signInWithGoogle() async throws {
        try await signInWithOAuth(provider: "google")
    }

    /// Sign in with GitHub via Supabase OAuth
    func signInWithGitHub() async throws {
        try await signInWithOAuth(provider: "github")
    }

    /// Sign in with Apple via Supabase OAuth
    func signInWithApple() async throws {
        try await signInWithOAuth(provider: "apple")
    }

    // Stored strongly so it isn't deallocated before the auth flow completes.
    private var webAuthSession: ASWebAuthenticationSession?
    private var webAuthContext: WebAuthPresentationContext?

    private func signInWithOAuth(provider: String) async throws {
        guard Configuration.isSupabaseConfigured else {
            throw AuthError.notConfigured
        }

        let redirectURL = "\(Configuration.oauthRedirectScheme)://auth/callback"
        guard let encodedRedirect = redirectURL.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "\(supabaseURL)/auth/v1/authorize?provider=\(provider)&redirect_to=\(encodedRedirect)&flow_type=implicit&skip_browser_redirect=true") else {
            throw AuthError.invalidURL
        }

        // Capture the key window here, while we're on the @MainActor, so the
        // presentation context helper doesn't need to access main-actor-isolated
        // APIs from a nonisolated context.
        #if os(iOS)
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        let anchor = scene?.windows.first(where: { $0.isKeyWindow }) ?? UIWindow()
        #elseif os(macOS)
        let anchor = NSApplication.shared.windows.first ?? NSWindow()
        #endif

        let presentationContext = WebAuthPresentationContext(anchor: anchor)
        self.webAuthContext = presentationContext

        // Use ASWebAuthenticationSession to keep the user inside the app.
        // The session opens an in-app browser sheet, captures the mtn:// callback
        // automatically, and returns the callback URL — no Safari switch required.
        let callbackURL: URL = try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: Configuration.oauthRedirectScheme
            ) { callbackURL, error in
                if let error = error {
                    continuation.resume(throwing: error)
                } else if let callbackURL = callbackURL {
                    continuation.resume(returning: callbackURL)
                } else {
                    continuation.resume(throwing: AuthError.invalidCallbackURL)
                }
            }
            session.presentationContextProvider = presentationContext
            // false = reuse existing browser session/cookies so the user may already be signed in
            session.prefersEphemeralWebBrowserSession = false
            // Retain the session strongly so it isn't released before the callback fires.
            self.webAuthSession = session
            session.start()
        }

        webAuthSession = nil
        webAuthContext = nil
        try await handleOAuthCallback(url: callbackURL)
    }

    // MARK: - OAuth Callback

    /// Handle OAuth callback URL (called from MTNApp.onOpenURL)
    func handleOAuthCallback(url: URL) async throws {
        // Extract the fragment or query parameters from the callback URL
        // Supabase returns tokens in the URL fragment: mtn://auth/callback#access_token=...
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw AuthError.invalidCallbackURL
        }

        // Try fragment first (implicit flow)
        if let fragment = components.fragment {
            let params = parseQueryString(fragment)
            if let accessToken = params["access_token"],
               let refreshToken = params["refresh_token"] {
                let newSession = try await getUserFromToken(accessToken: accessToken, refreshToken: refreshToken)
                self.session = newSession
                self.user = newSession.user
                storeSession(newSession)
                return
            }
        }

        // Try query parameters (PKCE flow)
        if let queryItems = components.queryItems {
            let params = Dictionary(uniqueKeysWithValues: queryItems.compactMap { item -> (String, String)? in
                guard let value = item.value else { return nil }
                return (item.name, value)
            })

            if let code = params["code"] {
                // Exchange code for session
                let newSession = try await exchangeCodeForSession(code: code)
                self.session = newSession
                self.user = newSession.user
                storeSession(newSession)
                return
            }
        }

        throw AuthError.invalidCallbackURL
    }

    /// Exchange authorization code for session tokens
    private func exchangeCodeForSession(code: String) async throws -> SupabaseSession {
        guard let url = URL(string: "\(supabaseURL)/auth/v1/token?grant_type=pkce") else {
            throw AuthError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")

        let body = ["auth_code": code]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw AuthError.tokenExchangeFailed
        }

        return try parseSession(from: data)
    }

    /// Get user info from an access token
    private func getUserFromToken(accessToken: String, refreshToken: String) async throws -> SupabaseSession {
        guard let url = URL(string: "\(supabaseURL)/auth/v1/user") else {
            throw AuthError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw AuthError.userFetchFailed
        }

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let userId = json["id"] as? String else {
            throw AuthError.parseError
        }

        let email = json["email"] as? String
        let user = SupabaseUser(id: userId, email: email)
        return SupabaseSession(accessToken: accessToken, refreshToken: refreshToken, user: user)
    }

    // MARK: - Sign Out

    func signOut() async throws {
        guard let session = session else { return }

        if Configuration.isSupabaseConfigured,
           let url = URL(string: "\(supabaseURL)/auth/v1/logout") {
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")

            // Best-effort sign out - don't fail if network is unavailable
            _ = try? await URLSession.shared.data(for: request)
        }

        clearStoredSession()
        self.session = nil
        self.user = nil
    }

    // MARK: - Helpers

    /// Get the current access token (for use by SupabaseStorageService)
    func getAccessToken() -> String? {
        return session?.accessToken
    }

    /// Get the current user ID
    func getUserId() -> String? {
        return user?.id
    }

    private func storeSession(_ session: SupabaseSession) {
        UserDefaults.standard.set(session.accessToken, forKey: "supabase_access_token")
        UserDefaults.standard.set(session.refreshToken, forKey: "supabase_refresh_token")
    }

    private func clearStoredSession() {
        UserDefaults.standard.removeObject(forKey: "supabase_access_token")
        UserDefaults.standard.removeObject(forKey: "supabase_refresh_token")
    }

    private func parseSession(from data: Data) throws -> SupabaseSession {
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let accessToken = json["access_token"] as? String,
              let refreshToken = json["refresh_token"] as? String,
              let userJson = json["user"] as? [String: Any],
              let userId = userJson["id"] as? String else {
            throw AuthError.parseError
        }

        let email = userJson["email"] as? String
        let user = SupabaseUser(id: userId, email: email)
        return SupabaseSession(accessToken: accessToken, refreshToken: refreshToken, user: user)
    }

    private func parseQueryString(_ query: String) -> [String: String] {
        var params: [String: String] = [:]
        for pair in query.components(separatedBy: "&") {
            let parts = pair.components(separatedBy: "=")
            if parts.count == 2 {
                let key = parts[0].removingPercentEncoding ?? parts[0]
                let value = parts[1].removingPercentEncoding ?? parts[1]
                params[key] = value
            }
        }
        return params
    }
}

// MARK: - ASWebAuthenticationSession Presentation Context

/// Lightweight helper that holds a pre-captured window anchor.
/// Because it is not @MainActor, its nonisolated presentationAnchor(for:) method
/// can safely return the stored window without any actor-isolation issues.
private class WebAuthPresentationContext: NSObject, ASWebAuthenticationPresentationContextProviding {
    private let anchor: ASPresentationAnchor

    init(anchor: ASPresentationAnchor) {
        self.anchor = anchor
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return anchor
    }
}

// MARK: - Auth Errors

enum AuthError: LocalizedError {
    case notConfigured
    case invalidURL
    case invalidCallbackURL
    case sessionRefreshFailed
    case tokenExchangeFailed
    case userFetchFailed
    case parseError

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Supabase is not configured"
        case .invalidURL: return "Invalid URL"
        case .invalidCallbackURL: return "Invalid OAuth callback URL"
        case .sessionRefreshFailed: return "Session refresh failed"
        case .tokenExchangeFailed: return "Token exchange failed"
        case .userFetchFailed: return "Failed to fetch user info"
        case .parseError: return "Failed to parse response"
        }
    }
}

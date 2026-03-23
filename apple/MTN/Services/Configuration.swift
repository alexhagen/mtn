import Foundation

/// Configuration for MTN app
/// Manages Supabase connection and storage mode
struct Configuration {
    /// Storage mode: local-only or cloud sync
    enum StorageMode: String {
        case local
        case cloud
    }
    
    /// Current storage mode (can be changed at runtime)
    static var storageMode: StorageMode {
        get {
            if let modeString = UserDefaults.standard.string(forKey: "storageMode"),
               let mode = StorageMode(rawValue: modeString) {
                return mode
            }
            return .local // Default to local
        }
        set {
            UserDefaults.standard.set(newValue.rawValue, forKey: "storageMode")
        }
    }
    
    /// Supabase project URL
    /// Set this to your Supabase project URL or leave empty for local-only mode
    static let supabaseURL: String = {
        // Try to read from Info.plist first.
        // Note: The xcconfig value stores only the hostname (e.g. "abc123.supabase.co")
        // because xcconfig treats "//" as a comment. We prepend "https://" here.
        if let host = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
           !host.isEmpty {
            if host.hasPrefix("https://") || host.hasPrefix("http://") {
                return host
            }
            return "https://\(host)"
        }
        // Fallback to empty (local-only mode)
        return ""
    }()
    
    /// Supabase anonymous key
    /// Set this to your Supabase anon key or leave empty for local-only mode
    static let supabaseAnonKey: String = {
        // Try to read from Info.plist first
        if let key = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String,
           !key.isEmpty {
            return key
        }
        // Fallback to empty (local-only mode)
        return ""
    }()
    
    /// Check if Supabase is configured
    static var isSupabaseConfigured: Bool {
        !supabaseURL.isEmpty && !supabaseAnonKey.isEmpty
    }
    
    /// OAuth redirect URL scheme
    static let oauthRedirectScheme = "mtn"
}

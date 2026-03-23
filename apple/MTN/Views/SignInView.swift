import SwiftUI

/// Sign-in view for cloud sync
/// Allows users to authenticate with Google, GitHub, or Apple
struct SignInView: View {
    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss
    @State private var isSigningIn = false
    @State private var errorMessage: String?
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                // Header
                VStack(spacing: 12) {
                    Image(systemName: "cloud.fill")
                        .font(.system(size: 60))
                        .foregroundColor(.accentColor)
                    
                    Text("Cloud Sync")
                        .font(.title)
                        .fontWeight(.bold)
                    
                    Text("Sign in to sync your data across devices")
                        .font(.body)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .padding(.top, 40)
                
                Spacer()
                
                // Sign-in buttons
                VStack(spacing: 16) {
                    if Configuration.isSupabaseConfigured {
                        Button(action: { signIn(with: .google) }) {
                            HStack {
                                Image(systemName: "globe")
                                Text("Continue with Google")
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                        .disabled(isSigningIn)
                        
                        Button(action: { signIn(with: .github) }) {
                            HStack {
                                Image(systemName: "chevron.left.forwardslash.chevron.right")
                                Text("Continue with GitHub")
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.gray)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                        .disabled(isSigningIn)
                        
                        Button(action: { signIn(with: .apple) }) {
                            HStack {
                                Image(systemName: "apple.logo")
                                Text("Continue with Apple")
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.black)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                        .disabled(isSigningIn)
                    } else {
                        VStack(spacing: 12) {
                            Image(systemName: "exclamationmark.triangle")
                                .font(.largeTitle)
                                .foregroundColor(.orange)
                            
                            Text("Cloud sync not configured")
                                .font(.headline)
                            
                            Text("To enable cloud sync, add your Supabase URL and anon key to Info.plist")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)
                        }
                    }
                    
                    if let error = errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }
                    
                    if isSigningIn {
                        HStack {
                            ProgressView()
                            Text("Signing in...")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding(.horizontal, 32)
                
                Spacer()
                
                // Continue without account
                Button(action: { dismiss() }) {
                    Text("Continue without account")
                        .font(.body)
                        .foregroundColor(.secondary)
                }
                .padding(.bottom, 40)
            }
            .navigationTitle("Sign In")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }
    
    private enum Provider {
        case google, github, apple
    }
    
    private func signIn(with provider: Provider) {
        isSigningIn = true
        errorMessage = nil
        
        Task {
            do {
                switch provider {
                case .google:
                    try await auth.signInWithGoogle()
                case .github:
                    try await auth.signInWithGitHub()
                case .apple:
                    try await auth.signInWithApple()
                }

                // OAuth completed successfully — dismiss the sheet
                isSigningIn = false
                dismiss()

            } catch {
                errorMessage = error.localizedDescription
                isSigningIn = false
            }
        }
    }
}

struct SignInView_Previews: PreviewProvider {
    static var previews: some View {
        SignInView()
            .environmentObject(AuthService.shared)
    }
}

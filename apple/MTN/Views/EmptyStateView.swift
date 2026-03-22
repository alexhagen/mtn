import SwiftUI

/// Fallback for ContentUnavailableView on iOS 16/macOS 13
/// Provides similar functionality with backwards compatibility
struct EmptyStateView: View {
    let title: String
    let systemImage: String
    let description: Text
    
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: systemImage)
                .font(.system(size: 48))
                .foregroundColor(.secondary)
            
            Text(title)
                .font(.title2)
                .fontWeight(.semibold)
            
            description
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    EmptyStateView(
        title: "No Items",
        systemImage: "tray",
        description: Text("There are no items to display")
    )
}

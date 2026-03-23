import SwiftUI

struct EmptyStateView: View {
    let title: String
    var systemImage: String = "tray"
    var description: Text? = nil

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 48))
                .foregroundColor(.secondary)
            Text(title)
                .font(.title2)
                .fontWeight(.semibold)
            if let description = description {
                description
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct EmptyStateView_Previews: PreviewProvider {
    static var previews: some View {
        EmptyStateView(
            title: "No Articles Saved",
            systemImage: "bookmark",
            description: Text("Save articles from the web to read later.")
        )
    }
}

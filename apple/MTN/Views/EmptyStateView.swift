import SwiftUI

struct EmptyStateView: View {
    let title: String
    var systemImage: String = "tray"
    var description: Text? = nil

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: systemImage)
        } description: {
            description
        }
    }
}

#Preview {
    EmptyStateView(
        title: "No Articles Saved",
        systemImage: "bookmark",
        description: Text("Save articles from the web to read later.")
    )
}

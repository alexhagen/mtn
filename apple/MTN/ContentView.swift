import SwiftUI

struct ContentView: View {
    @EnvironmentObject var auth: AuthService
    @EnvironmentObject var storage: StorageService
    
    var body: some View {
        TabView {
            NavigationStack {
                DailySummaryView()
            }
            .tabItem {
                Label("Daily", systemImage: "newspaper")
            }
            
            NavigationStack {
                ReadingListView()
            }
            .tabItem {
                Label("Reading", systemImage: "bookmark")
            }
            
            NavigationStack {
                BooksView()
            }
            .tabItem {
                Label("Books", systemImage: "books.vertical")
            }
            
            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("Settings", systemImage: "gear")
            }
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
            .environmentObject(AuthService.shared)
            .environmentObject(StorageService.shared)
    }
}

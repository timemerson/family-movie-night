import SwiftUI

struct HomeView: View {
    @EnvironmentObject var authService: AuthService

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("Welcome to Family Movie Night!")
                    .font(.title2)

                Text("Group features coming soon...")
                    .foregroundStyle(.secondary)
            }
            .navigationTitle("Home")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Sign Out") {
                        authService.signOut()
                    }
                }
            }
        }
    }
}

import SwiftUI
import Amplify
import AWSCognitoAuthPlugin

@main
struct FamilyMovieNightApp: App {
    @StateObject private var authService = AuthService()
    @StateObject private var profileSessionManager = ProfileSessionManager(
        authenticatedUser: .placeholder
    )

    init() {
        do {
            try Amplify.add(plugin: AWSCognitoAuthPlugin())
            try Amplify.configure()
        } catch {
            print("Failed to configure Amplify: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authService)
                .environmentObject(profileSessionManager)
                .task {
                    await authService.fetchSession()
                }
        }
    }
}

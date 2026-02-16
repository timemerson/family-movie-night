import SwiftUI
import Amplify
import AWSCognitoAuthPlugin

@main
struct FamilyMovieNightApp: App {
    @StateObject private var authService = AuthService()

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
                .task {
                    await authService.fetchSession()
                }
        }
    }
}

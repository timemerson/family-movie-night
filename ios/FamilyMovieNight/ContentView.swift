import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authService: AuthService

    var body: some View {
        SwiftUI.Group {
            if authService.isAuthenticated {
                HomeView()
            } else {
                SignInView()
            }
        }
    }
}

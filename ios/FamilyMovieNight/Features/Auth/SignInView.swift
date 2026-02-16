import SwiftUI
import AuthenticationServices

struct SignInView: View {
    @EnvironmentObject var authService: AuthService

    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {
                Spacer()

                Text("Family Movie Night")
                    .font(.largeTitle)
                    .fontWeight(.bold)

                Text("Pick movies together as a family")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                Spacer()

                SignInWithAppleButton(.signIn) { request in
                    request.requestedScopes = [.email, .fullName]
                } onCompletion: { result in
                    switch result {
                    case .success(let authorization):
                        handleAppleSignIn(authorization)
                    case .failure(let error):
                        print("Apple Sign-In failed: \(error)")
                    }
                }
                .signInWithAppleButtonStyle(.black)
                .frame(height: 50)

                NavigationLink("Sign in with email") {
                    EmailSignInView()
                }

                NavigationLink("Create an account") {
                    EmailSignUpView()
                }
                .padding(.bottom, 32)
            }
            .padding(.horizontal, 24)
        }
    }

    private func handleAppleSignIn(_ authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let identityToken = credential.identityToken,
              let authorizationCode = credential.authorizationCode else {
            return
        }
        Task {
            try? await authService.signInWithApple(
                identityToken: identityToken,
                authorizationCode: authorizationCode
            )
        }
    }
}

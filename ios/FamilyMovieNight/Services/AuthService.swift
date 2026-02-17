import Combine
import Foundation
import Amplify
import AWSCognitoAuthPlugin
import AWSPluginsCore

@MainActor
class AuthService: ObservableObject {
    @Published var isAuthenticated = false
    @Published var accessToken: String?
    @Published var userId: String?

    func signIn(email: String, password: String) async throws {
        let result = try await Amplify.Auth.signIn(username: email, password: password)
        guard result.isSignedIn else {
            throw AuthError.signInIncomplete
        }
        try await fetchTokensAndUser()
    }

    func signUp(email: String, password: String) async throws {
        let userAttributes = [AuthUserAttribute(.email, value: email)]
        let options = AuthSignUpRequest.Options(userAttributes: userAttributes)
        _ = try await Amplify.Auth.signUp(username: email, password: password, options: options)
    }

    func confirmSignUp(email: String, code: String) async throws {
        _ = try await Amplify.Auth.confirmSignUp(for: email, confirmationCode: code)
    }

    func signInWithApple(identityToken: Data, authorizationCode: Data) async throws {
        // Apple Sign-In requires Apple Developer credentials configured in Cognito.
        // Currently a placeholder — will be implemented once credentials are in place.
        throw AuthError.appleSignInNotConfigured
    }

    func signOut() async {
        _ = await Amplify.Auth.signOut()
        accessToken = nil
        userId = nil
        isAuthenticated = false
    }

    func refreshTokenIfNeeded() async throws {
        try await fetchTokensAndUser()
    }

    /// Restores a persisted session on app launch. Amplify stores sessions in the Keychain automatically.
    func fetchSession() async {
        do {
            let session = try await Amplify.Auth.fetchAuthSession()
            if session.isSignedIn {
                try await fetchTokensAndUser()
            }
        } catch {
            // No valid session — user will need to sign in
            accessToken = nil
            userId = nil
            isAuthenticated = false
        }
    }

    // MARK: - Private

    private func fetchTokensAndUser() async throws {
        let session = try await Amplify.Auth.fetchAuthSession()
        if let cognitoSession = session as? AuthCognitoTokensProvider {
            let tokens = try cognitoSession.getCognitoTokens().get()
            self.accessToken = tokens.idToken
        }
        let user = try await Amplify.Auth.getCurrentUser()
        self.userId = user.userId
        self.isAuthenticated = true
    }
}

enum AuthError: LocalizedError {
    case signInIncomplete
    case appleSignInNotConfigured

    var errorDescription: String? {
        switch self {
        case .signInIncomplete:
            return "Sign-in did not complete. Additional verification may be required."
        case .appleSignInNotConfigured:
            return "Apple Sign-In is not yet configured. Please use email and password to sign in."
        }
    }
}

import Amplify
import Combine
import Foundation
import os

private let logger = Logger(subsystem: "org.timemerson.FamilyMovieNight", category: "Auth")

@MainActor
class AuthViewModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var confirmPassword = ""
    @Published var verificationCode = ""
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var state: AuthState = .signIn

    enum AuthState {
        case signIn
        case signUp
        case verifyEmail
    }

    var isEmailValid: Bool {
        let pattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
        return email.wholeMatch(of: pattern) != nil
    }

    var isPasswordValid: Bool {
        password.count >= 8 && password.contains(where: \.isNumber)
    }

    var isConfirmPasswordValid: Bool {
        !confirmPassword.isEmpty && password == confirmPassword
    }

    var isVerificationCodeValid: Bool {
        verificationCode.count == 6 && verificationCode.allSatisfy(\.isNumber)
    }

    var canSignIn: Bool {
        isEmailValid && isPasswordValid
    }

    var canSignUp: Bool {
        isEmailValid && isPasswordValid && isConfirmPasswordValid
    }

    private var authService: AuthService?

    nonisolated init() {}

    init(authService: AuthService) {
        self.authService = authService
    }

    func configure(authService: AuthService) {
        self.authService = authService
    }

    func signIn() async {
        guard canSignIn else { return }
        isLoading = true
        errorMessage = nil
        do {
            logger.info("signIn: starting for \(self.email)")
            guard let authService else { return }
            try await authService.signIn(email: email, password: password)
            logger.info("signIn: success")
        } catch {
            logger.error("signIn: failed — \(String(describing: error))")
            errorMessage = Self.readableMessage(from: error)
        }
        isLoading = false
    }

    func signUp() async {
        guard canSignUp else { return }
        isLoading = true
        errorMessage = nil
        do {
            guard let authService else { return }
            logger.info("signUp: starting for \(self.email)")
            try await authService.signUp(email: email, password: password)
            logger.info("signUp: success, moving to verify")
            state = .verifyEmail
        } catch {
            logger.error("signUp: failed — \(String(describing: error))")
            errorMessage = Self.readableMessage(from: error)
        }
        isLoading = false
    }

    func confirmSignUp() async {
        guard isVerificationCodeValid else { return }
        isLoading = true
        errorMessage = nil
        do {
            guard let authService else { return }
            logger.info("confirmSignUp: confirming code for \(self.email)")
            try await authService.confirmSignUp(email: email, code: verificationCode)
            logger.info("confirmSignUp: success, now signing in")
        } catch let error as AuthError {
            // If already confirmed, that's fine — proceed to sign in
            if error.errorDescription?.contains("CONFIRMED") == true {
                logger.info("confirmSignUp: user already confirmed, proceeding to sign in")
            } else {
                logger.error("confirmSignUp: failed — \(String(describing: error))")
                errorMessage = Self.readableMessage(from: error)
                isLoading = false
                return
            }
        } catch {
            logger.error("confirmSignUp: failed — \(String(describing: error))")
            errorMessage = Self.readableMessage(from: error)
            isLoading = false
            return
        }
        do {
            try await authService!.signIn(email: email, password: password)
            logger.info("confirmSignUp: sign-in success")
        } catch {
            logger.error("confirmSignUp: sign-in failed — \(String(describing: error))")
            errorMessage = Self.readableMessage(from: error)
        }
        isLoading = false
    }

    private static func readableMessage(from error: Error) -> String {
        if let authError = error as? AuthError {
            return authError.errorDescription ?? error.localizedDescription
        }
        return error.localizedDescription
    }
}

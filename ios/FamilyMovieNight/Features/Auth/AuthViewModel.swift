import Foundation

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

    private let authService: AuthService

    init(authService: AuthService) {
        self.authService = authService
    }

    func signIn() async {
        guard canSignIn else { return }
        isLoading = true
        errorMessage = nil
        do {
            try await authService.signIn(email: email, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func signUp() async {
        guard canSignUp else { return }
        isLoading = true
        errorMessage = nil
        do {
            try await authService.signUp(email: email, password: password)
            state = .verifyEmail
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func confirmSignUp() async {
        guard isVerificationCodeValid else { return }
        isLoading = true
        errorMessage = nil
        do {
            try await authService.confirmSignUp(email: email, code: verificationCode)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

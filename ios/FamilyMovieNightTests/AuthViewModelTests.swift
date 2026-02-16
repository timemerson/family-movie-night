import XCTest
@testable import FamilyMovieNight

@MainActor
final class AuthViewModelTests: XCTestCase {

    private func makeSUT() -> AuthViewModel {
        AuthViewModel(authService: AuthService())
    }

    // MARK: - Email Validation

    func testValidEmail() {
        let vm = makeSUT()
        vm.email = "test@example.com"
        XCTAssertTrue(vm.isEmailValid)
    }

    func testInvalidEmail() {
        let vm = makeSUT()
        vm.email = "not-an-email"
        XCTAssertFalse(vm.isEmailValid)
    }

    func testEmptyEmail() {
        let vm = makeSUT()
        vm.email = ""
        XCTAssertFalse(vm.isEmailValid)
    }

    // MARK: - Password Validation

    func testValidPassword() {
        let vm = makeSUT()
        vm.password = "password1"
        XCTAssertTrue(vm.isPasswordValid)
    }

    func testPasswordTooShort() {
        let vm = makeSUT()
        vm.password = "pass1"
        XCTAssertFalse(vm.isPasswordValid)
    }

    func testPasswordNoDigit() {
        let vm = makeSUT()
        vm.password = "password"
        XCTAssertFalse(vm.isPasswordValid)
    }

    // MARK: - Confirm Password

    func testConfirmPasswordMatch() {
        let vm = makeSUT()
        vm.password = "password1"
        vm.confirmPassword = "password1"
        XCTAssertTrue(vm.isConfirmPasswordValid)
    }

    func testConfirmPasswordMismatch() {
        let vm = makeSUT()
        vm.password = "password1"
        vm.confirmPassword = "password2"
        XCTAssertFalse(vm.isConfirmPasswordValid)
    }

    // MARK: - Verification Code

    func testValidVerificationCode() {
        let vm = makeSUT()
        vm.verificationCode = "123456"
        XCTAssertTrue(vm.isVerificationCodeValid)
    }

    func testVerificationCodeTooShort() {
        let vm = makeSUT()
        vm.verificationCode = "12345"
        XCTAssertFalse(vm.isVerificationCodeValid)
    }

    func testVerificationCodeNonNumeric() {
        let vm = makeSUT()
        vm.verificationCode = "12345a"
        XCTAssertFalse(vm.isVerificationCodeValid)
    }

    // MARK: - Combined Validation

    func testCanSignIn() {
        let vm = makeSUT()
        vm.email = "test@example.com"
        vm.password = "password1"
        XCTAssertTrue(vm.canSignIn)
    }

    func testCannotSignInWithInvalidEmail() {
        let vm = makeSUT()
        vm.email = "bad"
        vm.password = "password1"
        XCTAssertFalse(vm.canSignIn)
    }

    func testCanSignUp() {
        let vm = makeSUT()
        vm.email = "test@example.com"
        vm.password = "password1"
        vm.confirmPassword = "password1"
        XCTAssertTrue(vm.canSignUp)
    }

    func testCannotSignUpWithMismatchedPasswords() {
        let vm = makeSUT()
        vm.email = "test@example.com"
        vm.password = "password1"
        vm.confirmPassword = "password2"
        XCTAssertFalse(vm.canSignUp)
    }

    // MARK: - State Transitions

    func testInitialState() {
        let vm = makeSUT()
        XCTAssertEqual(vm.state, .signIn)
        XCTAssertFalse(vm.isLoading)
        XCTAssertNil(vm.errorMessage)
    }
}

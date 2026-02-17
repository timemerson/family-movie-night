import SwiftUI

struct EmailSignUpView: View {
    @EnvironmentObject var authService: AuthService
    @StateObject private var viewModel = AuthViewModel()

    var body: some View {
        Form {
            Section {
                TextField("Email", text: $viewModel.email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)

                SecureField("Password (8+ chars, 1 number)", text: $viewModel.password)
                    .textContentType(.newPassword)

                SecureField("Confirm password", text: $viewModel.confirmPassword)
                    .textContentType(.newPassword)
            }

            if let error = viewModel.errorMessage {
                Section {
                    Text(error)
                        .foregroundStyle(.red)
                }
            }

            Section {
                Button("Create Account") {
                    Task { await viewModel.signUp() }
                }
                .disabled(!viewModel.canSignUp || viewModel.isLoading)
            }
        }
        .navigationTitle("Sign Up")
        .onAppear {
            viewModel.configure(authService: authService)
        }
        .sheet(isPresented: Binding(
            get: { viewModel.state == .verifyEmail },
            set: { if !$0 { viewModel.state = .signUp } }
        )) {
            VerifyEmailView(viewModel: viewModel)
        }
    }
}

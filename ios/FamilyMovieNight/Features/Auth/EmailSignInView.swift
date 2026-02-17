import SwiftUI

struct EmailSignInView: View {
    @EnvironmentObject var authService: AuthService
    @StateObject private var viewModel = AuthViewModel()

    var body: some View {
        Form {
            Section {
                TextField("Email", text: $viewModel.email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)

                SecureField("Password", text: $viewModel.password)
                    .textContentType(.password)
            }

            if let error = viewModel.errorMessage {
                Section {
                    Text(error)
                        .foregroundStyle(.red)
                }
            }

            Section {
                Button("Sign In") {
                    Task { await viewModel.signIn() }
                }
                .disabled(!viewModel.canSignIn || viewModel.isLoading)
            }
        }
        .navigationTitle("Sign In")
        .onAppear {
            viewModel.configure(authService: authService)
        }
    }
}

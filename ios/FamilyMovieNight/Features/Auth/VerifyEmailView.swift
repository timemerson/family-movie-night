import SwiftUI

struct VerifyEmailView: View {
    @ObservedObject var viewModel: AuthViewModel

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("Check your email")
                    .font(.title2)
                    .fontWeight(.semibold)

                Text("We sent a 6-digit code to \(viewModel.email)")
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                TextField("Verification code", text: $viewModel.verificationCode)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .multilineTextAlignment(.center)
                    .font(.title)
                    .padding()

                if let error = viewModel.errorMessage {
                    Text(error)
                        .foregroundStyle(.red)
                        .font(.caption)
                }

                Button("Verify") {
                    Task { await viewModel.confirmSignUp() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!viewModel.isVerificationCodeValid || viewModel.isLoading)
            }
            .padding()
            .navigationTitle("Verify Email")
        }
    }
}

import SwiftUI

struct JoinGroupView: View {
    @ObservedObject var viewModel: GroupViewModel
    @State private var inviteCode = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Invite code", text: $inviteCode)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                } header: {
                    Text("Enter the invite code shared by your family")
                }

                if let error = viewModel.error {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Join Group")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Join") {
                        Task {
                            await viewModel.acceptInvite(token: inviteCode)
                            if viewModel.group != nil {
                                dismiss()
                            }
                        }
                    }
                    .disabled(inviteCode.trimmingCharacters(in: .whitespaces).isEmpty || viewModel.isLoading)
                }
            }
        }
    }
}

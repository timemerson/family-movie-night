import SwiftUI

struct CreateGroupView: View {
    @ObservedObject var viewModel: GroupViewModel
    @State private var groupName = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Group name", text: $groupName)
                        .textContentType(.organizationName)
                } header: {
                    Text("Give your family group a name")
                }

                if let error = viewModel.error {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Create Group")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task {
                            await viewModel.createGroup(name: groupName)
                            if viewModel.group != nil {
                                dismiss()
                            }
                        }
                    }
                    .disabled(groupName.trimmingCharacters(in: .whitespaces).isEmpty || viewModel.isLoading)
                }
            }
        }
    }
}

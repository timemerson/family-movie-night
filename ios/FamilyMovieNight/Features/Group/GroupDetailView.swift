import SwiftUI

struct GroupDetailView: View {
    @ObservedObject var viewModel: GroupViewModel
    @StateObject private var preferencesViewModel = PreferencesViewModel()
    @StateObject private var suggestionsViewModel = SuggestionsViewModel()
    @StateObject private var watchlistViewModel = WatchlistViewModel()
    @State private var showShareSheet = false
    @State private var showLeaveConfirmation = false

    private var isCreator: Bool {
        guard let userId = viewModel.currentUserId,
              let group = viewModel.group else { return false }
        return group.members.first(where: { $0.isCreator })?.userId == userId
    }

    var body: some View {
        if let group = viewModel.group {
            List {
                Section("Members (\(group.members.count)/8)") {
                    ForEach(group.members) { member in
                        HStack {
                            Text(member.displayName)
                            Spacer()
                            if member.isCreator {
                                Text("Creator")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                Section {
                    NavigationLink {
                        SuggestionsView(
                            viewModel: suggestionsViewModel,
                            watchlistViewModel: watchlistViewModel
                        )
                    } label: {
                        Label("Suggest Movies", systemImage: "sparkles")
                    }

                    NavigationLink {
                        WatchlistView(
                            viewModel: watchlistViewModel,
                            apiClient: viewModel.apiClient,
                            groupId: group.groupId
                        )
                    } label: {
                        Label("Watchlist", systemImage: "bookmark")
                    }
                }

                Section {
                    NavigationLink("My Preferences") {
                        PreferencesView(viewModel: preferencesViewModel)
                    }
                }

                if isCreator {
                    Section {
                        Button("Share Invite Link") {
                            Task {
                                await viewModel.createInvite()
                                if viewModel.currentInvite != nil {
                                    showShareSheet = true
                                }
                            }
                        }
                    }
                }

                if let error = viewModel.error {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button("Leave Group", role: .destructive) {
                        showLeaveConfirmation = true
                    }
                }
            }
            .navigationTitle(group.name)
            .sheet(isPresented: $showShareSheet) {
                if let invite = viewModel.currentInvite {
                    ShareInviteView(inviteUrl: invite.inviteUrl, inviteToken: invite.inviteToken)
                }
            }
            .confirmationDialog(
                "Leave Group?",
                isPresented: $showLeaveConfirmation,
                titleVisibility: .visible
            ) {
                Button("Leave", role: .destructive) {
                    Task { await viewModel.leaveGroup() }
                }
            } message: {
                Text("You'll need a new invite to rejoin.")
            }
            .onAppear {
                if let apiClient = viewModel.apiClient {
                    preferencesViewModel.configure(apiClient: apiClient, groupId: group.groupId)
                    suggestionsViewModel.configure(apiClient: apiClient, groupId: group.groupId)
                    watchlistViewModel.configure(apiClient: apiClient, groupId: group.groupId)
                }
            }
        }
    }
}

struct ShareInviteView: View {
    let inviteUrl: String
    let inviteToken: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Text("Share this code with your family:")
                    .font(.headline)

                Text(inviteToken)
                    .font(.system(.title2, design: .monospaced))
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(8)

                Button("Copy Invite Link") {
                    UIPasteboard.general.string = inviteUrl
                }
                .buttonStyle(.borderedProminent)

                Text("The invite expires in 7 days.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding()
            .navigationTitle("Invite Link")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

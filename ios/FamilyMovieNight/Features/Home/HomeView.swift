import SwiftUI

struct HomeView: View {
    @EnvironmentObject var authService: AuthService
    @StateObject private var groupViewModel = GroupViewModel()

    @State private var showCreateGroup = false
    @State private var showJoinGroup = false

    var body: some View {
        NavigationStack {
            Group {
                if groupViewModel.isLoading {
                    ProgressView("Loading...")
                } else if groupViewModel.group != nil {
                    GroupDetailView(viewModel: groupViewModel)
                } else {
                    noGroupView
                }
            }
            .navigationTitle("Family Movie Night")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Sign Out") {
                        authService.signOut()
                    }
                }
            }
        }
        .task {
            let client = APIClient(
                baseURL: URL(string: "https://api.familymovienight.app")!,
                authService: authService
            )
            groupViewModel.configure(
                apiClient: client,
                currentUserId: authService.userId ?? ""
            )
            await groupViewModel.loadMyGroup()
        }
    }

    private var noGroupView: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "film.stack")
                .font(.system(size: 60))
                .foregroundStyle(.secondary)

            Text("Welcome to Family Movie Night!")
                .font(.title2)
                .multilineTextAlignment(.center)

            Text("Create a new group or join an existing one to get started.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            if let error = groupViewModel.error {
                Text(error)
                    .foregroundStyle(.red)
                    .font(.callout)
            }

            VStack(spacing: 12) {
                Button {
                    showCreateGroup = true
                } label: {
                    Text("Create a Group")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)

                Button {
                    showJoinGroup = true
                } label: {
                    Text("Join with Invite Code")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
            .padding(.horizontal, 40)

            Spacer()
        }
        .sheet(isPresented: $showCreateGroup) {
            CreateGroupView(viewModel: groupViewModel)
        }
        .sheet(isPresented: $showJoinGroup) {
            JoinGroupView(viewModel: groupViewModel)
        }
    }
}

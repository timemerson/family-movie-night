import SwiftUI

struct HomeView: View {
    @EnvironmentObject var authService: AuthService
    @EnvironmentObject var profileSessionManager: ProfileSessionManager
    @StateObject private var groupViewModel = GroupViewModel()

    @State private var showCreateGroup = false
    @State private var showJoinGroup = false
    @State private var showProfileSwitcher = false
    @State private var navigationPath = NavigationPath()

    var body: some View {
        NavigationStack(path: $navigationPath) {
            SwiftUI.Group {
                if groupViewModel.isLoading {
                    ProgressView("Loading...")
                } else if groupViewModel.group != nil {
                    GroupDetailView(viewModel: groupViewModel, navigationPath: $navigationPath)
                } else {
                    noGroupView
                }
            }
            .navigationTitle("Family Movie Night")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if groupViewModel.group != nil {
                        Button {
                            showProfileSwitcher = true
                        } label: {
                            ProfileAvatarNavButton(activeProfile: profileSessionManager.activeProfile)
                        }
                    } else {
                        Button("Sign Out") {
                            profileSessionManager.resetToAuthenticatedUser()
                            Task { await authService.signOut() }
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showProfileSwitcher) {
            ProfileSwitcherView(
                loadState: profileSessionManager.managedProfiles.isEmpty ? .noManaged : .hasManaged,
                householdName: groupViewModel.group?.name ?? "Family"
            )
            .environmentObject(profileSessionManager)
        }
        .task {
            let client = APIClient(
                baseURL: URL(string: "https://ikg34rhjk0.execute-api.us-east-1.amazonaws.com")!,
                authService: authService,
                profileSessionManager: profileSessionManager
            )
            groupViewModel.configure(
                apiClient: client,
                currentUserId: authService.userId ?? ""
            )
            await groupViewModel.loadMyGroup()

            // Update profile session manager with loaded group data
            updateProfileSessionManager()
        }
        .onChange(of: groupViewModel.group) {
            updateProfileSessionManager()
        }
    }

    private func updateProfileSessionManager() {
        guard let group = groupViewModel.group,
              let currentUserId = groupViewModel.currentUserId else { return }

        guard let authenticatedMember = group.members.first(where: { $0.userId == currentUserId }) else { return }

        let authenticatedUser = SwitchableProfile.from(authenticatedMember, isAuthenticatedUser: true)
        let managedMembers = group.members
            .filter { $0.isManagedMember && $0.parentUserId == currentUserId }
            .map { SwitchableProfile.from($0, isAuthenticatedUser: false) }

        profileSessionManager.updateProfiles(
            authenticatedUser: authenticatedUser,
            managedMembers: managedMembers
        )
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

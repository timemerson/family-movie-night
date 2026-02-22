import SwiftUI

// MARK: - DevMenuView
//
// SwiftUI Preview Harness — entry point for navigating all v1 screens
// using fake ViewModels and sample data. Groups screens by slice.
//
// To use: Launch via ContentView dev flag OR directly in Xcode previews.
// No real networking or persistence is used anywhere in this harness.

struct DevMenuView: View {
    @StateObject private var profileSessionManager: ProfileSessionManager = {
        let manager = ProfileSessionManager(authenticatedUser: SampleData.profileTim)
        manager.updateProfiles(
            authenticatedUser: SampleData.profileTim,
            managedMembers: [SampleData.profileMax, SampleData.profileEmily]
        )
        return manager
    }()

    @State private var showProfileSwitcher = false

    var body: some View {
        NavigationStack {
            List {
                c1RatingsSection
                c4ProfileSection
                c5ManagedMembersSection
                c6AttendeeSection
                c7SessionHistorySection
                sharedComponentsSection
            }
            .navigationTitle("Dev Menu")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showProfileSwitcher = true
                    } label: {
                        ProfileAvatarNavButton(
                            activeProfile: profileSessionManager.activeProfile
                        )
                    }
                    .accessibilityLabel(
                        profileSessionManager.isActingAsManaged
                            ? "Viewing as \(profileSessionManager.activeProfile.displayName). Double-tap to switch profiles."
                            : "Profile: \(profileSessionManager.activeProfile.displayName). Double-tap to switch profiles."
                    )
                }
            }
            .sheet(isPresented: $showProfileSwitcher) {
                ProfileSwitcherView(
                    loadState: .hasManaged,
                    householdName: "The Emersons"
                )
                .environmentObject(profileSessionManager)
            }
        }
        .environmentObject(profileSessionManager)
    }

    // MARK: - C1: Ratings

    private var c1RatingsSection: some View {
        Section("C1 — Ratings") {
            // RatingView states
            devRow("RatingView — Unrated") {
                NavigationStack {
                    RatingView(viewModel: .makeUnrated())
                }
            }
            devRow("RatingView — Loading") {
                NavigationStack {
                    RatingView(viewModel: .makeLoading())
                }
            }
            devRow("RatingView — Wait State") {
                NavigationStack {
                    RatingView(viewModel: .makeWaitState())
                }
            }
            devRow("RatingView — All Rated") {
                NavigationStack {
                    RatingView(viewModel: .makeAllRated())
                }
            }
            devRow("RatingView — Already Rated") {
                NavigationStack {
                    RatingView(viewModel: .makeAlreadyRated())
                }
            }
            devRow("RatingView — Managed Member") {
                NavigationStack {
                    RatingView(viewModel: .makeManagedMember())
                }
            }
            devRow("RatingView — Error") {
                NavigationStack {
                    RatingView(viewModel: .makeError())
                }
            }

            // RatingSelectorView
            devRow("RatingSelectorView") {
                RatingSelectorPreview()
            }

            // RatingSummaryView
            devRow("RatingSummaryView") {
                RatingSummaryPreview()
            }
        }
    }

    // MARK: - C4: Profile Switching

    private var c4ProfileSection: some View {
        Section("C4 — Profile Switching") {
            devRow("ProfileSwitcherView — No Managed") {
                ProfileSwitcherViewNoManaged()
            }

            devRow("ProfileSwitcherView — With Members") {
                ProfileSwitcherView(loadState: .hasManaged, householdName: "The Emersons")
                    .environmentObject(profileSessionManager)
            }

            devRow("ProfileSwitcherView — Loading") {
                ProfileSwitcherViewLoading()
            }

            devRow("ProfileSwitcherView — Error") {
                ProfileSwitcherViewError()
            }

            devRow("ActiveProfileBanner") {
                ActiveProfileBannerPreview()
            }
        }
    }

    // MARK: - C5: Managed Members

    private var c5ManagedMembersSection: some View {
        Section("C5 — Add Managed Member") {
            devRow("AddManagedMemberView — Empty Form") {
                AddManagedMemberView(viewModel: .makeEmpty())
            }
            devRow("AddManagedMemberView — Submitting") {
                AddManagedMemberView(viewModel: .makeSubmitting())
            }
            devRow("AddManagedMemberView — Success") {
                AddManagedMemberView(viewModel: .makeSuccess())
            }
            devRow("AddManagedMemberView — Error") {
                AddManagedMemberView(viewModel: .makeError())
            }
            devRow("AvatarPickerView") {
                AvatarPickerPreview()
            }
        }
    }

    // MARK: - C6: Attendee Selection

    private var c6AttendeeSection: some View {
        Section("C6 — Attendee Selection") {
            devNavRow("AttendeeSelectionView — Populated") {
                AttendeeSelectionView(viewModel: .makePopulated())
            }
            devNavRow("AttendeeSelectionView — Below Min (validation)") {
                AttendeeSelectionView(viewModel: .makeOnlyTwo())
            }
            devNavRow("AttendeeSelectionView — Loading") {
                AttendeeSelectionView(viewModel: .makeLoading())
            }
            devNavRow("AttendeeSelectionView — Error") {
                AttendeeSelectionView(viewModel: .makeError())
            }
        }
    }

    // MARK: - C7: Session History

    private var c7SessionHistorySection: some View {
        Section("C7 — Session History") {
            devNavRow("SessionHistoryView — Populated") {
                SessionHistoryView(viewModel: .makePopulated())
            }
            devNavRow("SessionHistoryView — Loading") {
                SessionHistoryView(viewModel: .makeLoading())
            }
            devNavRow("SessionHistoryView — Empty") {
                SessionHistoryView(viewModel: .makeEmpty())
            }
            devNavRow("SessionHistoryView — Error") {
                SessionHistoryView(viewModel: .makeError())
            }
            devNavRow("SessionDetailView — Rated") {
                SessionDetailView(viewModel: .makePopulated())
            }
            devNavRow("SessionDetailView — With Rate Now") {
                SessionDetailView(viewModel: .makeWatchedWithRateNow())
            }
            devNavRow("SessionDetailView — Loading") {
                SessionDetailView(viewModel: .makeLoading())
            }
            devNavRow("SessionDetailView — Error") {
                SessionDetailView(viewModel: .makeError())
            }
        }
    }

    // MARK: - Shared Components

    private var sharedComponentsSection: some View {
        Section("Shared Components") {
            devNavRow("MovieHeaderCard") {
                MovieHeaderCardPreview()
            }
            devNavRow("ProfileAvatarView — All Sizes") {
                ProfileAvatarPreview()
            }
            devNavRow("MemberChip") {
                MemberChipPreview()
            }
            devNavRow("SessionStatusBadgeView") {
                SessionStatusBadgePreview()
            }
            devNavRow("RatingMemberRowView") {
                RatingMemberRowPreview()
            }
            devNavRow("SessionHistoryRowView") {
                SessionHistoryRowPreview()
            }
            devNavRow("SessionSuggestionRowView") {
                SessionSuggestionRowPreview()
            }
        }
    }

    // MARK: - Row Helpers

    /// Sheet presentation row — for screens that must be presented as sheets
    private func devRow<Destination: View>(
        _ title: String,
        @ViewBuilder destination: @escaping () -> Destination
    ) -> some View {
        DevSheetRow(title: title, destination: destination)
    }

    /// Navigation push row — for screens pushed onto a navigation stack
    private func devNavRow<Destination: View>(
        _ title: String,
        @ViewBuilder destination: @escaping () -> Destination
    ) -> some View {
        NavigationLink(title) {
            destination()
        }
    }
}

// MARK: - ProfileSwitcher Dev Wrappers
// These wrappers create their own ProfileSessionManager instances so each
// preview state is self-contained and doesn't share state with the Dev Menu.

private struct ProfileSwitcherViewNoManaged: View {
    @StateObject private var manager: ProfileSessionManager = {
        let m = ProfileSessionManager(authenticatedUser: SampleData.profileTim)
        m.updateProfiles(authenticatedUser: SampleData.profileTim, managedMembers: [])
        return m
    }()
    var body: some View {
        ProfileSwitcherView(loadState: .noManaged, householdName: "The Emersons")
            .environmentObject(manager)
    }
}

private struct ProfileSwitcherViewLoading: View {
    @StateObject private var manager = ProfileSessionManager(authenticatedUser: SampleData.profileTim)
    var body: some View {
        ProfileSwitcherView(loadState: .loading, householdName: "The Emersons")
            .environmentObject(manager)
    }
}

private struct ProfileSwitcherViewError: View {
    @StateObject private var manager: ProfileSessionManager = {
        let m = ProfileSessionManager(authenticatedUser: SampleData.profileTim)
        m.updateProfiles(authenticatedUser: SampleData.profileTim, managedMembers: [])
        return m
    }()
    var body: some View {
        ProfileSwitcherView(loadState: .error, householdName: "The Emersons")
            .environmentObject(manager)
    }
}

// MARK: - DevSheetRow

private struct DevSheetRow<Destination: View>: View {
    let title: String
    let destination: () -> Destination
    @State private var isPresented = false

    var body: some View {
        Button {
            isPresented = true
        } label: {
            HStack {
                Text(title)
                    .foregroundStyle(.primary)
                Spacer()
                Image(systemName: "arrow.up.right.square")
                    .foregroundStyle(Color.primaryAccent)
                    .font(.caption)
            }
        }
        .sheet(isPresented: $isPresented) {
            ZStack(alignment: .topTrailing) {
                destination()
                // Dev harness escape hatch — always dismissable
                Button {
                    isPresented = false
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(.secondary)
                        .padding(8)
                }
                .accessibilityLabel("Close preview")
            }
            .interactiveDismissDisabled(false)
        }
    }
}

// MARK: - Inline Preview Screens (for component showcases)

private struct RatingSelectorPreview: View {
    @State private var selected: RatingValue? = nil
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Text("Rating Selector")
                    .font(.title2)
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.top, 24)

                RatingSelectorView(selectedRating: $selected)

                if let selected {
                    Text("Selected: \(selected.label)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .background(Color.appBackground)
        .navigationTitle("RatingSelectorView")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct RatingSummaryPreview: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                sectionHeader("Compact — Empty")
                RatingSummaryView(summary: SampleData.summaryEmpty, style: .compact)
                sectionHeader("Compact — Partial")
                RatingSummaryView(summary: SampleData.summaryPartial, style: .compact)
                sectionHeader("Compact — All Rated")
                RatingSummaryView(summary: SampleData.summaryAllRated, style: .compact)
                sectionHeader("Expanded — Partial")
                RatingSummaryView(summary: SampleData.summaryPartial, style: .expanded)
                sectionHeader("Expanded — All Rated")
                RatingSummaryView(summary: SampleData.summaryAllRated, style: .expanded)
            }
            .padding(.horizontal, 16)
        }
        .background(Color.appBackground)
        .navigationTitle("RatingSummaryView")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func sectionHeader(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .fontWeight(.semibold)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 8)
    }
}

private struct ActiveProfileBannerPreview: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Text("Voting Context").font(.caption).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                ActiveProfileBanner(context: .voting, name: "Max", avatarKey: "avatar_dino")
                Text("Preferences Context").font(.caption).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 8)
                ActiveProfileBanner(context: .preferences, name: "Max", avatarKey: "avatar_dino")
            }
            .padding(16)
        }
        .background(Color.appBackground)
        .navigationTitle("ActiveProfileBanner")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct AvatarPickerPreview: View {
    @State private var selected = "avatar_bear"
    var body: some View {
        VStack(spacing: 16) {
            Text("Selected: \(selected)")
                .font(.caption)
                .foregroundStyle(.secondary)
            AvatarPickerView(selectedAvatarKey: $selected)
            Spacer()
        }
        .padding(16)
        .background(Color.appBackground)
        .navigationTitle("AvatarPickerView")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct MovieHeaderCardPreview: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                MovieHeaderCard(
                    title: "The Incredibles",
                    year: 2004,
                    contentRating: "PG",
                    posterURL: URL(string: "https://image.tmdb.org/t/p/w185/2LqaLgk4Z226KkgPJuiOQ58XLef.jpg")
                )
                MovieHeaderCard(
                    title: "Spirited Away",
                    year: 2001,
                    contentRating: "PG",
                    posterURL: nil
                )
                MovieHeaderCard(
                    title: "Everything Everywhere All at Once",
                    year: 2022,
                    contentRating: "R",
                    posterURL: nil
                )
            }
            .padding(16)
        }
        .background(Color.appBackground)
        .navigationTitle("MovieHeaderCard")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct ProfileAvatarPreview: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Sizes").font(.title3).fontWeight(.semibold)
                HStack(spacing: 16) {
                    VStack {
                        ProfileAvatarView(avatarKey: "avatar_bear", size: .xsmall)
                        Text("xsmall").font(.caption2)
                    }
                    VStack {
                        ProfileAvatarView(avatarKey: "avatar_bear", size: .small)
                        Text("small").font(.caption2)
                    }
                    VStack {
                        ProfileAvatarView(avatarKey: "avatar_bear", size: .medium)
                        Text("medium").font(.caption2)
                    }
                    VStack {
                        ProfileAvatarView(avatarKey: "avatar_bear", size: .large)
                        Text("large").font(.caption2)
                    }
                }
                Text("All Avatars").font(.title3).fontWeight(.semibold)
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 6), spacing: 8) {
                    ForEach(AvatarDefinition.allAvatars) { avatar in
                        VStack(spacing: 2) {
                            ProfileAvatarView(avatarKey: avatar.key, size: .medium)
                            Text(avatar.emoji).font(.caption2)
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Color.appBackground)
        .navigationTitle("ProfileAvatarView")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct MemberChipPreview: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Member Chips").font(.title3).fontWeight(.semibold)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(SampleData.allMembers) { member in
                            MemberChip(displayName: member.displayName, avatarKey: member.avatarKey)
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Color.appBackground)
        .navigationTitle("MemberChip")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct SessionStatusBadgePreview: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(SessionStatus.allCases, id: \.rawValue) { status in
                    HStack {
                        SessionStatusBadgeView(status: status)
                        Text("— \(status.rawValue)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(16)
        }
        .background(Color.appBackground)
        .navigationTitle("SessionStatusBadgeView")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct RatingMemberRowPreview: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ForEach(Array(SampleData.allRatingEntries.enumerated()), id: \.element.id) { index, entry in
                    RatingMemberRowView(entry: entry)
                        .padding(.horizontal, 16)
                    if index < SampleData.allRatingEntries.count - 1 {
                        Divider().padding(.leading, 56)
                    }
                }
            }
            .background(RoundedRectangle(cornerRadius: 16).fill(Color.cardBackground))
            .padding(16)
        }
        .background(Color.appBackground)
        .navigationTitle("RatingMemberRowView")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct SessionHistoryRowPreview: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                ForEach(SampleData.allSessions) { session in
                    SessionHistoryRowView(session: session)
                }
            }
            .padding(16)
        }
        .background(Color.appBackground)
        .navigationTitle("SessionHistoryRowView")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct SessionSuggestionRowPreview: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                SessionSuggestionRowView(
                    suggestion: SampleData.suggestionIncredibles,
                    isPicked: true
                )
                SessionSuggestionRowView(
                    suggestion: SampleData.suggestionSpirited,
                    isPicked: false
                )
                SessionSuggestionRowView(
                    suggestion: SampleData.suggestionNemo,
                    isPicked: false
                )
            }
            .padding(16)
        }
        .background(Color.appBackground)
        .navigationTitle("SessionSuggestionRowView")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Previews

#Preview("Dev Menu — Light") {
    DevMenuView()
}

#Preview("Dev Menu — Dark") {
    DevMenuView()
        .preferredColorScheme(.dark)
}

#Preview("Dev Menu — Large Type") {
    DevMenuView()
        .environment(\.sizeCategory, .accessibilityLarge)
}

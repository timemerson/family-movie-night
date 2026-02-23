import SwiftUI

// MARK: - SessionDetailView
//
// Full breakdown of one session: attendees, suggestions with votes, pick, and ratings.
// Pushed from SessionHistoryView. "Rate Now" presents RatingView as a sheet.

struct SessionDetailView: View {
    @StateObject var viewModel: SessionDetailViewModel
    @EnvironmentObject var profileSessionManager: ProfileSessionManager
    var apiClient: APIClient?
    var roundId: String = ""
    var groupId: String = ""
    var isCreator: Bool = false
    @State private var showRatingSheet = false

    private var navigationTitle: String {
        viewModel.pickedSuggestion?.title ?? "Session Detail"
    }

    var body: some View {
        SwiftUI.Group {
            if viewModel.isLoadingRound {
                loadingContent
            } else if let error = viewModel.error {
                errorContent(error)
            } else if viewModel.roundDetails != nil {
                populatedContent
            } else {
                loadingContent
            }
        }
        .background(Color.appBackground)
        .navigationTitle(navigationTitle)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if viewModel.roundId.isEmpty {
                viewModel.configure(
                    apiClient: apiClient,
                    roundId: roundId,
                    groupId: groupId,
                    activeMemberId: profileSessionManager.activeProfile.memberId,
                    isCreator: isCreator,
                    activeProfileName: profileSessionManager.isActingAsManaged
                        ? profileSessionManager.activeProfile.displayName : nil
                )
            }
            if viewModel.roundDetails == nil {
                await viewModel.loadAll()
            }
        }
        .refreshable {
            await viewModel.refresh()
        }
        .sheet(isPresented: $showRatingSheet, onDismiss: {
            Task { await viewModel.loadRatings() }
        }) {
            NavigationStack {
                RatingView(viewModel: makeRatingViewModel())
            }
        }
    }

    // MARK: - Loading Content

    private var loadingContent: some View {
        ScrollView {
            VStack(spacing: 0) {
                // MovieHeaderCard skeleton
                HStack(spacing: 12) {
                    SkeletonRectangle(width: 60, height: 90, cornerRadius: 8)
                    VStack(alignment: .leading, spacing: 6) {
                        SkeletonRectangle(width: 160, height: 16, cornerRadius: 6)
                        SkeletonRectangle(width: 80, height: 12, cornerRadius: 6)
                    }
                    Spacer()
                }
                .padding(16)
                .background(RoundedRectangle(cornerRadius: 16).fill(Color.cardBackground))
                .padding(.horizontal, 16)
                .padding(.top, 16)

                // Section skeletons
                VStack(spacing: 12) {
                    ForEach(0..<3, id: \.self) { _ in
                        SkeletonRectangle(height: 80, cornerRadius: 16)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 20)
            }
        }
    }

    // MARK: - Error Content

    private func errorContent(_ message: String) -> some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "exclamationmark.triangle")
                .font(.title2)
                .foregroundStyle(Color.warningAccent)
            Text(message)
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            SecondaryButton(title: "Try Again") {
                Task { await viewModel.loadAll() }
            }
            .padding(.horizontal, 32)
            Spacer()
        }
    }

    // MARK: - Populated Content

    private var populatedContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if let pick = viewModel.pickedSuggestion {
                    // MovieHeaderCard
                    MovieHeaderCard(
                        title: pick.title,
                        year: pick.year,
                        contentRating: pick.contentRating,
                        posterURL: pick.posterURL
                    )
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                } else if viewModel.roundDetails != nil {
                    // No pick card
                    noPickCard
                        .padding(.horizontal, 16)
                        .padding(.top, 16)
                }

                // Status row
                if let detail = viewModel.roundDetails {
                    statusRow(for: detail)
                        .padding(.horizontal, 16)
                        .padding(.top, 20)
                }

                // Attendees section
                if let detail = viewModel.roundDetails {
                    sectionHeader("Attendees")
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(detail.attendees) { attendee in
                                MemberChip(
                                    displayName: attendee.displayName,
                                    avatarKey: attendee.avatarKey ?? ""
                                )
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                    .padding(.top, 12)
                }

                // Vote breakdown section
                if let detail = viewModel.roundDetails, !detail.suggestions.isEmpty {
                    sectionHeader("Vote Breakdown")
                    VStack(spacing: 12) {
                        ForEach(detail.suggestions) { suggestion in
                            SessionSuggestionRowView(
                                suggestion: suggestion,
                                isPicked: suggestion.tmdbMovieId == detail.pickedMovieId
                            )
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                }

                // Ratings section
                if let detail = viewModel.roundDetails,
                   detail.status == .watched || detail.status == .rated {
                    sectionHeader("Ratings")

                    RatingSummaryView(summary: viewModel.ratingsSummary, style: .expanded)
                        .padding(.horizontal, 16)
                        .padding(.top, 12)

                    VStack(spacing: 0) {
                        ForEach(Array(viewModel.ratingEntries.enumerated()), id: \.element.id) { index, entry in
                            RatingMemberRowView(entry: entry)
                                .padding(.horizontal, 16)
                            if index < viewModel.ratingEntries.count - 1 {
                                Divider()
                                    .padding(.leading, 56)
                            }
                        }
                    }
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color.cardBackground)
                    )
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                }

                // "Rate Now" CTA — conditional
                if viewModel.canRateNow {
                    PrimaryButton(title: "Rate Now") {
                        showRatingSheet = true
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 24)
                }

                Spacer(minLength: 16)
                    .frame(height: 16)
            }
        }
    }

    // MARK: - Sub-views

    private var noPickCard: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.systemGray5))
                .frame(width: 60, height: 90)
                .overlay(
                    Image(systemName: "film")
                        .foregroundStyle(.secondary)
                )

            VStack(alignment: .leading, spacing: 4) {
                Text("No movie selected")
                    .font(.title3)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
                    .italic()
            }
            Spacer()
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.cardBackground)
        )
    }

    private func statusRow(for detail: SessionDetailData) -> some View {
        HStack(spacing: 6) {
            SessionStatusBadgeView(status: detail.status)
            Text(detail.formattedDate)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text("·")
                .font(.caption)
                .foregroundStyle(.tertiary)
            Text("Started by \(detail.startedByName)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private func makeRatingViewModel() -> RatingViewModel {
        let vm = RatingViewModel()
        let pick = viewModel.pickedSuggestion
        vm.configure(
            roundId: viewModel.roundId,
            activeMemberId: viewModel.activeMemberId,
            isCreator: viewModel.isCreator,
            activeProfileName: viewModel.activeProfileName,
            movieTitle: pick?.title ?? "",
            movieYear: pick?.year ?? 0,
            movieContentRating: pick?.contentRating,
            posterURL: pick?.posterURL,
            apiClient: apiClient
        )
        vm.ratingEntries = viewModel.ratingEntries
        return vm
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.title2)
            .fontWeight(.semibold)
            .foregroundStyle(.primary)
            .padding(.horizontal, 16)
            .padding(.top, 20)
    }
}

// MARK: - Previews

#Preview("Populated — Rated") {
    NavigationStack {
        SessionDetailView(viewModel: .makePopulated())
    }
}

#Preview("Populated — Dark Mode") {
    NavigationStack {
        SessionDetailView(viewModel: .makePopulated())
    }
    .preferredColorScheme(.dark)
}

#Preview("With Rate Now CTA") {
    NavigationStack {
        SessionDetailView(viewModel: .makeWatchedWithRateNow())
    }
}

#Preview("Loading") {
    NavigationStack {
        SessionDetailView(viewModel: .makeLoading())
    }
}

#Preview("Error") {
    NavigationStack {
        SessionDetailView(viewModel: .makeError())
    }
}

#Preview("Large Type") {
    NavigationStack {
        SessionDetailView(viewModel: .makePopulated())
    }
    .environment(\.sizeCategory, .accessibilityLarge)
}

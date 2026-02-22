import SwiftUI

// MARK: - RatingView
//
// Full-screen modal container housing the movie header, RatingSelectorView,
// submission controls, and post-submission states.
// Presented as .sheet from PickConfirmationView or SessionDetailView "Rate Now".

struct RatingView: View {
    @ObservedObject var viewModel: RatingViewModel
    @Environment(\.dismiss) private var dismiss

    private var showSkipButton: Bool {
        switch viewModel.viewState {
        case .loading, .unrated, .error, .submitting: return true
        default: return false
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    // Movie header — fixed at top, does not participate in transitions
                    MovieHeaderCard(
                        title: viewModel.movieTitle,
                        year: viewModel.movieYear,
                        contentRating: viewModel.movieContentRating,
                        posterURL: viewModel.posterURL
                    )
                    .padding(.horizontal, 16)
                    .padding(.top, 16)

                    // Transitioning content area
                    SwiftUI.Group {
                        switch viewModel.viewState {
                        case .loading:
                            loadingContent
                        case .unrated:
                            unratedContent
                        case .submitting:
                            unratedContent
                        case .wait:
                            waitContent
                        case .allRated:
                            allRatedContent
                        case .alreadyRated:
                            alreadyRatedContent
                        case .error(let message):
                            VStack(spacing: 0) {
                                unratedContent
                                errorBanner(message)
                                    .padding(.horizontal, 16)
                                    .padding(.bottom, 8)
                            }
                        }
                    }
                    .transition(.opacity.combined(with: .scale(scale: 0.97)))
                    .animation(.easeInOut(duration: 0.3), value: viewModel.hasSubmitted)
                    .animation(.easeInOut(duration: 0.25), value: viewModel.isLoading)
                }
            }
            .background(Color.appBackground)
            .navigationTitle("Rate the Movie")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if showSkipButton {
                        skipButton
                    }
                }
            }
            .interactiveDismissDisabled(viewModel.selectedRating != nil && !viewModel.hasSubmitted)
        }
        .task {
            await viewModel.loadRatings()
        }
        .onDisappear {
            viewModel.stopPolling()
        }
        .onAppear {
            if let name = viewModel.activeProfileName {
                AccessibilityNotification.Announcement("Now rating as \(name)").post()
            }
        }
    }

    // MARK: - Skip Button

    private var skipButton: some View {
        Button("Skip for now") {
            dismiss()
        }
        .tint(Color.primaryAccent)
        .accessibilityLabel("Skip rating. Double-tap to dismiss without rating.")
    }

    // MARK: - Loading Content

    private var loadingContent: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                ForEach(0..<3, id: \.self) { _ in
                    SkeletonRectangle(height: 88, cornerRadius: 16)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
        }
    }

    // MARK: - Unrated / Option Selected / Error Content

    private var unratedContent: some View {
        VStack(spacing: 0) {
            Text("How was it?")
                .font(.title2)
                .foregroundStyle(.primary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.top, 20)
                .padding(.bottom, 8)

            RatingSelectorView(
                selectedRating: Binding(
                    get: { viewModel.selectedRating },
                    set: { viewModel.selectedRating = $0 }
                ),
                isDisabled: viewModel.isSubmitting
            )

            // Managed member pill
            if let name = viewModel.activeProfileName {
                Text("Rating as \(name)")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(Color.primaryAccent)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(Color.primaryAccent.opacity(0.10))
                    )
                    .padding(.top, 12)
            }

            PrimaryButton(
                title: "Save My Rating",
                isLoading: viewModel.isSubmitting,
                isDisabled: viewModel.selectedRating == nil
            ) {
                Task { await viewModel.submitRating() }
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 16)
            .animation(.easeInOut(duration: 0.2), value: viewModel.selectedRating != nil)
        }
    }

    private func errorBanner(_ message: String) -> some View {
        Text(message)
            .font(.caption)
            .foregroundStyle(Color.warningAccent)
            .padding(.horizontal, 16)
            .padding(.bottom, 8)
    }

    // MARK: - Wait State Content

    private var waitContent: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    if let rating = viewModel.selectedRating {
                        Image(systemName: rating.icon)
                            .foregroundStyle(Color(rating.accentTokenName))
                    }
                    Text("Your rating is in!")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundStyle(.primary)
                }
                let remaining = viewModel.totalAttendees - viewModel.ratedCount
                Text("Waiting for \(remaining) more to rate.")
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 16)

            // Member list card
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

            if viewModel.isCreator {
                SecondaryButton(title: "Close Ratings") {
                    Task { await viewModel.closeRatings() }
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
            }

            Spacer(minLength: 24)
        }
    }

    // MARK: - All Rated Content

    private var allRatedContent: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Everyone's in!")
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundStyle(.primary)
                Text("Here's how you all felt:")
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 16)

            RatingSummaryView(summary: viewModel.summary, style: .expanded)
                .padding(.horizontal, 16)

            PrimaryButton(title: "Done") {
                dismiss()
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 16)
        }
    }

    // MARK: - Already Rated Content

    private var alreadyRatedContent: some View {
        VStack(spacing: 0) {
            Text("How was it?")
                .font(.title2)
                .foregroundStyle(.primary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.top, 20)
                .padding(.bottom, 8)

            RatingSelectorView(
                selectedRating: Binding(
                    get: { viewModel.selectedRating },
                    set: { viewModel.selectedRating = $0 }
                ),
                isDisabled: true
            )

            Text("You already rated this.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.top, 8)

            PrimaryButton(title: "Done") {
                dismiss()
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 16)
        }
    }
}

// MARK: - Previews

#Preview("Unrated — Light") {
    RatingView(viewModel: .makeUnrated())
}

#Preview("Unrated — Dark") {
    RatingView(viewModel: .makeUnrated())
        .preferredColorScheme(.dark)
}

#Preview("Loading") {
    RatingView(viewModel: .makeLoading())
}

#Preview("Managed Member Pill") {
    RatingView(viewModel: .makeManagedMember())
}

#Preview("Wait State") {
    RatingView(viewModel: .makeWaitState())
}

#Preview("All Rated") {
    RatingView(viewModel: .makeAllRated())
}

#Preview("Already Rated") {
    RatingView(viewModel: .makeAlreadyRated())
}

#Preview("Error State") {
    RatingView(viewModel: .makeError())
}

#Preview("XXXL Dynamic Type") {
    RatingView(viewModel: .makeUnrated())
        .environment(\.sizeCategory, .accessibilityExtraExtraExtraLarge)
}

import SwiftUI

// MARK: - AttendeeSelectionView
//
// First step in the movie night initiation flow. Presents a checklist of all
// household members. All members pre-checked; minimum 2 required to proceed.
// Pushed onto NavigationStack from GroupDetailView.

struct AttendeeSelectionView: View {
    @StateObject var viewModel: AttendeeSelectionViewModel
    var onProceed: (([String]) -> Void)?  // passes selected member IDs to StartRoundView

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Instruction text
                Text("Select who's here for movie night. Suggestions will be tailored to your group.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                    .padding(.bottom, 12)

                // State-driven content
                SwiftUI.Group {
                    switch contentState {
                    case .loading:
                        loadingContent
                    case .error(let message):
                        errorContent(message)
                    case .empty:
                        emptyContent
                    case .populated:
                        attendeeCard
                    }
                }

                // Validation helper
                validationHelper

                Spacer(minLength: 24)

                // Next button
                PrimaryButton(
                    title: "Next",
                    isDisabled: !viewModel.canProceed
                ) {
                    onProceed?(Array(viewModel.selectedMemberIds))
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
            }
        }
        .background(Color.appBackground)
        .navigationTitle("Who's Watching Tonight?")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if viewModel.members.isEmpty {
                await viewModel.loadMembers()
            }
        }
    }

    // MARK: - Content State

    private enum ContentState {
        case loading
        case error(String)
        case empty
        case populated
    }

    private var contentState: ContentState {
        if viewModel.isLoading { return .loading }
        if let error = viewModel.error { return .error(error) }
        if viewModel.members.isEmpty { return .empty }
        return .populated
    }

    // MARK: - Attendee Card

    private var attendeeCard: some View {
        VStack(spacing: 0) {
            // Card header row
            HStack(alignment: .center) {
                Text("ATTENDING (\(viewModel.selectedCount) of \(viewModel.totalCount))")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(
                        viewModel.selectedCount < 2
                            ? Color.warningAccent
                            : Color.secondary
                    )
                    .contentTransition(.numericText())
                    .animation(.easeInOut(duration: 0.2), value: viewModel.selectedCount)

                Spacer()

                HStack(spacing: 12) {
                    Button("All") {
                        viewModel.selectAll()
                    }
                    .font(.caption)
                    .foregroundStyle(Color.primaryAccent)
                    .opacity(viewModel.selectedCount == viewModel.totalCount ? 0.4 : 1.0)
                    .frame(minHeight: 44)

                    Button("None") {
                        viewModel.deselectAll()
                    }
                    .font(.caption)
                    .foregroundStyle(Color.primaryAccent)
                    .opacity(viewModel.selectedCount <= 1 ? 0.4 : 1.0)
                    .frame(minHeight: 44)
                }
            }
            .frame(minHeight: 44)

            Divider()
                .padding(.top, 8)

            // Member rows
            ForEach(Array(viewModel.members.enumerated()), id: \.element.id) { index, member in
                AttendeeRowView(
                    member: member,
                    isSelected: viewModel.isSelected(member.userId),
                    isActiveUser: member.userId == viewModel.activeUserId,
                    isLocked: viewModel.isLocked(member.userId),
                    onToggle: { viewModel.toggle(memberId: member.userId) }
                )

                if index < viewModel.members.count - 1 {
                    Divider()
                        .padding(.leading, 56)
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.cardBackground)
        )
        .padding(.horizontal, 16)
    }

    // MARK: - Validation Helper

    @ViewBuilder
    private var validationHelper: some View {
        if viewModel.selectedCount < 2 && !viewModel.members.isEmpty {
            HStack(spacing: 6) {
                Image(systemName: "exclamationmark.circle")
                    .font(.caption)
                Text("Select at least 2 people to start movie night.")
                    .font(.caption)
            }
            .foregroundStyle(Color.warningAccent)
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .opacity(viewModel.selectedCount < 2 ? 1.0 : 0.0)
            .animation(.easeInOut(duration: 0.2), value: viewModel.selectedCount < 2)
        }
    }

    // MARK: - Loading Content

    private var loadingContent: some View {
        VStack(spacing: 0) {
            ForEach(0..<4, id: \.self) { _ in
                SkeletonRectangle(height: 52, cornerRadius: 0)
                    .padding(.bottom, 1)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal, 16)
    }

    // MARK: - Error Content

    private func errorContent(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.title2)
                .foregroundStyle(Color.warningAccent)

            Text(message)
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            SecondaryButton(title: "Try Again") {
                Task { await viewModel.loadMembers() }
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
    }

    // MARK: - Empty Content

    private var emptyContent: some View {
        VStack(spacing: 12) {
            Image(systemName: "person.2")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text("No Members Found")
                .font(.title2)
                .foregroundStyle(.primary)
            Text("Your household appears to have no members. Check your connection and try again.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(24)
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Previews

#Preview("Populated — All Selected — Light") {
    NavigationStack {
        AttendeeSelectionView(viewModel: .makePopulated())
    }
}

#Preview("Populated — All Selected — Dark") {
    NavigationStack {
        AttendeeSelectionView(viewModel: .makePopulated())
    }
    .preferredColorScheme(.dark)
}

#Preview("Below Minimum (validation active)") {
    NavigationStack {
        AttendeeSelectionView(viewModel: .makeOnlyTwo())
    }
}

#Preview("Loading") {
    NavigationStack {
        AttendeeSelectionView(viewModel: .makeLoading())
    }
}

#Preview("Error") {
    NavigationStack {
        AttendeeSelectionView(viewModel: .makeError())
    }
}

#Preview("Large Type") {
    NavigationStack {
        AttendeeSelectionView(viewModel: .makePopulated())
    }
    .environment(\.sizeCategory, .accessibilityLarge)
}

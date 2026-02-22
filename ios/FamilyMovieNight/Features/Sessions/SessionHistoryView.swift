import SwiftUI

// MARK: - SessionHistoryView
//
// Paginated list of all household sessions, sorted newest first.
// Pushed onto NavigationStack from GroupDetailView.

struct SessionHistoryView: View {
    @StateObject var viewModel: SessionHistoryViewModel
    var groupId: String = "group_001"

    var body: some View {
        SwiftUI.Group {
            switch contentState {
            case .loading:
                loadingContent
            case .empty:
                emptyContent
            case .error(let message):
                errorContent(message)
            case .populated:
                populatedContent
            }
        }
        .background(Color.appBackground)
        .navigationTitle("Watch History")
        .navigationBarTitleDisplayMode(.large)
        .task {
            viewModel.configure(groupId: groupId)
            if viewModel.sessions.isEmpty {
                await viewModel.loadInitialPage()
            }
        }
        .refreshable {
            await viewModel.refresh()
        }
    }

    // MARK: - Content State

    private enum ContentState {
        case loading
        case empty
        case error(String)
        case populated
    }

    private var contentState: ContentState {
        if viewModel.isLoading { return .loading }
        if let error = viewModel.error { return .error(error) }
        if viewModel.sessions.isEmpty { return .empty }
        return .populated
    }

    // MARK: - Loading Content

    private var loadingContent: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(0..<4, id: \.self) { _ in
                    sessionSkeletonRow
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
        }
        .allowsHitTesting(false)
    }

    private var sessionSkeletonRow: some View {
        HStack(alignment: .top, spacing: 12) {
            SkeletonRectangle(width: 60, height: 90, cornerRadius: 8)

            VStack(alignment: .leading, spacing: 8) {
                SkeletonRectangle(width: 80, height: 16, cornerRadius: 8)
                SkeletonRectangle(width: 140, height: 14, cornerRadius: 6)
                SkeletonRectangle(width: 100, height: 12, cornerRadius: 6)
            }
            Spacer()
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.cardBackground)
        )
    }

    // MARK: - Empty Content

    private var emptyContent: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "film.stack")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("No Movie Nights Yet")
                .font(.title2)
                .foregroundStyle(.primary)
            Text("Start a voting round to pick your first movie as a household.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
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
                Task { await viewModel.loadInitialPage() }
            }
            .padding(.horizontal, 32)
            Spacer()
        }
    }

    // MARK: - Populated Content

    private var populatedContent: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(viewModel.sessions) { session in
                    NavigationLink {
                        SessionDetailView(
                            viewModel: .makePopulated(canRate: session.status == .watched)
                        )
                    } label: {
                        SessionHistoryRowView(session: session)
                    }
                    .buttonStyle(.plain)
                    .onAppear {
                        viewModel.loadNextPageIfNeeded(currentItem: session)
                    }
                }

                // Pagination footer
                if viewModel.isLoadingMore {
                    ProgressView()
                        .frame(height: 44)
                } else if viewModel.hasReachedEnd {
                    Text("That's all your movie nights")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 24)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
        }
    }
}

// MARK: - Previews

#Preview("Populated — Light") {
    NavigationStack {
        SessionHistoryView(viewModel: .makePopulated())
    }
}

#Preview("Populated — Dark") {
    NavigationStack {
        SessionHistoryView(viewModel: .makePopulated())
    }
    .preferredColorScheme(.dark)
}

#Preview("Loading") {
    NavigationStack {
        SessionHistoryView(viewModel: .makeLoading())
    }
}

#Preview("Empty") {
    NavigationStack {
        SessionHistoryView(viewModel: .makeEmpty())
    }
}

#Preview("Error") {
    NavigationStack {
        SessionHistoryView(viewModel: .makeError())
    }
}

#Preview("Large Type") {
    NavigationStack {
        SessionHistoryView(viewModel: .makePopulated())
    }
    .environment(\.sizeCategory, .accessibilityLarge)
}

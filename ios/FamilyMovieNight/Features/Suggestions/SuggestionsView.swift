import SwiftUI

struct SuggestionsView: View {
    @ObservedObject var viewModel: SuggestionsViewModel
    @ObservedObject var watchlistViewModel: WatchlistViewModel

    var body: some View {
        SwiftUI.Group {
            if viewModel.isLoading && viewModel.suggestions.isEmpty {
                VStack(spacing: 16) {
                    ProgressView()
                    Text("Finding movies your family will love...")
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.error {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 40))
                        .foregroundStyle(.secondary)
                    Text(error)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                    Button("Try Again") {
                        Task { await viewModel.loadSuggestions() }
                    }
                    .buttonStyle(.bordered)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if viewModel.suggestions.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "film")
                        .font(.system(size: 40))
                        .foregroundStyle(.secondary)
                    Text("No suggestions found. Try updating your preferences.")
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                suggestionsList
            }
        }
        .navigationTitle("Tonight's Suggestions")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if viewModel.suggestions.isEmpty {
                await viewModel.loadSuggestions()
            }
        }
    }

    private var suggestionsList: some View {
        ScrollView {
            if !viewModel.relaxedConstraints.isEmpty {
                HStack {
                    Image(systemName: "info.circle")
                    Text("We loosened some filters to find more options.")
                }
                .font(.caption)
                .foregroundStyle(.orange)
                .padding(.horizontal)
                .padding(.top, 8)
            }

            LazyVStack(spacing: 16) {
                ForEach(viewModel.suggestions) { suggestion in
                    SuggestionCard(
                        suggestion: suggestion,
                        onSaveForLater: {
                            Task {
                                _ = await watchlistViewModel.addToWatchlist(movie: suggestion)
                            }
                        }
                    )
                }
            }
            .padding()

            Button {
                Task { await viewModel.refresh() }
            } label: {
                HStack {
                    Image(systemName: "arrow.clockwise")
                    Text("Show Me More")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .padding(.horizontal)
            .padding(.bottom, 24)
            .disabled(viewModel.isLoading)
        }
        .overlay {
            if viewModel.isLoading && !viewModel.suggestions.isEmpty {
                ProgressView()
                    .padding()
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }
}

struct SuggestionCard: View {
    let suggestion: MovieSuggestion
    var onSaveForLater: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                // Poster
                AsyncImage(url: suggestion.posterURL) { image in
                    image
                        .resizable()
                        .aspectRatio(2/3, contentMode: .fill)
                } placeholder: {
                    Rectangle()
                        .fill(Color(.systemGray5))
                        .aspectRatio(2/3, contentMode: .fill)
                        .overlay {
                            Image(systemName: "film")
                                .foregroundStyle(.secondary)
                        }
                }
                .frame(width: 80, height: 120)
                .clipShape(RoundedRectangle(cornerRadius: 8))

                VStack(alignment: .leading, spacing: 4) {
                    Text(suggestion.title)
                        .font(.headline)
                    Text(String(suggestion.year))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    // Genre tags
                    FlowLayout(spacing: 4) {
                        ForEach(suggestion.genres, id: \.self) { genre in
                            Text(genre)
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color(.systemGray5))
                                .clipShape(Capsule())
                        }
                    }

                    if let rating = suggestion.contentRating {
                        Text(rating)
                            .font(.caption)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .overlay(
                                RoundedRectangle(cornerRadius: 4)
                                    .stroke(Color.secondary, lineWidth: 1)
                            )
                    }

                    HStack(spacing: 4) {
                        Image(systemName: "star.fill")
                            .font(.caption2)
                            .foregroundStyle(.yellow)
                        Text(String(format: "%.1f", suggestion.voteAverage))
                            .font(.caption)
                    }
                }
            }

            // Streaming providers
            if !suggestion.streaming.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "play.tv")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(suggestion.streaming.map(\.providerName).joined(separator: ", "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            // Reason
            Text(suggestion.reason)
                .font(.caption)
                .foregroundStyle(.blue)
                .italic()

            // Save for Later
            if let onSaveForLater {
                Button {
                    onSaveForLater()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "bookmark")
                        Text("Save for Later")
                    }
                    .font(.subheadline)
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
    }
}

/// Simple horizontal wrapping layout for genre tags
struct FlowLayout: Layout {
    var spacing: CGFloat = 4

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (index, subview) in subviews.enumerated() {
            let point = result.positions[index]
            subview.place(at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y), proposal: .unspecified)
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, positions: [CGPoint]) {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var maxX: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth && x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
            maxX = max(maxX, x)
        }

        return (CGSize(width: maxX, height: y + rowHeight), positions)
    }
}

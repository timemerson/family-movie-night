import SwiftUI

struct VotingView: View {
    @ObservedObject var viewModel: VotingViewModel
    let currentUserId: String
    let isCreator: Bool
    var onDoneVoting: (() -> Void)?

    var body: some View {
        SwiftUI.Group {
            if viewModel.isLoading && viewModel.roundDetails == nil {
                ProgressView("Loading round...")
            } else if let details = viewModel.roundDetails {
                List {
                    if let progress = viewModel.voteProgress {
                        Section {
                            HStack {
                                Image(systemName: "person.2")
                                Text("\(progress.voted) of \(progress.total) voted")
                                Spacer()
                                if progress.voted == progress.total {
                                    Label("All voted", systemImage: "checkmark.circle.fill")
                                        .font(.caption)
                                        .foregroundStyle(.green)
                                }
                            }
                        }
                    }

                    Section("Movies") {
                        ForEach(details.suggestions) { suggestion in
                            VotingCard(
                                suggestion: suggestion,
                                currentVote: viewModel.userVote(for: suggestion.tmdbMovieId, userId: currentUserId),
                                isVoting: viewModel.isVoting
                            ) { vote in
                                Task {
                                    await viewModel.submitVote(tmdbMovieId: suggestion.tmdbMovieId, vote: vote)
                                }
                            }
                        }
                    }

                    if isCreator {
                        Section {
                            Button("Done Voting — See Results") {
                                onDoneVoting?()
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }

                    if let error = viewModel.error {
                        Section {
                            Text(error)
                                .foregroundStyle(.red)
                        }
                    }
                }
            } else {
                ContentUnavailableView(
                    "Round Not Found",
                    systemImage: "film.stack",
                    description: Text("This round may have been removed.")
                )
            }
        }
        .navigationTitle("Vote")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Voting Card

struct VotingCard: View {
    let suggestion: SuggestionWithVotes
    let currentVote: String?
    let isVoting: Bool
    let onVote: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 12) {
                // Poster
                AsyncImage(url: suggestion.posterURL) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    Rectangle()
                        .fill(Color(.systemGray5))
                        .overlay(Image(systemName: "film").foregroundStyle(.secondary))
                }
                .frame(width: 60, height: 90)
                .cornerRadius(6)

                VStack(alignment: .leading, spacing: 4) {
                    Text(suggestion.title)
                        .font(.headline)
                    Text("\(suggestion.year)")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    if !suggestion.genres.isEmpty {
                        Text(suggestion.genres.joined(separator: ", "))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }

                    if suggestion.source == "watchlist" {
                        Label("From Watchlist", systemImage: "bookmark.fill")
                            .font(.caption2)
                            .foregroundStyle(.orange)
                    }

                    Text(suggestion.reason)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }

                Spacer()
            }

            // Vote buttons + current tally
            HStack {
                Button {
                    onVote("up")
                } label: {
                    Label("\(suggestion.votes.up)", systemImage: currentVote == "up" ? "hand.thumbsup.fill" : "hand.thumbsup")
                        .foregroundStyle(currentVote == "up" ? .green : .primary)
                }
                .buttonStyle(.bordered)
                .disabled(isVoting)

                Button {
                    onVote("down")
                } label: {
                    Label("\(suggestion.votes.down)", systemImage: currentVote == "down" ? "hand.thumbsdown.fill" : "hand.thumbsdown")
                        .foregroundStyle(currentVote == "down" ? .red : .primary)
                }
                .buttonStyle(.bordered)
                .disabled(isVoting)

                Spacer()

                if !suggestion.voters.isEmpty {
                    Text("\(suggestion.voters.count) vote\(suggestion.voters.count == 1 ? "" : "s")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

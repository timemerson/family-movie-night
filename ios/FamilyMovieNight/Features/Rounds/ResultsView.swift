import SwiftUI

struct ResultsView: View {
    @ObservedObject var viewModel: VotingViewModel
    let isCreator: Bool
    var onPickMovie: ((Int) -> Void)?

    var body: some View {
        SwiftUI.Group {
            if viewModel.isLoading && viewModel.results == nil {
                ProgressView("Loading results...")
            } else if let results = viewModel.results {
                List {
                    Section {
                        HStack {
                            Image(systemName: "person.2")
                            Text("\(results.voteProgress.voted) of \(results.voteProgress.total) voted")
                        }
                    }

                    Section("Rankings") {
                        ForEach(results.results) { movie in
                            ResultCard(
                                movie: movie,
                                isCreator: isCreator,
                                isPicking: viewModel.isPicking,
                                roundStatus: viewModel.status
                            ) {
                                onPickMovie?(movie.tmdbMovieId)
                            }
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
                    "No Results Yet",
                    systemImage: "chart.bar",
                    description: Text("Results will appear once voting begins.")
                )
            }
        }
        .navigationTitle("Results")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadResults()
        }
    }
}

// MARK: - Result Card

struct ResultCard: View {
    let movie: RankedMovie
    let isCreator: Bool
    let isPicking: Bool
    let roundStatus: String
    let onPick: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 12) {
                // Rank badge
                ZStack {
                    Circle()
                        .fill(movie.rank == 1 ? Color.accentColor : Color(.systemGray5))
                        .frame(width: 32, height: 32)
                    Text("#\(movie.rank)")
                        .font(.caption.bold())
                        .foregroundStyle(movie.rank == 1 ? .white : .primary)
                }

                // Poster
                AsyncImage(url: movie.posterURL) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    Rectangle()
                        .fill(Color(.systemGray5))
                        .overlay(Image(systemName: "film").foregroundStyle(.secondary))
                }
                .frame(width: 50, height: 75)
                .cornerRadius(6)

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(movie.title)
                            .font(.headline)
                        if movie.tied {
                            Text("TIE")
                                .font(.caption2.bold())
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.orange.opacity(0.2))
                                .foregroundStyle(.orange)
                                .cornerRadius(4)
                        }
                    }

                    HStack(spacing: 12) {
                        Label("\(movie.votesUp)", systemImage: "hand.thumbsup.fill")
                            .foregroundStyle(.green)
                        Label("\(movie.votesDown)", systemImage: "hand.thumbsdown.fill")
                            .foregroundStyle(.red)
                        Text("Net: \(movie.netScore)")
                            .bold()
                    }
                    .font(.caption)

                    if movie.source == "watchlist" {
                        Label("From Watchlist", systemImage: "bookmark.fill")
                            .font(.caption2)
                            .foregroundStyle(.orange)
                    }

                    // Voter details
                    if !movie.voters.isEmpty {
                        HStack(spacing: 4) {
                            ForEach(movie.voters) { voter in
                                HStack(spacing: 2) {
                                    Image(systemName: voter.vote == "up" ? "hand.thumbsup.fill" : "hand.thumbsdown.fill")
                                        .foregroundStyle(voter.vote == "up" ? .green : .red)
                                    Text(voter.displayName)
                                }
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                Spacer()
            }

            // Pick button (creator only, if round is voting or closed)
            if isCreator && (roundStatus == "voting" || roundStatus == "closed") {
                Button {
                    onPick()
                } label: {
                    Label("Pick This One", systemImage: "checkmark.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .disabled(isPicking)
            }
        }
        .padding(.vertical, 4)
    }
}

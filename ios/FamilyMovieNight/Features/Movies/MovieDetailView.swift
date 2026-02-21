import SwiftUI

struct MovieDetailView: View {
    @ObservedObject var viewModel: MovieDetailViewModel
    let tmdbMovieId: Int

    @State private var showWatchedConfirmation = false

    var body: some View {
        SwiftUI.Group {
            if viewModel.isLoading {
                ProgressView("Loading movie details...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.error, viewModel.movie == nil {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 40))
                        .foregroundStyle(.secondary)
                    Text(error)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                    Button("Try Again") {
                        Task { await viewModel.loadMovieDetail(tmdbMovieId: tmdbMovieId) }
                    }
                    .buttonStyle(.bordered)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let movie = viewModel.movie {
                movieContent(movie)
            }
        }
        .navigationTitle(viewModel.movie?.title ?? "Movie Detail")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if viewModel.movie == nil {
                await viewModel.loadMovieDetail(tmdbMovieId: tmdbMovieId)
            }
        }
    }

    private func movieContent(_ movie: MovieDetail) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Poster + basic info
                HStack(alignment: .top, spacing: 16) {
                    AsyncImage(url: movie.posterURL) { image in
                        image
                            .resizable()
                            .aspectRatio(2/3, contentMode: .fill)
                    } placeholder: {
                        Rectangle()
                            .fill(Color(.systemGray5))
                            .aspectRatio(2/3, contentMode: .fill)
                            .overlay {
                                Image(systemName: "film")
                                    .font(.title)
                                    .foregroundStyle(.secondary)
                            }
                    }
                    .frame(width: 130, height: 195)
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                    VStack(alignment: .leading, spacing: 6) {
                        Text(movie.title)
                            .font(.title3)
                            .fontWeight(.bold)

                        if movie.year > 0 {
                            Text("\(movie.year)")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }

                        if movie.runtime > 0 {
                            Text("\(movie.runtime) min")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }

                        if let rating = movie.contentRating {
                            Text(rating)
                                .font(.caption)
                                .fontWeight(.medium)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 4)
                                        .stroke(Color.secondary, lineWidth: 1)
                                )
                        }

                        HStack(spacing: 4) {
                            Image(systemName: "star.fill")
                                .foregroundStyle(.yellow)
                                .font(.caption)
                            Text(String(format: "%.1f", movie.voteAverage))
                                .font(.subheadline)
                        }
                    }
                }
                .padding(.horizontal)

                // Genres
                if !movie.genres.isEmpty {
                    FlowLayout(spacing: 6) {
                        ForEach(movie.genres, id: \.self) { genre in
                            Text(genre)
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color(.systemGray5))
                                .clipShape(Capsule())
                        }
                    }
                    .padding(.horizontal)
                }

                // Overview
                if !movie.overview.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Synopsis")
                            .font(.headline)
                        Text(movie.overview)
                            .font(.body)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal)
                }

                // Cast
                if !movie.cast.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Cast")
                            .font(.headline)
                        ForEach(movie.cast, id: \.name) { member in
                            HStack {
                                Text(member.name)
                                    .font(.subheadline)
                                Text("as \(member.character)")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .padding(.horizontal)
                }

                // Streaming
                if !movie.streaming.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Where to Watch")
                            .font(.headline)
                        HStack(spacing: 8) {
                            ForEach(movie.streaming) { provider in
                                Text(provider.providerName)
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.blue.opacity(0.1))
                                    .clipShape(Capsule())
                            }
                        }
                    }
                    .padding(.horizontal)
                }

                // Trailer link
                if let trailerUrl = movie.trailerUrl, let url = URL(string: trailerUrl) {
                    Link(destination: url) {
                        HStack {
                            Image(systemName: "play.rectangle.fill")
                            Text("Watch Trailer")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .padding(.horizontal)
                }

                // Group Context
                if let context = movie.groupContext {
                    groupContextSection(context, movie: movie)
                }

                // Actions
                actionsSection(movie)

                if let error = viewModel.error {
                    Text(error)
                        .foregroundStyle(.red)
                        .font(.callout)
                        .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
        .confirmationDialog(
            "Mark as Watched",
            isPresented: $showWatchedConfirmation,
            titleVisibility: .visible
        ) {
            Button("Mark Watched") {
                Task { await viewModel.markWatched() }
            }
        } message: {
            Text("Mark as watched for the whole group? It won't appear in future suggestions.")
        }
    }

    @ViewBuilder
    private func groupContextSection(_ context: GroupContext, movie: MovieDetail) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Group Status")
                .font(.headline)

            // Watchlist badge
            if context.watchlistStatus.onWatchlist {
                HStack(spacing: 4) {
                    Image(systemName: "bookmark.fill")
                        .foregroundStyle(.blue)
                    Text("On your Watchlist")
                        .font(.subheadline)
                    if let date = context.watchlistStatus.addedAt {
                        Text("- \(formattedDate(date))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            // Watched badge
            if context.watchedStatus.watched {
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                    Text("Watched")
                        .font(.subheadline)
                    if let date = context.watchedStatus.watchedAt {
                        Text("on \(formattedDate(date))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                if let source = context.watchedStatus.source {
                    Text(source == "picked" ? "Picked through voting" : "Marked directly")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.leading, 28)
                }
            }

            // Vote history
            if !context.voteHistory.isEmpty {
                ForEach(context.voteHistory) { entry in
                    HStack(spacing: 4) {
                        Image(systemName: "hand.thumbsup")
                            .font(.caption)
                        Text("\(entry.votesUp) up / \(entry.votesDown) down")
                            .font(.caption)
                        Text("on \(formattedDate(entry.createdAt))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            // Active round
            if let round = context.activeRound {
                HStack(spacing: 4) {
                    Image(systemName: "bolt.circle.fill")
                        .foregroundStyle(.orange)
                    Text("In tonight's vote:")
                        .font(.subheadline)
                    Text("\(round.votesUp) up / \(round.votesDown) down")
                        .font(.caption)
                }
            }
        }
        .padding(.horizontal)
    }

    @ViewBuilder
    private func actionsSection(_ movie: MovieDetail) -> some View {
        VStack(spacing: 8) {
            let context = movie.groupContext

            // Add/Remove Watchlist
            if let ctx = context {
                if ctx.watchlistStatus.onWatchlist {
                    Button(role: .destructive) {
                        Task { await viewModel.removeFromWatchlist() }
                    } label: {
                        HStack {
                            Image(systemName: "bookmark.slash")
                            Text("Remove from Watchlist")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(viewModel.actionInProgress)
                } else if !ctx.watchedStatus.watched {
                    Button {
                        Task { await viewModel.addToWatchlist() }
                    } label: {
                        HStack {
                            Image(systemName: "bookmark")
                            Text("Add to Watchlist")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(viewModel.actionInProgress)
                }

                // Mark Watched / Undo
                if ctx.watchedStatus.watched {
                    if ctx.watchedStatus.source == "direct" {
                        Button {
                            Task { await viewModel.undoWatched() }
                        } label: {
                            HStack {
                                Image(systemName: "arrow.uturn.backward")
                                Text("Undo Watched")
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .disabled(viewModel.actionInProgress)
                    }
                } else {
                    Button {
                        showWatchedConfirmation = true
                    } label: {
                        HStack {
                            Image(systemName: "checkmark.circle")
                            Text("Already Watched")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(viewModel.actionInProgress)
                }
            }
        }
        .padding(.horizontal)
    }

    private func formattedDate(_ isoString: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: isoString) else { return isoString }
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        return displayFormatter.string(from: date)
    }
}

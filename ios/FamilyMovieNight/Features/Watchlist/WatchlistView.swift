import SwiftUI

struct WatchlistView: View {
    @ObservedObject var viewModel: WatchlistViewModel
    var apiClient: APIClient?
    var groupId: String?

    var body: some View {
        SwiftUI.Group {
            if viewModel.isLoading && viewModel.items.isEmpty {
                ProgressView("Loading watchlist...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if viewModel.items.isEmpty {
                emptyState
            } else {
                watchlistContent
            }
        }
        .navigationTitle("Watchlist")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if viewModel.items.isEmpty {
                await viewModel.loadWatchlist()
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "bookmark")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text("No movies saved yet")
                .font(.headline)
            Text("Add movies from suggestions or search.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var watchlistContent: some View {
        List {
            Section {
                Text("\(viewModel.count) of \(viewModel.max) movies")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            ForEach(viewModel.items) { item in
                NavigationLink {
                    movieDetailDestination(for: item)
                } label: {
                    WatchlistRow(item: item)
                }
            }
            .onDelete { indexSet in
                Task {
                    for index in indexSet {
                        let item = viewModel.items[index]
                        await viewModel.removeFromWatchlist(tmdbMovieId: item.tmdbMovieId)
                    }
                }
            }

            if let error = viewModel.error {
                Section {
                    Text(error)
                        .foregroundStyle(.red)
                        .font(.callout)
                }
            }
        }
        .refreshable {
            await viewModel.loadWatchlist()
        }
    }

    @ViewBuilder
    private func movieDetailDestination(for item: WatchlistItem) -> some View {
        if let apiClient, let groupId {
            let vm = MovieDetailViewModel(apiClient: apiClient, groupId: groupId)
            MovieDetailView(viewModel: vm, tmdbMovieId: item.tmdbMovieId)
        }
    }
}

struct WatchlistRow: View {
    let item: WatchlistItem

    var body: some View {
        HStack(spacing: 12) {
            AsyncImage(url: item.posterURL) { image in
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
            .frame(width: 50, height: 75)
            .clipShape(RoundedRectangle(cornerRadius: 4))

            VStack(alignment: .leading, spacing: 4) {
                Text(item.title)
                    .font(.headline)
                    .lineLimit(1)
                Text("\(item.year)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                HStack(spacing: 4) {
                    ForEach(item.genres.prefix(3), id: \.self) { genre in
                        Text(genre)
                            .font(.caption2)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(Color(.systemGray5))
                            .clipShape(Capsule())
                    }
                }
            }
        }
    }
}

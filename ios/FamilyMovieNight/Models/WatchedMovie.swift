import Foundation

struct WatchedMoviesResponse: Codable {
    let watchedMovies: [WatchedMovie]
}

struct WatchedMovie: Codable, Identifiable {
    let tmdbMovieId: Int
    let title: String
    let posterPath: String
    let year: Int
    let watchedAt: String
    let source: String
    let markedBy: String
    let pickId: String?
    let avgRating: Double?

    var id: Int { tmdbMovieId }

    var posterURL: URL? {
        guard !posterPath.isEmpty else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w342\(posterPath)")
    }
}

struct MarkWatchedRequest: Encodable {
    let tmdbMovieId: Int
}

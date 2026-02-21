import Foundation

struct WatchlistResponse: Codable {
    let items: [WatchlistItem]
    let count: Int
    let max: Int
}

struct WatchlistItem: Codable, Identifiable {
    let groupId: String
    let tmdbMovieId: Int
    let addedBy: String
    let addedAt: String
    let title: String
    let posterPath: String
    let year: Int
    let genres: [String]
    let contentRating: String

    var id: Int { tmdbMovieId }

    var posterURL: URL? {
        URL(string: "https://image.tmdb.org/t/p/w342\(posterPath)")
    }
}

struct AddToWatchlistRequest: Encodable {
    let tmdbMovieId: Int
    let title: String
    let posterPath: String
    let year: Int
    let genres: [String]
    let contentRating: String
}

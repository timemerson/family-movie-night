import Foundation

struct SuggestionsResponse: Codable {
    let suggestions: [MovieSuggestion]
    let relaxedConstraints: [String]
}

struct MovieSuggestion: Codable, Identifiable {
    let tmdbMovieId: Int
    let title: String
    let year: Int
    let posterPath: String?
    let overview: String
    let genres: [String]
    let contentRating: String?
    let popularity: Double
    let voteAverage: Double
    let streaming: [StreamingProvider]
    let score: Double
    let reason: String

    var id: Int { tmdbMovieId }

    var posterURL: URL? {
        guard let path = posterPath else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w342\(path)")
    }
}

struct StreamingProvider: Codable, Identifiable {
    let providerName: String
    let logoPath: String?

    var id: String { providerName }
}

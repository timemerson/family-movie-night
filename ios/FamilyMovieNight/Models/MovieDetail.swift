import Foundation

struct MovieDetail: Codable {
    let tmdbMovieId: Int
    let title: String
    let year: Int
    let posterPath: String?
    let overview: String
    let runtime: Int
    let genres: [String]
    let contentRating: String?
    let cast: [CastMember]
    let popularity: Double
    let voteAverage: Double
    let trailerUrl: String?
    let streaming: [StreamingProvider]
    let groupContext: GroupContext?

    var posterURL: URL? {
        guard let path = posterPath else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w500\(path)")
    }
}

struct CastMember: Codable {
    let name: String
    let character: String
}

struct GroupContext: Codable {
    let watchlistStatus: WatchlistStatus
    let watchedStatus: WatchedStatus
    let voteHistory: [VoteHistoryEntry]
    let activeRound: ActiveRoundState?
}

struct WatchlistStatus: Codable {
    let onWatchlist: Bool
    let addedBy: String?
    let addedAt: String?
}

struct WatchedStatus: Codable {
    let watched: Bool
    let watchedAt: String?
    let source: String?
    let markedBy: String?
}

struct VoteHistoryEntry: Codable, Identifiable {
    let roundId: String
    let createdAt: String
    let votesUp: Int
    let votesDown: Int

    var id: String { roundId }
}

struct ActiveRoundState: Codable {
    let roundId: String
    let votesUp: Int
    let votesDown: Int
    let userVote: String?
}

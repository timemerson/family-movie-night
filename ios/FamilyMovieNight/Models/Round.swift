import Foundation

// MARK: - Create Round Response

struct CreateRoundResponse: Codable {
    let roundId: String
    let groupId: String
    let status: String
    let startedBy: String
    let createdAt: String
    let attendees: [String]?
    let suggestions: [RoundSuggestion]
    let watchlistEligibleCount: Int
    let relaxedConstraints: [String]
}

// MARK: - Round Details (GET /rounds/:id)

struct RoundDetails: Codable {
    let roundId: String
    let groupId: String
    let status: String
    let startedBy: String
    let createdAt: String
    let closedAt: String?
    let attendees: [String]?
    let suggestions: [SuggestionWithVotes]
    let voteProgress: VoteProgress
    let pick: RoundPick?
}

struct RoundSuggestion: Codable, Identifiable {
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
    let source: String

    var id: Int { tmdbMovieId }

    var posterURL: URL? {
        guard let path = posterPath else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w342\(path)")
    }
}

struct SuggestionWithVotes: Codable, Identifiable {
    let tmdbMovieId: Int
    let title: String
    let year: Int
    let posterPath: String?
    let genres: [String]
    let contentRating: String?
    let overview: String
    let source: String
    let streaming: [StreamingProvider]
    let score: Double
    let reason: String
    let popularity: Double
    let voteAverage: Double
    let votes: VoteCounts
    let voters: [Voter]

    var id: Int { tmdbMovieId }

    var posterURL: URL? {
        guard let path = posterPath else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w342\(path)")
    }
}

struct VoteCounts: Codable {
    let up: Int
    let down: Int

    var netScore: Int { up - down }
}

struct Voter: Codable, Identifiable {
    let userId: String
    let displayName: String
    let vote: String

    var id: String { userId }
}

struct VoteProgress: Codable {
    let voted: Int
    let total: Int
}

struct RoundPick: Codable {
    let pickId: String
    let tmdbMovieId: Int
    let title: String
    let pickedBy: String
    let pickedAt: String
    let watched: Bool
}

// MARK: - Vote

struct VoteResponse: Codable {
    let roundId: String
    let tmdbMovieId: Int
    let userId: String
    let vote: String
    let votedAt: String
}

// MARK: - Results

struct RoundResultsResponse: Codable {
    let roundId: String
    let status: String
    let results: [RankedMovie]
    let voteProgress: VoteProgress
}

struct RankedMovie: Codable, Identifiable {
    let tmdbMovieId: Int
    let title: String
    let posterPath: String?
    let source: String
    let netScore: Int
    let votesUp: Int
    let votesDown: Int
    let voters: [Voter]
    let rank: Int
    let tied: Bool

    var id: Int { tmdbMovieId }

    var posterURL: URL? {
        guard let path = posterPath else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w342\(path)")
    }
}

// MARK: - Pick Response

struct PickResponse: Codable {
    let pickId: String
    let roundId: String
    let groupId: String
    let tmdbMovieId: Int
    let pickedBy: String
    let pickedAt: String
    let watched: Bool
}

// MARK: - Requests

struct CreateRoundRequest: Codable {
    let excludeMovieIds: [Int]
    let includeWatchlist: Bool
    var attendees: [String]? = nil
}

struct SubmitVoteRequest: Codable {
    let tmdbMovieId: Int
    let vote: String
}

struct PickMovieRequest: Codable {
    let tmdbMovieId: Int
}

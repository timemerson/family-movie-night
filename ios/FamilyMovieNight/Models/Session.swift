import Foundation

// MARK: - Session Status

enum SessionStatus: String, Codable, CaseIterable {
    case draft     = "draft"
    case voting    = "voting"
    case selected  = "selected"
    case watched   = "watched"
    case rated     = "rated"
    case expired   = "expired"
    case discarded = "discarded"   // legacy; displayed as "Expired" per US-45

    var label: String {
        switch self {
        case .draft:     return "Draft"
        case .voting:    return "Voting"
        case .selected:  return "Selected"
        case .watched:   return "Watched"
        case .rated:     return "Rated"
        case .expired:   return "Expired"
        case .discarded: return "Expired"  // US-45: discarded displays as "Expired"
        }
    }
}

// MARK: - Session Summary (from GET /groups/{id}/sessions list)

struct SessionSummary: Decodable, Identifiable {
    let roundId:        String
    let status:         SessionStatus
    let createdAt:      String
    let attendees:      [SessionAttendee]
    let pick:           SessionPickSummary?
    let ratingsSummary: SessionRatingsSummary?

    var id: String { roundId }

    var formattedDate: String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: createdAt) else { return "" }
        let cal = Calendar.current
        let outputFormatter = DateFormatter()
        if cal.isDate(date, equalTo: Date(), toGranularity: .year) {
            outputFormatter.dateFormat = "MMM d"
        } else {
            outputFormatter.dateFormat = "MMM d, yyyy"
        }
        return outputFormatter.string(from: date)
    }

    var attendeeSummary: String {
        let names = attendees.prefix(3).map { $0.displayName }
        let joined = names.joined(separator: ", ")
        let remaining = attendees.count - 3
        if remaining > 0 {
            return "\(joined) + \(remaining) more"
        }
        return joined
    }
}

struct SessionAttendee: Decodable, Identifiable {
    let memberId:    String
    let displayName: String
    let avatarKey:   String?

    var id: String { memberId }
}

struct SessionPickSummary: Decodable {
    let tmdbMovieId: Int
    let title:       String
    let posterPath:  String?

    var posterURL: URL? {
        guard let p = posterPath else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w185\(p)")
    }
}

struct SessionRatingsSummary: Decodable {
    let loved:      Int
    let liked:      Int
    let didNotLike: Int

    func toRatingsSummary(totalAttendees: Int) -> RatingsSummary {
        let total = loved + liked + didNotLike
        return RatingsSummary(
            loved:          loved,
            liked:          liked,
            didNotLike:     didNotLike,
            totalRated:     total,
            totalAttendees: totalAttendees
        )
    }
}

// MARK: - Sessions List API Response

struct SessionsListResponse: Decodable {
    let sessions:   [SessionSummary]
    let nextCursor: String?
}

// MARK: - Session Detail Data (from GET /rounds/{id})

struct SessionDetailData: Decodable {
    let roundId:       String
    let groupId:       String
    let status:        SessionStatus
    let startedBy:     String
    let attendees:     [SessionAttendee]
    let createdAt:     String
    let suggestions:   [SessionSuggestionItem]
    let pickedMovieId: Int?

    var formattedDate: String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: createdAt) else { return "" }
        let outputFormatter = DateFormatter()
        outputFormatter.dateFormat = "MMM d, yyyy"
        return outputFormatter.string(from: date)
    }

    var startedByName: String {
        attendees.first(where: { $0.memberId == startedBy })?.displayName ?? startedBy
    }
}

struct SessionSuggestionItem: Decodable, Identifiable {
    let tmdbMovieId:   Int
    let title:         String
    let year:          Int
    let posterPath:    String?
    let contentRating: String?
    let votesUp:       Int
    let votesDown:     Int
    let voters:        [SuggestionVoter]

    var id: Int { tmdbMovieId }
    var netScore: Int { votesUp - votesDown }

    var posterURL: URL? {
        guard let p = posterPath else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w92\(p)")
    }
}

struct SuggestionVoter: Decodable, Identifiable {
    let memberId:    String
    let displayName: String
    let avatarKey:   String?
    let vote:        String  // "up" or "down"

    var id: String { memberId }
    var isUp: Bool { vote == "up" }
}

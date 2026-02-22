import Foundation

// MARK: - Rating Value

enum RatingValue: String, CaseIterable, Codable {
    case loved      = "loved"
    case liked      = "liked"
    case didNotLike = "did_not_like"

    var label: String {
        switch self {
        case .loved:      return "Loved"
        case .liked:      return "Liked"
        case .didNotLike: return "Did Not Like"
        }
    }

    var icon: String {
        switch self {
        case .loved:      return "heart.fill"
        case .liked:      return "hand.thumbsup.fill"
        case .didNotLike: return "hand.thumbsdown.fill"
        }
    }

    /// Design token name for the accent color associated with this rating.
    var accentTokenName: String {
        switch self {
        case .loved:      return "SuccessAccent"
        case .liked:      return "PrimaryAccent"
        case .didNotLike: return "WarningAccent"
        }
    }

    var accessibilityLabel: String {
        switch self {
        case .loved:      return "Loved it"
        case .liked:      return "Liked it"
        case .didNotLike: return "Did not like it"
        }
    }
}

// MARK: - API Request / Response

struct SubmitRatingRequest: Encodable {
    let rating: String  // RatingValue.rawValue
}

struct RatingResponse: Decodable {
    let roundId:  String
    let memberId: String
    let rating:   String
    let ratedAt:  String
}

struct RatingsListResponse: Decodable {
    let roundId: String
    let ratings: [RatingEntryResponse]
}

struct RatingEntryResponse: Decodable, Identifiable {
    let memberId:    String
    let displayName: String
    let avatarKey:   String?
    let rating:      String?
    let ratedAt:     String?

    var id: String { memberId }

    var ratingValue: RatingValue? {
        guard let r = rating else { return nil }
        return RatingValue(rawValue: r)
    }
}

// MARK: - Derived Summary

struct RatingsSummary {
    let loved:          Int
    let liked:          Int
    let didNotLike:     Int
    let totalRated:     Int
    let totalAttendees: Int

    var allRated:     Bool { totalRated == totalAttendees }
    var hasAnyRating: Bool { totalRated > 0 }

    static func from(entries: [RatingEntryResponse]) -> RatingsSummary {
        RatingsSummary(
            loved:          entries.filter { $0.rating == "loved"        }.count,
            liked:          entries.filter { $0.rating == "liked"        }.count,
            didNotLike:     entries.filter { $0.rating == "did_not_like" }.count,
            totalRated:     entries.filter { $0.rating != nil            }.count,
            totalAttendees: entries.count
        )
    }
}

// MARK: - View Model Entry (maps API response to view-ready model)

struct RatingEntry: Identifiable {
    let memberId:    String
    let displayName: String
    let avatarKey:   String
    let rating:      RatingValue?
    let ratedAt:     Date?

    var id: String  { memberId }
    var hasRated: Bool { rating != nil }

    /// Convert back to a response-like struct for RatingsSummary.from()
    func toResponse() -> RatingEntryResponse {
        RatingEntryResponse(
            memberId:    memberId,
            displayName: displayName,
            avatarKey:   avatarKey,
            rating:      rating?.rawValue,
            ratedAt:     nil
        )
    }
}

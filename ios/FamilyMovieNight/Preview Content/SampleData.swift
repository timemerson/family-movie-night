import Foundation

// MARK: - SampleData
//
// Realistic fake data for Dev Menu previews and SwiftUI Previews.
// All data is static — no networking, no persistence.

enum SampleData {

    // MARK: - Members

    static let memberTim = GroupMember(
        userId: "user_tim",
        displayName: "Tim",
        avatarKey: "avatar_bear",
        role: "creator",
        joinedAt: "2024-01-01T00:00:00Z",
        isManaged: false,
        parentUserId: nil,
        memberType: "independent"
    )

    static let memberSarah = GroupMember(
        userId: "user_sarah",
        displayName: "Sarah",
        avatarKey: "avatar_fox",
        role: "member",
        joinedAt: "2024-01-02T00:00:00Z",
        isManaged: false,
        parentUserId: nil,
        memberType: "independent"
    )

    static let memberMax = GroupMember(
        userId: "managed_max",
        displayName: "Max",
        avatarKey: "avatar_dino",
        role: "member",
        joinedAt: "2024-01-03T00:00:00Z",
        isManaged: true,
        parentUserId: "user_tim",
        memberType: "managed"
    )

    static let memberGrandma = GroupMember(
        userId: "user_grandma",
        displayName: "Grandma",
        avatarKey: "avatar_owl",
        role: "member",
        joinedAt: "2024-01-04T00:00:00Z",
        isManaged: false,
        parentUserId: nil,
        memberType: "independent"
    )

    static let allMembers: [GroupMember] = [memberTim, memberSarah, memberMax, memberGrandma]

    // MARK: - Switchable Profiles

    static let profileTim = SwitchableProfile(
        memberId: "user_tim",
        displayName: "Tim",
        avatarKey: "avatar_bear",
        isManaged: false,
        parentUserId: nil
    )

    static let profileSarah = SwitchableProfile(
        memberId: "user_sarah",
        displayName: "Sarah",
        avatarKey: "avatar_fox",
        isManaged: false,
        parentUserId: nil
    )

    static let profileMax = SwitchableProfile(
        memberId: "managed_max",
        displayName: "Max",
        avatarKey: "avatar_dino",
        isManaged: true,
        parentUserId: "user_tim"
    )

    static let profileEmily = SwitchableProfile(
        memberId: "managed_emily",
        displayName: "Emily",
        avatarKey: "avatar_cat",
        isManaged: true,
        parentUserId: "user_tim"
    )

    static let profileLiam = SwitchableProfile(
        memberId: "managed_liam",
        displayName: "Liam",
        avatarKey: "avatar_lion",
        isManaged: true,
        parentUserId: "user_tim"
    )

    // MARK: - Rating Entries

    static let ratingEntryTimLoved = RatingEntry(
        memberId: "user_tim",
        displayName: "Tim",
        avatarKey: "avatar_bear",
        rating: .loved,
        ratedAt: Date()
    )

    static let ratingEntrySarahLiked = RatingEntry(
        memberId: "user_sarah",
        displayName: "Sarah",
        avatarKey: "avatar_fox",
        rating: .liked,
        ratedAt: Date()
    )

    static let ratingEntryMaxUnrated = RatingEntry(
        memberId: "managed_max",
        displayName: "Max",
        avatarKey: "avatar_dino",
        rating: nil,
        ratedAt: nil
    )

    static let ratingEntryGrandmaUnrated = RatingEntry(
        memberId: "user_grandma",
        displayName: "Grandma",
        avatarKey: "avatar_owl",
        rating: nil,
        ratedAt: nil
    )

    static let allRatingEntries: [RatingEntry] = [
        ratingEntryTimLoved,
        ratingEntrySarahLiked,
        ratingEntryMaxUnrated,
        ratingEntryGrandmaUnrated
    ]

    static let ratingEntriesAllRated: [RatingEntry] = [
        ratingEntryTimLoved,
        ratingEntrySarahLiked,
        RatingEntry(memberId: "managed_max", displayName: "Max", avatarKey: "avatar_dino",
                    rating: .loved, ratedAt: Date()),
        RatingEntry(memberId: "user_grandma", displayName: "Grandma", avatarKey: "avatar_owl",
                    rating: .didNotLike, ratedAt: Date())
    ]

    // MARK: - Ratings Summary

    static let summaryPartial = RatingsSummary(
        loved: 2, liked: 1, didNotLike: 0, totalRated: 3, totalAttendees: 4
    )

    static let summaryAllRated = RatingsSummary(
        loved: 2, liked: 1, didNotLike: 1, totalRated: 4, totalAttendees: 4
    )

    static let summaryEmpty = RatingsSummary(
        loved: 0, liked: 0, didNotLike: 0, totalRated: 0, totalAttendees: 4
    )

    // MARK: - Movies

    static let movieIncredibles = MovieInfo(
        title: "The Incredibles",
        year: 2004,
        contentRating: "PG",
        posterURL: URL(string: "https://image.tmdb.org/t/p/w185/2LqaLgk4Z226KkgPJuiOQ58XLef.jpg"),
        tmdbMovieId: 9806
    )

    static let movieSpirited = MovieInfo(
        title: "Spirited Away",
        year: 2001,
        contentRating: "PG",
        posterURL: URL(string: "https://image.tmdb.org/t/p/w185/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg"),
        tmdbMovieId: 129
    )

    static let movieNemo = MovieInfo(
        title: "Finding Nemo",
        year: 2003,
        contentRating: "G",
        posterURL: URL(string: "https://image.tmdb.org/t/p/w185/eHuGQ10FUzK1mdOY69wF5pGgEf5.jpg"),
        tmdbMovieId: 12
    )

    static let movieMoana = MovieInfo(
        title: "Moana",
        year: 2016,
        contentRating: "PG",
        posterURL: URL(string: "https://image.tmdb.org/t/p/w185/4LrIPMu0rGKMzCjiOxJKVGO9lhL.jpg"),
        tmdbMovieId: 277834
    )

    // MARK: - Session Summaries

    static let sessionRated = SessionSummary(
        roundId: "round_001",
        status: .rated,
        createdAt: "2026-02-14T20:00:00Z",
        attendees: [
            SessionAttendee(memberId: "user_tim", displayName: "Tim", avatarKey: "avatar_bear"),
            SessionAttendee(memberId: "user_sarah", displayName: "Sarah", avatarKey: "avatar_fox"),
            SessionAttendee(memberId: "managed_max", displayName: "Max", avatarKey: "avatar_dino")
        ],
        pick: SessionPickSummary(
            tmdbMovieId: 9806,
            title: "The Incredibles",
            posterPath: "/2LqaLgk4Z226KkgPJuiOQ58XLef.jpg"
        ),
        ratingsSummary: SessionRatingsSummary(loved: 2, liked: 1, didNotLike: 0)
    )

    static let sessionWatched = SessionSummary(
        roundId: "round_002",
        status: .watched,
        createdAt: "2026-01-28T19:00:00Z",
        attendees: [
            SessionAttendee(memberId: "user_tim", displayName: "Tim", avatarKey: "avatar_bear"),
            SessionAttendee(memberId: "user_sarah", displayName: "Sarah", avatarKey: "avatar_fox"),
            SessionAttendee(memberId: "managed_max", displayName: "Max", avatarKey: "avatar_dino"),
            SessionAttendee(memberId: "user_grandma", displayName: "Grandma", avatarKey: "avatar_owl")
        ],
        pick: SessionPickSummary(
            tmdbMovieId: 129,
            title: "Spirited Away",
            posterPath: "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg"
        ),
        ratingsSummary: SessionRatingsSummary(loved: 1, liked: 0, didNotLike: 0)
    )

    static let sessionVoting = SessionSummary(
        roundId: "round_003",
        status: .voting,
        createdAt: "2026-02-21T18:00:00Z",
        attendees: [
            SessionAttendee(memberId: "user_tim", displayName: "Tim", avatarKey: "avatar_bear"),
            SessionAttendee(memberId: "user_sarah", displayName: "Sarah", avatarKey: "avatar_fox")
        ],
        pick: nil,
        ratingsSummary: nil
    )

    static let sessionExpired = SessionSummary(
        roundId: "round_004",
        status: .expired,
        createdAt: "2025-12-15T20:00:00Z",
        attendees: [
            SessionAttendee(memberId: "user_tim", displayName: "Tim", avatarKey: "avatar_bear"),
            SessionAttendee(memberId: "user_sarah", displayName: "Sarah", avatarKey: "avatar_fox")
        ],
        pick: nil,
        ratingsSummary: nil
    )

    static let allSessions: [SessionSummary] = [
        sessionVoting,
        sessionWatched,
        sessionRated,
        sessionExpired
    ]

    // MARK: - Session Suggestions

    static let suggestionIncredibles = SessionSuggestionItem(
        tmdbMovieId: 9806,
        title: "The Incredibles",
        year: 2004,
        posterPath: "/2LqaLgk4Z226KkgPJuiOQ58XLef.jpg",
        contentRating: "PG",
        votesUp: 3,
        votesDown: 0,
        voters: [
            SuggestionVoter(memberId: "user_tim", displayName: "Tim", avatarKey: "avatar_bear", vote: "up"),
            SuggestionVoter(memberId: "user_sarah", displayName: "Sarah", avatarKey: "avatar_fox", vote: "up"),
            SuggestionVoter(memberId: "managed_max", displayName: "Max", avatarKey: "avatar_dino", vote: "up")
        ]
    )

    static let suggestionSpirited = SessionSuggestionItem(
        tmdbMovieId: 129,
        title: "Spirited Away",
        year: 2001,
        posterPath: "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
        contentRating: "PG",
        votesUp: 2,
        votesDown: 1,
        voters: [
            SuggestionVoter(memberId: "user_tim", displayName: "Tim", avatarKey: "avatar_bear", vote: "up"),
            SuggestionVoter(memberId: "user_sarah", displayName: "Sarah", avatarKey: "avatar_fox", vote: "down"),
            SuggestionVoter(memberId: "managed_max", displayName: "Max", avatarKey: "avatar_dino", vote: "up")
        ]
    )

    static let suggestionNemo = SessionSuggestionItem(
        tmdbMovieId: 12,
        title: "Finding Nemo",
        year: 2003,
        posterPath: "/eHuGQ10FUzK1mdOY69wF5pGgEf5.jpg",
        contentRating: "G",
        votesUp: 1,
        votesDown: 2,
        voters: [
            SuggestionVoter(memberId: "user_tim", displayName: "Tim", avatarKey: "avatar_bear", vote: "down"),
            SuggestionVoter(memberId: "user_sarah", displayName: "Sarah", avatarKey: "avatar_fox", vote: "down"),
            SuggestionVoter(memberId: "managed_max", displayName: "Max", avatarKey: "avatar_dino", vote: "up")
        ]
    )

    // MARK: - Session Detail

    static let sessionDetailData = SessionDetailData(
        roundId: "round_001",
        groupId: "group_001",
        status: .rated,
        startedBy: "user_tim",
        attendees: [
            SessionAttendee(memberId: "user_tim", displayName: "Tim", avatarKey: "avatar_bear"),
            SessionAttendee(memberId: "user_sarah", displayName: "Sarah", avatarKey: "avatar_fox"),
            SessionAttendee(memberId: "managed_max", displayName: "Max", avatarKey: "avatar_dino")
        ],
        createdAt: "2026-02-14T20:00:00Z",
        suggestions: [suggestionIncredibles, suggestionSpirited, suggestionNemo],
        pickedMovieId: 9806
    )
}

// MARK: - MovieInfo (lightweight model for preview use)

struct MovieInfo {
    let title: String
    let year: Int
    let contentRating: String?
    let posterURL: URL?
    let tmdbMovieId: Int
}

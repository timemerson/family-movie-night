import Combine
import Foundation

// MARK: - SessionDetailViewModel

@MainActor
class SessionDetailViewModel: ObservableObject {

    // MARK: - Published State

    @Published var roundDetails:     SessionDetailData?
    @Published var ratingEntries:    [RatingEntry] = []
    @Published var isLoadingRound:   Bool = false
    @Published var isLoadingRatings: Bool = false
    @Published var error:            String?

    // MARK: - Configuration state

    private(set) var roundId:           String = ""
    private(set) var groupId:           String = ""
    private(set) var activeMemberId:    String = ""
    private(set) var isCreator:         Bool = false
    private(set) var activeProfileName: String? = nil

    // MARK: - Private

    private var apiClient: APIClient?

    // MARK: - Derived

    var canRateNow: Bool {
        guard roundDetails?.status == .watched else { return false }
        return !ratingEntries.contains { $0.memberId == activeMemberId && $0.hasRated }
    }

    var ratingsSummary: RatingsSummary {
        RatingsSummary.from(entries: ratingEntries.map { $0.toResponse() })
    }

    var pickedSuggestion: SessionSuggestionItem? {
        guard let pickedId = roundDetails?.pickedMovieId else { return nil }
        return roundDetails?.suggestions.first { $0.tmdbMovieId == pickedId }
    }

    // MARK: - Configuration

    func configure(
        apiClient:         APIClient?,
        roundId:           String,
        groupId:           String,
        activeMemberId:    String,
        isCreator:         Bool,
        activeProfileName: String?
    ) {
        self.apiClient = apiClient
        self.roundId = roundId
        self.groupId = groupId
        self.activeMemberId = activeMemberId
        self.isCreator = isCreator
        self.activeProfileName = activeProfileName
    }

    // MARK: - API Operations

    func loadAll() async {
        isLoadingRound = true
        isLoadingRatings = true
        error = nil

        guard let apiClient else {
            // Preview / dev harness mode
            try? await Task.sleep(for: .milliseconds(800))
            roundDetails = SampleData.sessionDetailData
            ratingEntries = SampleData.allRatingEntries
            isLoadingRound = false
            isLoadingRatings = false
            return
        }

        do {
            // Load round details (GET /rounds/:id returns RoundWithDetails which we map to SessionDetailData)
            let round: RoundDetailsForSession = try await apiClient.request(
                "GET",
                path: "/rounds/\(roundId)"
            )
            roundDetails = round.toSessionDetailData()
            isLoadingRound = false
        } catch let apiError as APIError {
            isLoadingRound = false
            isLoadingRatings = false
            handleError(apiError)
            return
        } catch {
            isLoadingRound = false
            isLoadingRatings = false
            self.error = "Couldn't load session details. Check your connection."
            return
        }

        // Load ratings
        await loadRatings()
    }

    func loadRatings() async {
        guard let apiClient else {
            // Preview / dev harness mode
            try? await Task.sleep(for: .milliseconds(400))
            ratingEntries = SampleData.ratingEntriesAllRated
            isLoadingRatings = false
            return
        }

        isLoadingRatings = true

        do {
            let response: RatingsListResponse = try await apiClient.request(
                "GET",
                path: "/rounds/\(roundId)/ratings"
            )
            ratingEntries = response.ratings.map { entry in
                RatingEntry(
                    memberId:    entry.memberId,
                    displayName: entry.displayName,
                    avatarKey:   entry.avatarKey ?? "avatar_bear",
                    rating:      entry.ratingValue,
                    ratedAt:     nil
                )
            }
        } catch {
            // Silently fail ratings load — round details still visible
        }

        isLoadingRatings = false
    }

    func refresh() async {
        await loadAll()
    }

    // MARK: - Private

    private func handleError(_ error: APIError) {
        switch error {
        case .httpError(let statusCode, _):
            switch statusCode {
            case 403: self.error = "You don't have access to this session."
            case 404: self.error = "Session not found."
            default:  self.error = "Something went wrong (\(statusCode))."
            }
        case .invalidResponse:
            self.error = "Couldn't load session details. Check your connection."
        }
    }
}

// MARK: - RoundDetailsForSession (maps GET /rounds/:id response to SessionDetailData)

/// Intermediate model to decode the GET /rounds/:id response and map it to SessionDetailData
private struct RoundDetailsForSession: Decodable {
    let roundId: String
    let groupId: String
    let status: String
    let startedBy: String
    let createdAt: String
    let attendees: [String]?
    let suggestions: [RoundSuggestionForSession]
    let pick: RoundPickForSession?

    func toSessionDetailData() -> SessionDetailData {
        let sessionStatus = SessionStatus(rawValue: status) ?? .voting

        // Build attendees from round.attendees (member IDs) — we use voter display names as fallback
        let allVoterNames = Dictionary(
            suggestions.flatMap { s in
                s.voters.map { ($0.userId, $0.displayName) }
            },
            uniquingKeysWith: { first, _ in first }
        )

        let attendeeList: [SessionAttendee]
        if let ids = attendees {
            attendeeList = ids.map { id in
                SessionAttendee(
                    memberId: id,
                    displayName: allVoterNames[id] ?? id,
                    avatarKey: nil
                )
            }
        } else {
            // No explicit attendees — derive from voters
            let uniqueIds = Set(suggestions.flatMap { $0.voters.map { $0.userId } })
            attendeeList = uniqueIds.map { id in
                SessionAttendee(
                    memberId: id,
                    displayName: allVoterNames[id] ?? id,
                    avatarKey: nil
                )
            }
        }

        let sessionSuggestions = suggestions.map { s in
            SessionSuggestionItem(
                tmdbMovieId: s.tmdbMovieId,
                title: s.title,
                year: s.year,
                posterPath: s.posterPath,
                contentRating: s.contentRating,
                votesUp: s.votes.up,
                votesDown: s.votes.down,
                voters: s.voters.map { v in
                    SuggestionVoter(
                        memberId: v.userId,
                        displayName: v.displayName,
                        avatarKey: nil,
                        vote: v.vote
                    )
                }
            )
        }

        return SessionDetailData(
            roundId: roundId,
            groupId: groupId,
            status: sessionStatus,
            startedBy: startedBy,
            attendees: attendeeList,
            createdAt: createdAt,
            suggestions: sessionSuggestions,
            pickedMovieId: pick?.tmdbMovieId
        )
    }
}

private struct RoundSuggestionForSession: Decodable {
    let tmdbMovieId: Int
    let title: String
    let year: Int
    let posterPath: String?
    let contentRating: String?
    let votes: VoteCounts
    let voters: [VoterInfo]

    struct VoteCounts: Decodable {
        let up: Int
        let down: Int
    }

    struct VoterInfo: Decodable {
        let userId: String
        let displayName: String
        let vote: String
    }
}

private struct RoundPickForSession: Decodable {
    let tmdbMovieId: Int
    let title: String
}

// MARK: - Factory (Dev Menu)

extension SessionDetailViewModel {

    static func makeLoading() -> SessionDetailViewModel {
        let vm = SessionDetailViewModel()
        vm.isLoadingRound = true
        vm.isLoadingRatings = true
        return vm
    }

    static func makePopulated(canRate: Bool = false) -> SessionDetailViewModel {
        let vm = SessionDetailViewModel()
        vm.configure(
            apiClient: nil,
            roundId: "round_001",
            groupId: "group_001",
            activeMemberId: canRate ? "managed_max" : "user_tim",
            isCreator: !canRate,
            activeProfileName: nil
        )
        vm.roundDetails = SampleData.sessionDetailData
        vm.ratingEntries = canRate ? SampleData.allRatingEntries : SampleData.ratingEntriesAllRated
        return vm
    }

    static func makeWatchedWithRateNow() -> SessionDetailViewModel {
        // Build a watched session where active member hasn't rated
        let watchedDetail = SessionDetailData(
            roundId: "round_002",
            groupId: "group_001",
            status: .watched,
            startedBy: "user_tim",
            attendees: [
                SessionAttendee(memberId: "user_tim", displayName: "Tim", avatarKey: "avatar_bear"),
                SessionAttendee(memberId: "user_sarah", displayName: "Sarah", avatarKey: "avatar_fox"),
                SessionAttendee(memberId: "managed_max", displayName: "Max", avatarKey: "avatar_dino")
            ],
            createdAt: "2026-01-28T19:00:00Z",
            suggestions: SampleData.sessionDetailData.suggestions,
            pickedMovieId: 129
        )
        let vm = SessionDetailViewModel()
        vm.configure(
            apiClient: nil,
            roundId: "round_002",
            groupId: "group_001",
            activeMemberId: "managed_max",
            isCreator: false,
            activeProfileName: nil
        )
        vm.roundDetails = watchedDetail
        vm.ratingEntries = [
            SampleData.ratingEntryTimLoved,
            SampleData.ratingEntrySarahLiked,
            SampleData.ratingEntryMaxUnrated
        ]
        return vm
    }

    static func makeError() -> SessionDetailViewModel {
        let vm = SessionDetailViewModel()
        vm.error = "Couldn't load session details. Check your connection."
        return vm
    }
}

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
        roundId:           String,
        groupId:           String,
        activeMemberId:    String,
        isCreator:         Bool,
        activeProfileName: String?
    ) {
        self.roundId = roundId
        self.groupId = groupId
        self.activeMemberId = activeMemberId
        self.isCreator = isCreator
        self.activeProfileName = activeProfileName
    }

    // MARK: - API Operations (Fake — Dev Harness)

    func loadAll() async {
        isLoadingRound = true
        isLoadingRatings = true
        error = nil
        try? await Task.sleep(for: .milliseconds(800))
        roundDetails = SampleData.sessionDetailData
        ratingEntries = SampleData.allRatingEntries
        isLoadingRound = false
        isLoadingRatings = false
    }

    func loadRatings() async {
        isLoadingRatings = true
        try? await Task.sleep(for: .milliseconds(400))
        ratingEntries = SampleData.ratingEntriesAllRated
        isLoadingRatings = false
    }

    func refresh() async {
        await loadAll()
    }
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

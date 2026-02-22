import Combine
import Foundation
import UIKit

// MARK: - RatingViewState

enum RatingViewState {
    case loading
    case unrated
    case submitting
    case wait           // submitted, not all rated
    case allRated
    case alreadyRated
    case error(String)
}

// MARK: - RatingViewModel

@MainActor
class RatingViewModel: ObservableObject {

    // MARK: - Published State
    @Published var selectedRating:  RatingValue?
    @Published var isSubmitting:    Bool = false
    @Published var hasSubmitted:    Bool = false
    @Published var isLoading:       Bool = false
    @Published var error:           String?
    @Published var ratingEntries:   [RatingEntry] = []
    @Published var ratingsClosed:   Bool = false

    // MARK: - Configuration (set via configure())
    private(set) var isCreator:         Bool = false
    private(set) var activeProfileName: String? = nil

    // MARK: - Private
    private var roundId:        String = ""
    private var activeMemberId: String = ""
    private var pollingTask:    Task<Void, Never>?

    // Movie metadata (passed in from caller)
    var movieTitle:         String = ""
    var movieYear:          Int = 2024
    var movieContentRating: String? = nil
    var posterURL:          URL? = nil

    // MARK: - Derived

    var allRated: Bool { ratingEntries.allSatisfy { $0.hasRated } }
    var ratedCount: Int { ratingEntries.filter { $0.hasRated }.count }
    var totalAttendees: Int { ratingEntries.count }
    var alreadyRated: Bool {
        ratingEntries.first(where: { $0.memberId == activeMemberId })?.hasRated ?? false
    }
    var summary: RatingsSummary {
        RatingsSummary.from(entries: ratingEntries.map { $0.toResponse() })
    }

    var viewState: RatingViewState {
        if isLoading { return .loading }
        if let error { return .error(error) }
        if ratingsClosed { return .allRated }
        if hasSubmitted && allRated { return .allRated }
        if hasSubmitted { return .wait }
        if isSubmitting { return .submitting }
        if alreadyRated { return .alreadyRated }
        return .unrated
    }

    // MARK: - Configuration

    func configure(
        roundId:           String,
        activeMemberId:    String,
        isCreator:         Bool,
        activeProfileName: String?,
        movieTitle:        String,
        movieYear:         Int,
        movieContentRating: String?,
        posterURL:         URL?
    ) {
        self.roundId = roundId
        self.activeMemberId = activeMemberId
        self.isCreator = isCreator
        self.activeProfileName = activeProfileName
        self.movieTitle = movieTitle
        self.movieYear = movieYear
        self.movieContentRating = movieContentRating
        self.posterURL = posterURL
    }

    // MARK: - Fake API Operations (Dev Harness)

    func loadRatings() async {
        isLoading = true
        try? await Task.sleep(for: .milliseconds(600))
        // Populated by configure-time pre-seeding or left empty
        isLoading = false
    }

    func submitRating() async {
        guard let selected = selectedRating else { return }
        isSubmitting = true
        if UIDevice.current.userInterfaceIdiom == .phone {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        }
        try? await Task.sleep(for: .milliseconds(800))
        // Simulate the active member's entry updating
        ratingEntries = ratingEntries.map { entry in
            guard entry.memberId == activeMemberId else { return entry }
            return RatingEntry(
                memberId:    entry.memberId,
                displayName: entry.displayName,
                avatarKey:   entry.avatarKey,
                rating:      selected,
                ratedAt:     Date()
            )
        }
        hasSubmitted = true
        isSubmitting = false
        if allRated {
            if UIDevice.current.userInterfaceIdiom == .phone {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            }
        }
    }

    func closeRatings() async {
        try? await Task.sleep(for: .milliseconds(400))
        ratingsClosed = true
    }

    // MARK: - Polling (no-op in dev harness)

    func startPolling() {
        pollingTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(5))
            }
        }
    }

    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }
}

// MARK: - Factory Methods (for Dev Menu / Previews)

extension RatingViewModel {

    static func makeUnrated() -> RatingViewModel {
        let vm = RatingViewModel()
        vm.configure(
            roundId: "round_001",
            activeMemberId: "user_tim",
            isCreator: true,
            activeProfileName: nil,
            movieTitle: "The Incredibles",
            movieYear: 2004,
            movieContentRating: "PG",
            posterURL: URL(string: "https://image.tmdb.org/t/p/w185/2LqaLgk4Z226KkgPJuiOQ58XLef.jpg")
        )
        vm.ratingEntries = SampleData.allRatingEntries
        return vm
    }

    static func makeLoading() -> RatingViewModel {
        let vm = RatingViewModel()
        vm.configure(
            roundId: "round_001",
            activeMemberId: "user_tim",
            isCreator: true,
            activeProfileName: nil,
            movieTitle: "The Incredibles",
            movieYear: 2004,
            movieContentRating: "PG",
            posterURL: nil
        )
        vm.isLoading = true
        return vm
    }

    static func makeWaitState() -> RatingViewModel {
        let vm = RatingViewModel()
        vm.configure(
            roundId: "round_001",
            activeMemberId: "user_tim",
            isCreator: true,
            activeProfileName: nil,
            movieTitle: "The Incredibles",
            movieYear: 2004,
            movieContentRating: "PG",
            posterURL: nil
        )
        vm.ratingEntries = SampleData.allRatingEntries
        vm.hasSubmitted = true
        vm.selectedRating = .loved
        return vm
    }

    static func makeAllRated() -> RatingViewModel {
        let vm = RatingViewModel()
        vm.configure(
            roundId: "round_001",
            activeMemberId: "user_tim",
            isCreator: true,
            activeProfileName: nil,
            movieTitle: "The Incredibles",
            movieYear: 2004,
            movieContentRating: "PG",
            posterURL: nil
        )
        vm.ratingEntries = SampleData.ratingEntriesAllRated
        vm.hasSubmitted = true
        vm.selectedRating = .loved
        vm.ratingsClosed = true
        return vm
    }

    static func makeManagedMember() -> RatingViewModel {
        let vm = RatingViewModel()
        vm.configure(
            roundId: "round_001",
            activeMemberId: "managed_max",
            isCreator: false,
            activeProfileName: "Max",
            movieTitle: "Spirited Away",
            movieYear: 2001,
            movieContentRating: "PG",
            posterURL: nil
        )
        vm.ratingEntries = SampleData.allRatingEntries
        return vm
    }

    static func makeError() -> RatingViewModel {
        let vm = RatingViewModel()
        vm.configure(
            roundId: "round_001",
            activeMemberId: "user_tim",
            isCreator: true,
            activeProfileName: nil,
            movieTitle: "The Incredibles",
            movieYear: 2004,
            movieContentRating: "PG",
            posterURL: nil
        )
        vm.ratingEntries = SampleData.allRatingEntries
        vm.selectedRating = .liked
        vm.error = "Couldn't connect. Check your connection and try again."
        return vm
    }

    static func makeAlreadyRated() -> RatingViewModel {
        let vm = RatingViewModel()
        vm.configure(
            roundId: "round_001",
            activeMemberId: "user_tim",
            isCreator: true,
            activeProfileName: nil,
            movieTitle: "The Incredibles",
            movieYear: 2004,
            movieContentRating: "PG",
            posterURL: nil
        )
        vm.ratingEntries = SampleData.ratingEntriesAllRated
        vm.selectedRating = .loved
        return vm
    }
}

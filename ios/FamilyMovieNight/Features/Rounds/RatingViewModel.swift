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
    private var apiClient:      APIClient?
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
        posterURL:         URL?,
        apiClient:         APIClient? = nil
    ) {
        self.roundId = roundId
        self.activeMemberId = activeMemberId
        self.isCreator = isCreator
        self.activeProfileName = activeProfileName
        self.movieTitle = movieTitle
        self.movieYear = movieYear
        self.movieContentRating = movieContentRating
        self.posterURL = posterURL
        self.apiClient = apiClient
    }

    // MARK: - API Operations

    func loadRatings() async {
        isLoading = true
        error = nil

        guard let apiClient else {
            // Preview / dev harness mode — no real API
            try? await Task.sleep(for: .milliseconds(600))
            isLoading = false
            return
        }

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
            // If the active member already rated, pre-select their rating
            if let existing = ratingEntries.first(where: { $0.memberId == activeMemberId }),
               let existingRating = existing.rating {
                selectedRating = existingRating
            }
        } catch {
            self.error = errorMessage(from: error)
        }

        isLoading = false

        // Start polling if we've submitted (or already rated) and not all done
        if (hasSubmitted || alreadyRated) && !allRated {
            startPolling()
        }
    }

    func submitRating() async {
        guard let selected = selectedRating else { return }
        isSubmitting = true
        error = nil

        if UIDevice.current.userInterfaceIdiom == .phone {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        }

        guard let apiClient else {
            // Preview / dev harness mode
            try? await Task.sleep(for: .milliseconds(800))
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
            return
        }

        do {
            let request = SubmitRatingRequest(rating: selected.rawValue)
            let _: RatingResponse = try await apiClient.request(
                "POST",
                path: "/rounds/\(roundId)/ratings",
                body: request
            )

            // Update local entry to reflect the submitted rating
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
            } else {
                startPolling()
            }
        } catch {
            isSubmitting = false
            if UIDevice.current.userInterfaceIdiom == .phone {
                UINotificationFeedbackGenerator().notificationOccurred(.error)
            }
            self.error = errorMessage(from: error)
        }
    }

    func closeRatings() async {
        guard let apiClient else {
            // Preview / dev harness mode
            try? await Task.sleep(for: .milliseconds(400))
            ratingsClosed = true
            return
        }

        do {
            struct StatusUpdate: Encodable {
                let status: String
            }
            let _: RoundDetails = try await apiClient.request(
                "PATCH",
                path: "/rounds/\(roundId)",
                body: StatusUpdate(status: "rated")
            )
            ratingsClosed = true
            stopPolling()
        } catch {
            self.error = "Failed to close ratings. Try again."
        }
    }

    // MARK: - Polling

    func startPolling() {
        stopPolling()
        pollingTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(5))
                guard !Task.isCancelled else { break }
                await refreshRatings()
                if allRated {
                    if UIDevice.current.userInterfaceIdiom == .phone {
                        UINotificationFeedbackGenerator().notificationOccurred(.success)
                    }
                    break
                }
            }
        }
    }

    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }

    // MARK: - Private Helpers

    private func refreshRatings() async {
        guard let apiClient else { return }

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
            // Silently fail polling — don't surface transient errors
        }
    }

    private func errorMessage(from error: Error) -> String {
        if let apiError = error as? APIError {
            switch apiError {
            case .httpError(let statusCode, _):
                switch statusCode {
                case 400: return "Something went wrong. Try again."
                case 403: return "You're not listed as an attendee for this session."
                case 404: return "This session wasn't found."
                case 409: return "Your rating has already been recorded."
                default:  return "Couldn't connect. Check your connection and try again."
                }
            case .invalidResponse:
                return "Couldn't connect. Check your connection and try again."
            }
        }
        return "Couldn't connect. Check your connection and try again."
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

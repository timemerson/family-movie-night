import Combine
import Foundation
import os

@MainActor
class VotingViewModel: ObservableObject {
    private let logger = Logger(subsystem: "com.familymovienight", category: "VotingViewModel")

    @Published var roundDetails: RoundDetails?
    @Published var results: RoundResultsResponse?
    @Published var pickResponse: PickResponse?
    @Published var isLoading = false
    @Published var isVoting = false
    @Published var isPicking = false
    @Published var error: String?

    private var apiClient: APIClient?
    private var groupId: String?
    private var configured = false

    var roundId: String? { roundDetails?.roundId }
    var status: String { roundDetails?.status ?? "unknown" }
    var suggestions: [SuggestionWithVotes] { roundDetails?.suggestions ?? [] }
    var voteProgress: VoteProgress? { roundDetails?.voteProgress }
    var pick: RoundPick? { roundDetails?.pick }

    func configure(apiClient: APIClient, groupId: String) {
        guard !configured else { return }
        self.apiClient = apiClient
        self.groupId = groupId
        configured = true
    }

    // MARK: - Create Round

    func createRound(excludeMovieIds: [Int] = [], includeWatchlist: Bool = false, attendees: [String]? = nil) async -> String? {
        guard let apiClient, let groupId else { return nil }
        isLoading = true
        error = nil

        do {
            let request = CreateRoundRequest(
                excludeMovieIds: excludeMovieIds,
                includeWatchlist: includeWatchlist,
                attendees: attendees
            )
            let response: CreateRoundResponse = try await apiClient.request(
                "POST",
                path: "/groups/\(groupId)/rounds",
                body: request
            )
            logger.info("Round created: \(response.roundId)")
            // Load full round details
            await loadRound(roundId: response.roundId)
            isLoading = false
            return response.roundId
        } catch let apiError as APIError {
            isLoading = false
            handleAPIError(apiError, context: "creating round")
            return nil
        } catch {
            isLoading = false
            self.error = error.localizedDescription
            return nil
        }
    }

    // MARK: - Load Round

    func loadRound(roundId: String) async {
        guard let apiClient else { return }
        isLoading = true
        error = nil

        do {
            let details: RoundDetails = try await apiClient.request(
                "GET",
                path: "/rounds/\(roundId)"
            )
            self.roundDetails = details
            isLoading = false
            logger.info("Round loaded: \(details.roundId), status: \(details.status)")
        } catch let apiError as APIError {
            isLoading = false
            handleAPIError(apiError, context: "loading round")
        } catch {
            isLoading = false
            self.error = error.localizedDescription
        }
    }

    // MARK: - Submit Vote

    func submitVote(tmdbMovieId: Int, vote: String) async {
        guard let apiClient, let roundId else { return }
        isVoting = true
        error = nil

        do {
            let request = SubmitVoteRequest(tmdbMovieId: tmdbMovieId, vote: vote)
            let _: VoteResponse = try await apiClient.request(
                "POST",
                path: "/rounds/\(roundId)/votes",
                body: request
            )
            logger.info("Vote submitted: \(vote) on movie \(tmdbMovieId)")
            // Refresh round details to show updated votes
            await loadRound(roundId: roundId)
            isVoting = false
        } catch let apiError as APIError {
            isVoting = false
            handleAPIError(apiError, context: "submitting vote")
        } catch {
            isVoting = false
            self.error = error.localizedDescription
        }
    }

    // MARK: - Load Results

    func loadResults() async {
        guard let apiClient, let roundId else { return }
        isLoading = true
        error = nil

        do {
            let response: RoundResultsResponse = try await apiClient.request(
                "GET",
                path: "/rounds/\(roundId)/results"
            )
            self.results = response
            isLoading = false
            logger.info("Results loaded: \(response.results.count) movies ranked")
        } catch let apiError as APIError {
            isLoading = false
            handleAPIError(apiError, context: "loading results")
        } catch {
            isLoading = false
            self.error = error.localizedDescription
        }
    }

    // MARK: - Close Round

    func closeRound() async {
        guard let apiClient, let roundId else { return }
        isLoading = true
        error = nil

        do {
            struct CloseRequest: Codable { let status = "closed" }
            let _: RoundDetails = try await apiClient.request(
                "PATCH",
                path: "/rounds/\(roundId)",
                body: CloseRequest()
            )
            logger.info("Round closed: \(roundId)")
            await loadRound(roundId: roundId)
            isLoading = false
        } catch let apiError as APIError {
            isLoading = false
            handleAPIError(apiError, context: "closing round")
        } catch {
            isLoading = false
            self.error = error.localizedDescription
        }
    }

    // MARK: - Pick Movie

    func pickMovie(tmdbMovieId: Int) async {
        guard let apiClient, let roundId else { return }
        isPicking = true
        error = nil

        do {
            let request = PickMovieRequest(tmdbMovieId: tmdbMovieId)
            let response: PickResponse = try await apiClient.request(
                "POST",
                path: "/rounds/\(roundId)/pick",
                body: request
            )
            self.pickResponse = response
            logger.info("Movie picked: \(tmdbMovieId) for round \(roundId)")
            // Refresh round to get updated status
            await loadRound(roundId: roundId)
            isPicking = false
        } catch let apiError as APIError {
            isPicking = false
            handleAPIError(apiError, context: "picking movie")
        } catch {
            isPicking = false
            self.error = error.localizedDescription
        }
    }

    // MARK: - Helpers

    func userVote(for tmdbMovieId: Int, userId: String) -> String? {
        guard let suggestion = suggestions.first(where: { $0.tmdbMovieId == tmdbMovieId }) else {
            return nil
        }
        return suggestion.voters.first(where: { $0.userId == userId })?.vote
    }

    private func handleAPIError(_ error: APIError, context: String) {
        switch error {
        case .httpError(let statusCode, _):
            switch statusCode {
            case 400:
                self.error = "Invalid request"
            case 403:
                self.error = "You don't have permission for this action"
            case 404:
                self.error = "Round not found"
            case 409:
                self.error = "A conflict occurred — please refresh"
            case 422:
                self.error = "Not enough members have set preferences yet"
            default:
                self.error = "Something went wrong (\(statusCode))"
            }
            logger.error("API error \(context): \(statusCode)")
        case .invalidResponse:
            self.error = "Connection error"
            logger.error("Invalid response \(context)")
        }
    }
}

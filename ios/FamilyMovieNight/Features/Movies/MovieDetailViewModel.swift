import Combine
import SwiftUI

@MainActor
class MovieDetailViewModel: ObservableObject {
    @Published var movie: MovieDetail?
    @Published var isLoading = false
    @Published var error: String?
    @Published var actionInProgress = false

    private var apiClient: APIClient?
    private var groupId: String?

    init() {}

    init(apiClient: APIClient, groupId: String) {
        self.apiClient = apiClient
        self.groupId = groupId
    }

    func configure(apiClient: APIClient, groupId: String) {
        guard self.apiClient == nil else { return }
        self.apiClient = apiClient
        self.groupId = groupId
    }

    func loadMovieDetail(tmdbMovieId: Int) async {
        guard let apiClient, let groupId else { return }
        isLoading = true
        error = nil
        do {
            let detail: MovieDetail = try await apiClient.request(
                "GET",
                path: "/movies/\(tmdbMovieId)?group_id=\(groupId)"
            )
            movie = detail
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            self.error = "An unexpected error occurred."
        }
        isLoading = false
    }

    func addToWatchlist() async {
        guard let apiClient, let groupId, let movie else { return }
        actionInProgress = true
        do {
            let request = AddToWatchlistRequest(
                tmdbMovieId: movie.tmdbMovieId
            )
            let _: WatchlistItem = try await apiClient.request(
                "POST",
                path: "/groups/\(groupId)/watchlist",
                body: request
            )
            await loadMovieDetail(tmdbMovieId: movie.tmdbMovieId)
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            self.error = "An unexpected error occurred."
        }
        actionInProgress = false
    }

    func removeFromWatchlist() async {
        guard let apiClient, let groupId, let movie else { return }
        actionInProgress = true
        do {
            try await apiClient.delete(
                path: "/groups/\(groupId)/watchlist/\(movie.tmdbMovieId)"
            )
            await loadMovieDetail(tmdbMovieId: movie.tmdbMovieId)
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            self.error = "An unexpected error occurred."
        }
        actionInProgress = false
    }

    func markWatched() async {
        guard let apiClient, let groupId, let movie else { return }
        actionInProgress = true
        do {
            let request = MarkWatchedRequest(
                tmdbMovieId: movie.tmdbMovieId
            )
            let _: WatchedMovie = try await apiClient.request(
                "POST",
                path: "/groups/\(groupId)/watched",
                body: request
            )
            await loadMovieDetail(tmdbMovieId: movie.tmdbMovieId)
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            self.error = "An unexpected error occurred."
        }
        actionInProgress = false
    }

    func undoWatched() async {
        guard let apiClient, let groupId, let movie else { return }
        actionInProgress = true
        do {
            try await apiClient.delete(
                path: "/groups/\(groupId)/watched/\(movie.tmdbMovieId)"
            )
            await loadMovieDetail(tmdbMovieId: movie.tmdbMovieId)
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            self.error = "An unexpected error occurred."
        }
        actionInProgress = false
    }

    private func errorMessage(from apiError: APIError) -> String {
        switch apiError {
        case .httpError(let statusCode, _):
            switch statusCode {
            case 400: return "This action is not available."
            case 403: return "You don't have permission for this action."
            case 409: return "This movie is already on the watchlist or watched."
            default: return "Something went wrong (error \(statusCode))."
            }
        case .invalidResponse:
            return "Could not reach the server."
        }
    }
}

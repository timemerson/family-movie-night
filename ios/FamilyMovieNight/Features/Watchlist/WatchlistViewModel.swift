import Combine
import SwiftUI

@MainActor
class WatchlistViewModel: ObservableObject {
    @Published var items: [WatchlistItem] = []
    @Published var count = 0
    @Published var max = 50
    @Published var isLoading = false
    @Published var error: String?

    private var apiClient: APIClient?
    private var groupId: String?

    func configure(apiClient: APIClient, groupId: String) {
        guard self.apiClient == nil else { return }
        self.apiClient = apiClient
        self.groupId = groupId
    }

    func loadWatchlist() async {
        guard let apiClient, let groupId else { return }
        isLoading = true
        error = nil
        do {
            let response: WatchlistResponse = try await apiClient.request(
                "GET",
                path: "/groups/\(groupId)/watchlist"
            )
            items = response.items
            count = response.count
            max = response.max
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            self.error = "An unexpected error occurred."
        }
        isLoading = false
    }

    func addToWatchlist(movie: MovieSuggestion) async -> Bool {
        guard let apiClient, let groupId else { return false }
        do {
            let request = AddToWatchlistRequest(
                tmdbMovieId: movie.tmdbMovieId
            )
            let _: WatchlistItem = try await apiClient.request(
                "POST",
                path: "/groups/\(groupId)/watchlist",
                body: request
            )
            await loadWatchlist()
            return true
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
            return false
        } catch {
            self.error = "An unexpected error occurred."
            return false
        }
    }

    func removeFromWatchlist(tmdbMovieId: Int) async {
        guard let apiClient, let groupId else { return }
        do {
            try await apiClient.delete(
                path: "/groups/\(groupId)/watchlist/\(tmdbMovieId)"
            )
            items.removeAll { $0.tmdbMovieId == tmdbMovieId }
            count = items.count
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            self.error = "An unexpected error occurred."
        }
    }

    private func errorMessage(from apiError: APIError) -> String {
        switch apiError {
        case .httpError(let statusCode, _):
            switch statusCode {
            case 400: return "Cannot add this movie. It may already be watched or the watchlist is full."
            case 403: return "You don't have permission for this action."
            case 409: return "This movie is already on the watchlist."
            default: return "Something went wrong (error \(statusCode))."
            }
        case .invalidResponse:
            return "Could not reach the server."
        }
    }
}

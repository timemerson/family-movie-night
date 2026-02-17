import Combine
import SwiftUI

@MainActor
class SuggestionsViewModel: ObservableObject {
    @Published var suggestions: [MovieSuggestion] = []
    @Published var relaxedConstraints: [String] = []
    @Published var isLoading = false
    @Published var error: String?

    private var apiClient: APIClient?
    private var groupId: String?
    private var excludeMovieIds: [Int] = []

    func configure(apiClient: APIClient, groupId: String) {
        guard self.apiClient == nil else { return }
        self.apiClient = apiClient
        self.groupId = groupId
    }

    func loadSuggestions() async {
        guard let apiClient, let groupId else { return }
        isLoading = true
        error = nil
        do {
            var path = "/groups/\(groupId)/suggestions"
            if !excludeMovieIds.isEmpty {
                let ids = excludeMovieIds.map(String.init).joined(separator: ",")
                path += "?exclude_movie_ids=\(ids)"
            }
            let response: SuggestionsResponse = try await apiClient.request("GET", path: path)
            suggestions = response.suggestions
            relaxedConstraints = response.relaxedConstraints
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            self.error = "An unexpected error occurred. Please try again."
        }
        isLoading = false
    }

    func refresh() async {
        // "Show Me More" — exclude current batch and load new ones
        excludeMovieIds.append(contentsOf: suggestions.map(\.tmdbMovieId))
        await loadSuggestions()
    }

    private func errorMessage(from apiError: APIError) -> String {
        switch apiError {
        case .httpError(let statusCode, _):
            switch statusCode {
            case 400: return "Your group needs at least 2 members with preferences set."
            case 403: return "You don't have permission to view suggestions."
            default: return "Something went wrong (error \(statusCode))."
            }
        case .invalidResponse:
            return "Could not reach the server. Check your connection."
        }
    }
}

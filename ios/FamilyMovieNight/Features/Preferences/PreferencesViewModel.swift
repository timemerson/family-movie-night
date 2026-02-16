import SwiftUI

@MainActor
class PreferencesViewModel: ObservableObject {
    @Published var genreLikes: Set<String> = []
    @Published var genreDislikes: Set<String> = []
    @Published var maxContentRating: ContentRating = .pg13
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var error: String?
    @Published var savedSuccessfully = false

    private var apiClient: APIClient?
    private var groupId: String?

    var canSave: Bool {
        genreLikes.count >= 2
    }

    var hasOverlap: Bool {
        !genreLikes.isDisjoint(with: genreDislikes)
    }

    func configure(apiClient: APIClient, groupId: String) {
        guard self.apiClient == nil else { return }
        self.apiClient = apiClient
        self.groupId = groupId
    }

    func loadPreferences() async {
        guard let apiClient, let groupId else { return }
        isLoading = true
        error = nil
        do {
            let prefs: Preference = try await apiClient.request("GET", path: "/groups/\(groupId)/preferences")
            genreLikes = Set(prefs.genreLikes)
            genreDislikes = Set(prefs.genreDislikes)
            if let rating = prefs.maxContentRating,
               let parsed = ContentRating(rawValue: rating) {
                maxContentRating = parsed
            }
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            // Decode error from empty preferences — not an error
        }
        isLoading = false
    }

    func savePreferences() async {
        guard let apiClient, let groupId else { return }
        guard canSave else { return }

        // Remove overlaps from dislikes before saving
        let cleanDislikes = genreDislikes.subtracting(genreLikes)

        isSaving = true
        error = nil
        savedSuccessfully = false
        do {
            let request = PutPreferenceRequest(
                genreLikes: Array(genreLikes).sorted(),
                genreDislikes: Array(cleanDislikes).sorted(),
                maxContentRating: maxContentRating.rawValue
            )
            let _: Preference = try await apiClient.request("PUT", path: "/groups/\(groupId)/preferences", body: request)
            genreDislikes = cleanDislikes
            savedSuccessfully = true
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            self.error = "An unexpected error occurred. Please try again."
        }
        isSaving = false
    }

    func toggleLike(_ genreId: String) {
        if genreLikes.contains(genreId) {
            genreLikes.remove(genreId)
        } else {
            genreLikes.insert(genreId)
            genreDislikes.remove(genreId)
        }
    }

    func toggleDislike(_ genreId: String) {
        if genreDislikes.contains(genreId) {
            genreDislikes.remove(genreId)
        } else {
            genreDislikes.insert(genreId)
            genreLikes.remove(genreId)
        }
    }

    private func errorMessage(from apiError: APIError) -> String {
        switch apiError {
        case .httpError(let statusCode, _):
            switch statusCode {
            case 400: return "Invalid preferences. Please check your selections."
            case 403: return "You don't have permission to do that."
            default: return "Something went wrong (error \(statusCode))."
            }
        case .invalidResponse:
            return "Could not reach the server. Check your connection."
        }
    }
}

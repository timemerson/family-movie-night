import Combine
import SwiftUI
import os

private let logger = Logger(subsystem: "org.timemerson.FamilyMovieNight", category: "Preferences")

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
    private var memberId: String?

    var canSave: Bool {
        genreLikes.count >= 2
    }

    func configure(apiClient: APIClient, groupId: String, memberId: String? = nil) {
        let memberChanged = self.memberId != memberId
        if self.apiClient != nil && !memberChanged { return }
        logger.info("configure: groupId=\(groupId), memberId=\(memberId ?? "self")")
        self.apiClient = apiClient
        self.groupId = groupId
        self.memberId = memberId
        if memberChanged {
            // Reset stale data so loadPreferences fetches fresh for new member
            genreLikes = []
            genreDislikes = []
            maxContentRating = .pg13
            error = nil
            savedSuccessfully = false
        }
    }

    private var preferencesPath: String {
        guard let groupId else { return "" }
        var path = "/groups/\(groupId)/preferences"
        if let memberId {
            path += "?member_id=\(memberId)"
        }
        return path
    }

    func loadPreferences() async {
        guard let apiClient, let groupId else {
            logger.warning("loadPreferences: skipped — apiClient or groupId is nil")
            return
        }
        logger.info("loadPreferences: loading for group \(groupId)")
        isLoading = true
        error = nil
        do {
            let prefs: Preference = try await apiClient.request("GET", path: preferencesPath)
            logger.info("loadPreferences: loaded \(prefs.genreLikes.count) likes")
            genreLikes = Set(prefs.genreLikes)
            genreDislikes = Set(prefs.genreDislikes)
            if let rating = prefs.maxContentRating,
               let parsed = ContentRating(rawValue: rating) {
                maxContentRating = parsed
            }
        } catch let apiError as APIError {
            logger.error("loadPreferences: API error — \(String(describing: apiError))")
            error = errorMessage(from: apiError)
        } catch {
            logger.error("loadPreferences: decode/other error — \(String(describing: error))")
        }
        isLoading = false
    }

    func savePreferences() async {
        guard let apiClient, let groupId else {
            logger.warning("savePreferences: skipped — apiClient or groupId is nil")
            return
        }
        guard canSave else {
            logger.warning("savePreferences: skipped — canSave is false (likes: \(self.genreLikes.count))")
            return
        }

        // Remove overlaps from dislikes before saving
        let cleanDislikes = genreDislikes.subtracting(genreLikes)

        logger.info("savePreferences: saving \(self.genreLikes.count) likes, \(cleanDislikes.count) dislikes, rating=\(self.maxContentRating.rawValue)")
        isSaving = true
        error = nil
        savedSuccessfully = false
        do {
            let request = PutPreferenceRequest(
                genreLikes: Array(genreLikes).sorted(),
                genreDislikes: Array(cleanDislikes).sorted(),
                maxContentRating: maxContentRating.rawValue
            )
            let _: Preference = try await apiClient.request("PUT", path: preferencesPath, body: request)
            logger.info("savePreferences: success")
            genreDislikes = cleanDislikes
            savedSuccessfully = true
        } catch let apiError as APIError {
            logger.error("savePreferences: API error — \(String(describing: apiError))")
            error = errorMessage(from: apiError)
        } catch {
            logger.error("savePreferences: error — \(String(describing: error))")
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

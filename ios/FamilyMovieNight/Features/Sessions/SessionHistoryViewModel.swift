import Combine
import Foundation

// MARK: - SessionHistoryViewModel

@MainActor
class SessionHistoryViewModel: ObservableObject {

    // MARK: - Published State

    @Published var sessions:      [SessionSummary] = []
    @Published var isLoading:     Bool = false
    @Published var isLoadingMore: Bool = false
    @Published var hasReachedEnd: Bool = false
    @Published var error:         String?

    // MARK: - Private

    private var nextCursor: String?
    private var groupId:    String = ""
    private var apiClient:  APIClient?

    // MARK: - Configuration

    func configure(apiClient: APIClient, groupId: String) {
        self.apiClient = apiClient
        self.groupId = groupId
    }

    // MARK: - API Operations

    func loadInitialPage() async {
        isLoading = true
        error = nil
        nextCursor = nil
        hasReachedEnd = false

        guard let apiClient else {
            // Preview / dev harness mode
            try? await Task.sleep(for: .milliseconds(900))
            sessions = SampleData.allSessions
            hasReachedEnd = true
            isLoading = false
            return
        }

        do {
            let response: SessionsListResponse = try await apiClient.request(
                "GET",
                path: "/groups/\(groupId)/sessions"
            )
            sessions = response.sessions
            nextCursor = response.nextCursor
            hasReachedEnd = response.nextCursor == nil
        } catch let apiError as APIError {
            handleError(apiError)
        } catch {
            self.error = "Couldn't load watch history. Check your connection."
        }

        isLoading = false
    }

    func loadNextPage() async {
        guard !hasReachedEnd, !isLoadingMore, let apiClient, let cursor = nextCursor else { return }
        isLoadingMore = true

        do {
            let response: SessionsListResponse = try await apiClient.request(
                "GET",
                path: "/groups/\(groupId)/sessions?cursor=\(cursor)"
            )
            sessions.append(contentsOf: response.sessions)
            nextCursor = response.nextCursor
            hasReachedEnd = response.nextCursor == nil
        } catch {
            // Silently fail pagination — don't overwrite main content with error
        }

        isLoadingMore = false
    }

    func refresh() async {
        await loadInitialPage()
    }

    func loadNextPageIfNeeded(currentItem: SessionSummary) {
        guard !hasReachedEnd, !isLoadingMore else { return }
        guard let lastSession = sessions.last, lastSession.id == currentItem.id else { return }
        Task { await loadNextPage() }
    }

    // MARK: - Private

    private func handleError(_ error: APIError) {
        switch error {
        case .httpError(let statusCode, _):
            switch statusCode {
            case 403: self.error = "You don't have access to this group."
            case 404: self.error = "Group not found."
            default:  self.error = "Something went wrong (\(statusCode))."
            }
        case .invalidResponse:
            self.error = "Couldn't load watch history. Check your connection."
        }
    }
}

// MARK: - Factory (Dev Menu)

extension SessionHistoryViewModel {

    static func makeLoading() -> SessionHistoryViewModel {
        let vm = SessionHistoryViewModel()
        vm.isLoading = true
        return vm
    }

    static func makeEmpty() -> SessionHistoryViewModel {
        let vm = SessionHistoryViewModel()
        vm.sessions = []
        vm.hasReachedEnd = true
        return vm
    }

    static func makePopulated() -> SessionHistoryViewModel {
        let vm = SessionHistoryViewModel()
        vm.sessions = SampleData.allSessions
        vm.hasReachedEnd = true
        return vm
    }

    static func makeError() -> SessionHistoryViewModel {
        let vm = SessionHistoryViewModel()
        vm.error = "Couldn't load watch history. Check your connection."
        return vm
    }
}

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

    // MARK: - Configuration

    func configure(groupId: String) {
        self.groupId = groupId
    }

    // MARK: - API Operations (Fake — Dev Harness)

    func loadInitialPage() async {
        isLoading = true
        error = nil
        try? await Task.sleep(for: .milliseconds(900))
        sessions = SampleData.allSessions
        hasReachedEnd = true
        isLoading = false
    }

    func loadNextPage() async {
        guard !hasReachedEnd, !isLoadingMore else { return }
        isLoadingMore = true
        try? await Task.sleep(for: .milliseconds(600))
        // In real impl: append from cursor; in dev harness, we're already at end
        hasReachedEnd = true
        isLoadingMore = false
    }

    func refresh() async {
        nextCursor = nil
        hasReachedEnd = false
        await loadInitialPage()
    }

    func loadNextPageIfNeeded(currentItem: SessionSummary) {
        guard !hasReachedEnd, !isLoadingMore else { return }
        guard let lastSession = sessions.last, lastSession.id == currentItem.id else { return }
        Task { await loadNextPage() }
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

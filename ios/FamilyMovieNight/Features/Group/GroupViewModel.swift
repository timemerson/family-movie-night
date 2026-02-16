import SwiftUI

@MainActor
class GroupViewModel: ObservableObject {
    @Published var group: Group?
    @Published var isLoading = false
    @Published var error: String?
    @Published var currentInvite: InviteResponse?

    private(set) var currentUserId: String?
    private(set) var apiClient: APIClient?

    func configure(apiClient: APIClient, currentUserId: String) {
        guard self.apiClient == nil else { return }
        self.apiClient = apiClient
        self.currentUserId = currentUserId
    }

    func loadMyGroup() async {
        guard let apiClient else { return }
        isLoading = true
        error = nil
        do {
            // GET /groups/me returns either { group: null } or a full Group object
            // Try to decode as a full Group first; if that fails, user has no group
            let loaded: Group = try await apiClient.request("GET", path: "/groups/me")
            group = loaded
        } catch let apiError as APIError {
            // A 200 with { group: null } will fail to decode as Group — that's expected
            if case .httpError = apiError {
                error = errorMessage(from: apiError)
            }
            // Decode failures for { group: null } are not errors — user simply has no group
        } catch {
            // DecodingError when backend returns { group: null } — user has no group, not an error
        }
        isLoading = false
    }

    func createGroup(name: String) async {
        guard let apiClient else { return }
        isLoading = true
        error = nil
        do {
            let request = CreateGroupRequest(name: name)
            let created: Group = try await apiClient.request("POST", path: "/groups", body: request)
            group = created
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            self.error = "An unexpected error occurred. Please try again."
        }
        isLoading = false
    }

    func loadGroup(groupId: String) async {
        guard let apiClient else { return }
        isLoading = true
        error = nil
        do {
            let loaded: Group = try await apiClient.request("GET", path: "/groups/\(groupId)")
            group = loaded
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            self.error = "An unexpected error occurred. Please try again."
        }
        isLoading = false
    }

    func acceptInvite(token: String) async {
        guard let apiClient else { return }
        isLoading = true
        error = nil
        do {
            let response: AcceptInviteResponse = try await apiClient.request("POST", path: "/invites/\(token)/accept")
            // Load the full group after joining
            await loadGroup(groupId: response.groupId)
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            self.error = "An unexpected error occurred. Please try again."
        }
        isLoading = false
    }

    func createInvite() async {
        guard let apiClient else { return }
        guard let groupId = group?.groupId else { return }
        error = nil
        do {
            let invite: InviteResponse = try await apiClient.request("POST", path: "/groups/\(groupId)/invites")
            currentInvite = invite
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            self.error = "An unexpected error occurred. Please try again."
        }
    }

    func leaveGroup() async {
        guard let apiClient else { return }
        guard let groupId = group?.groupId else { return }
        isLoading = true
        error = nil
        do {
            try await apiClient.delete(path: "/groups/\(groupId)/members/me")
            group = nil
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            self.error = "An unexpected error occurred. Please try again."
        }
        isLoading = false
    }

    private func errorMessage(from apiError: APIError) -> String {
        switch apiError {
        case .httpError(let statusCode, _):
            switch statusCode {
            case 403: return "You don't have permission to do that."
            case 409: return "You're already in a group."
            case 410: return "This invite has expired or been revoked."
            default: return "Something went wrong (error \(statusCode))."
            }
        case .invalidResponse:
            return "Could not reach the server. Check your connection."
        }
    }
}

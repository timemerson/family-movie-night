import SwiftUI

@MainActor
class GroupViewModel: ObservableObject {
    @Published var group: Group?
    @Published var isLoading = false
    @Published var error: String?
    @Published var currentInvite: InviteResponse?

    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func createGroup(name: String) async {
        isLoading = true
        error = nil
        do {
            let request = CreateGroupRequest(name: name)
            let created: Group = try await apiClient.request("POST", path: "/groups", body: request)
            group = created
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func loadGroup(groupId: String) async {
        isLoading = true
        error = nil
        do {
            let loaded: Group = try await apiClient.request("GET", path: "/groups/\(groupId)")
            group = loaded
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func acceptInvite(token: String) async {
        isLoading = true
        error = nil
        do {
            let response: AcceptInviteResponse = try await apiClient.request("POST", path: "/invites/\(token)/accept")
            // Load the full group after joining
            await loadGroup(groupId: response.groupId)
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func createInvite() async {
        guard let groupId = group?.groupId else { return }
        error = nil
        do {
            let invite: InviteResponse = try await apiClient.request("POST", path: "/groups/\(groupId)/invites")
            currentInvite = invite
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func leaveGroup() async {
        guard let groupId = group?.groupId else { return }
        isLoading = true
        error = nil
        do {
            try await apiClient.delete(path: "/groups/\(groupId)/members/me")
            group = nil
        } catch let apiError as APIError {
            error = errorMessage(from: apiError)
        } catch {
            self.error = error.localizedDescription
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
            return "Invalid response from server."
        }
    }
}

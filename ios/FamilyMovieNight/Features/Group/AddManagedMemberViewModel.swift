import Combine
import Foundation
import SwiftUI
import UIKit

// MARK: - AddManagedMemberSubmissionState

enum AddManagedMemberSubmissionState {
    case idle
    case submitting
    case success(displayName: String, avatarKey: String)
    case error(String)
}

// MARK: - AddManagedMemberViewModel

@MainActor
class AddManagedMemberViewModel: ObservableObject {

    // MARK: - Published State

    @Published var displayName: String = ""
    @Published var selectedAvatarKey: String = AvatarDefinition.allAvatars.first?.key ?? "avatar_bear"
    @Published var submissionState: AddManagedMemberSubmissionState = .idle
    @Published var isFocused: Bool = false

    // MARK: - Derived

    var trimmedName: String { displayName.trimmingCharacters(in: .whitespacesAndNewlines) }
    var canSubmit: Bool { !trimmedName.isEmpty && trimmedName.count <= 30 }
    var isSubmitting: Bool {
        if case .submitting = submissionState { return true }
        return false
    }
    var hasUserInput: Bool { !displayName.isEmpty }
    var showCancelButton: Bool {
        if case .submitting = submissionState { return false }
        if case .success = submissionState { return false }
        return true
    }

    var characterCount: Int { displayName.count }

    /// Show the character counter once user has typed 10+ characters.
    var showCharacterCounter: Bool { characterCount >= 10 }

    /// Counter color turns WarningAccent at 25+ characters.
    var characterCounterColor: Color {
        characterCount >= 25 ? Color.warningAccent : Color(.tertiaryLabel)
    }

    var nameFieldBorderColor: Color? {
        if case .error = submissionState { return Color.warningAccent }
        return nil
    }

    // MARK: - Private

    private var apiClient: APIClient?
    private var groupId: String = ""

    // MARK: - Configuration

    func configure(apiClient: APIClient, groupId: String) {
        self.apiClient = apiClient
        self.groupId = groupId
    }

    // MARK: - Input Handling

    func onNameChange(_ newValue: String) {
        // Enforce 30-character limit at field level
        if newValue.count > 30 {
            displayName = String(newValue.prefix(30))
        }
    }

    // MARK: - Submission

    func submit() async {
        guard canSubmit else { return }
        guard let apiClient else {
            // Preview/harness mode — no API client configured
            submissionState = .submitting
            try? await Task.sleep(for: .milliseconds(500))
            withAnimation(.easeInOut(duration: 0.3)) {
                submissionState = .success(displayName: trimmedName, avatarKey: selectedAvatarKey)
            }
            return
        }
        submissionState = .submitting

        do {
            let request = CreateManagedMemberRequest(
                displayName: trimmedName,
                avatarKey: selectedAvatarKey
            )
            let _: CreateManagedMemberResponse = try await apiClient.request(
                "POST",
                path: "/groups/\(groupId)/members/managed",
                body: request
            )

            withAnimation(.easeInOut(duration: 0.3)) {
                submissionState = .success(
                    displayName: trimmedName,
                    avatarKey: selectedAvatarKey
                )
            }

            if UIDevice.current.userInterfaceIdiom == .phone {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            }
        } catch let apiError as APIError {
            let message: String
            switch apiError {
            case .httpError(let statusCode, _):
                switch statusCode {
                case 403: message = "Only the group creator can add family members."
                case 409: message = "Your household is full (maximum 8 members)."
                default: message = "Something went wrong (error \(statusCode))."
                }
            case .invalidResponse:
                message = "Could not reach the server. Check your connection."
            }
            withAnimation {
                submissionState = .error(message)
            }
            if UIDevice.current.userInterfaceIdiom == .phone {
                UINotificationFeedbackGenerator().notificationOccurred(.error)
            }
        } catch {
            withAnimation {
                submissionState = .error("An unexpected error occurred. Please try again.")
            }
            if UIDevice.current.userInterfaceIdiom == .phone {
                UINotificationFeedbackGenerator().notificationOccurred(.error)
            }
        }
    }

    func resetToIdle() {
        submissionState = .idle
    }
}

// MARK: - Factory (for Dev Menu)

extension AddManagedMemberViewModel {

    static func makeEmpty() -> AddManagedMemberViewModel {
        AddManagedMemberViewModel()
    }

    static func makeSuccess() -> AddManagedMemberViewModel {
        let vm = AddManagedMemberViewModel()
        vm.submissionState = .success(displayName: "Max", avatarKey: "avatar_dino")
        return vm
    }

    static func makeError() -> AddManagedMemberViewModel {
        let vm = AddManagedMemberViewModel()
        vm.displayName = "Max"
        vm.submissionState = .error("Couldn't add this member. Your household may be full.")
        return vm
    }

    static func makeSubmitting() -> AddManagedMemberViewModel {
        let vm = AddManagedMemberViewModel()
        vm.displayName = "Max"
        vm.submissionState = .submitting
        return vm
    }
}

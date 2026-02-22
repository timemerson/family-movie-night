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

    private var groupId: String = ""

    // MARK: - Configuration

    func configure(groupId: String) {
        self.groupId = groupId
    }

    // MARK: - Input Handling

    func onNameChange(_ newValue: String) {
        // Enforce 30-character limit at field level
        if newValue.count > 30 {
            displayName = String(newValue.prefix(30))
        }
    }

    // MARK: - Submission (Fake — Dev Harness)

    func submit() async {
        guard canSubmit else { return }
        submissionState = .submitting

        try? await Task.sleep(for: .milliseconds(1000))

        // Simulate success
        withAnimation(.easeInOut(duration: 0.3)) {
            submissionState = .success(
                displayName: trimmedName,
                avatarKey: selectedAvatarKey
            )
        }

        if UIDevice.current.userInterfaceIdiom == .phone {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }

    func simulateError() async {
        guard canSubmit else { return }
        submissionState = .submitting
        try? await Task.sleep(for: .milliseconds(800))
        withAnimation {
            submissionState = .error("Couldn't add this member. Your household may be full.")
        }
        if UIDevice.current.userInterfaceIdiom == .phone {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
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

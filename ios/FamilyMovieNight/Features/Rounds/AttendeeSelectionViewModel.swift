import Combine
import Foundation
import SwiftUI
import UIKit

// MARK: - AttendeeSelectionViewModel

@MainActor
class AttendeeSelectionViewModel: ObservableObject {

    // MARK: - Published State

    @Published var members: [GroupMember] = []
    @Published var selectedMemberIds: Set<String> = []
    @Published var isLoading: Bool = false
    @Published var error: String? = nil

    // MARK: - Derived

    var selectedCount: Int { selectedMemberIds.count }
    var totalCount: Int { members.count }
    var canProceed: Bool { selectedCount >= 2 }
    var selectedMembers: [GroupMember] {
        members.filter { selectedMemberIds.contains($0.userId) }
    }

    // MARK: - Private

    private(set) var activeUserId: String = ""
    private var groupId: String = ""

    // MARK: - Preferred Initializer

    init(members: [GroupMember], activeUserId: String, groupId: String) {
        self.activeUserId = activeUserId
        self.groupId = groupId
        self.members = Self.sorted(members, activeUserId: activeUserId)
        self.selectedMemberIds = Set(members.map { $0.userId })  // all pre-checked
    }

    // MARK: - Fallback init (for previews)

    init() { }

    // MARK: - Fake Load (fallback)

    func loadMembers() async {
        isLoading = true
        try? await Task.sleep(for: .milliseconds(800))
        self.members = Self.sorted(SampleData.allMembers, activeUserId: activeUserId)
        self.selectedMemberIds = Set(self.members.map { $0.userId })
        isLoading = false
    }

    // MARK: - Selection Management

    func toggle(memberId: String) {
        guard memberId != activeUserId else {
            if UIDevice.current.userInterfaceIdiom == .phone {
                UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
            }
            return
        }
        withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
            if selectedMemberIds.contains(memberId) {
                selectedMemberIds.remove(memberId)
            } else {
                selectedMemberIds.insert(memberId)
            }
        }
        if UIDevice.current.userInterfaceIdiom == .phone {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
    }

    func selectAll() {
        if UIDevice.current.userInterfaceIdiom == .phone {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        }
        for (index, member) in members.enumerated() {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(index) * 0.03) {
                withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                    _ = self.selectedMemberIds.insert(member.userId)
                }
            }
        }
    }

    func deselectAll() {
        if UIDevice.current.userInterfaceIdiom == .phone {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        }
        let locked = activeUserId
        for (index, member) in members.enumerated() {
            guard member.userId != locked else { continue }
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(index) * 0.03) {
                withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                    _ = self.selectedMemberIds.remove(member.userId)
                }
            }
        }
    }

    func isSelected(_ memberId: String) -> Bool { selectedMemberIds.contains(memberId) }
    func isLocked(_ memberId: String) -> Bool { memberId == activeUserId }

    // MARK: - Private Helpers

    private static func sorted(_ members: [GroupMember], activeUserId: String) -> [GroupMember] {
        let active = members.filter { $0.userId == activeUserId }
        let independents = members
            .filter { $0.userId != activeUserId && $0.isManagedMember == false }
            .sorted { $0.displayName < $1.displayName }
        let managed = members
            .filter { $0.isManagedMember }
            .sorted { $0.displayName < $1.displayName }
        return active + independents + managed
    }
}

// MARK: - Factory (Dev Menu)

extension AttendeeSelectionViewModel {

    static func makePopulated() -> AttendeeSelectionViewModel {
        let vm = AttendeeSelectionViewModel(
            members: SampleData.allMembers,
            activeUserId: "user_tim",
            groupId: "group_001"
        )
        return vm
    }

    static func makeLoading() -> AttendeeSelectionViewModel {
        let vm = AttendeeSelectionViewModel()
        vm.activeUserId = "user_tim"
        vm.isLoading = true
        return vm
    }

    static func makeError() -> AttendeeSelectionViewModel {
        let vm = AttendeeSelectionViewModel()
        vm.activeUserId = "user_tim"
        vm.error = "Couldn't load members. Check your connection and try again."
        return vm
    }

    static func makeOnlyTwo() -> AttendeeSelectionViewModel {
        let vm = AttendeeSelectionViewModel(
            members: [SampleData.memberTim, SampleData.memberSarah],
            activeUserId: "user_tim",
            groupId: "group_001"
        )
        // Deselect Sarah to trigger the <2 validation state
        vm.selectedMemberIds = ["user_tim"]
        return vm
    }
}

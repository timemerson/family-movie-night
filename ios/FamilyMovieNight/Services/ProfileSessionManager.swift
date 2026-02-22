import Combine
import Foundation

// MARK: - SwitchableProfile
//
// Unified representation for the profile switcher — works for both the
// authenticated user and managed members.

struct SwitchableProfile: Identifiable, Equatable {
    let memberId:     String
    let displayName:  String
    let avatarKey:    String
    let isManaged:    Bool
    let parentUserId: String?

    var id: String { memberId }

    /// Subtitle shown in ProfileSwitcherRow.
    var typeLabel: String { isManaged ? "Family Member" : "You" }

    // MARK: - Factory

    static func from(_ member: GroupMember, isAuthenticatedUser: Bool) -> SwitchableProfile {
        SwitchableProfile(
            memberId:     member.userId,
            displayName:  member.displayName,
            avatarKey:    member.avatarKey,
            isManaged:    member.isManaged ?? false,
            parentUserId: member.parentUserId
        )
    }

    /// Placeholder used during app launch before group data loads.
    static var placeholder: SwitchableProfile {
        SwitchableProfile(
            memberId:     "placeholder",
            displayName:  "",
            avatarKey:    "",
            isManaged:    false,
            parentUserId: nil
        )
    }
}

// MARK: - ProfileSessionManager
//
// Central source of truth for the active acting-as profile.
// Injected as @EnvironmentObject from FamilyMovieNightApp.
// Makes no API calls — derives managed member list from GroupViewModel data.

@MainActor
final class ProfileSessionManager: ObservableObject {

    // MARK: - Published State

    /// Currently active profile. Defaults to the authenticated user.
    @Published private(set) var activeProfile: SwitchableProfile

    /// All profiles available to switch to (authenticated user + managed members).
    @Published private(set) var availableProfiles: [SwitchableProfile] = []

    // MARK: - Derived

    /// True when acting as a managed member.
    var isActingAsManaged: Bool { activeProfile.isManaged }

    /// The member_id to attach to X-Acting-As-Member header.
    /// Returns nil when acting as the authenticated user (header omitted).
    var actingAsMemberId: String? {
        activeProfile.isManaged ? activeProfile.memberId : nil
    }

    /// All managed member profiles the authenticated user controls.
    var managedProfiles: [SwitchableProfile] {
        availableProfiles.filter { $0.isManaged }
    }

    // MARK: - Init

    init(authenticatedUser: SwitchableProfile) {
        self.activeProfile = authenticatedUser
        self.availableProfiles = [authenticatedUser]
    }

    // MARK: - Profile Management

    /// Called by GroupViewModel after loading/refreshing group data.
    /// Rebuilds availableProfiles. Resets to authenticated user if the
    /// active managed member was removed from the household.
    func updateProfiles(
        authenticatedUser: SwitchableProfile,
        managedMembers: [SwitchableProfile]
    ) {
        availableProfiles = [authenticatedUser] + managedMembers
        if !availableProfiles.contains(where: { $0.memberId == activeProfile.memberId }) {
            activeProfile = authenticatedUser
        }
    }

    /// Switch to a different profile. Animation and haptic are handled by the View layer.
    func switchProfile(to profile: SwitchableProfile) {
        activeProfile = profile
    }

    /// Return to the authenticated user's own context.
    func resetToAuthenticatedUser() {
        guard let ownProfile = availableProfiles.first(where: { !$0.isManaged }) else { return }
        activeProfile = ownProfile
    }
}

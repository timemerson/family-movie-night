import SwiftUI

// MARK: - ProfileSwitcherView
//
// Bottom sheet listing the authenticated user's own profile and all managed
// member profiles they control. Presented from ProfileAvatarNavButton.
// Switch is purely client-side — no re-authentication, no app reload.

struct ProfileSwitcherView: View {
    @EnvironmentObject var profileSessionManager: ProfileSessionManager
    @Environment(\.dismiss) private var dismiss

    var onAddMember: (() -> Void)?

    // MARK: - State

    enum LoadState {
        case loading
        case noManaged
        case hasManaged
        case error
    }

    var loadState: LoadState = .hasManaged  // default for sheet usage; overridden in dev harness

    var householdName: String = "The Emersons"

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    // Header
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Switch Profile")
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundStyle(.primary)
                        Text(householdName)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 20)
                    .padding(.bottom, 16)

                    // Content by state
                    switch loadState {
                    case .loading:
                        loadingContent
                    case .noManaged:
                        profilesCard(showFamilySection: false)
                        noManagedCaption
                        addFamilyMemberButton
                    case .hasManaged:
                        profilesCard(showFamilySection: true)
                        addFamilyMemberButton
                    case .error:
                        errorContent
                    }

                    // Sign Out (de-emphasized footnote per OQ-2)
                    Button("Sign Out") {
                        // handled by AuthService — wired at integration time
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 16)
                    .padding(.bottom, 16)
                }
            }
            .background(Color.appBackground)
            .presentationDragIndicator(.visible)
            .presentationDetents(
                profileSessionManager.availableProfiles.count >= 4
                    ? [.medium, .large]
                    : [.medium]
            )
        }
    }

    // MARK: - Profiles Card

    private func profilesCard(showFamilySection: Bool) -> some View {
        VStack(spacing: 0) {
            // Authenticated user row (always first)
            if let ownProfile = profileSessionManager.availableProfiles.first(where: { !$0.isManaged }) {
                ProfileSwitcherRow(
                    profile: ownProfile,
                    isActive: profileSessionManager.activeProfile.memberId == ownProfile.memberId,
                    onSelect: {
                        profileSessionManager.switchProfile(to: ownProfile)
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                            dismiss()
                            announceProfileSwitch(profile: ownProfile)
                        }
                    }
                )
            }

            if showFamilySection && !profileSessionManager.managedProfiles.isEmpty {
                Divider()
                    .opacity(0.3)

                // Section header
                Text("FAMILY MEMBERS")
                    .font(.caption)
                    .textCase(.uppercase)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 4)
                    .accessibilityHidden(true)

                Divider()
                    .opacity(0.3)

                ForEach(profileSessionManager.managedProfiles) { profile in
                    ProfileSwitcherRow(
                        profile: profile,
                        isActive: profileSessionManager.activeProfile.memberId == profile.memberId,
                        onSelect: {
                            profileSessionManager.switchProfile(to: profile)
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                                dismiss()
                                announceProfileSwitch(profile: profile)
                            }
                        }
                    )
                    if profile.id != profileSessionManager.managedProfiles.last?.id {
                        Divider()
                            .padding(.leading, 72)
                            .opacity(0.3)
                    }
                }
                .animation(.easeInOut(duration: 0.2), value: profileSessionManager.managedProfiles.map { $0.id })
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.cardBackground)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal, 16)
    }

    // MARK: - Loading Content

    private var loadingContent: some View {
        VStack(spacing: 1) {
            ForEach(0..<2, id: \.self) { _ in
                SkeletonRectangle(height: 68, cornerRadius: 0)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal, 16)
    }

    // MARK: - Error Content

    private var errorContent: some View {
        VStack(spacing: 0) {
            if let ownProfile = profileSessionManager.availableProfiles.first(where: { !$0.isManaged }) {
                ProfileSwitcherRow(
                    profile: ownProfile,
                    isActive: true,
                    onSelect: { }
                )
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.cardBackground)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal, 16)
        .overlay(alignment: .bottom) {
            Text("Couldn't load family members. Pull to refresh on the home screen.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .offset(y: 32)
                .accessibilityLabel("Couldn't load family members. Pull to refresh on the home screen.")
        }
    }

    // MARK: - No Managed Caption (State 2)

    private var noManagedCaption: some View {
        Text("Add a profile for a family member who doesn't have their own device.")
            .font(.caption)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 16)
            .padding(.top, 8)
    }

    // MARK: - Add Family Member Button

    private var addFamilyMemberButton: some View {
        SecondaryButton(title: "Add Family Member") {
            if UIDevice.current.userInterfaceIdiom == .phone {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
            dismiss()
            onAddMember?()
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .accessibilityLabel("Add Family Member. Opens family member setup.")
    }

    // MARK: - VoiceOver

    private func announceProfileSwitch(profile: SwitchableProfile) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            let text = profile.isManaged
                ? "Now viewing as \(profile.displayName)"
                : "Now viewing as yourself"
            AccessibilityNotification.Announcement(text).post()
        }
    }
}

// MARK: - ProfileSwitcherRow
//
// Single tappable row representing one switchable profile.

struct ProfileSwitcherRow: View {
    let profile: SwitchableProfile
    let isActive: Bool
    let onSelect: () -> Void

    @State private var checkmarkScale: CGFloat = 1.0
    @State private var isPressed: Bool = false
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var activeRowTintOpacity: Double {
        colorScheme == .dark ? 0.10 : 0.06
    }

    var body: some View {
        Button(action: handleSelect) {
            HStack(spacing: 12) {
                ProfileAvatarView(
                    avatarKey: profile.avatarKey,
                    size: .medium,
                    displayName: profile.displayName
                )

                VStack(alignment: .leading, spacing: 2) {
                    Text(profile.displayName)
                        .font(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                        .truncationMode(.tail)
                    Text(profile.typeLabel)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                if isActive {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(Color.primaryAccent)
                        .scaleEffect(checkmarkScale)
                        .opacity(isActive ? 1.0 : 0.0)
                        .animation(.easeOut(duration: 0.15), value: isActive)
                        .accessibilityHidden(true)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(minHeight: 44)
            .background(
                isActive
                    ? Color.primaryAccent.opacity(activeRowTintOpacity)
                    : Color.clear
            )
        }
        .buttonStyle(PressScaleButtonStyle())
        .onChange(of: isActive) { _, newValue in
            guard newValue, !reduceMotion else { return }
            withAnimation(.spring(response: 0.18, dampingFraction: 0.45)) {
                checkmarkScale = 1.15
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                withAnimation(.spring(response: 0.22, dampingFraction: 0.65)) {
                    checkmarkScale = 1.0
                }
            }
        }
        .accessibilityLabel(
            isActive
                ? "\(profile.displayName), \(profile.typeLabel). Currently active."
                : "\(profile.displayName), \(profile.typeLabel). Double-tap to switch to this profile."
        )
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
    }

    private func handleSelect() {
        onSelect()
        if UIDevice.current.userInterfaceIdiom == .phone {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        }
    }
}

// MARK: - Press Scale Button Style

struct PressScaleButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.98 : 1.0)
            .animation(.spring(response: 0.2, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

// MARK: - ProfileAvatarNavButton
//
// Always-visible tap target in the navigation bar trailing position.
// Shows the active profile's avatar plus a badge when acting as a managed member.

struct ProfileAvatarNavButton: View {
    let activeProfile: SwitchableProfile

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            ProfileAvatarView(
                avatarKey: activeProfile.avatarKey,
                size: .small,
                displayName: activeProfile.displayName
            )
            .id(activeProfile.memberId)
            .transition(.opacity)
            .animation(.easeInOut(duration: 0.25), value: activeProfile.memberId)

            if activeProfile.isManaged {
                Circle()
                    .fill(Color.appBackground)
                    .frame(width: 13, height: 13)
                    .overlay(
                        Circle()
                            .fill(Color.primaryAccent)
                            .frame(width: 10, height: 10)
                    )
                    .scaleEffect(activeProfile.isManaged && !reduceMotion ? 1.0 : 0.0)
                    .opacity(activeProfile.isManaged ? 1.0 : 0.0)
                    .animation(
                        reduceMotion
                            ? .easeOut(duration: 0.15)
                            : .spring(response: 0.3, dampingFraction: 0.6),
                        value: activeProfile.isManaged
                    )
                    .accessibilityHidden(true)
            }
        }
        .contentShape(Rectangle().size(CGSize(width: 44, height: 44)))
        .frame(width: 32, height: 32)
    }
}

// MARK: - Previews

#Preview("ProfileSwitcherView — No Managed Members") {
    let manager = ProfileSessionManager(authenticatedUser: SampleData.profileTim)
    manager.updateProfiles(authenticatedUser: SampleData.profileTim, managedMembers: [])
    return ProfileSwitcherView(loadState: .noManaged, householdName: "The Emersons")
        .environmentObject(manager)
}

#Preview("ProfileSwitcherView — With Managed Members (Tim Active)") {
    let manager = ProfileSessionManager(authenticatedUser: SampleData.profileTim)
    manager.updateProfiles(
        authenticatedUser: SampleData.profileTim,
        managedMembers: [SampleData.profileMax]
    )
    return ProfileSwitcherView(loadState: .hasManaged, householdName: "The Emersons")
        .environmentObject(manager)
}

#Preview("ProfileSwitcherView — Managed Member Active") {
    let manager = ProfileSessionManager(authenticatedUser: SampleData.profileTim)
    manager.updateProfiles(
        authenticatedUser: SampleData.profileTim,
        managedMembers: [SampleData.profileMax]
    )
    manager.switchProfile(to: SampleData.profileMax)
    return ProfileSwitcherView(loadState: .hasManaged, householdName: "The Emersons")
        .environmentObject(manager)
}

#Preview("ProfileSwitcherView — Three Managed Members") {
    let manager = ProfileSessionManager(authenticatedUser: SampleData.profileTim)
    manager.updateProfiles(
        authenticatedUser: SampleData.profileTim,
        managedMembers: [SampleData.profileMax, SampleData.profileEmily, SampleData.profileLiam]
    )
    return ProfileSwitcherView(loadState: .hasManaged, householdName: "The Emersons")
        .environmentObject(manager)
}

#Preview("ProfileSwitcherView — Loading") {
    let manager = ProfileSessionManager(authenticatedUser: SampleData.profileTim)
    return ProfileSwitcherView(loadState: .loading, householdName: "The Emersons")
        .environmentObject(manager)
}

#Preview("ProfileSwitcherView — Error") {
    let manager = ProfileSessionManager(authenticatedUser: SampleData.profileTim)
    manager.updateProfiles(authenticatedUser: SampleData.profileTim, managedMembers: [])
    return ProfileSwitcherView(loadState: .error, householdName: "The Emersons")
        .environmentObject(manager)
}

#Preview("ProfileSwitcherView — Dark Mode") {
    let manager = ProfileSessionManager(authenticatedUser: SampleData.profileTim)
    manager.updateProfiles(
        authenticatedUser: SampleData.profileTim,
        managedMembers: [SampleData.profileMax]
    )
    return ProfileSwitcherView(loadState: .hasManaged, householdName: "The Emersons")
        .environmentObject(manager)
        .preferredColorScheme(.dark)
}

#Preview("ProfileSwitcherView — Large Type") {
    let manager = ProfileSessionManager(authenticatedUser: SampleData.profileTim)
    manager.updateProfiles(
        authenticatedUser: SampleData.profileTim,
        managedMembers: [SampleData.profileMax]
    )
    return ProfileSwitcherView(loadState: .hasManaged, householdName: "The Emersons")
        .environmentObject(manager)
        .environment(\.sizeCategory, .accessibilityExtraExtraExtraLarge)
}

#Preview("ProfileAvatarNavButton — No Badge") {
    ProfileAvatarNavButton(activeProfile: SampleData.profileTim)
        .padding()
}

#Preview("ProfileAvatarNavButton — Managed Badge") {
    ProfileAvatarNavButton(activeProfile: SampleData.profileMax)
        .padding()
}

#Preview("ProfileAvatarNavButton — Dark Mode Badge") {
    ProfileAvatarNavButton(activeProfile: SampleData.profileMax)
        .padding()
        .preferredColorScheme(.dark)
}

#Preview("ProfileSwitcherRow — All Variants") {
    VStack(spacing: 0) {
        ProfileSwitcherRow(profile: SampleData.profileTim, isActive: true, onSelect: {})
        Divider().opacity(0.3)
        ProfileSwitcherRow(profile: SampleData.profileTim, isActive: false, onSelect: {})
        Divider().opacity(0.3)
        ProfileSwitcherRow(profile: SampleData.profileMax, isActive: true, onSelect: {})
        Divider().opacity(0.3)
        ProfileSwitcherRow(profile: SampleData.profileMax, isActive: false, onSelect: {})
    }
    .background(Color.cardBackground)
    .cornerRadius(16)
    .padding()
}

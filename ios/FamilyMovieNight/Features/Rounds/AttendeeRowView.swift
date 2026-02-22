import SwiftUI

// MARK: - AttendeeRowView
//
// Single selectable row in the attendee checklist.
// Structurally parallel to RatingMemberRowView but supports toggle interaction.

struct AttendeeRowView: View {
    let member: GroupMember
    let isSelected: Bool
    let isActiveUser: Bool
    let isLocked: Bool
    let onToggle: () -> Void

    @State private var checkmarkScale: CGFloat = 1.0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            ProfileAvatarView(
                avatarKey: member.avatarKey,
                size: .small,
                displayName: member.displayName
            )
            .frame(width: 36, height: 36)

            // Name + Badges
            VStack(alignment: .leading, spacing: 2) {
                Text(member.displayName)
                    .font(.body)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .truncationMode(.tail)

                if isActiveUser || member.isManagedMember {
                    HStack(spacing: 4) {
                        if isActiveUser {
                            Text("You")
                                .font(.caption2)
                                .fontWeight(.semibold)
                                .foregroundStyle(Color.primaryAccent)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(Color.primaryAccent.opacity(0.10))
                                )
                        }
                        if member.isManagedMember {
                            Text("Managed")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(Color(.systemGray5))
                                )
                        }
                    }
                }
            }

            Spacer()

            // Checkmark
            SwiftUI.Group {
                if isSelected || isLocked {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title3)
                        .foregroundStyle(Color.primaryAccent)
                        .scaleEffect(checkmarkScale)
                } else {
                    Image(systemName: "circle")
                        .font(.title3)
                        .foregroundStyle(Color(.systemGray3))
                }
            }
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: isSelected)
        }
        .frame(minHeight: 44)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
        .onTapGesture {
            if isLocked {
                if UIDevice.current.userInterfaceIdiom == .phone {
                    UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
                }
            } else {
                onToggle()
            }
        }
        .onChange(of: isSelected) { _, newValue in
            guard newValue, !reduceMotion else { return }
            withAnimation(.spring(response: 0.18, dampingFraction: 0.5)) {
                checkmarkScale = 1.2
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                withAnimation(.spring(response: 0.22, dampingFraction: 0.7)) {
                    checkmarkScale = 1.0
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(buildAccessibilityLabel())
        .accessibilityAddTraits(isLocked ? [] : .isButton)
        .accessibilityHint(
            isLocked
                ? "You must be attending to start movie night."
                : (isSelected
                    ? "Double-tap to remove from tonight's movie night."
                    : "Double-tap to add to tonight's movie night.")
        )
    }

    private func buildAccessibilityLabel() -> String {
        var label = member.displayName
        if isActiveUser { label += ", you" }
        if member.isManagedMember { label += ", managed profile" }
        label += isSelected ? ", attending" : ", not attending"
        if isLocked { label += ". Required attendee." }
        return label
    }
}

// MARK: - Previews

#Preview("All Row Variants") {
    VStack(spacing: 0) {
        AttendeeRowView(
            member: SampleData.memberTim,
            isSelected: true,
            isActiveUser: true,
            isLocked: true,
            onToggle: {}
        )
        Divider().padding(.leading, 56)

        AttendeeRowView(
            member: SampleData.memberSarah,
            isSelected: true,
            isActiveUser: false,
            isLocked: false,
            onToggle: {}
        )
        Divider().padding(.leading, 56)

        AttendeeRowView(
            member: SampleData.memberMax,
            isSelected: false,
            isActiveUser: false,
            isLocked: false,
            onToggle: {}
        )
        Divider().padding(.leading, 56)

        AttendeeRowView(
            member: SampleData.memberGrandma,
            isSelected: true,
            isActiveUser: false,
            isLocked: false,
            onToggle: {}
        )
    }
    .padding(.horizontal, 16)
    .background(Color.cardBackground)
    .cornerRadius(16)
    .padding()
}

#Preview("Dark Mode") {
    AttendeeRowView(
        member: SampleData.memberTim,
        isSelected: true,
        isActiveUser: true,
        isLocked: true,
        onToggle: {}
    )
    .padding()
    .preferredColorScheme(.dark)
}

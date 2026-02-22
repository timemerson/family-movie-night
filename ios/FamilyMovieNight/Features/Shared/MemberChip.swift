import SwiftUI

// MARK: - MemberChip
//
// Compact inline display of a single member — avatar + name.
// Used in SessionDetailView attendees row and similar contexts.
// Not for selection interactions — use AttendeeRowView for that.

struct MemberChip: View {
    let displayName: String
    let avatarKey: String

    var body: some View {
        HStack(spacing: 6) {
            ProfileAvatarView(avatarKey: avatarKey, size: .xsmall, displayName: displayName)

            Text(displayName)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundStyle(.primary)
                .lineLimit(1)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(
            Capsule()
                .fill(Color.cardBackground)
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(displayName)
    }
}

// MARK: - Previews

#Preview("Single Chip") {
    MemberChip(displayName: "Tim", avatarKey: "avatar_bear")
        .padding()
}

#Preview("Multiple Chips") {
    ScrollView(.horizontal, showsIndicators: false) {
        HStack(spacing: 8) {
            MemberChip(displayName: "Tim", avatarKey: "avatar_bear")
            MemberChip(displayName: "Sarah", avatarKey: "avatar_fox")
            MemberChip(displayName: "Max", avatarKey: "avatar_dino")
            MemberChip(displayName: "Grandma", avatarKey: "avatar_owl")
        }
        .padding()
    }
}

#Preview("Dark Mode") {
    HStack(spacing: 8) {
        MemberChip(displayName: "Tim", avatarKey: "avatar_bear")
        MemberChip(displayName: "Sarah", avatarKey: "avatar_fox")
    }
    .padding()
    .preferredColorScheme(.dark)
}

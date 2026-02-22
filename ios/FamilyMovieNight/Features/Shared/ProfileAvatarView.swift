import SwiftUI
import UIKit

// MARK: - ProfileAvatarView
//
// Reusable avatar component supporting all profile sizes used across the app.
// Renders a bundled avatar image keyed by avatarKey, or a monogram fallback
// when the key is empty or unrecognized.

enum AvatarSize {
    case xsmall   // 20pt — ActiveProfileBanner
    case small    // 32pt — Nav bar, RatingMemberRowView
    case medium   // 44pt — ProfileSwitcherRow
    case large    // 88pt — AddManagedMemberView success state

    var diameter: CGFloat {
        switch self {
        case .xsmall: return 20
        case .small:  return 32
        case .medium: return 44
        case .large:  return 88
        }
    }

    var fontSize: Font {
        switch self {
        case .xsmall: return .caption2
        case .small:  return .caption
        case .medium: return .body
        case .large:  return .title
        }
    }
}

// MARK: - Avatar Definitions

struct AvatarDefinition: Identifiable {
    let key: String
    let emoji: String  // Emoji fallback when image asset is absent in dev harness

    var id: String { key }
}

extension AvatarDefinition {
    static let allAvatars: [AvatarDefinition] = [
        AvatarDefinition(key: "avatar_bear",    emoji: "🐻"),
        AvatarDefinition(key: "avatar_fox",     emoji: "🦊"),
        AvatarDefinition(key: "avatar_owl",     emoji: "🦉"),
        AvatarDefinition(key: "avatar_dino",    emoji: "🦕"),
        AvatarDefinition(key: "avatar_cat",     emoji: "🐱"),
        AvatarDefinition(key: "avatar_dog",     emoji: "🐶"),
        AvatarDefinition(key: "avatar_lion",    emoji: "🦁"),
        AvatarDefinition(key: "avatar_penguin", emoji: "🐧"),
        AvatarDefinition(key: "avatar_rabbit",  emoji: "🐰"),
        AvatarDefinition(key: "avatar_panda",   emoji: "🐼"),
        AvatarDefinition(key: "avatar_koala",   emoji: "🐨"),
        AvatarDefinition(key: "avatar_frog",    emoji: "🐸")
    ]

    static func emoji(for key: String) -> String {
        allAvatars.first(where: { $0.key == key })?.emoji ?? "👤"
    }
}

// MARK: - ProfileAvatarView

struct ProfileAvatarView: View {
    let avatarKey: String
    let size: AvatarSize
    var displayName: String = ""  // Used for monogram fallback

    var body: some View {
        ZStack {
            Circle()
                .fill(Color.cardBackground)

            // Attempt to load bundled asset; fall back to emoji or monogram
            avatarContent
        }
        .frame(width: size.diameter, height: size.diameter)
        .accessibilityHidden(true)  // avatars are decorative; parent provides context
    }

    @ViewBuilder
    private var avatarContent: some View {
        let image = UIImage(named: avatarKey)
        if image != nil {
            Image(avatarKey)
                .resizable()
                .scaledToFit()
                .frame(width: size.diameter * 0.75, height: size.diameter * 0.75)
        } else {
            // Emoji / monogram fallback
            let fallbackEmoji = AvatarDefinition.emoji(for: avatarKey)
            if fallbackEmoji != "👤" {
                Text(fallbackEmoji)
                    .font(size.fontSize)
            } else if !displayName.isEmpty {
                Text(String(displayName.prefix(1)).uppercased())
                    .font(size.fontSize)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
            } else {
                Image(systemName: "person.fill")
                    .font(size.fontSize)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Previews

#Preview("All Sizes") {
    HStack(spacing: 12) {
        ProfileAvatarView(avatarKey: "avatar_bear", size: .xsmall)
        ProfileAvatarView(avatarKey: "avatar_fox", size: .small)
        ProfileAvatarView(avatarKey: "avatar_dino", size: .medium)
        ProfileAvatarView(avatarKey: "avatar_owl", size: .large, displayName: "Grandma")
    }
    .padding()
}

#Preview("Monogram Fallback") {
    HStack(spacing: 12) {
        ProfileAvatarView(avatarKey: "", size: .medium, displayName: "Tim")
        ProfileAvatarView(avatarKey: "unknown_key", size: .medium, displayName: "Sarah")
        ProfileAvatarView(avatarKey: "", size: .medium)
    }
    .padding()
}

#Preview("Dark Mode") {
    HStack(spacing: 12) {
        ProfileAvatarView(avatarKey: "avatar_bear", size: .medium)
        ProfileAvatarView(avatarKey: "avatar_fox", size: .medium)
    }
    .padding()
    .preferredColorScheme(.dark)
}

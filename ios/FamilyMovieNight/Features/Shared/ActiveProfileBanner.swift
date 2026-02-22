import SwiftUI

// MARK: - ActiveProfileBannerContext

enum ActiveProfileBannerContext {
    case voting
    case preferences

    func label(for name: String) -> String {
        switch self {
        case .voting:       return "Voting as \(name)"
        case .preferences:  return "Setting preferences for \(name)"
        }
    }
}

// MARK: - ActiveProfileBanner
//
// Full-width, non-interactive banner shown at the top of action screens when
// acting as a managed member. The nav bar avatar is the only entry point for
// switching — this banner is display-only.
//
// Note: RatingView uses the compact "Rating as [Name]" pill instead of this component.

struct ActiveProfileBanner: View {
    let context: ActiveProfileBannerContext
    let name: String
    let avatarKey: String

    var body: some View {
        HStack(spacing: 8) {
            ProfileAvatarView(avatarKey: avatarKey, size: .xsmall, displayName: name)

            Text(context.label(for: name))
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundStyle(Color.primaryAccent)
                .lineLimit(1)
                .minimumScaleFactor(0.85)

            Spacer()

            Image(systemName: "arrow.left.arrow.right")
                .font(.system(size: 14))
                .foregroundStyle(Color.primaryAccent.opacity(0.6))
                .accessibilityHidden(true)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.primaryAccent.opacity(0.10))
        )
        .padding(.horizontal, 16)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Viewing as \(name)")
        .accessibilityAddTraits(.isSummaryElement)
    }
}

// MARK: - Previews

#Preview("Voting Context — Light") {
    VStack {
        ActiveProfileBanner(context: .voting, name: "Max", avatarKey: "avatar_dino")
        Spacer()
    }
    .padding(.top)
}

#Preview("Preferences Context — Light") {
    VStack {
        ActiveProfileBanner(context: .preferences, name: "Max", avatarKey: "avatar_dino")
        Spacer()
    }
    .padding(.top)
}

#Preview("Dark Mode") {
    VStack {
        ActiveProfileBanner(context: .voting, name: "Max", avatarKey: "avatar_dino")
        Spacer()
    }
    .padding(.top)
    .preferredColorScheme(.dark)
}

#Preview("Large Type") {
    VStack {
        ActiveProfileBanner(context: .voting, name: "Max", avatarKey: "avatar_dino")
        Spacer()
    }
    .padding(.top)
    .environment(\.sizeCategory, .accessibilityLarge)
}

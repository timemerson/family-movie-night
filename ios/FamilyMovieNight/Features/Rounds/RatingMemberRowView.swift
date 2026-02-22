import SwiftUI

// MARK: - RatingMemberRowView
//
// A single row displaying a member's name, avatar, and rating status.
// Used in RatingView wait state and SessionDetailView ratings section.

struct RatingMemberRowView: View {
    let entry: RatingEntry

    var body: some View {
        HStack(spacing: 12) {
            ProfileAvatarView(
                avatarKey: entry.avatarKey,
                size: .small,
                displayName: entry.displayName
            )

            Text(entry.displayName)
                .font(.body)
                .foregroundStyle(.primary)

            Spacer()

            if let rating = entry.rating {
                HStack(spacing: 4) {
                    Image(systemName: rating.icon)
                        .foregroundStyle(Color(rating.accentTokenName))
                        .font(.subheadline)
                    Text(rating.label)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            } else {
                Text("Not yet")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .frame(minHeight: 44)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "\(entry.displayName): \(entry.hasRated ? entry.rating!.accessibilityLabel : "has not rated yet")"
        )
    }
}

// MARK: - Previews

#Preview("Rated — Loved") {
    RatingMemberRowView(entry: SampleData.ratingEntryTimLoved)
        .padding()
}

#Preview("Rated — Liked") {
    RatingMemberRowView(entry: SampleData.ratingEntrySarahLiked)
        .padding()
}

#Preview("Not Yet Rated") {
    RatingMemberRowView(entry: SampleData.ratingEntryMaxUnrated)
        .padding()
}

#Preview("All Variants") {
    VStack(spacing: 0) {
        ForEach(SampleData.allRatingEntries) { entry in
            RatingMemberRowView(entry: entry)
                .padding(.horizontal, 16)
            Divider()
                .padding(.leading, 56)
        }
    }
    .background(Color.cardBackground)
    .cornerRadius(16)
    .padding()
}

#Preview("Dark Mode") {
    RatingMemberRowView(entry: SampleData.ratingEntryTimLoved)
        .padding()
        .preferredColorScheme(.dark)
}

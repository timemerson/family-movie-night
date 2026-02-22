import SwiftUI

// MARK: - SessionSuggestionRowView
//
// A single movie row in SessionDetailView's vote breakdown section.
// Shows the movie with its vote tally and individual voter avatars.
// The picked movie receives a PrimaryAccent left-edge accent.

struct SessionSuggestionRowView: View {
    let suggestion: SessionSuggestionItem
    let isPicked: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            // Left: poster thumbnail
            posterThumbnail

            // Center: title, metadata, voter chips
            VStack(alignment: .leading, spacing: 4) {
                // Title + crown
                HStack(spacing: 4) {
                    Text(suggestion.title)
                        .font(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(.primary)
                        .lineLimit(1)

                    if isPicked {
                        Image(systemName: "crown.fill")
                            .font(.caption)
                            .foregroundStyle(Color.primaryAccent)
                    }
                }

                // Metadata
                let metadataParts = ["\(suggestion.year)", suggestion.contentRating].compactMap { $0 }
                Text(metadataParts.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(.secondary)

                // Picked label
                if isPicked {
                    Label("Picked", systemImage: "crown.fill")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.primaryAccent)
                }

                // Voter chips
                if !suggestion.voters.isEmpty {
                    voterChips
                }
            }

            Spacer(minLength: 0)

            // Right: vote tally
            VStack(alignment: .trailing, spacing: 4) {
                HStack(spacing: 4) {
                    Image(systemName: "hand.thumbsup.fill")
                        .foregroundStyle(Color.successAccent)
                        .font(.caption)
                    Text("\(suggestion.votesUp)")
                        .font(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(.primary)
                }
                HStack(spacing: 4) {
                    Image(systemName: "hand.thumbsdown.fill")
                        .foregroundStyle(Color.warningAccent)
                        .font(.caption)
                    Text("\(suggestion.votesDown)")
                        .font(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(.primary)
                }
            }
        }
        .padding(12)
        .padding(.leading, isPicked ? 15 : 12)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.cardBackground)
                .overlay(alignment: .leading) {
                    if isPicked {
                        RoundedRectangle(cornerRadius: 1.5)
                            .fill(Color.primaryAccent)
                            .frame(width: 3)
                            .padding(.vertical, 0)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 16))
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(buildAccessibilityLabel())
    }

    // MARK: - Poster Thumbnail

    private var posterThumbnail: some View {
        AsyncImage(url: suggestion.posterURL) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            default:
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color(.systemGray5))
                    .overlay(
                        Image(systemName: "film")
                            .foregroundStyle(.secondary)
                            .font(.caption)
                    )
            }
        }
        .frame(width: 45, height: 68)
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    // MARK: - Voter Chips

    private var voterChips: some View {
        HStack(spacing: -8) {
            ForEach(suggestion.voters.prefix(5)) { voter in
                ProfileAvatarView(
                    avatarKey: voter.avatarKey ?? "",
                    size: .xsmall,
                    displayName: voter.displayName
                )
                .overlay(
                    Circle()
                        .strokeBorder(
                            voter.isUp ? Color.successAccent : Color.warningAccent,
                            lineWidth: 1.5
                        )
                )
            }
            if suggestion.voters.count > 5 {
                Text("+\(suggestion.voters.count - 5)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .padding(.leading, 12)
            }
        }
    }

    // MARK: - Accessibility

    private func buildAccessibilityLabel() -> String {
        var parts: [String] = [suggestion.title, "\(suggestion.year)"]
        if let rating = suggestion.contentRating { parts.append(rating) }
        parts.append("\(suggestion.votesUp) thumbs up, \(suggestion.votesDown) thumbs down")
        if isPicked { parts.append("Picked for this session.") }
        return parts.joined(separator: ". ")
    }
}

// MARK: - Previews

#Preview("Regular Suggestion") {
    SessionSuggestionRowView(
        suggestion: SampleData.suggestionSpirited,
        isPicked: false
    )
    .padding()
}

#Preview("Picked Suggestion") {
    SessionSuggestionRowView(
        suggestion: SampleData.suggestionIncredibles,
        isPicked: true
    )
    .padding()
}

#Preview("All Suggestions") {
    VStack(spacing: 12) {
        SessionSuggestionRowView(
            suggestion: SampleData.suggestionIncredibles,
            isPicked: true
        )
        SessionSuggestionRowView(
            suggestion: SampleData.suggestionSpirited,
            isPicked: false
        )
        SessionSuggestionRowView(
            suggestion: SampleData.suggestionNemo,
            isPicked: false
        )
    }
    .padding()
}

#Preview("Dark Mode") {
    SessionSuggestionRowView(
        suggestion: SampleData.suggestionIncredibles,
        isPicked: true
    )
    .padding()
    .preferredColorScheme(.dark)
}

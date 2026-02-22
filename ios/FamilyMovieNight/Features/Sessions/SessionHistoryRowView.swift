import SwiftUI

// MARK: - SessionHistoryRowView
//
// Single tappable card row representing one session in the history list.
// Full-width card with poster, status badge, title, attendees, and ratings summary.

struct SessionHistoryRowView: View {
    let session: SessionSummary
    var onTap: (() -> Void)?

    @State private var isPressed = false

    var body: some View {
        Button(action: handleTap) {
            HStack(alignment: .top, spacing: 12) {
                // Poster column
                posterImage

                // Content column
                VStack(alignment: .leading, spacing: 6) {
                    // Status badge + date
                    HStack {
                        SessionStatusBadgeView(status: session.status)
                        Spacer()
                        Text(session.formattedDate)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    // Movie title
                    if let pick = session.pick {
                        Text(pick.title)
                            .font(.body)
                            .fontWeight(.semibold)
                            .foregroundStyle(.primary)
                            .lineLimit(1)
                    } else {
                        Text("No movie selected")
                            .font(.body)
                            .fontWeight(.semibold)
                            .foregroundStyle(.secondary)
                            .italic()
                            .lineLimit(1)
                    }

                    // Attendees
                    Text(session.attendeeSummary)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)

                    // Ratings summary (hidden for non-rated sessions)
                    if showRatings, let ratings = session.ratingsSummary {
                        RatingSummaryView(
                            summary: ratings.toRatingsSummary(
                                totalAttendees: session.attendees.count
                            ),
                            style: .compact
                        )
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.cardBackground)
            )
        }
        .buttonStyle(.plain)
        .scaleEffect(isPressed ? 0.97 : 1.0)
        .animation(.spring(response: 0.2, dampingFraction: 0.7), value: isPressed)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(buildAccessibilityLabel())
        .accessibilityHint("Double-tap to see full session details.")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Poster Image

    private var posterImage: some View {
        SwiftUI.Group {
            if let posterURL = session.pick?.posterURL {
                AsyncImage(url: posterURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    default:
                        posterPlaceholder
                    }
                }
            } else {
                posterPlaceholder
            }
        }
        .frame(width: 60, height: 90)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var posterPlaceholder: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(Color(.systemGray5))
            .overlay(
                Image(systemName: "film")
                    .foregroundStyle(.secondary)
            )
    }

    // MARK: - Helpers

    /// Show ratings summary only when session reached watched/rated state
    private var showRatings: Bool {
        switch session.status {
        case .watched, .rated: return true
        default: return false
        }
    }

    private func handleTap() {
        if UIDevice.current.userInterfaceIdiom == .phone {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
        onTap?()
    }

    private func buildAccessibilityLabel() -> String {
        var parts: [String] = []
        if let pick = session.pick {
            parts.append(pick.title)
        } else {
            parts.append("No movie selected")
        }
        parts.append(session.status.label)
        parts.append(session.formattedDate)
        parts.append("Attended by \(session.attendeeSummary)")
        return parts.joined(separator: ". ")
    }
}

// MARK: - Previews

#Preview("Rated Session") {
    SessionHistoryRowView(session: SampleData.sessionRated)
        .padding()
}

#Preview("Watched Session") {
    SessionHistoryRowView(session: SampleData.sessionWatched)
        .padding()
}

#Preview("Voting Session (no pick)") {
    SessionHistoryRowView(session: SampleData.sessionVoting)
        .padding()
}

#Preview("Expired Session") {
    SessionHistoryRowView(session: SampleData.sessionExpired)
        .padding()
}

#Preview("Dark Mode") {
    SessionHistoryRowView(session: SampleData.sessionRated)
        .padding()
        .preferredColorScheme(.dark)
}

import SwiftUI

// MARK: - RatingSummaryStyle

enum RatingSummaryStyle {
    case compact   // Single line: icon + count
    case expanded  // Full breakdown with proportional bars
}

// MARK: - RatingSummaryView
//
// Read-only aggregate rating display for session history and session detail.
// Compact: single-line summary. Expanded: bar chart per option.

struct RatingSummaryView: View {
    let summary: RatingsSummary
    var style: RatingSummaryStyle = .compact

    var body: some View {
        switch style {
        case .compact:
            compactView
        case .expanded:
            expandedView
        }
    }

    // MARK: - Compact

    @ViewBuilder
    private var compactView: some View {
        if summary.hasAnyRating {
            ViewThatFits(in: .horizontal) {
                compactHorizontalContent
                compactVerticalContent
            }
        } else {
            Text("No ratings yet")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
    }

    private var compactHorizontalContent: some View {
        HStack(spacing: 8) {
            ForEach(ratingOptionsWithCounts, id: \.option.rawValue) { pair in
                HStack(spacing: 4) {
                    Image(systemName: pair.option.icon)
                        .font(.caption)
                        .foregroundStyle(Color(pair.option.accentTokenName))
                    Text("\(pair.count) \(pair.option.label)")
                        .font(.caption)
                        .foregroundStyle(.primary)
                }
                if pair.option != ratingOptionsWithCounts.last?.option {
                    Text("·")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            if !summary.allRated {
                Text("·")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("\(summary.totalRated) of \(summary.totalAttendees) rated")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
    }

    private var compactVerticalContent: some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(ratingOptionsWithCounts, id: \.option.rawValue) { pair in
                HStack(spacing: 4) {
                    Image(systemName: pair.option.icon)
                        .font(.caption)
                        .foregroundStyle(Color(pair.option.accentTokenName))
                    Text("\(pair.count) \(pair.option.label)")
                        .font(.caption)
                        .foregroundStyle(.primary)
                }
            }
            if !summary.allRated {
                Text("\(summary.totalRated) of \(summary.totalAttendees) rated")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
    }

    // MARK: - Expanded (Bubble Chart)
    //
    // Each rating option is shown as its SF Symbol icon scaled proportionally
    // to the fraction of total attendees who chose it. Icons range from a
    // minimum of 24pt (zero votes) to a maximum of 64pt (all attendees voted
    // for that option). A count label sits below each bubble.

    /// Base diameter for a single vote. Each additional vote adds another
    /// unit, so 2 votes = 2× the area of 1 vote (diameter scales by √count).
    /// Zero-vote bubbles get a small resting size so they're still visible.
    private static let unitArea: CGFloat = 1600  // area for 1 vote (≈ 45pt diameter)
    private static let zeroSize: CGFloat = 24
    private static let maxSize: CGFloat = 88

    private var expandedView: some View {
        VStack(spacing: 12) {
            HStack(spacing: 24) {
                ForEach(RatingValue.allCases, id: \.rawValue) { option in
                    bubbleItem(for: option)
                }
            }
            if !summary.allRated {
                Text("\(summary.totalRated) of \(summary.totalAttendees) rated")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
    }

    private func bubbleItem(for option: RatingValue) -> some View {
        let count = countFor(option)
        // Area scales linearly with count so 2 votes = 2× the area of 1 vote.
        // Diameter = √(count × unitArea / π) × 2, clamped to bounds.
        let diameter: CGFloat = count > 0
            ? min(Self.maxSize, sqrt(Double(count) * Self.unitArea / .pi) * 2)
            : Self.zeroSize

        return VStack(spacing: 6) {
            ZStack {
                Circle()
                    .fill(Color(option.accentTokenName).opacity(0.12))
                    .frame(width: diameter, height: diameter)

                Image(systemName: option.icon)
                    .font(.system(size: diameter * 0.45))
                    .foregroundStyle(Color(option.accentTokenName))
            }
            .frame(width: Self.maxSize, height: Self.maxSize)

            Text("\(count)")
                .font(.body)
                .fontWeight(.semibold)
                .foregroundStyle(.primary)
        }
    }

    // MARK: - Helpers

    private struct OptionCount {
        let option: RatingValue
        let count: Int
    }

    private var ratingOptionsWithCounts: [OptionCount] {
        RatingValue.allCases
            .map { OptionCount(option: $0, count: countFor($0)) }
            .filter { $0.count > 0 }
    }

    private func countFor(_ option: RatingValue) -> Int {
        switch option {
        case .loved:      return summary.loved
        case .liked:      return summary.liked
        case .didNotLike: return summary.didNotLike
        }
    }

    private var accessibilityLabel: String {
        "Ratings: \(summary.loved) Loved, \(summary.liked) Liked, \(summary.didNotLike) Did Not Like. \(summary.totalRated) of \(summary.totalAttendees) attendees rated."
    }
}

// MARK: - Previews

#Preview("Compact — No Ratings") {
    RatingSummaryView(summary: SampleData.summaryEmpty, style: .compact)
        .padding()
}

#Preview("Compact — Partial") {
    RatingSummaryView(summary: SampleData.summaryPartial, style: .compact)
        .padding()
}

#Preview("Compact — All Rated") {
    RatingSummaryView(summary: SampleData.summaryAllRated, style: .compact)
        .padding()
}

#Preview("Expanded — Partial") {
    RatingSummaryView(summary: SampleData.summaryPartial, style: .expanded)
        .padding()
}

#Preview("Expanded — All Rated") {
    RatingSummaryView(summary: SampleData.summaryAllRated, style: .expanded)
        .padding()
}

#Preview("Expanded — Large Type") {
    RatingSummaryView(summary: SampleData.summaryAllRated, style: .expanded)
        .padding()
        .environment(\.sizeCategory, .accessibilityLarge)
}

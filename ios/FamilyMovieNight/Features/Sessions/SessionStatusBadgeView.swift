import SwiftUI

// MARK: - SessionStatusBadgeSize

enum SessionStatusBadgeSize {
    case regular  // used in rows and detail header
    case large    // reserved for future use
}

// MARK: - SessionStatusBadgeView
//
// Compact pill badge communicating the current session lifecycle state.
// Used in SessionHistoryRowView and SessionDetailView.

struct SessionStatusBadgeView: View {
    let status: SessionStatus
    var size: SessionStatusBadgeSize = .regular

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(foregroundColor)
                .frame(width: 6, height: 6)

            Text(status.label)
                .font(.caption2)
                .fontWeight(.medium)
                .foregroundStyle(foregroundColor)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(backgroundToken.opacity(0.12))
        )
        .accessibilityLabel("Status: \(status.label)")
    }

    // MARK: - Color tokens per status

    private var foregroundColor: Color {
        switch status {
        case .draft:     return .secondary
        case .voting:    return Color.primaryAccent
        case .selected:  return Color.primaryAccent
        case .watched:   return Color.warningAccent
        case .rated:     return Color.successAccent
        case .expired:   return .secondary
        case .discarded: return .secondary
        }
    }

    private var backgroundToken: Color {
        switch status {
        case .draft:     return Color.cardBackground
        case .voting:    return Color.primaryAccent
        case .selected:  return Color.primaryAccent
        case .watched:   return Color.warningAccent
        case .rated:     return Color.successAccent
        case .expired:   return Color.cardBackground
        case .discarded: return Color.cardBackground
        }
    }
}

// MARK: - Previews

#Preview("All Statuses") {
    VStack(alignment: .leading, spacing: 8) {
        ForEach(SessionStatus.allCases, id: \.rawValue) { status in
            HStack {
                SessionStatusBadgeView(status: status)
                Text(status.label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
    .padding()
}

#Preview("Dark Mode") {
    VStack(alignment: .leading, spacing: 8) {
        ForEach(SessionStatus.allCases, id: \.rawValue) { status in
            SessionStatusBadgeView(status: status)
        }
    }
    .padding()
    .preferredColorScheme(.dark)
}

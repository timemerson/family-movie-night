import SwiftUI

// MARK: - PrimaryButton
//
// The primary CTA button style. Used for the single most important action on any screen.
// Maximum one or two PrimaryButtons per screen.

struct PrimaryButton: View {
    let title: String
    var isLoading: Bool = false
    var isDisabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                if isLoading {
                    HStack(spacing: 8) {
                        ProgressView()
                            .tint(.white)
                        Text(title)
                            .font(.body)
                            .fontWeight(.semibold)
                            .foregroundStyle(.white)
                    }
                } else {
                    Text(title)
                        .font(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(.white)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 44)
            .padding(.horizontal, 16)
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(Color.primaryAccent)
                    .opacity(isDisabled ? 0.4 : 1.0)
            )
        }
        .disabled(isDisabled || isLoading)
        .animation(.easeInOut(duration: 0.2), value: isDisabled)
        .accessibilityAddTraits(.isButton)
    }
}

// MARK: - SecondaryButton
//
// Secondary action button. Used for lower-priority actions like "Cancel", "Skip",
// or "Close Ratings". Styled as outlined with PrimaryAccent stroke.

struct SecondaryButton: View {
    let title: String
    var isDisabled: Bool = false
    var destructive: Bool = false
    let action: () -> Void

    private var foregroundColor: Color {
        destructive ? .warningAccent : .primaryAccent
    }

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.body)
                .fontWeight(.medium)
                .foregroundStyle(foregroundColor)
                .frame(maxWidth: .infinity)
                .frame(minHeight: 44)
                .padding(.horizontal, 16)
                .background(
                    RoundedRectangle(cornerRadius: 14)
                        .strokeBorder(foregroundColor, lineWidth: 1.5)
                        .opacity(isDisabled ? 0.4 : 1.0)
                )
        }
        .disabled(isDisabled)
        .animation(.easeInOut(duration: 0.2), value: isDisabled)
        .accessibilityAddTraits(.isButton)
    }
}

// MARK: - Previews

#Preview("Primary Button") {
    VStack(spacing: 16) {
        PrimaryButton(title: "Save My Rating") { }
        PrimaryButton(title: "Loading...", isLoading: true) { }
        PrimaryButton(title: "Disabled", isDisabled: true) { }
    }
    .padding()
}

#Preview("Secondary Button") {
    VStack(spacing: 16) {
        SecondaryButton(title: "Close Ratings") { }
        SecondaryButton(title: "Delete", destructive: true) { }
        SecondaryButton(title: "Disabled", isDisabled: true) { }
    }
    .padding()
}

#Preview("Dark Mode") {
    VStack(spacing: 16) {
        PrimaryButton(title: "Save My Rating") { }
        SecondaryButton(title: "Skip for now") { }
    }
    .padding()
    .preferredColorScheme(.dark)
}

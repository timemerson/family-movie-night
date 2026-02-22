import SwiftUI

// MARK: - RatingSelectorView
//
// Interactive 3-option rating picker. Reusable component accepting a binding
// to the selected rating. Used inside RatingView.

struct RatingSelectorView: View {
    @Binding var selectedRating: RatingValue?
    var isDisabled: Bool = false

    var body: some View {
        HStack(spacing: 8) {
            ForEach(RatingValue.allCases, id: \.rawValue) { option in
                RatingOptionCard(
                    option: option,
                    isSelected: selectedRating == option,
                    isDisabled: isDisabled,
                    onTap: {
                        selectedRating = option
                    }
                )
            }
        }
        .padding(.horizontal, 16)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Rating options, 3 available")
    }
}

// MARK: - RatingOptionCard
//
// A single tappable rating option within RatingSelectorView.
// Animates on selection with a spring scale punch on the icon.

struct RatingOptionCard: View {
    let option: RatingValue
    let isSelected: Bool
    let isDisabled: Bool
    let onTap: () -> Void

    @State private var iconScale: CGFloat = 1.0
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var tintOpacity: Double {
        colorScheme == .dark ? 0.16 : 0.12
    }

    var body: some View {
        Button(action: handleTap) {
            VStack(spacing: 8) {
                Image(systemName: option.icon)
                    .font(.title)
                    .foregroundStyle(isSelected ? Color(option.accentTokenName) : Color.secondary)
                    .scaleEffect(iconScale)

                Text(option.label)
                    .font(.subheadline)
                    .fontWeight(isSelected ? .semibold : .regular)
                    .foregroundStyle(isSelected ? Color(option.accentTokenName) : Color.secondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 88)
            .padding(.vertical, 16)
            .padding(.horizontal, 12)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(
                        isSelected
                            ? Color(option.accentTokenName).opacity(tintOpacity)
                            : Color.cardBackground
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(
                        isSelected ? Color(option.accentTokenName) : Color.clear,
                        lineWidth: 2
                    )
            )
            .animation(.spring(response: 0.3, dampingFraction: 0.65), value: isSelected)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .opacity(isDisabled ? 0.4 : 1.0)
        .allowsHitTesting(!isDisabled)
        .onChange(of: isSelected) { _, newValue in
            guard newValue else { return }
            animateIconPunch()
        }
        .accessibilityLabel(
            isSelected
                ? "\(option.accessibilityLabel), selected. Double-tap to change."
                : "\(option.accessibilityLabel). Double-tap to select."
        )
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    private func handleTap() {
        onTap()
        if UIDevice.current.userInterfaceIdiom == .phone {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
    }

    private func animateIconPunch() {
        guard !reduceMotion else {
            // Reduce Motion: simple opacity flash instead of scale
            withAnimation(.easeInOut(duration: 0.15)) { iconScale = 1.0 }
            return
        }
        withAnimation(.spring(response: 0.18, dampingFraction: 0.45)) {
            iconScale = 1.25
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.14) {
            withAnimation(.spring(response: 0.22, dampingFraction: 0.65)) {
                iconScale = 1.0
            }
        }
    }
}

// MARK: - Previews

#Preview("All Unselected") {
    RatingStatefulPreview(RatingValue?.none) { binding in
        RatingSelectorView(selectedRating: binding)
    }
    .padding()
}

#Preview("Loved Selected") {
    RatingStatefulPreview(RatingValue?.some(.loved)) { binding in
        RatingSelectorView(selectedRating: binding)
    }
    .padding()
}

#Preview("Liked Selected") {
    RatingStatefulPreview(RatingValue?.some(.liked)) { binding in
        RatingSelectorView(selectedRating: binding)
    }
    .padding()
}

#Preview("Did Not Like Selected") {
    RatingStatefulPreview(RatingValue?.some(.didNotLike)) { binding in
        RatingSelectorView(selectedRating: binding)
    }
    .padding()
}

#Preview("Disabled") {
    RatingStatefulPreview(RatingValue?.some(.loved)) { binding in
        RatingSelectorView(selectedRating: binding, isDisabled: true)
    }
    .padding()
}

#Preview("Dark Mode") {
    RatingStatefulPreview(RatingValue?.some(.loved)) { binding in
        RatingSelectorView(selectedRating: binding)
    }
    .padding()
    .preferredColorScheme(.dark)
}

// MARK: - RatingStatefulPreview helper

private struct RatingStatefulPreview<Value, Content: View>: View {
    @State private var value: Value
    let content: (Binding<Value>) -> Content

    init(_ initialValue: Value, @ViewBuilder content: @escaping (Binding<Value>) -> Content) {
        _value = State(initialValue: initialValue)
        self.content = content
    }

    var body: some View {
        content($value)
    }
}

import SwiftUI

// MARK: - AvatarPickerView
//
// Horizontally scrollable avatar selection row for profile creation.
// Reusable in managed-member creation (C5) and future profile editing.
// One avatar is always selected — no "no avatar" state.

struct AvatarPickerView: View {
    @Binding var selectedAvatarKey: String
    var isDisabled: Bool = false

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(AvatarDefinition.allAvatars) { avatar in
                        AvatarCell(
                            avatar: avatar,
                            isSelected: selectedAvatarKey == avatar.key,
                            isDisabled: isDisabled,
                            onTap: {
                                withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                                    selectedAvatarKey = avatar.key
                                }
                                if UIDevice.current.userInterfaceIdiom == .phone {
                                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                }
                                withAnimation {
                                    proxy.scrollTo(avatar.key, anchor: .center)
                                }
                            }
                        )
                        .id(avatar.key)
                    }
                }
                .padding(.horizontal, 4)
                .padding(.vertical, 4)
            }
            .disabled(isDisabled)
            .opacity(isDisabled ? 0.4 : 1.0)
            .onAppear {
                proxy.scrollTo(selectedAvatarKey, anchor: .center)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Avatar picker. \(AvatarDefinition.allAvatars.count) avatars available.")
    }
}

// MARK: - AvatarCell

private struct AvatarCell: View {
    let avatar: AvatarDefinition
    let isSelected: Bool
    let isDisabled: Bool
    let onTap: () -> Void

    @State private var scale: CGFloat = 1.0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button(action: handleTap) {
            ZStack {
                Circle()
                    .fill(
                        isSelected
                            ? Color.primaryAccent.opacity(0.12)
                            : Color.cardBackground
                    )
                    .frame(width: 64, height: 64)
                    .animation(.spring(response: 0.25, dampingFraction: 0.7), value: isSelected)

                // Avatar illustration (emoji fallback for dev harness)
                Text(avatar.emoji)
                    .font(.system(size: 36))
                    .frame(width: 44, height: 44)
                    .scaleEffect(scale)

                if isSelected {
                    Circle()
                        .strokeBorder(Color.primaryAccent, lineWidth: 2.5)
                        .frame(width: 64, height: 64)
                        .animation(.spring(response: 0.25, dampingFraction: 0.7), value: isSelected)
                }
            }
            .frame(width: 64, height: 64)
        }
        .buttonStyle(.plain)
        .onChange(of: isSelected) { _, newValue in
            guard newValue, !reduceMotion else { return }
            withAnimation(.spring(response: 0.18, dampingFraction: 0.5)) { scale = 1.1 }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                withAnimation(.spring(response: 0.22, dampingFraction: 0.7)) { scale = 1.0 }
            }
        }
        .accessibilityLabel("\(avatar.emoji) avatar\(isSelected ? ", selected" : "")")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    private func handleTap() {
        onTap()
    }
}

// MARK: - Previews

#Preview("Default — bear selected") {
    StatefulAvatarPreview(initial: "avatar_bear") { binding in
        AvatarPickerView(selectedAvatarKey: binding)
            .padding()
    }
}

#Preview("Disabled") {
    AvatarPickerView(
        selectedAvatarKey: .constant("avatar_dino"),
        isDisabled: true
    )
    .padding()
}

#Preview("Dark Mode") {
    StatefulAvatarPreview(initial: "avatar_fox") { binding in
        AvatarPickerView(selectedAvatarKey: binding)
            .padding()
    }
    .preferredColorScheme(.dark)
}

// MARK: - Preview helper

private struct StatefulAvatarPreview<Content: View>: View {
    @State private var value: String
    let content: (Binding<String>) -> Content

    init(initial: String, @ViewBuilder content: @escaping (Binding<String>) -> Content) {
        _value = State(initialValue: initial)
        self.content = content
    }

    var body: some View { content($value) }
}

import SwiftUI

// MARK: - AddManagedMemberView
//
// Form for creating a managed household member profile with a name and avatar.
// Presented as .sheet from GroupDetailView or ProfileSwitcherView "Add Family Member".
// Handles form entry, validation, submission, and success/error states inline.

struct AddManagedMemberView: View {
    @StateObject var viewModel: AddManagedMemberViewModel
    @Environment(\.dismiss) private var dismiss

    var onSuccess: ((String, String) -> Void)?  // (displayName, avatarKey)

    @FocusState private var isNameFocused: Bool

    var body: some View {
        NavigationStack {
            SwiftUI.Group {
                switch viewModel.submissionState {
                case .success(let name, let avatarKey):
                    successContent(name: name, avatarKey: avatarKey)
                default:
                    formContent
                }
            }
            .background(Color.appBackground)
            .navigationTitle("Add Family Member")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if viewModel.showCancelButton {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button("Cancel") {
                            dismiss()
                        }
                        .tint(Color.primaryAccent)
                    }
                }
            }
            .interactiveDismissDisabled(viewModel.hasUserInput)
        }
        .onAppear {
            isNameFocused = true
        }
    }

    // MARK: - Form Content

    private var formContent: some View {
        ScrollView {
            VStack(spacing: 12) {
                // Name field card
                nameCard

                // Avatar picker card
                avatarCard

                // Content rating info card
                contentRatingCard

                // COPPA disclosure card
                coppaCard

                // Error banner (above submit button)
                if case .error(let message) = viewModel.submissionState {
                    errorBanner(message)
                }

                // Submit button
                PrimaryButton(
                    title: "Add Member",
                    isLoading: viewModel.isSubmitting,
                    isDisabled: !viewModel.canSubmit
                ) {
                    Task { await viewModel.submit() }
                }
                .animation(.easeInOut(duration: 0.2), value: viewModel.canSubmit)
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 16)
        }
        .disabled(viewModel.isSubmitting)
    }

    // MARK: - Name Card

    private var nameCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Name")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)

            TextField("Enter a name...", text: $viewModel.displayName)
                .font(.body)
                .focused($isNameFocused)
                .textContentType(.name)
                .autocorrectionDisabled()
                .onChange(of: viewModel.displayName) { _, newValue in
                    viewModel.onNameChange(newValue)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color(.systemGray6))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .strokeBorder(
                            viewModel.nameFieldBorderColor ?? Color.clear,
                            lineWidth: 1.5
                        )
                )

            HStack {
                Text("Up to 30 characters")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                Spacer()
                if viewModel.showCharacterCounter {
                    Text("\(viewModel.characterCount)/30")
                        .font(.caption)
                        .foregroundStyle(viewModel.characterCounterColor)
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.cardBackground)
        )
    }

    // MARK: - Avatar Card

    private var avatarCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Choose an Avatar")
                .font(.title3)
                .fontWeight(.semibold)
                .foregroundStyle(.primary)

            AvatarPickerView(
                selectedAvatarKey: $viewModel.selectedAvatarKey,
                isDisabled: viewModel.isSubmitting
            )
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.cardBackground)
        )
    }

    // MARK: - Content Rating Card

    private var contentRatingCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Content Rating")
                .font(.body)
                .foregroundStyle(.primary)

            HStack(spacing: 8) {
                Text("PG")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        RoundedRectangle(cornerRadius: 6)
                            .strokeBorder(.secondary, lineWidth: 1)
                    )

                Text("Rated PG")
                    .font(.body)
                    .foregroundStyle(.primary)
            }

            Text("Managed profiles are always limited to PG or below.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.cardBackground)
        )
    }

    // MARK: - COPPA Disclosure Card

    private var coppaCard: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "info.circle")
                .foregroundStyle(.secondary)
                .font(.caption)
                .padding(.top, 1)

            Text("This profile is managed by you on behalf of a household member. No data is collected directly from them.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(.systemGray6))
        )
    }

    // MARK: - Error Banner

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle")
                .foregroundStyle(Color.warningAccent)
            Text(message)
                .font(.caption)
                .foregroundStyle(Color.warningAccent)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.warningAccent.opacity(0.10))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(Color.warningAccent, lineWidth: 1)
                )
        )
    }

    // MARK: - Success Content

    private func successContent(name: String, avatarKey: String) -> some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: 8) {
                ProfileAvatarView(
                    avatarKey: avatarKey,
                    size: .large,
                    displayName: name
                )
                .transition(.scale(scale: 0.7).combined(with: .opacity))
                .animation(.spring(response: 0.4, dampingFraction: 0.7), value: avatarKey)

                Text("\(name) has been added!")
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 8)

                Text("Switch to \(name)'s profile to set up their genre preferences.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
                    .padding(.horizontal, 24)
                    .padding(.top, 4)
            }

            Spacer()

            VStack(spacing: 8) {
                PrimaryButton(title: "Set Their Preferences") {
                    onSuccess?(name, avatarKey)
                    dismiss()
                }

                SecondaryButton(title: "Done") {
                    dismiss()
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
    }
}

// MARK: - Previews

#Preview("Empty Form — Light") {
    AddManagedMemberView(viewModel: .makeEmpty())
}

#Preview("Empty Form — Dark") {
    AddManagedMemberView(viewModel: .makeEmpty())
        .preferredColorScheme(.dark)
}

#Preview("Submitting State") {
    AddManagedMemberView(viewModel: .makeSubmitting())
}

#Preview("Success State") {
    AddManagedMemberView(viewModel: .makeSuccess())
}

#Preview("Error State") {
    AddManagedMemberView(viewModel: .makeError())
}

#Preview("Large Type") {
    AddManagedMemberView(viewModel: .makeEmpty())
        .environment(\.sizeCategory, .accessibilityLarge)
}

import SwiftUI

struct PreferencesView: View {
    @ObservedObject var viewModel: PreferencesViewModel
    @EnvironmentObject var profileSessionManager: ProfileSessionManager
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            Form {
                if profileSessionManager.isActingAsManaged {
                    Section {
                        ActiveProfileBanner(
                            context: .preferences,
                            name: profileSessionManager.activeProfile.displayName,
                            avatarKey: profileSessionManager.activeProfile.avatarKey
                        )
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                    }
                }

                Section {
                    Picker("Max Content Rating", selection: $viewModel.maxContentRating) {
                        ForEach(ContentRating.allCases) { rating in
                            Text(rating.displayName).tag(rating)
                        }
                    }
                } header: {
                    Text("Content Rating")
                } footer: {
                    Text("Movies above this rating will be excluded from suggestions.")
                }

                Section {
                    ForEach(TMDBGenre.all) { genre in
                        GenreRow(
                            genre: genre,
                            isLiked: viewModel.genreLikes.contains(genre.id),
                            isDisliked: viewModel.genreDislikes.contains(genre.id),
                            onToggleLike: { viewModel.toggleLike(genre.id) },
                            onToggleDislike: { viewModel.toggleDislike(genre.id) }
                        )
                    }
                } header: {
                    Text("Genres (select at least 2 likes)")
                } footer: {
                    Text("\(viewModel.genreLikes.count) liked, \(viewModel.genreDislikes.count) disliked")
                }

                if let error = viewModel.error {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }
            }

            Divider()

            Button {
                Task {
                    await viewModel.savePreferences()
                    if viewModel.savedSuccessfully {
                        dismiss()
                    }
                }
            } label: {
                HStack {
                    Spacer()
                    if viewModel.isSaving {
                        ProgressView()
                    } else {
                        Text("Save Preferences")
                    }
                    Spacer()
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(!viewModel.canSave || viewModel.isSaving)
            .padding()
        }
        .navigationTitle(profileSessionManager.isActingAsManaged
            ? "\(profileSessionManager.activeProfile.displayName)'s Preferences"
            : "My Preferences"
        )
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadPreferences()
        }
        .overlay {
            if viewModel.isLoading {
                ProgressView("Loading...")
            }
        }
    }
}

struct GenreRow: View {
    let genre: TMDBGenre
    let isLiked: Bool
    let isDisliked: Bool
    let onToggleLike: () -> Void
    let onToggleDislike: () -> Void

    var body: some View {
        HStack {
            Text(genre.name)
            Spacer()
            Button {
                onToggleDislike()
            } label: {
                Image(systemName: isDisliked ? "hand.thumbsdown.fill" : "hand.thumbsdown")
                    .foregroundStyle(isDisliked ? .red : .secondary)
            }
            .buttonStyle(.plain)

            Button {
                onToggleLike()
            } label: {
                Image(systemName: isLiked ? "hand.thumbsup.fill" : "hand.thumbsup")
                    .foregroundStyle(isLiked ? .green : .secondary)
            }
            .buttonStyle(.plain)
        }
    }
}

import SwiftUI

struct PickConfirmationView: View {
    let pick: RoundPick
    let groupId: String
    let apiClient: APIClient?
    @Environment(\.dismiss) private var dismiss
    @State private var markingWatched = false
    @State private var markedWatched = false
    @State private var error: String?

    var posterURL: URL? {
        // Pick response doesn't include poster_path, so we can't show it directly
        // In a full implementation, we'd pass it through or fetch movie details
        nil
    }

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "popcorn.fill")
                .font(.system(size: 56))
                .foregroundStyle(.yellow)

            Text("Tonight's Movie")
                .font(.title.bold())

            Text(pick.title)
                .font(.title2)
                .multilineTextAlignment(.center)

            if markedWatched {
                Label("Marked as Watched", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                    .font(.headline)
            } else {
                Button {
                    Task { await markWatched() }
                } label: {
                    Label(
                        markingWatched ? "Marking..." : "We Watched It",
                        systemImage: "eye.fill"
                    )
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .padding(.horizontal, 32)
                .disabled(markingWatched)
            }

            if let error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            Button("Done") {
                dismiss()
            }
            .padding(.top)
        }
        .padding()
        .navigationTitle("Movie Picked!")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func markWatched() async {
        guard let apiClient else { return }
        markingWatched = true
        error = nil

        do {
            struct MarkWatchedRequest: Codable {
                let tmdbMovieId: Int
                let source: String
            }
            let request = MarkWatchedRequest(tmdbMovieId: pick.tmdbMovieId, source: "round_pick")
            let _: WatchedMovie = try await apiClient.request(
                "POST",
                path: "/groups/\(groupId)/watched",
                body: request
            )
            markedWatched = true
        } catch {
            self.error = "Failed to mark as watched"
        }

        markingWatched = false
    }
}

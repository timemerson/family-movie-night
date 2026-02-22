import SwiftUI

struct PickConfirmationView: View {
    let pick: RoundPick
    let roundId: String
    let groupId: String
    let isCreator: Bool
    let apiClient: APIClient?
    @Environment(\.dismiss) private var dismiss
    @State private var markingWatched = false
    @State private var markedWatched = false
    @State private var showRatingSheet = false
    @State private var error: String?
    @StateObject private var ratingViewModel = RatingViewModel()

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
        .sheet(isPresented: $showRatingSheet) {
            RatingView(viewModel: ratingViewModel)
        }
    }

    private func markWatched() async {
        guard let apiClient else { return }
        markingWatched = true
        error = nil

        do {
            struct StatusUpdate: Encodable {
                let status: String
            }
            let request = StatusUpdate(status: "watched")
            let _: RoundDetails = try await apiClient.request(
                "PATCH",
                path: "/rounds/\(roundId)",
                body: request
            )
            markedWatched = true

            // Configure and present the rating view
            ratingViewModel.configure(
                roundId: roundId,
                activeMemberId: apiClient.currentUserId,
                isCreator: isCreator,
                activeProfileName: nil,
                movieTitle: pick.title,
                movieYear: 0,
                movieContentRating: nil,
                posterURL: nil,
                apiClient: apiClient
            )
            showRatingSheet = true
        } catch {
            self.error = "Failed to mark as watched"
        }

        markingWatched = false
    }
}

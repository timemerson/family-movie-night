import SwiftUI

struct StartRoundView: View {
    @ObservedObject var viewModel: VotingViewModel
    let groupId: String
    let attendees: [String]
    var onRoundStarted: ((String) -> Void)?

    @State private var includeWatchlist = true

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "film.stack")
                .font(.system(size: 48))
                .foregroundStyle(.tint)

            Text("Pick Tonight's Movie")
                .font(.title2.bold())

            Text("We'll suggest movies based on your group's preferences. Everyone votes, then the creator picks the winner.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Toggle("Include watchlist movies", isOn: $includeWatchlist)
                .padding(.horizontal, 32)

            if viewModel.isLoading {
                ProgressView("Generating suggestions...")
            } else {
                Button {
                    Task {
                        if let roundId = await viewModel.createRound(
                            includeWatchlist: includeWatchlist,
                            attendees: attendees
                        ) {
                            onRoundStarted?(roundId)
                        }
                    }
                } label: {
                    Label("Start Voting Round", systemImage: "play.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .padding(.horizontal, 32)
            }

            if let error = viewModel.error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.horizontal)
            }
        }
        .padding()
        .navigationTitle("New Round")
    }
}

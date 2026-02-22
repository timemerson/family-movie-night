import SwiftUI

// MARK: - MovieHeaderCard
//
// Compact movie identity display — poster, title, metadata.
// Visual anchor at the top of RatingView, PickConfirmationView, SessionDetailView.
// Flat, no shadow. CardBackground surface.

struct MovieHeaderCard: View {
    let title:         String
    let year:          Int
    let contentRating: String?
    let posterURL:     URL?

    private var metadataLine: String {
        var parts: [String] = ["\(year)"]
        if let rating = contentRating, !rating.isEmpty {
            parts.append(rating)
        }
        return parts.joined(separator: " · ")
    }

    var body: some View {
        HStack(spacing: 12) {
            // MARK: Poster
            AsyncImage(url: posterURL) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                case .failure, .empty:
                    posterPlaceholder
                @unknown default:
                    posterPlaceholder
                }
            }
            .frame(width: 60, height: 90)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            // MARK: Title + Metadata
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.title3)
                    .fontWeight(.semibold)
                    .lineLimit(2)
                    .foregroundStyle(.primary)

                Text(metadataLine)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.cardBackground)
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(title), \(year)\(contentRating.map { ", \($0)" } ?? "")")
    }

    private var posterPlaceholder: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(Color(.systemGray5))
            .overlay(
                Image(systemName: "film")
                    .foregroundStyle(.secondary)
            )
    }
}

// MARK: - Previews

#Preview("With Poster URL") {
    MovieHeaderCard(
        title: "The Incredibles",
        year: 2004,
        contentRating: "PG",
        posterURL: URL(string: "https://image.tmdb.org/t/p/w185/2LqaLgk4Z226KkgPJuiOQ58XLef.jpg")
    )
    .padding()
}

#Preview("No Poster") {
    MovieHeaderCard(
        title: "Spirited Away",
        year: 2001,
        contentRating: "PG",
        posterURL: nil
    )
    .padding()
}

#Preview("Long Title") {
    MovieHeaderCard(
        title: "Everything Everywhere All at Once",
        year: 2022,
        contentRating: "R",
        posterURL: nil
    )
    .padding()
}

#Preview("Dark Mode") {
    MovieHeaderCard(
        title: "The Incredibles",
        year: 2004,
        contentRating: "PG",
        posterURL: nil
    )
    .padding()
    .preferredColorScheme(.dark)
}

#Preview("Large Type") {
    MovieHeaderCard(
        title: "The Incredibles",
        year: 2004,
        contentRating: "PG",
        posterURL: nil
    )
    .padding()
    .environment(\.sizeCategory, .accessibilityLarge)
}

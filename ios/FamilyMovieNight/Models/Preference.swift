import Foundation

struct Preference: Codable {
    let userId: String
    let groupId: String
    let genreLikes: [String]
    let genreDislikes: [String]
    let maxContentRating: String?
    let updatedAt: String?
}

struct PutPreferenceRequest: Codable {
    let genreLikes: [String]
    let genreDislikes: [String]
    let maxContentRating: String
}

enum ContentRating: String, CaseIterable, Identifiable {
    case g = "G"
    case pg = "PG"
    case pg13 = "PG-13"
    case r = "R"

    var id: String { rawValue }

    var displayName: String { rawValue }
}

struct TMDBGenre: Identifiable {
    let id: String
    let name: String

    static let all: [TMDBGenre] = [
        TMDBGenre(id: "28", name: "Action"),
        TMDBGenre(id: "12", name: "Adventure"),
        TMDBGenre(id: "16", name: "Animation"),
        TMDBGenre(id: "35", name: "Comedy"),
        TMDBGenre(id: "80", name: "Crime"),
        TMDBGenre(id: "99", name: "Documentary"),
        TMDBGenre(id: "18", name: "Drama"),
        TMDBGenre(id: "10751", name: "Family"),
        TMDBGenre(id: "14", name: "Fantasy"),
        TMDBGenre(id: "36", name: "History"),
        TMDBGenre(id: "27", name: "Horror"),
        TMDBGenre(id: "10402", name: "Music"),
        TMDBGenre(id: "9648", name: "Mystery"),
        TMDBGenre(id: "10749", name: "Romance"),
        TMDBGenre(id: "878", name: "Science Fiction"),
        TMDBGenre(id: "53", name: "Thriller"),
        TMDBGenre(id: "10752", name: "War"),
        TMDBGenre(id: "37", name: "Western"),
    ]
}

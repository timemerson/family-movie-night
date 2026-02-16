import Foundation

struct User: Codable, Identifiable {
    let userId: String
    let email: String
    var displayName: String
    var avatarKey: String
    let createdAt: String
    var notificationPrefs: NotificationPrefs

    var id: String { userId }

    struct NotificationPrefs: Codable {
        var voteNudge: Bool
        var pickAnnounce: Bool
        var newRound: Bool
    }
}

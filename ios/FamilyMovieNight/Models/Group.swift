import Foundation

struct Group: Codable, Identifiable {
    let groupId: String
    let name: String
    let createdBy: String
    let streamingServices: [String]
    let createdAt: String
    let members: [GroupMember]

    var id: String { groupId }
}

struct GroupMember: Codable, Identifiable {
    let userId: String
    let displayName: String
    let avatarKey: String
    let role: String
    let joinedAt: String

    var id: String { userId }
    var isCreator: Bool { role == "creator" }
}

struct CreateGroupRequest: Codable {
    let name: String
}

struct InviteResponse: Codable {
    let inviteId: String
    let inviteToken: String
    let inviteUrl: String
    let status: String
    let expiresAt: String
}

struct AcceptInviteResponse: Codable {
    let groupId: String
    let groupName: String
    let role: String
}

struct InviteListResponse: Codable {
    let invites: [InviteSummary]
}

struct InviteSummary: Codable, Identifiable {
    let inviteId: String
    let status: String
    let createdAt: String
    let expiresAt: String

    var id: String { inviteId }
}

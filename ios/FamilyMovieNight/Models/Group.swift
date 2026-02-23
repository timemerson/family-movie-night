import Foundation

struct Group: Codable, Identifiable, Equatable {
    let groupId: String
    let name: String
    let createdBy: String
    let streamingServices: [String]
    let memberCount: Int
    let createdAt: String
    let members: [GroupMember]

    var id: String { groupId }
}

struct GroupMember: Codable, Identifiable, Equatable {
    let userId: String
    let displayName: String
    let avatarKey: String
    let role: String
    let joinedAt: String
    // Slice C4/C5: Managed member fields — optional for backward compat with existing records
    let isManaged: Bool?
    let parentUserId: String?
    let memberType: String?  // "independent" | "managed"

    var id: String { userId }
    var isCreator: Bool { role == "creator" }
    var isManagedMember: Bool { isManaged == true }

    // Convenience init for code that predates managed member fields
    init(
        userId: String,
        displayName: String,
        avatarKey: String,
        role: String,
        joinedAt: String,
        isManaged: Bool? = nil,
        parentUserId: String? = nil,
        memberType: String? = nil
    ) {
        self.userId = userId
        self.displayName = displayName
        self.avatarKey = avatarKey
        self.role = role
        self.joinedAt = joinedAt
        self.isManaged = isManaged
        self.parentUserId = parentUserId
        self.memberType = memberType
    }
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

struct CreateManagedMemberRequest: Codable {
    let displayName: String
    let avatarKey: String
}

struct CreateManagedMemberResponse: Codable {
    let userId: String
    let displayName: String
    let avatarKey: String
    let role: String
    let memberType: String
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

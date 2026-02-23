import Foundation

class APIClient {
    private let baseURL: URL
    private let authService: AuthService
    private weak var profileSessionManager: ProfileSessionManager?

    var currentUserId: String {
        authService.userId ?? ""
    }

    init(baseURL: URL, authService: AuthService, profileSessionManager: ProfileSessionManager? = nil) {
        self.baseURL = baseURL
        self.authService = authService
        self.profileSessionManager = profileSessionManager
    }

    func request<T: Decodable>(_ method: String, path: String, body: Encodable? = nil) async throws -> T {
        var urlRequest = URLRequest(url: baseURL.appendingPathComponent(path))
        urlRequest.httpMethod = method
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = authService.accessToken {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let memberId = profileSessionManager?.actingAsMemberId {
            urlRequest.setValue(memberId, forHTTPHeaderField: "X-Acting-As-Member")
        }

        if let body = body {
            let encoder = JSONEncoder()
            encoder.keyEncodingStrategy = .convertToSnakeCase
            urlRequest.httpBody = try encoder.encode(body)
        }

        let (data, response) = try await URLSession.shared.data(for: urlRequest)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(statusCode: httpResponse.statusCode, data: data)
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(T.self, from: data)
    }

    func delete(path: String) async throws {
        var urlRequest = URLRequest(url: baseURL.appendingPathComponent(path))
        urlRequest.httpMethod = "DELETE"

        if let token = authService.accessToken {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let memberId = profileSessionManager?.actingAsMemberId {
            urlRequest.setValue(memberId, forHTTPHeaderField: "X-Acting-As-Member")
        }

        let (_, response) = try await URLSession.shared.data(for: urlRequest)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(statusCode: httpResponse.statusCode, data: Data())
        }
    }
}

enum APIError: Error {
    case invalidResponse
    case httpError(statusCode: Int, data: Data)
}

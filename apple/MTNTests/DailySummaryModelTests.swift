import XCTest
@testable import MTN

final class DailySummaryModelTests: XCTestCase {
    
    func testIsExpiredReturnsTrueForExpiredSummary() {
        let summary = DailySummary(
            id: "test-id",
            topicId: "topic-1",
            topicName: "Technology",
            summary: "Test summary",
            generatedAt: Date().addingTimeInterval(-10 * 24 * 60 * 60), // 10 days ago
            expiresAt: Date().addingTimeInterval(-1 * 24 * 60 * 60) // Expired yesterday
        )
        
        XCTAssertTrue(summary.isExpired)
    }
    
    func testIsExpiredReturnsFalseForValidSummary() {
        let summary = DailySummary(
            id: "test-id",
            topicId: "topic-1",
            topicName: "Technology",
            summary: "Test summary",
            generatedAt: Date(),
            expiresAt: Date().addingTimeInterval(7 * 24 * 60 * 60) // Expires in 7 days
        )
        
        XCTAssertFalse(summary.isExpired)
    }
    
    func testCodableRoundtrip() throws {
        let original = DailySummary(
            id: "test-id",
            topicId: "topic-1",
            topicName: "Technology",
            summary: "# Daily Summary\n\nTest content",
            generatedAt: Date(),
            expiresAt: Date().addingTimeInterval(7 * 24 * 60 * 60)
        )
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(original)
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(DailySummary.self, from: data)
        
        XCTAssertEqual(decoded.id, original.id)
        XCTAssertEqual(decoded.topicId, original.topicId)
        XCTAssertEqual(decoded.topicName, original.topicName)
        XCTAssertEqual(decoded.summary, original.summary)
    }
    
    func testHashable() {
        let summary1 = DailySummary(
            id: "test-id",
            topicId: "topic-1",
            topicName: "Technology",
            summary: "Test",
            generatedAt: Date(),
            expiresAt: Date().addingTimeInterval(7 * 24 * 60 * 60)
        )
        
        let summary2 = DailySummary(
            id: "test-id",
            topicId: "topic-1",
            topicName: "Technology",
            summary: "Test",
            generatedAt: Date(),
            expiresAt: Date().addingTimeInterval(7 * 24 * 60 * 60)
        )
        
        let summary3 = DailySummary(
            id: "different-id",
            topicId: "topic-1",
            topicName: "Technology",
            summary: "Test",
            generatedAt: Date(),
            expiresAt: Date().addingTimeInterval(7 * 24 * 60 * 60)
        )
        
        XCTAssertEqual(summary1, summary2)
        XCTAssertNotEqual(summary1, summary3)
        
        var set = Set<DailySummary>()
        set.insert(summary1)
        set.insert(summary2)
        set.insert(summary3)
        
        XCTAssertEqual(set.count, 2) // summary1 and summary2 are the same
    }
    
    func testDefaultInitializer() {
        let summary = DailySummary(
            topicId: "topic-1",
            topicName: "Technology",
            summary: "Test",
            expiresAt: Date().addingTimeInterval(7 * 24 * 60 * 60)
        )
        
        XCTAssertFalse(summary.id.isEmpty)
        XCTAssertEqual(summary.topicId, "topic-1")
        XCTAssertEqual(summary.topicName, "Technology")
        XCTAssertFalse(summary.isExpired)
    }
}

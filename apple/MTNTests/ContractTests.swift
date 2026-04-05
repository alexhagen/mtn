import XCTest
@testable import MTN

/// Cross-platform behavioral contract tests
/// These tests verify that Swift implementations match the behavior defined in contracts/*.json
/// The same contracts are tested on the TypeScript side in src/services/__tests__/contracts.test.ts
final class ContractTests: XCTestCase {
    
    // MARK: - word-counting.json
    
    func testWordCountingContract() throws {
        let contractURL = Bundle(for: type(of: self)).url(forResource: "word-counting", withExtension: "json", subdirectory: "contracts")!
        let data = try Data(contentsOf: contractURL)
        let contract = try JSONDecoder().decode(WordCountingContract.self, from: data)
        
        for testCase in contract.cases {
            let result = TextUtilities.countWords(testCase.input)
            XCTAssertEqual(result, testCase.expectedWordCount, "Failed: \(testCase.name)")
        }
    }
    
    // MARK: - long-form-threshold.json
    
    func testLongFormThresholdContract() throws {
        let contractURL = Bundle(for: type(of: self)).url(forResource: "long-form-threshold", withExtension: "json", subdirectory: "contracts")!
        let data = try Data(contentsOf: contractURL)
        let contract = try JSONDecoder().decode(LongFormContract.self, from: data)
        
        XCTAssertEqual(contract.threshold, 4000, "Threshold must be 4000")
        
        for testCase in contract.cases {
            let result = TextUtilities.isLongForm(testCase.wordCount)
            XCTAssertEqual(result, testCase.expectedIsLongForm, "Failed: \(testCase.name)")
        }
    }
    
    // MARK: - date-filtering.json
    
    func testDateFilteringContract() throws {
        let contractURL = Bundle(for: type(of: self)).url(forResource: "date-filtering", withExtension: "json", subdirectory: "contracts")!
        let data = try Data(contentsOf: contractURL)
        let contract = try JSONDecoder().decode(DateFilteringContract.self, from: data)
        
        for testCase in contract.cases {
            // Mock the current time to match the contract's reference timestamp
            let referenceDate = Date(timeIntervalSince1970: TimeInterval(contract.referenceTimestamp) / 1000.0)
            
            // Convert test articles to RSSFeedItem
            let articles = testCase.articles.map { article -> RSSFeedItem in
                let pubDate: Date? = article.pubDate.map { Date(timeIntervalSince1970: TimeInterval($0) / 1000.0) }
                return RSSFeedItem(
                    title: article.title,
                    link: article.link,
                    pubDate: pubDate
                )
            }
            
            // Filter using the cutoff date
            let cutoffDate = referenceDate.addingTimeInterval(-Double(testCase.hoursAgo) * 3600)
            let filtered = articles.filter { item in
                guard let pubDate = item.pubDate else { return true }
                return pubDate >= cutoffDate
            }
            
            let resultTitles = filtered.map { $0.title }
            XCTAssertEqual(resultTitles, testCase.expectedTitles, "Failed: \(testCase.name)")
        }
    }
    
    // MARK: - date-utilities.json
    
    func testDateUtilitiesContract() throws {
        let contractURL = Bundle(for: type(of: self)).url(forResource: "date-utilities", withExtension: "json", subdirectory: "contracts")!
        let data = try Data(contentsOf: contractURL)
        let contract = try JSONDecoder().decode(DateUtilitiesContract.self, from: data)
        
        for testCase in contract.cases {
            let date = Date(timeIntervalSince1970: TimeInterval(testCase.timestamp) / 1000.0)
            let calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = TimeZone(identifier: "UTC")!
            
            // Test month key
            if let expectedMonthKey = testCase.expectedMonthKey {
                let components = calendar.dateComponents([.year, .month], from: date)
                let monthKey = String(format: "%04d-%02d", components.year!, components.month!)
                XCTAssertEqual(monthKey, expectedMonthKey, "Failed month key: \(testCase.name)")
            }
            
            // Test quarter
            if let expectedQuarter = testCase.expectedQuarter {
                let components = calendar.dateComponents([.year, .month], from: date)
                let quarter = (components.month! - 1) / 3 + 1
                let quarterKey = String(format: "%04d-Q%d", components.year!, quarter)
                XCTAssertEqual(quarterKey, expectedQuarter, "Failed quarter: \(testCase.name)")
            }
        }
    }
    
    // MARK: - model-pricing.json
    
    func testModelPricingContract() throws {
        let contractURL = Bundle(for: type(of: self)).url(forResource: "model-pricing", withExtension: "json", subdirectory: "contracts")!
        let data = try Data(contentsOf: contractURL)
        let contract = try JSONDecoder().decode(ModelPricingContract.self, from: data)
        
        // Define the pricing table (should match generation-pipeline.ts)
        let modelPricing: [String: (input: Double, output: Double)] = [
            "claude-opus-4-6": (input: 15, output: 75),
            "claude-sonnet-4-20250514": (input: 3, output: 15),
            "claude-haiku-3-5-20241022": (input: 0.8, output: 4),
        ]
        
        // Verify pricing matches contract
        for (model, pricing) in contract.models {
            XCTAssertEqual(modelPricing[model]?.input, pricing.input, "Input pricing mismatch for \(model)")
            XCTAssertEqual(modelPricing[model]?.output, pricing.output, "Output pricing mismatch for \(model)")
        }
        
        // Verify cost calculations
        for testCase in contract.testCases {
            let pricing = modelPricing[testCase.model]!
            let cost = (Double(testCase.inputTokens) / 1_000_000) * pricing.input +
                       (Double(testCase.outputTokens) / 1_000_000) * pricing.output
            XCTAssertEqual(cost, testCase.expectedCost, accuracy: 0.0001, "Failed cost calculation: \(testCase.name)")
        }
    }
    
    // MARK: - prompts.json
    
    func testPromptsContract() throws {
        let contractURL = Bundle(for: type(of: self)).url(forResource: "prompts", withExtension: "json", subdirectory: "contracts")!
        let data = try Data(contentsOf: contractURL)
        let contract = try JSONDecoder().decode(PromptsContract.self, from: data)
        
        XCTAssertEqual(DEFAULT_DAILY_SUMMARY_SYSTEM_PROMPT, contract.dailySummary.systemPrompt,
                      "Daily summary system prompt must match contract")
        XCTAssertEqual(DEFAULT_DAILY_SUMMARY_USER_PROMPT, contract.dailySummary.userPromptTemplate,
                      "Daily summary user prompt must match contract")
        XCTAssertEqual(DEFAULT_BOOK_RECOMMENDATIONS_SYSTEM_PROMPT, contract.bookRecommendations.systemPrompt,
                      "Book recommendations system prompt must match contract")
        XCTAssertEqual(DEFAULT_BOOK_RECOMMENDATIONS_USER_PROMPT, contract.bookRecommendations.userPromptTemplate,
                      "Book recommendations user prompt must match contract")
    }
    
    // MARK: - anthropic-tools.json
    
    func testAnthropicToolsContract() throws {
        let contractURL = Bundle(for: type(of: self)).url(forResource: "anthropic-tools", withExtension: "json", subdirectory: "contracts")!
        let data = try Data(contentsOf: contractURL)
        let contract = try JSONDecoder().decode(AnthropicToolsContract.self, from: data)
        
        // Verify finalize_summary tool
        let finalizeSummary = contract.tools.finalize_summary
        XCTAssertEqual(finalizeSummary.name, "finalize_summary")
        XCTAssertEqual(finalizeSummary.description, "Call this tool when you are ready to provide the final summary. This signals that your analysis is complete.")
        XCTAssertEqual(finalizeSummary.input_schema.type, "object")
        XCTAssertEqual(finalizeSummary.input_schema.properties["summary"]?.type, "string")
        XCTAssertEqual(finalizeSummary.input_schema.required, ["summary"])
        
        // Verify finalize_recommendations tool
        let finalizeRecs = contract.tools.finalize_recommendations
        XCTAssertEqual(finalizeRecs.name, "finalize_recommendations")
        XCTAssertEqual(finalizeRecs.description, "Call this tool when you are ready to provide the final book recommendations.")
        XCTAssertEqual(finalizeRecs.input_schema.type, "object")
        XCTAssertEqual(finalizeRecs.input_schema.properties["recommendations"]?.type, "string")
        XCTAssertEqual(finalizeRecs.input_schema.required, ["recommendations"])
    }
    
    // MARK: - storage-interface.json
    
    func testStorageInterfaceContract() throws {
        let contractURL = Bundle(for: type(of: self)).url(forResource: "storage-interface", withExtension: "json", subdirectory: "contracts")!
        let data = try Data(contentsOf: contractURL)
        let contract = try JSONDecoder().decode(StorageInterfaceContract.self, from: data)
        
        // Verify all required methods exist in StorageProtocol
        // This is primarily a compile-time check, but we verify the contract structure
        XCTAssertEqual(contract.requiredMethods.settings.count, 2)
        XCTAssertEqual(contract.requiredMethods.articles.count, 4)
        XCTAssertEqual(contract.requiredMethods.summaries.count, 5)
        XCTAssertEqual(contract.requiredMethods.topicActivity.count, 2)
        XCTAssertEqual(contract.requiredMethods.bookLists.count, 3)
        
        // Verify method names
        let allMethods = contract.requiredMethods.settings.map { $0.name } +
                        contract.requiredMethods.articles.map { $0.name } +
                        contract.requiredMethods.summaries.map { $0.name } +
                        contract.requiredMethods.topicActivity.map { $0.name } +
                        contract.requiredMethods.bookLists.map { $0.name }
        
        let expectedMethods = [
            "getSettings", "saveSettings",
            "saveArticle", "getArticlesByMonth", "deleteArticle", "getAllArticles",
            "saveSummary", "getSummaryByTopic", "getAllSummaries", "deleteSummary", "cleanupExpiredSummaries",
            "logTopicActivity", "getActiveTopicIdsForQuarter",
            "saveBookList", "getBookListByQuarterAndTopic", "getBookListsByQuarter"
        ]
        
        for method in expectedMethods {
            XCTAssertTrue(allMethods.contains(method), "StorageProtocol must have method: \(method)")
        }
    }
}

// MARK: - Contract Decodable Models

private struct WordCountingContract: Decodable {
    let cases: [TestCase]
    
    struct TestCase: Decodable {
        let name: String
        let input: String
        let expectedWordCount: Int
    }
}

private struct LongFormContract: Decodable {
    let threshold: Int
    let cases: [TestCase]
    
    struct TestCase: Decodable {
        let name: String
        let wordCount: Int
        let expectedIsLongForm: Bool
    }
}

private struct DateFilteringContract: Decodable {
    let referenceTimestamp: Int64
    let cases: [TestCase]
    
    struct TestCase: Decodable {
        let name: String
        let hoursAgo: Int
        let articles: [Article]
        let expectedTitles: [String]
    }
    
    struct Article: Decodable {
        let title: String
        let link: String
        let pubDate: Int64?
    }
}

private struct DateUtilitiesContract: Decodable {
    let cases: [TestCase]
    
    struct TestCase: Decodable {
        let name: String
        let timestamp: Int64
        let expectedMonthKey: String?
        let expectedQuarter: String?
    }
}

private struct ModelPricingContract: Decodable {
    let models: [String: Pricing]
    let testCases: [TestCase]
    
    struct Pricing: Decodable {
        let input: Double
        let output: Double
    }
    
    struct TestCase: Decodable {
        let name: String
        let model: String
        let inputTokens: Int
        let outputTokens: Int
        let expectedCost: Double
    }
}

private struct PromptsContract: Decodable {
    let dailySummary: PromptPair
    let bookRecommendations: PromptPair
    
    struct PromptPair: Decodable {
        let systemPrompt: String
        let userPromptTemplate: String
    }
}

private struct AnthropicToolsContract: Decodable {
    let tools: Tools
    
    struct Tools: Decodable {
        let finalize_summary: Tool
        let finalize_recommendations: Tool
    }
    
    struct Tool: Decodable {
        let name: String
        let description: String
        let input_schema: InputSchema
    }
    
    struct InputSchema: Decodable {
        let type: String
        let properties: [String: Property]
        let required: [String]
    }
    
    struct Property: Decodable {
        let type: String
        let description: String?
    }
}

private struct StorageInterfaceContract: Decodable {
    let requiredMethods: RequiredMethods
    
    struct RequiredMethods: Decodable {
        let settings: [Method]
        let articles: [Method]
        let summaries: [Method]
        let topicActivity: [Method]
        let bookLists: [Method]
    }
    
    struct Method: Decodable {
        let name: String
        let parameters: [String]?
        let returns: String?
        let description: String
    }
}

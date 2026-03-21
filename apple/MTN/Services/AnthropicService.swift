import Foundation

// Default prompts
let DEFAULT_DAILY_SUMMARY_SYSTEM_PROMPT = """
You are a news analyst tasked with creating a comprehensive daily news summary. Your goal is to:

1. Identify major themes that appear across multiple sources
2. Write a rich, engaging summary in paragraph form
3. Include links to source articles using markdown format
4. Note where sources agree or disagree on key points
5. Focus on the most significant stories

The summary should be well-structured with clear sections for different themes.
"""

let DEFAULT_DAILY_SUMMARY_USER_PROMPT = """
Topic: {topicName}

Here are the articles from the past 24 hours:

{articles}

Please analyze these articles and create a comprehensive daily news summary. Identify the major themes that appear across multiple sources, and write your summary in rich markdown format with proper headings, paragraphs, and links.

When you're ready to provide the final summary, use the finalize_summary tool.
"""

let DEFAULT_BOOK_RECOMMENDATIONS_SYSTEM_PROMPT = """
You are a book recommendation expert. Your task is to research and recommend both popular and scholarly books related to given topics. For each book, provide:

1. Title and author
2. Brief description (2-3 sentences)
3. Why it's relevant to the topic
4. Purchase links (Amazon and Bookshop.org if available)

Format your response as a markdown list with proper structure.
"""

let DEFAULT_BOOK_RECOMMENDATIONS_USER_PROMPT = """
Based on these topics: {topics}

Please recommend 8-12 books that are:
- Mix of popular and scholarly works
- Recently published or highly relevant classics
- Diverse perspectives on the topics

Format each recommendation with:
- **Title** by Author
- Description
- Purchase links: [Amazon](url) | [Bookshop](url)

When ready, use the finalize_recommendations tool.
"""

class AnthropicService {
    static let shared = AnthropicService()
    
    private init() {}
    
    func generateDailySummary(
        topicName: String,
        articles: [RSSFeedItem],
        apiKey: String,
        customSystemPrompt: String? = nil,
        customUserPrompt: String? = nil,
        onProgress: @escaping (String, Bool) -> Void
    ) async throws -> String {
        let articlesText = articles.enumerated().map { index, article in
            """
            Article \(index + 1):
            Title: \(article.title)
            URL: \(article.link)
            Description: \(article.description ?? "N/A")
            ---
            """
        }.joined(separator: "\n\n")
        
        let systemPrompt = customSystemPrompt ?? DEFAULT_DAILY_SUMMARY_SYSTEM_PROMPT
        
        let userPromptTemplate = customUserPrompt ?? DEFAULT_DAILY_SUMMARY_USER_PROMPT
        let userPrompt = userPromptTemplate
            .replacingOccurrences(of: "{topicName}", with: topicName)
            .replacingOccurrences(of: "{articles}", with: articlesText)
        
        let request = AnthropicRequest(
            model: "claude-opus-4-6",
            maxTokens: 4096,
            system: systemPrompt,
            messages: [
                AnthropicMessage(role: "user", content: userPrompt)
            ],
            tools: [
                AnthropicTool(
                    name: "finalize_summary",
                    description: "Call this tool when you are ready to provide the final summary. This signals that your analysis is complete.",
                    inputSchema: AnthropicToolSchema(
                        type: "object",
                        properties: [
                            "summary": AnthropicToolProperty(type: "string", description: "The final markdown-formatted summary of the daily news")
                        ],
                        required: ["summary"]
                    )
                )
            ],
            stream: true
        )
        
        return try await streamRequest(request: request, apiKey: apiKey, onProgress: onProgress)
    }
    
    func generateBookRecommendations(
        topics: [String],
        apiKey: String,
        customSystemPrompt: String? = nil,
        customUserPrompt: String? = nil,
        onProgress: @escaping (String, Bool) -> Void
    ) async throws -> String {
        let systemPrompt = customSystemPrompt ?? DEFAULT_BOOK_RECOMMENDATIONS_SYSTEM_PROMPT
        
        let userPromptTemplate = customUserPrompt ?? DEFAULT_BOOK_RECOMMENDATIONS_USER_PROMPT
        let userPrompt = userPromptTemplate.replacingOccurrences(of: "{topics}", with: topics.joined(separator: ", "))
        
        let request = AnthropicRequest(
            model: "claude-opus-4-6",
            maxTokens: 4096,
            system: systemPrompt,
            messages: [
                AnthropicMessage(role: "user", content: userPrompt)
            ],
            tools: [
                AnthropicTool(
                    name: "finalize_recommendations",
                    description: "Call this tool when you are ready to provide the final book recommendations.",
                    inputSchema: AnthropicToolSchema(
                        type: "object",
                        properties: [
                            "recommendations": AnthropicToolProperty(type: "string", description: "The final markdown-formatted book recommendations")
                        ],
                        required: ["recommendations"]
                    )
                )
            ],
            stream: true
        )
        
        return try await streamRequest(request: request, apiKey: apiKey, onProgress: onProgress)
    }
    
    private func streamRequest(
        request: AnthropicRequest,
        apiKey: String,
        onProgress: @escaping (String, Bool) -> Void
    ) async throws -> String {
        var urlRequest = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        urlRequest.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        urlRequest.httpBody = try JSONEncoder().encode(request)
        
        let (asyncBytes, _) = try await URLSession.shared.bytes(for: urlRequest)
        
        var thinkingContent = ""
        var finalContent = ""
        var isFinal = false
        
        for try await line in asyncBytes.lines {
            guard line.hasPrefix("data: ") else { continue }
            let jsonString = String(line.dropFirst(6))
            guard jsonString != "[DONE]",
                  let data = jsonString.data(using: .utf8) else { continue }
            
            if let event = try? JSONDecoder().decode(StreamEvent.self, from: data) {
                switch event.type {
                case "content_block_delta":
                    if let delta = event.delta {
                        if delta.type == "text_delta", let text = delta.text {
                            thinkingContent += text
                            onProgress(thinkingContent, false)
                        }
                    }
                case "message_stop":
                    // Message complete
                    break
                default:
                    break
                }
            }
            
            // Try to parse as complete message to extract tool use
            if let message = try? JSONDecoder().decode(MessageResponse.self, from: data) {
                if let toolUse = message.content.first(where: { $0.type == "tool_use" }) {
                    if let input = toolUse.input {
                        if let summary = input["summary"] as? String {
                            finalContent = summary
                            isFinal = true
                            onProgress(finalContent, true)
                        } else if let recommendations = input["recommendations"] as? String {
                            finalContent = recommendations
                            isFinal = true
                            onProgress(finalContent, true)
                        }
                    }
                }
            }
        }
        
        return isFinal ? finalContent : thinkingContent
    }
}

// MARK: - Request/Response Models

private struct AnthropicRequest: Codable {
    let model: String
    let maxTokens: Int
    let system: String
    let messages: [AnthropicMessage]
    let tools: [AnthropicTool]
    let stream: Bool
    
    enum CodingKeys: String, CodingKey {
        case model
        case maxTokens = "max_tokens"
        case system
        case messages
        case tools
        case stream
    }
}

private struct AnthropicMessage: Codable {
    let role: String
    let content: String
}

private struct AnthropicTool: Codable {
    let name: String
    let description: String
    let inputSchema: AnthropicToolSchema
    
    enum CodingKeys: String, CodingKey {
        case name
        case description
        case inputSchema = "input_schema"
    }
}

private struct AnthropicToolSchema: Codable {
    let type: String
    let properties: [String: AnthropicToolProperty]
    let required: [String]
}

private struct AnthropicToolProperty: Codable {
    let type: String
    let description: String
}

private struct StreamEvent: Codable {
    let type: String
    let delta: StreamDelta?
}

private struct StreamDelta: Codable {
    let type: String
    let text: String?
}

private struct MessageResponse: Codable {
    let content: [ContentBlock]
}

private struct ContentBlock: Codable {
    let type: String
    let input: [String: Any]?
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(String.self, forKey: .type)
        
        if let inputContainer = try? container.nestedContainer(keyedBy: DynamicKey.self, forKey: .input) {
            var dict: [String: Any] = [:]
            for key in inputContainer.allKeys {
                if let value = try? inputContainer.decode(String.self, forKey: key) {
                    dict[key.stringValue] = value
                }
            }
            input = dict
        } else {
            input = nil
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(type, forKey: .type)
    }
    
    enum CodingKeys: String, CodingKey {
        case type
        case input
    }
    
    struct DynamicKey: CodingKey {
        var stringValue: String
        var intValue: Int?
        
        init?(stringValue: String) {
            self.stringValue = stringValue
        }
        
        init?(intValue: Int) {
            return nil
        }
    }
}

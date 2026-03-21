import Foundation
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

class ReadabilityService {
    static let shared = ReadabilityService()
    
    private init() {}
    
    func extractArticle(url: String, proxyUrl: String) async throws -> (title: String, content: String, wordCount: Int) {
        // Fetch HTML through proxy
        let proxyRequest = ProxyRequest(url: url, method: "GET")
        
        var request = URLRequest(url: URL(string: proxyUrl)!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(proxyRequest)
        
        let (data, _) = try await URLSession.shared.data(for: request)
        
        guard let html = String(data: data, encoding: .utf8) else {
            throw ReadabilityError.invalidData
        }
        
        // Simple HTML parsing - extract title and content
        let title = extractTitle(from: html)
        let content = extractContent(from: html)
        let wordCount = countWords(in: content)
        
        return (title, content, wordCount)
    }
    
    private func extractTitle(from html: String) -> String {
        // Try to extract from <title> tag
        if let titleRange = html.range(of: "<title>", options: .caseInsensitive),
           let endRange = html.range(of: "</title>", options: .caseInsensitive, range: titleRange.upperBound..<html.endIndex) {
            let title = String(html[titleRange.upperBound..<endRange.lowerBound])
            return title.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        
        // Try to extract from <h1> tag
        if let h1Range = html.range(of: "<h1[^>]*>", options: [.caseInsensitive, .regularExpression]),
           let endRange = html.range(of: "</h1>", options: .caseInsensitive, range: h1Range.upperBound..<html.endIndex) {
            let title = String(html[h1Range.upperBound..<endRange.lowerBound])
            return stripHTML(title).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        
        return "Untitled Article"
    }
    
    private func extractContent(from html: String) -> String {
        // Look for article, main, or content divs
        let contentPatterns = [
            "<article[^>]*>(.*?)</article>",
            "<main[^>]*>(.*?)</main>",
            "<div[^>]*class=\"[^\"]*content[^\"]*\"[^>]*>(.*?)</div>",
            "<div[^>]*class=\"[^\"]*article[^\"]*\"[^>]*>(.*?)</div>"
        ]
        
        for pattern in contentPatterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive, .dotMatchesLineSeparators]),
               let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
               let range = Range(match.range(at: 1), in: html) {
                let content = String(html[range])
                return cleanContent(content)
            }
        }
        
        // Fallback: extract all paragraph text
        return extractParagraphs(from: html)
    }
    
    private func extractParagraphs(from html: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: "<p[^>]*>(.*?)</p>", options: [.caseInsensitive, .dotMatchesLineSeparators]) else {
            return ""
        }
        
        let matches = regex.matches(in: html, range: NSRange(html.startIndex..., in: html))
        let paragraphs = matches.compactMap { match -> String? in
            guard let range = Range(match.range(at: 1), in: html) else { return nil }
            let paragraph = String(html[range])
            let cleaned = stripHTML(paragraph).trimmingCharacters(in: .whitespacesAndNewlines)
            return cleaned.isEmpty ? nil : cleaned
        }
        
        return paragraphs.joined(separator: "\n\n")
    }
    
    private func cleanContent(_ html: String) -> String {
        var content = html
        
        // Remove script and style tags
        content = content.replacingOccurrences(of: "<script[^>]*>.*?</script>", with: "", options: [.regularExpression, .caseInsensitive])
        content = content.replacingOccurrences(of: "<style[^>]*>.*?</style>", with: "", options: [.regularExpression, .caseInsensitive])
        
        // Convert common tags to markdown-ish format
        content = content.replacingOccurrences(of: "<h1[^>]*>", with: "\n# ", options: [.regularExpression, .caseInsensitive])
        content = content.replacingOccurrences(of: "</h1>", with: "\n", options: .caseInsensitive)
        content = content.replacingOccurrences(of: "<h2[^>]*>", with: "\n## ", options: [.regularExpression, .caseInsensitive])
        content = content.replacingOccurrences(of: "</h2>", with: "\n", options: .caseInsensitive)
        content = content.replacingOccurrences(of: "<h3[^>]*>", with: "\n### ", options: [.regularExpression, .caseInsensitive])
        content = content.replacingOccurrences(of: "</h3>", with: "\n", options: .caseInsensitive)
        content = content.replacingOccurrences(of: "<p[^>]*>", with: "\n", options: [.regularExpression, .caseInsensitive])
        content = content.replacingOccurrences(of: "</p>", with: "\n", options: .caseInsensitive)
        content = content.replacingOccurrences(of: "<br[^>]*>", with: "\n", options: [.regularExpression, .caseInsensitive])
        
        // Strip remaining HTML tags
        content = stripHTML(content)
        
        // Clean up whitespace
        content = content.replacingOccurrences(of: "\n{3,}", with: "\n\n", options: .regularExpression)
        
        return content.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    private func stripHTML(_ text: String) -> String {
        text.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
    }
    
    private func countWords(in text: String) -> Int {
        let words = text.components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
        return words.count
    }
    
    private struct ProxyRequest: Codable {
        let url: String
        let method: String
    }
    
    enum ReadabilityError: Error {
        case invalidData
        case parsingFailed
    }
}

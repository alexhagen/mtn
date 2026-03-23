import Foundation

class RSSService {
    static let shared = RSSService()
    
    private init() {}
    
    func fetchMultipleFeeds(urls: [String], proxyUrl: String) async throws -> [RSSFeedItem] {
        var allItems: [RSSFeedItem] = []
        
        await withTaskGroup(of: [RSSFeedItem]?.self) { group in
            for url in urls {
                group.addTask {
                    try? await self.fetchFeed(url: url, proxyUrl: proxyUrl)
                }
            }
            
            for await items in group {
                if let items = items {
                    allItems.append(contentsOf: items)
                }
            }
        }
        
        return allItems
    }
    
    func fetchFeed(url: String, proxyUrl: String) async throws -> [RSSFeedItem] {
        // Create proxy request
        let proxyRequest = ProxyRequest(url: url, method: "GET")
        
        var request = URLRequest(url: URL(string: proxyUrl)!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(proxyRequest)
        
        let (data, _) = try await URLSession.shared.data(for: request)
        
        guard let xmlString = String(data: data, encoding: .utf8) else {
            throw RSSError.invalidData
        }
        
        return try parseFeed(xmlString: xmlString)
    }
    
    func filterArticlesByDate(_ items: [RSSFeedItem], hoursAgo: Int = 24) -> [RSSFeedItem] {
        let cutoffDate = Date().addingTimeInterval(-Double(hoursAgo) * 3600)
        
        return items.filter { item in
            // Include items without pubDate (better to show content than hide it)
            guard let pubDate = item.pubDate else { return true }
            // Also include items with dates in the future (clock skew) or within the window
            return pubDate >= cutoffDate
        }
    }
    
    private func parseFeed(xmlString: String) throws -> [RSSFeedItem] {
        let parser = RSSParser()
        return try parser.parse(xmlString: xmlString)
    }
    
    private struct ProxyRequest: Codable {
        let url: String
        let method: String
    }
    
    enum RSSError: Error {
        case invalidData
        case parsingFailed
    }
}

// MARK: - RSS Parser

private class RSSParser: NSObject, XMLParserDelegate {
    private var items: [RSSFeedItem] = []
    private var currentElement = ""
    private var currentTitle = ""
    private var currentLink = ""
    private var currentDescription = ""
    private var currentPubDate = ""
    private var currentContent = ""
    private var isInItem = false
    
    func parse(xmlString: String) throws -> [RSSFeedItem] {
        guard let data = xmlString.data(using: .utf8) else {
            throw RSSService.RSSError.invalidData
        }
        
        let parser = XMLParser(data: data)
        parser.delegate = self
        
        guard parser.parse() else {
            throw RSSService.RSSError.parsingFailed
        }
        
        return items
    }
    
    func parser(_ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?, qualifiedName qName: String?, attributes attributeDict: [String : String] = [:]) {
        currentElement = elementName
        
        if elementName == "item" || elementName == "entry" {
            isInItem = true
            currentTitle = ""
            currentLink = ""
            currentDescription = ""
            currentPubDate = ""
            currentContent = ""
        }
        
        // Handle Atom links
        if elementName == "link" && isInItem {
            if let href = attributeDict["href"] {
                currentLink = href
            }
        }
    }
    
    func parser(_ parser: XMLParser, foundCharacters string: String) {
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        
        switch currentElement {
        case "title":
            if isInItem {
                currentTitle += trimmed
            }
        case "link":
            if isInItem && currentLink.isEmpty {
                currentLink += trimmed
            }
        case "description", "summary":
            if isInItem {
                currentDescription += trimmed
            }
        case "pubDate", "published", "updated":
            if isInItem {
                currentPubDate += trimmed
            }
        case "content", "content:encoded":
            if isInItem {
                currentContent += trimmed
            }
        default:
            break
        }
    }
    
    func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?, qualifiedName qName: String?) {
        if elementName == "item" || elementName == "entry" {
            isInItem = false
            
            let item = RSSFeedItem(
                title: currentTitle,
                link: currentLink,
                description: currentDescription.isEmpty ? nil : currentDescription,
                pubDate: parseDate(currentPubDate),
                content: currentContent.isEmpty ? nil : currentContent
            )
            
            items.append(item)
        }
    }
    
    private func parseDate(_ dateString: String) -> Date? {
        guard !dateString.isEmpty else { return nil }
        
        // Try RFC 822 format (RSS)
        let rfc822Formatter = DateFormatter()
        rfc822Formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss Z"
        rfc822Formatter.locale = Locale(identifier: "en_US_POSIX")
        if let date = rfc822Formatter.date(from: dateString) {
            return date
        }
        
        // Try ISO 8601 format (Atom)
        let iso8601Formatter = ISO8601DateFormatter()
        if let date = iso8601Formatter.date(from: dateString) {
            return date
        }
        
        return nil
    }
}

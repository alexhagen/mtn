import Foundation

/// Text processing utilities that must match TypeScript behavior exactly
/// These functions are tested against shared behavioral contracts
class TextUtilities {
    
    /// Count words in text, stripping HTML tags first
    /// Must match the behavior defined in contracts/word-counting.json
    static func countWords(_ text: String) -> Int {
        // Remove HTML tags if present
        let plainText = text.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
        
        // Split by whitespace and filter out empty strings
        let words = plainText.components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
        
        return words.count
    }
    
    /// Determine if an article is long-form based on word count
    /// Must match the behavior defined in contracts/long-form-threshold.json
    static func isLongForm(_ wordCount: Int) -> Bool {
        return wordCount > 4000
    }
}

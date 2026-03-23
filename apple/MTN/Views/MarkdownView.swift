import SwiftUI

/// Callback type for saving an article from a link in the summary
/// Returns (success, errorMessage)
typealias SaveArticleCallback = (String, String) async -> (success: Bool, error: String?)

struct MarkdownView: View {
    let markdown: String
    var onSaveArticle: SaveArticleCallback?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(parseMarkdown(markdown), id: \.id) { block in
                renderBlock(block)
            }
        }
    }
    
    private func renderBlock(_ block: MarkdownBlock) -> some View {
        Group {
            switch block.type {
            case .heading1:
                Text(parseInlineMarkdown(block.content))
                    .font(.title)
                    .fontWeight(.bold)
                    .padding(.top, 8)
                    .padding(.bottom, 4)
                
            case .heading2:
                Text(parseInlineMarkdown(block.content))
                    .font(.title2)
                    .fontWeight(.bold)
                    .padding(.top, 6)
                    .padding(.bottom, 3)
                
            case .heading3:
                Text(parseInlineMarkdown(block.content))
                    .font(.title3)
                    .fontWeight(.semibold)
                    .padding(.top, 4)
                    .padding(.bottom, 2)
                
            case .paragraph:
                MarkdownParagraphView(content: block.content, onSaveArticle: onSaveArticle)
                    .padding(.bottom, 8)
                
            case .bulletItem:
                HStack(alignment: .top, spacing: 8) {
                    Text("•")
                        .font(.body)
                    MarkdownParagraphView(content: block.content, onSaveArticle: onSaveArticle)
                        .font(.body)
                }
                .padding(.leading, 16)
                
            case .numberedItem:
                HStack(alignment: .top, spacing: 8) {
                    Text("\(block.number ?? 1).")
                        .font(.body)
                    MarkdownParagraphView(content: block.content, onSaveArticle: onSaveArticle)
                        .font(.body)
                }
                .padding(.leading, 16)
                
            case .horizontalRule:
                Divider()
                    .padding(.vertical, 8)
                
            case .empty:
                Spacer()
                    .frame(height: 4)
            }
        }
    }
    
    private func parseInlineMarkdown(_ text: String) -> AttributedString {
        do {
            return try AttributedString(
                markdown: text,
                options: AttributedString.MarkdownParsingOptions(
                    interpretedSyntax: .inlineOnlyPreservingWhitespace
                )
            )
        } catch {
            return AttributedString(text)
        }
    }
    
    private func parseMarkdown(_ markdown: String) -> [MarkdownBlock] {
        var blocks: [MarkdownBlock] = []
        let lines = markdown.split(separator: "\n", omittingEmptySubsequences: false)
        var currentNumber = 1
        
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            
            if trimmed.isEmpty {
                blocks.append(MarkdownBlock(type: .empty, content: ""))
                currentNumber = 1 // Reset numbering on empty line
                continue
            }
            
            // Heading 1: # Text
            if trimmed.hasPrefix("# ") {
                let content = String(trimmed.dropFirst(2))
                blocks.append(MarkdownBlock(type: .heading1, content: content))
            }
            // Heading 2: ## Text
            else if trimmed.hasPrefix("## ") {
                let content = String(trimmed.dropFirst(3))
                blocks.append(MarkdownBlock(type: .heading2, content: content))
            }
            // Heading 3: ### Text
            else if trimmed.hasPrefix("### ") {
                let content = String(trimmed.dropFirst(4))
                blocks.append(MarkdownBlock(type: .heading3, content: content))
            }
            // Horizontal rule: --- or ***
            else if trimmed == "---" || trimmed == "***" || trimmed == "___" {
                blocks.append(MarkdownBlock(type: .horizontalRule, content: ""))
            }
            // Bullet list: - Text or * Text
            else if trimmed.hasPrefix("- ") || trimmed.hasPrefix("* ") {
                let content = String(trimmed.dropFirst(2))
                blocks.append(MarkdownBlock(type: .bulletItem, content: content))
                currentNumber = 1 // Reset numbering
            }
            // Numbered list: 1. Text
            else if let match = trimmed.range(of: #"^\d+\.\s"#, options: .regularExpression) {
                let content = String(trimmed[match.upperBound...])
                blocks.append(MarkdownBlock(type: .numberedItem, content: content, number: currentNumber))
                currentNumber += 1
            }
            // Regular paragraph
            else {
                blocks.append(MarkdownBlock(type: .paragraph, content: trimmed))
            }
        }
        
        return blocks
    }
}

// MARK: - Paragraph view with link support

/// Renders a paragraph of markdown text, extracting links and rendering them
/// with a save-to-reading-list button when onSaveArticle is provided.
struct MarkdownParagraphView: View {
    let content: String
    var onSaveArticle: SaveArticleCallback?
    
    var body: some View {
        if let onSaveArticle = onSaveArticle, containsLinks(content) {
            // Render with interactive link buttons
            MarkdownLinksView(content: content, onSaveArticle: onSaveArticle)
        } else {
            // Plain attributed text rendering
            Text(parseInlineMarkdown(content))
                .font(.body)
        }
    }
    
    private func containsLinks(_ text: String) -> Bool {
        text.contains("[") && text.contains("](")
    }
    
    private func parseInlineMarkdown(_ text: String) -> AttributedString {
        do {
            return try AttributedString(
                markdown: text,
                options: AttributedString.MarkdownParsingOptions(
                    interpretedSyntax: .inlineOnlyPreservingWhitespace
                )
            )
        } catch {
            return AttributedString(text)
        }
    }
}

// MARK: - Links view with save button

/// Parses markdown links from text and renders them with a save button
struct MarkdownLinksView: View {
    let content: String
    let onSaveArticle: SaveArticleCallback
    
    var body: some View {
        // Parse the content into segments (text and links)
        let segments = parseSegments(content)
        
        // Build a flow layout of text and link buttons
        FlowLayout(segments: segments, onSaveArticle: onSaveArticle)
    }
    
    private func parseSegments(_ text: String) -> [TextSegment] {
        var segments: [TextSegment] = []
        var remaining = text
        
        // Regex pattern for markdown links: [text](url)
        let pattern = #"\[([^\]]+)\]\(([^)]+)\)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            segments.append(.text(text))
            return segments
        }
        
        var searchRange = remaining.startIndex..<remaining.endIndex
        
        while !remaining.isEmpty {
            let nsRange = NSRange(searchRange, in: remaining)
            if let match = regex.firstMatch(in: remaining, range: nsRange),
               let fullRange = Range(match.range, in: remaining),
               let titleRange = Range(match.range(at: 1), in: remaining),
               let urlRange = Range(match.range(at: 2), in: remaining) {
                
                // Add text before the link
                let beforeText = String(remaining[searchRange.lowerBound..<fullRange.lowerBound])
                if !beforeText.isEmpty {
                    segments.append(.text(beforeText))
                }
                
                // Add the link
                let linkTitle = String(remaining[titleRange])
                let linkURL = String(remaining[urlRange])
                segments.append(.link(title: linkTitle, url: linkURL))
                
                // Move past this match
                searchRange = fullRange.upperBound..<remaining.endIndex
            } else {
                // No more links, add remaining text
                let remainingText = String(remaining[searchRange])
                if !remainingText.isEmpty {
                    segments.append(.text(remainingText))
                }
                break
            }
        }
        
        return segments
    }
}

enum TextSegment {
    case text(String)
    case link(title: String, url: String)
}

// MARK: - Flow layout for mixed text and links

struct FlowLayout: View {
    let segments: [TextSegment]
    let onSaveArticle: SaveArticleCallback
    
    var body: some View {
        // Use a wrapping HStack approach via a custom layout
        // For simplicity, render each segment inline
        VStack(alignment: .leading, spacing: 4) {
            ForEach(Array(segments.enumerated()), id: \.offset) { _, segment in
                switch segment {
                case .text(let text):
                    if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Text(parseInlineMarkdown(text))
                            .font(.body)
                    }
                case .link(let title, let url):
                    LinkWithSaveButton(title: title, url: url, onSaveArticle: onSaveArticle)
                }
            }
        }
    }
    
    private func parseInlineMarkdown(_ text: String) -> AttributedString {
        do {
            return try AttributedString(
                markdown: text,
                options: AttributedString.MarkdownParsingOptions(
                    interpretedSyntax: .inlineOnlyPreservingWhitespace
                )
            )
        } catch {
            return AttributedString(text)
        }
    }
}

// MARK: - Link with save button

struct LinkWithSaveButton: View {
    let title: String
    let url: String
    let onSaveArticle: SaveArticleCallback
    
    @State private var showSavePopover = false
    @State private var isSaving = false
    @State private var saveResult: SaveResult?
    
    enum SaveResult {
        case success(String)
        case failure(String)
    }
    
    var body: some View {
        HStack(spacing: 4) {
            // The link itself
            Button(action: openURL) {
                Text(title)
                    .font(.body)
                    .foregroundColor(.accentColor)
                    .underline()
            }
            .buttonStyle(.plain)
            
            // Save to reading list button
            Button(action: { showSavePopover = true }) {
                Image(systemName: "bookmark")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
            .popover(isPresented: $showSavePopover) {
                savePopoverContent
            }
        }
    }
    
    private var savePopoverContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Save to Reading List")
                .font(.headline)
            
            Text(title)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .lineLimit(2)
            
            if let result = saveResult {
                switch result {
                case .success(let message):
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                        Text(message)
                            .font(.caption)
                            .foregroundColor(.green)
                    }
                case .failure(let message):
                    HStack(spacing: 6) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.red)
                        Text(message)
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }
            }
            
            HStack {
                Button("Cancel") {
                    showSavePopover = false
                    saveResult = nil
                }
                .buttonStyle(.bordered)
                
                Spacer()
                
                Button(action: saveArticle) {
                    if isSaving {
                        HStack(spacing: 6) {
                            ProgressView()
                                .scaleEffect(0.8)
                            Text("Saving...")
                        }
                    } else {
                        Text("Save")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isSaving || saveResult != nil)
            }
        }
        .padding()
        .frame(minWidth: 260)
    }
    
    private func openURL() {
        guard let url = URL(string: url) else { return }
        #if os(iOS)
        UIApplication.shared.open(url)
        #elseif os(macOS)
        NSWorkspace.shared.open(url)
        #endif
    }
    
    private func saveArticle() {
        isSaving = true
        Task {
            let result = await onSaveArticle(url, title)
            isSaving = false
            if result.success {
                saveResult = .success("Saved!")
                // Auto-dismiss after a moment
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                showSavePopover = false
                saveResult = nil
            } else {
                saveResult = .failure(result.error ?? "Failed to save article")
            }
        }
    }
}

// MARK: - Data model

private struct MarkdownBlock: Identifiable {
    let id = UUID()
    let type: BlockType
    let content: String
    var number: Int? = nil
    
    enum BlockType {
        case heading1
        case heading2
        case heading3
        case paragraph
        case bulletItem
        case numberedItem
        case horizontalRule
        case empty
    }
}

struct MarkdownView_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            MarkdownView(markdown: """
# Main Heading

This is a paragraph with **bold text** and *italic text* and a [link](https://example.com).

## Subheading

Another paragraph here.

### Smaller Heading

- Bullet point one
- Bullet point two with **bold**
- Bullet point three

1. Numbered item one
2. Numbered item two
3. Numbered item three

---

Final paragraph after horizontal rule.
""")
            .padding()
        }
    }
}

import SwiftUI

struct MarkdownView: View {
    let markdown: String
    
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
                Text(parseInlineMarkdown(block.content))
                    .font(.body)
                    .padding(.bottom, 8)
                
            case .bulletItem:
                HStack(alignment: .top, spacing: 8) {
                    Text("•")
                        .font(.body)
                    Text(parseInlineMarkdown(block.content))
                        .font(.body)
                }
                .padding(.leading, 16)
                
            case .numberedItem:
                HStack(alignment: .top, spacing: 8) {
                    Text("\(block.number ?? 1).")
                        .font(.body)
                    Text(parseInlineMarkdown(block.content))
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

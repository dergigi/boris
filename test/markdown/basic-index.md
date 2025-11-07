# Basic Markdown Syntax Test Index

This directory contains test files for basic markdown syntax features. Each file focuses on a specific aspect of the [Markdown Guide's Basic Syntax](https://www.markdownguide.org/basic-syntax/).

## Test Files

### [basic-headings.md](./basic-headings.md)
Tests heading syntax including:
- All heading levels (H1 through H6)
- Setext-style headings (alternate syntax)
- Headings with formatting and links
- Best practices for spacing and blank lines

### [basic-paragraphs-line-breaks.md](./basic-paragraphs-line-breaks.md)
Tests paragraph separation and line break syntax:
- Paragraph creation with blank lines
- Line breaks using trailing spaces
- HTML line breaks using `<br>` tag
- Best practices for paragraph formatting

### [basic-emphasis.md](./basic-emphasis.md)
Tests bold and italic text formatting:
- Bold text with `**` and `__`
- Italic text with `*` and `_`
- Combined bold and italic
- Mid-word emphasis best practices

### [basic-blockquotes.md](./basic-blockquotes.md)
Tests blockquote syntax:
- Basic blockquotes with `>`
- Multiple paragraph blockquotes
- Nested blockquotes
- Blockquotes containing lists, code, and formatting

### [basic-lists.md](./basic-lists.md)
Tests ordered and unordered list syntax:
- Unordered lists with `-`, `*`, and `+`
- Ordered lists with numbers
- Nested lists
- Lists with formatting, links, and code

### [basic-code.md](./basic-code.md)
Tests inline code and code block syntax:
- Inline code with backticks
- Code blocks with triple backticks
- Code blocks with language specification
- Escaping backticks in inline code

### [basic-horizontal-rules.md](./basic-horizontal-rules.md)
Tests horizontal rule syntax:
- Horizontal rules with `---`, `***`, and `___`
- Minimum character requirements
- Horizontal rules in various contexts

### [basic-links-and-images.md](./basic-links-and-images.md)
Tests link and image syntax:
- Inline links and reference links
- Links with titles
- Images with alt text and titles
- Linking images
- URL encoding best practices

### [basic-escaping.md](./basic-escaping.md)
Tests character escaping:
- Escaping special markdown characters with backslashes
- Escaping in different contexts
- All escapable characters per the Markdown Guide

## Usage

These test files can be:
- Viewed in the app's markdown reader
- Published to Nostr relays using `./scripts/publish-markdown.sh`

### Publishing a Test File

```bash
# Publish a specific file
./scripts/publish-markdown.sh basic-headings.md [wss://relay.example.com]

# Interactive mode (choose from all files)
./scripts/publish-markdown.sh
```

## Related Files

- [tables.md](./tables.md) - Tests markdown table syntax (GFM feature, not basic syntax)

## Notes

- These files test only **basic markdown syntax** as defined in the original Markdown specification
- Extended syntax features (like tables, footnotes, task lists) are not included here
- Each file starts with an H1 heading for title extraction by the publish script
- Files are kept under 420 lines per project conventions


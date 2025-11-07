# Basic Paragraphs and Line Breaks Test

This file tests paragraph separation and line break syntax in markdown.

## Paragraphs

Paragraphs are created by separating blocks of text with blank lines. A paragraph is one or more consecutive lines of text separated by blank lines.

This is the first paragraph. It contains multiple sentences. Each sentence flows naturally into the next. The paragraph continues until a blank line appears.

This is the second paragraph. It is separated from the first paragraph by a blank line. Paragraphs should render as distinct blocks of text with appropriate spacing between them.

This is the third paragraph. It demonstrates that multiple paragraphs can appear consecutively, each separated by a blank line.

## Single Line Paragraphs

A paragraph can consist of a single line of text.

This is a single-line paragraph.

This is another single-line paragraph.

## Paragraphs with Multiple Sentences

Paragraphs can contain multiple sentences. Each sentence ends with appropriate punctuation. The sentences flow together as a cohesive unit. This paragraph demonstrates that natural paragraph structure is preserved.

## Line Breaks

To create a line break within a paragraph, end a line with two or more spaces followed by a return.

This is the first line.  
This is the second line created with trailing spaces.

This demonstrates that line breaks create a new line within the same paragraph, rather than starting a new paragraph.

## HTML Line Breaks

If your markdown processor supports HTML, you can use the `<br>` tag for line breaks.

This is the first line.<br>
This is the second line created with an HTML break tag.

This is another line.<br>
And another line after the break.

## Best Practices

### Don't Indent Paragraphs

Paragraphs should not be indented with spaces or tabs unless they are part of a list.

This is a correctly formatted paragraph without indentation.

    This paragraph is incorrectly indented with spaces.

This paragraph is correctly formatted again.

### Blank Lines Between Paragraphs

Always use blank lines to separate paragraphs for compatibility.

This paragraph is correctly separated.

This paragraph is also correctly separated.

Without a blank line, this might not render as a separate paragraph.
This text might be treated as part of the previous paragraph.

## Multiple Line Breaks

Multiple line breaks within a paragraph can be created using trailing spaces or HTML breaks.

Line one.  
Line two.  
Line three.

Line one.<br>
Line two.<br>
Line three.

## Paragraphs with Formatting

Paragraphs can contain inline formatting like bold, italic, and code.

This paragraph contains **bold text** and *italic text* and `code text`.

This paragraph demonstrates that formatting works correctly within paragraph boundaries.

## Paragraphs with Links

Paragraphs can contain links and other inline elements.

This paragraph contains a [link to example.com](https://example.com) and another [reference link][ref].

[ref]: https://example.com

## Long Paragraphs

This paragraph contains a substantial amount of text to test how the markdown processor handles longer paragraphs. It includes multiple sentences that flow together naturally. The paragraph should render as a single cohesive block of text with appropriate line wrapping based on the container width. This tests that paragraph rendering works correctly even with extended content that might wrap across multiple visual lines in the rendered output.

## Paragraphs with Special Characters

Paragraphs can contain various special characters and punctuation marks.

This paragraph has numbers: 123, 456, 789.

This paragraph has symbols: !@#$%^&*().

This paragraph has quotes: "Hello" and 'World'.

This paragraph has parentheses (like this) and brackets [like this].

## Empty Paragraphs

An empty line creates a paragraph break, but multiple empty lines should still create a single paragraph break.

Paragraph before empty lines.

Paragraph after empty lines.

## Paragraphs with Code

Paragraphs can contain inline code and code blocks.

This paragraph contains `inline code` within the text flow.

This paragraph appears before a code block.

```
Code block here
```

This paragraph appears after a code block.

## Edge Cases

### Paragraph with Only Whitespace

    

### Paragraph with Trailing Spaces

This paragraph has trailing spaces.    

### Very Short Paragraph

A.

### Paragraph with Only Special Characters

!@#$%^&*()

---

**Source:** [test/markdown](https://github.com/dergigi/boris/tree/master/test/markdown)


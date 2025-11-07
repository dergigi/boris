# Basic Blockquotes Test

This file tests blockquote syntax using the `>` character.

## Basic Blockquotes

Blockquotes are created by placing a `>` character at the start of a line, followed by a space.

> This is a blockquote.

> This is another blockquote with multiple sentences. It demonstrates that blockquotes can contain extended text. The entire blockquote should be rendered with appropriate styling to distinguish it from regular paragraphs.

## Multiple Paragraph Blockquotes

Blockquotes can span multiple paragraphs by placing `>` at the start of each paragraph.

> This is the first paragraph in a blockquote.
>
> This is the second paragraph in the same blockquote.

> First paragraph.
>
> Second paragraph.
>
> Third paragraph.

## Blockquotes with Formatting

Blockquotes can contain inline formatting like bold, italic, and code.

> This blockquote contains **bold text**.

> This blockquote contains *italic text*.

> This blockquote contains ***bold and italic text***.

> This blockquote contains `code text`.

> This blockquote contains **bold**, *italic*, and `code` all together.

## Blockquotes with Links

Blockquotes can contain links.

> This blockquote contains a [link to example.com](https://example.com).

> This blockquote contains a [reference link][ref].

[ref]: https://example.com

## Nested Blockquotes

Blockquotes can be nested by using multiple `>` characters.

> This is the first level of a blockquote.
>
> > This is a nested blockquote.
>
> Back to the first level.

> First level.
>
> > Second level.
>
> > > Third level.
>
> > Back to second level.
>
> Back to first level.

## Blockquotes with Lists

Blockquotes can contain lists.

> This is a blockquote with a list:
>
> - First item
> - Second item
> - Third item

> This is a blockquote with a numbered list:
>
> 1. First item
> 2. Second item
> 3. Third item

> This is a blockquote with a nested list:
>
> - First item
>   - Nested item
>   - Another nested item
> - Second item

## Blockquotes with Code

Blockquotes can contain inline code and code blocks.

> This blockquote contains `inline code`.

> This blockquote contains a code block:
>
> ```
> Code block here
> More code
> ```

> This blockquote contains a code block with language:
>
> ```javascript
> function example() {
>   return "Hello";
> }
> ```

## Blockquotes with Headings

Blockquotes can contain headings.

> # Heading Level 1
>
> ## Heading Level 2
>
> ### Heading Level 3

## Blockquotes with Horizontal Rules

Blockquotes can contain horizontal rules.

> This is text before the rule.
>
> ---
>
> This is text after the rule.

## Multiple Blockquotes

Multiple blockquotes can appear consecutively.

> This is the first blockquote.

> This is the second blockquote.

> This is the third blockquote.

## Blockquotes in Context

Blockquotes can appear alongside regular paragraphs and other elements.

This is a regular paragraph before the blockquote.

> This is a blockquote between paragraphs.

This is a regular paragraph after the blockquote.

## Empty Blockquotes

An empty blockquote can be created, though it may not render visibly.

>

## Blockquotes with Special Characters

Blockquotes can contain special characters and punctuation.

> This blockquote has numbers: 123, 456, 789.

> This blockquote has symbols: !@#$%^&*().

> This blockquote has quotes: "Hello" and 'World'.

> This blockquote has parentheses (like this) and brackets [like this].

## Long Blockquotes

Blockquotes can contain very long text that wraps across multiple lines.

> This is a very long blockquote that contains a substantial amount of text. It demonstrates how blockquotes handle extended content that might wrap across multiple visual lines in the rendered output. The blockquote should maintain its styling and indentation even when the text extends beyond a single line.

## Blockquotes with Mixed Content

Blockquotes can contain a mix of different content types.

> This blockquote contains **bold text**, *italic text*, and `code`.
>
> It also contains a [link](https://example.com).
>
> - And a list item
> - Another list item
>
> And more regular text.

## Edge Cases

### Blockquote with Only Spaces

>     

### Blockquote with Trailing Spaces

> Blockquote with trailing spaces.    

### Very Short Blockquote

> A

### Blockquote with Only Special Characters

> !@#$%^&*()

### Blockquote Marker Without Space

>This might not render correctly in some processors.

---

**Source:** [basic-blockquotes.md](https://github.com/dergigi/boris/tree/master/test/markdown/basic-blockquotes.md)


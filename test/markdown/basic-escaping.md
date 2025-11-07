# Basic Escaping Test

This file tests character escaping in markdown using backslashes to display literal characters that would otherwise have special meaning.

## Escaping Special Characters

You can escape special markdown characters by placing a backslash (`\`) before them.

### Backslash

To display a literal backslash, escape it: \\

### Backtick

To display a literal backtick, escape it: \`

### Asterisk

To display a literal asterisk, escape it: \*

### Underscore

To display a literal underscore, escape it: \_

### Curly Braces

To display literal curly braces, escape them: \{ \}

### Square Brackets

To display literal square brackets, escape them: \[ \]

### Angle Brackets

To display literal angle brackets, escape them: \< \>

### Parentheses

To display literal parentheses, escape them: \( \)

### Pound Sign

To display a literal pound sign (hash), escape it: \#

### Plus Sign

To display a literal plus sign, escape it: \+

### Minus Sign

To display a literal minus sign (hyphen), escape it: \-

### Dot

To display a literal dot (period), escape it: \.

### Exclamation Mark

To display a literal exclamation mark, escape it: \!

### Pipe

To display a literal pipe character, escape it: \|

## Escaping in Different Contexts

### Escaping in Paragraphs

This paragraph contains escaped characters: \*asterisk\*, \_underscore\_, \`backtick\`.

### Escaping in Headings

#### Heading with \*Escaped\* Characters

#### Heading with \_Escaped\_ Characters

### Escaping in Lists

- Item with \*escaped asterisk\*
- Item with \_escaped underscore\_
- Item with \`escaped backtick\`

1. Ordered item with \*escaped\*
2. Another item with \_escaped\_

### Escaping in Blockquotes

> This blockquote contains \*escaped\* characters.

> This blockquote has \_escaped\_ underscores.

### Escaping in Links

You cannot escape characters inside link syntax, but you can escape them in the link text context.

This is a [link with \*escaped\* text](https://example.com).

## Multiple Escaped Characters

You can escape multiple characters in sequence.

\*\*This would be bold if not escaped\*\*

\*\*\*This would be bold and italic if not escaped\*\*\*

\`\`This would be code if not escaped\`\`

## Escaping vs. Not Escaping

### Without Escaping

This text has **bold** and *italic* formatting.

### With Escaping

This text has \*\*escaped bold\*\* and \*escaped italic\* markers.

## Escaping Special Characters in Code

Inside code blocks and inline code, characters are already literal and don't need escaping.

```
This code block contains *asterisks* and _underscores_ without escaping.
```

This paragraph contains `inline code with *asterisks*` that don't need escaping.

## Escaping at Word Boundaries

Escaped characters can appear at the start or end of words.

\*Start of word

End of word\*

\_Start of word

End of word\_

## Escaping with Punctuation

Escaped characters work correctly with adjacent punctuation.

\*Asterisk\*, with comma.

\*Asterisk\*. With period.

\*Asterisk\*! With exclamation.

\_Underscore\_, with comma.

\_Underscore\_. With period.

## Edge Cases

### Escaping Non-Special Characters

Escaping characters that don't have special meaning in markdown typically results in a literal backslash followed by the character.

\a

\b

\c

### Multiple Backslashes

\\\\

\\\\\\

### Escaping Spaces

Escaping a space typically doesn't have a special effect: \ 

### Escaping Newlines

Escaping a newline (backslash at end of line) may create a line break in some processors, but this is not part of basic markdown syntax.

### Escaping in Different Positions

Start: \*text

Middle: text\*text

End: text\*

### Escaping Special Character Sequences

\*\*\*

\`\`\`

\-\-\-

## Real-World Examples

### Escaping in Documentation

When writing documentation about markdown, you often need to escape characters to show the syntax.

To create bold text, use \*\*two asterisks\*\*.

To create italic text, use \*one asterisk\*.

To create inline code, use \`backticks\`.

### Escaping in Examples

Here's how to escape a backtick: \`

Here's how to escape an asterisk: \*

Here's how to escape an underscore: \_

---

**Source:** [basic-escaping.md](https://github.com/dergigi/boris/tree/master/test/markdown/basic-escaping.md)


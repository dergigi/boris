# Basic Lists Test

This file tests ordered and unordered list syntax in markdown.

## Unordered Lists

Unordered lists are created using hyphens (`-`), asterisks (`*`), or plus signs (`+`) followed by a space.

- First item
- Second item
- Third item

* First item
* Second item
* Third item

+ First item
+ Second item
+ Third item

## Ordered Lists

Ordered lists are created using numbers followed by a period and a space.

1. First item
2. Second item
3. Third item

## List Items with Multiple Paragraphs

List items can contain multiple paragraphs by indenting subsequent paragraphs.

- First item

  This is a second paragraph in the first item.

- Second item

  This is a second paragraph in the second item.

  This is a third paragraph in the second item.

## Nested Lists

Lists can be nested by indenting list items.

- First level item
  - Second level item
  - Another second level item
- Back to first level

1. First ordered item
   - Nested unordered item
   - Another nested unordered item
2. Second ordered item
   - Nested unordered item
     - Third level item

- Unordered item
  1. Nested ordered item
  2. Another nested ordered item
- Another unordered item

## Lists with Formatting

List items can contain inline formatting like bold, italic, and code.

- Item with **bold text**
- Item with *italic text*
- Item with ***bold and italic text***
- Item with `code text`
- Item with **bold**, *italic*, and `code` together

1. Ordered item with **bold text**
2. Ordered item with *italic text*
3. Ordered item with `code text`

## Lists with Links

List items can contain links.

- Item with [inline link](https://example.com)
- Item with [reference link][ref]

[ref]: https://example.com

1. Ordered item with [link](https://example.com)
2. Another ordered item with [link](https://example.com)

## Lists with Code

List items can contain inline code and code blocks.

- Item with `inline code`
- Item with code block:

  ```
  Code block here
  More code
  ```

1. Ordered item with `inline code`
2. Ordered item with code block:

   ```javascript
   function example() {
     return "Hello";
   }
   ```

## Lists with Blockquotes

List items can contain blockquotes.

- Item with blockquote:

  > This is a blockquote inside a list item.

1. Ordered item with blockquote:

   > This is a blockquote inside an ordered list item.

## Lists with Other Lists

Lists can contain other lists as nested items.

- First item
  - Nested unordered list
    - Deeper nesting
  - Another nested item
- Second item
  1. Nested ordered list
  2. Another ordered item
     - Even deeper nesting

## Ordered Lists with Different Start Numbers

Ordered lists can start with any number, but markdown processors typically normalize them.

1. First item
2. Second item
3. Third item

5. Starting at five
6. Second item
7. Third item

10. Starting at ten
11. Second item
12. Third item

## Mixed List Types

You can mix ordered and unordered lists at the same level.

- Unordered item
- Another unordered item

1. Ordered item
2. Another ordered item

- Back to unordered

## Long List Items

List items can contain extended text that wraps across multiple lines.

- This is a very long list item that contains a substantial amount of text. It demonstrates how list items handle extended content that might wrap across multiple visual lines in the rendered output. The list item should maintain proper formatting and indentation.

- Another long item with multiple sentences. Each sentence flows naturally into the next. The entire item should render as a cohesive unit with appropriate line wrapping based on the container width.

## Lists with Special Characters

List items can contain special characters and punctuation.

- Item with numbers: 123, 456, 789
- Item with symbols: !@#$%^&*()
- Item with quotes: "Hello" and 'World'
- Item with parentheses (like this) and brackets [like this]

1. Ordered item with numbers: 123
2. Ordered item with symbols: !@#$%^&*()
3. Ordered item with quotes: "Hello"

## Empty List Items

An empty list item can be created, though it may not render visibly.

- 

1. 

## Edge Cases

### List with Only Spaces

-     

### List Item with Trailing Spaces

- Item with trailing spaces.    

### Very Short List Items

- A
- B
- C

### List with Only Special Characters

- !@#$%^&*()
- !@#$%^&*()

### List Marker Without Space

-This might not render correctly in some processors.

1.This might not render correctly in some processors.

### Single Item Lists

- Only one item

1. Only one item

### Lists with Many Items

This tests how lists handle a larger number of items.

1. First item
2. Second item
3. Third item
4. Fourth item
5. Fifth item
6. Sixth item
7. Seventh item
8. Eighth item
9. Ninth item
10. Tenth item
11. Eleventh item
12. Twelfth item
13. Thirteenth item
14. Fourteenth item
15. Fifteenth item


# Basic Code Test

This file tests inline code and code block syntax in markdown.

## Inline Code

Inline code is created using backticks (`` ` ``) around the text.

This paragraph contains `inline code`.

You can use `inline code` anywhere in a sentence.

`Code` can appear at the start of a sentence.

A sentence can end with `code`.

## Code Blocks

Code blocks are created using triple backticks (``` ``` ```) on lines before and after the code.

```
This is a code block.
It can contain multiple lines.
Each line is preserved as written.
```

## Code Blocks with Language

Code blocks can specify a programming language for syntax highlighting.

```javascript
function example() {
  return "Hello, World!";
}
```

```python
def example():
    return "Hello, World!"
```

```html
<div>
  <p>Hello, World!</p>
</div>
```

```css
.example {
  color: blue;
  font-size: 16px;
}
```

## Multiple Code Blocks

Multiple code blocks can appear consecutively.

```
First code block
```

```
Second code block
```

```
Third code block
```

## Code Blocks with Formatting

Code blocks preserve all formatting, including spaces and indentation.

```
    This code block
        has indentation
            that should be preserved
```

```
function example() {
    if (condition) {
        return value;
    }
}
```

## Code Blocks with Special Characters

Code blocks can contain special characters and symbols.

```
!@#$%^&*()
[]{}()
<>
```

```
function test() {
  console.log("Hello, World!");
  return 123;
}
```

## Inline Code with Special Characters

Inline code can contain special characters.

This has `code with !@#$%` in it.

This has `code with ()[]{}` in it.

This has `code with <>&` in it.

## Escaping Backticks in Inline Code

To include a backtick in inline code, use double backticks.

This contains `` `backtick` `` in the code.

This contains `` `code with backticks` `` in it.

## Code Blocks with Empty Lines

Code blocks can contain empty lines.

```
First line

Third line
```

```
Line one

Line three

Line five
```

## Code Blocks with Only Whitespace

Code blocks can contain only whitespace.

```
    
```

```
    

```

## Inline Code in Different Contexts

Inline code can appear in various contexts.

### In Paragraphs

This paragraph has `inline code` in it.

### In Lists

- Item with `inline code`
- Another item with `code`

1. Ordered item with `inline code`
2. Another ordered item with `code`

### In Blockquotes

> This blockquote contains `inline code`.

### In Headings

### Heading with `Code`

## Code Blocks in Different Contexts

### Code Blocks After Paragraphs

This is a paragraph.

```
Code block after paragraph
```

### Code Blocks Before Paragraphs

```
Code block before paragraph
```

This is a paragraph.

### Code Blocks Between Paragraphs

This is the first paragraph.

```
Code block in the middle
```

This is the second paragraph.

### Code Blocks in Lists

- List item before code block

  ```
  Code block in list
  ```

- List item after code block

### Code Blocks in Blockquotes

> This is a blockquote with a code block:
>
> ```
> Code block in blockquote
> ```

## Long Code Blocks

Code blocks can contain very long lines of code.

```
This is a very long line of code that extends far beyond the normal width and should demonstrate how code blocks handle extended content that might require horizontal scrolling or wrapping depending on the rendering implementation.
```

```
function veryLongFunctionNameThatExtendsBeyondNormalWidth(parameterOne, parameterTwo, parameterThree, parameterFour) {
  return parameterOne + parameterTwo + parameterThree + parameterFour;
}
```

## Code Blocks with Many Lines

Code blocks can contain many lines of code.

```javascript
function example() {
  let x = 1;
  let y = 2;
  let z = 3;
  let a = 4;
  let b = 5;
  let c = 6;
  let d = 7;
  let e = 8;
  let f = 9;
  let g = 10;
  return x + y + z + a + b + c + d + e + f + g;
}
```

## Edge Cases

### Inline Code with Only Spaces

`    `

### Inline Code with Only Special Characters

`!@#$%^&*()`

### Very Short Inline Code

`` `a` ``

### Inline Code at Word Boundaries

`code`word

word`code`

### Code Block with Only One Line

```
Single line code block
```

### Code Block with Trailing Spaces

```
Code block with trailing spaces    
```

### Unclosed Code Block

```
This code block is not closed properly

### Code Block with Language but No Code

```javascript
```

### Inline Code with Backticks

`` `code` ``

`` ``code`` ``

---

**Source:** [basic-code.md](https://github.com/dergigi/boris/tree/master/test/markdown/basic-code.md)


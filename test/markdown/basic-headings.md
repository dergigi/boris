# Basic Headings Test

This file tests markdown heading syntax, including all heading levels and alternate syntax forms.

## Heading Levels

Headings are created using number signs (`#`) followed by a space and the heading text. The number of `#` symbols determines the heading level.

# Heading Level 1

## Heading Level 2

### Heading Level 3

#### Heading Level 4

##### Heading Level 5

###### Heading Level 6

## Best Practices

Always include a space between the number signs and the heading text for compatibility across markdown processors.

# Correct: Space after #

#Incorrect: No space after #

## Blank Lines

For best compatibility, include blank lines before and after headings.

This paragraph is before the heading.

# Heading with blank lines

This paragraph is after the heading.

Without blank lines, this might not render correctly.
# Heading without blank lines
This text might be treated as part of the heading.

## Alternate Syntax (Setext)

Heading level 1 can also be created using equals signs (`=`) on the line below the text.

Heading Level 1
===============

Heading level 2 can be created using hyphens (`-`) on the line below the text.

Heading Level 2
---------------

## Headings with Formatting

Headings can contain inline formatting like bold and italic text.

### Heading with **Bold** Text

### Heading with *Italic* Text

### Heading with ***Bold and Italic*** Text

### Heading with `Code` Text

## Headings with Links

Headings can contain links.

### Heading with [Link](https://example.com)

### Heading with [Reference Link][ref]

[ref]: https://example.com

## Long Headings

This tests how headings handle very long text that might wrap across multiple lines on smaller screens or in narrow containers.

# This is a very long heading that contains many words and should demonstrate how the markdown processor handles headings that extend beyond a single line of text

## Special Characters in Headings

Headings can contain various special characters and punctuation.

### Heading with Numbers: 123

### Heading with Symbols: !@#$%^&*()

### Heading with Quotes: "Hello World"

### Heading with Parentheses (Like This)

### Heading with Brackets [Like This]

### Heading with Braces {Like This}

## Multiple Headings

Multiple headings of the same or different levels can appear consecutively.

# First H1

# Second H1

## First H2

## Second H2

### First H3

### Second H3

## Edge Cases

### Heading with Only Spaces

#    

### Heading with Trailing Spaces

# Heading with trailing spaces    

### Heading Starting with Number Sign

# #Heading that starts with a number sign

### Very Short Heading

# A

### Heading with Only Special Characters

# !@#$%^&*()

---

**Source:** [basic-headings.md](https://github.com/dergigi/boris/tree/master/test/markdown/basic-headings.md)


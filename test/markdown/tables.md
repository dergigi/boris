# Markdown Tables Test

This file contains various markdown table examples to test table parsing and rendering.

## Basic Table

This is a simple two-column table with two data rows. It tests basic table structure and rendering without any special formatting or alignment.

| Column 1      | Column 2      |
| ------------- | ------------- |
| Cell 1, Row 1 | Cell 2, Row 1 |
| Cell 1, Row 2 | Cell 2, Row 2 |

## Table with Alignment

This table demonstrates text alignment options in markdown tables. The first column is left-aligned (default), the second is centered using `:---:`, and the third is right-aligned using `---:`. This tests that the CSS alignment rules work correctly.

| Left         | Centered         | Right                      |
| :----------- | :--------------: | -------------------------: |
| This is left | Text is centered | And this is right-aligned  |
| More text    | Even more text   | And even more to the right |

## Table with Formatting

This table contains various markdown formatting within cells: italic text using asterisks, bold text using double asterisks, and inline code using backticks. This tests that formatting is preserved and rendered correctly within table cells.

| Name    | Location     | Food    |
| ------- | ------------ | ------- |
| *Alice* | **New York** | `Pizza` |
| Bob     | Paris        | Crepes  |

## Table with Links

This table includes markdown links within cells. It tests that hyperlinks are properly rendered and clickable within table cells, and that link styling matches the app's theme.

| Name  | Website                    | Description           |
| ----- | -------------------------- | --------------------- |
| Alice | [GitHub](https://github.com) | Code repository       |
| Bob   | [Nostr](https://nostr.com)  | Decentralized network |

## Table with Code Blocks

This table contains inline code examples in cells. It tests that code formatting (monospace font, background, borders) is properly applied within table cells and doesn't conflict with table styling.

| Language | Example                    |
| -------- | -------------------------- |
| Python   | `print("Hello, World!")`   |
| JavaScript | `console.log("Hello")`   |
| SQL      | `SELECT * FROM users`      |

## Wide Table (Testing Horizontal Scroll)

This table has eight columns to test horizontal scrolling behavior on mobile devices and smaller screens. The table should allow users to scroll horizontally to view all columns while maintaining proper styling and readability.

| Column 1 | Column 2 | Column 3 | Column 4 | Column 5 | Column 6 | Column 7 | Column 8 |
| -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- |
| Data 1   | Data 2   | Data 3   | Data 4   | Data 5   | Data 6   | Data 7   | Data 8   |
| More     | Content  | Here     | To       | Test     | Scrolling| Behavior | Mobile   |

## Table with Mixed Content

This table combines various content types: currency values, emoji indicators, and descriptive text. It tests how different content types render together within table cells and ensures proper spacing and alignment.

| Item | Price | Status | Notes                          |
| ---- | ----- | ------ | ------------------------------ |
| Apple | $1.00 | ✅ In stock | Fresh from the farm            |
| Banana | $0.50 | ⚠️ Low stock | Last few left                  |
| Orange | $1.25 | ❌ Out of stock | Coming next week               |

## Table with Empty Cells

This table contains empty cells to test how the table styling handles missing data. Empty cells should still maintain proper borders and spacing, ensuring the table structure remains intact.

| Name | Email | Phone |
| ---- | ----- | ----- |
| Alice | alice@example.com | |
| Bob | | 555-1234 |
| Charlie | charlie@example.com | 555-5678 |

## Table with Long Text

This table tests text wrapping behavior with varying column widths. The third column contains a long paragraph that should wrap to multiple lines within the cell while maintaining proper padding and readability. This is especially important for responsive design.

| Short | Medium Length Column | Very Long Column That Contains A Lot Of Text And Should Wrap Properly |
| ----- | -------------------- | -------------------------------------------------------------------- |
| A     | This is medium text  | This is a very long piece of text that should wrap to multiple lines when displayed in the table cell. It should maintain proper formatting and readability. |

## Table with Numbers

This table contains 21 rows of ranked data with numeric scores and percentages. It's useful for testing row striping, scrolling behavior with longer tables, and ensuring that numeric alignment and formatting remain consistent throughout a larger dataset.

| Rank | Name | Score | Percentage |
| ---- | ---- | ----- | ---------- |
| 1    | Alice | 95    | 95%        |
| 2    | Bob   | 87    | 87%        |
| 3    | Charlie | 82  | 82%        |
| 4    | David | 78    | 78%        |
| 5    | Emma  | 75    | 75%        |
| 6    | Frank | 72    | 72%        |
| 7    | Grace | 70    | 70%        |
| 8    | Henry | 68    | 68%        |
| 9    | Ivy   | 65    | 65%        |
| 10   | Jack  | 63    | 63%        |
| 11   | Kate  | 60    | 60%        |
| 12   | Liam  | 58    | 58%        |
| 13   | Mia   | 55    | 55%        |
| 14   | Noah  | 53    | 53%        |
| 15   | Olivia | 50   | 50%        |
| 16   | Paul  | 48    | 48%        |
| 17   | Quinn | 45    | 45%        |
| 18   | Ryan  | 43    | 43%        |
| 19   | Sarah | 40    | 40%        |
| 20   | Tom   | 38    | 38%        |
| 21   | Uma   | 35    | 35%        |

## Table with Special Characters

This table contains escaped special characters that have meaning in markdown syntax. It tests that these characters are properly escaped and displayed as literal characters rather than being interpreted as markdown syntax.

| Symbol | Name | Usage |
| ------ | ---- | ----- |
| `\|` | Pipe | Used in markdown tables |
| `\*` | Asterisk | Used for bold/italic |
| `\#` | Hash | Used for headings |

## Table with Headers Only

This table contains only header rows with no data rows. It tests edge case handling for tables without content, ensuring that the header styling is still applied correctly even when there's no body content.

| Header 1 | Header 2 | Header 3 |
| -------- | -------- | -------- |

## Single Column Table

This is a minimal table with only one column. It tests how table styling handles narrow tables and ensures that single-column layouts are properly formatted with appropriate borders and spacing.

| Item |
| ---- |
| First |
| Second |
| Third |

## A Table from a Real Article

This one is from [Bitcoin is Time](https://read.withboris.com/a/naddr1qq8ky6t5vdhkjm3dd9ej6arfd4jsygrwg6zz9hahfftnsup23q3mnv5pdz46hpj4l2ktdpfu6rhpthhwjvpsgqqqw4rsdan6ej) which broke and is the reason why this document exists.

| Clock                     | Tick Frequency                          |
| --------------------------|-----------------------------------------|
| Grandfather's clock       | ~0.5 Hz                                 |
| Metronome                 | ~0.67 Hz to ~4.67 Hz                    |
| Quartz watch              | 32768 Hz                                |
| Caesium-133 atomic clock  | 9,192,631,770 Hz                        |
| Bitcoin                   | 1 block (0.00000192901 Hz* to ∞ Hz**)   |

\* first block (6 days)  
\*\* timestamps between blocks can show a negative delta

## Table with Nested Formatting

This table demonstrates complex nested formatting combinations within cells, including bold and italic text together, code blocks containing links, and strikethrough text. It tests that multiple formatting types can coexist properly within table cells.

| Description | Example |
| ----------- | ------- |
| Bold and italic | ***Important*** |
| Code and link | `[Click here](https://example.com)` |
| Strikethrough | ~~Old price~~ |


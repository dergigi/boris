# Basic Links and Images Test

This file tests link and image syntax in markdown, including inline links, reference links, and images.

## Inline Links

Inline links are created using square brackets for the link text followed by parentheses containing the URL.

This is an [inline link](https://example.com).

You can have [multiple links](https://example.com) in the [same paragraph](https://example.org).

## Links with Titles

Links can include an optional title that appears as a tooltip when hovering.

This is a [link with title](https://example.com "Example Website").

This is another [link with title](https://example.org 'Another Example').

This link uses (parentheses) for the title: [link](https://example.com (Title in Parentheses)).

## Reference Links

Reference links use a two-part syntax: the link text in square brackets, and the URL definition elsewhere.

This is a [reference link][example].

This is another [reference link][another].

[example]: https://example.com
[another]: https://example.org

## Reference Links with Titles

Reference links can also include titles.

This is a [reference link with title][titled].

[titled]: https://example.com "Link Title"

This is another [reference link with title][titled2].

[titled2]: https://example.org 'Another Title'

## Implicit Reference Links

You can use the link text itself as the reference identifier.

This is an [implicit reference link][implicit reference link].

[implicit reference link]: https://example.com

## Links in Different Contexts

### Links in Paragraphs

This paragraph contains a [link](https://example.com) in the middle of the text.

### Links in Lists

- Item with [link](https://example.com)
- Another item with [link](https://example.org)

1. Ordered item with [link](https://example.com)
2. Another ordered item with [link](https://example.org)

### Links in Blockquotes

> This blockquote contains a [link](https://example.com).

### Links in Headings

### Heading with [Link](https://example.com)

## Links with Formatting

Links can contain formatting like bold and italic.

This is a [**bold link**](https://example.com).

This is a [*italic link*](https://example.com).

This is a [***bold italic link***](https://example.com).

## Images

Images are created using an exclamation mark followed by square brackets for alt text and parentheses for the image URL.

![Alt text](https://example.com/image.jpg)

![Image with description](https://example.com/photo.png)

## Images with Titles

Images can include optional titles.

![Alt text](https://example.com/image.jpg "Image Title")

![Another image](https://example.com/photo.png 'Another Title')

## Reference Style Images

Images can use reference-style syntax.

![Reference image][img1]

![Another reference image][img2]

[img1]: https://example.com/image.jpg
[img2]: https://example.com/photo.png "Photo Title"

## Linking Images

To create a link that wraps an image, enclose the image syntax in square brackets followed by the link URL in parentheses.

[![Linked image](https://example.com/image.jpg)](https://example.com)

[![Another linked image](https://example.com/photo.png)](https://example.org "Link Title")

## Images in Different Contexts

### Images in Paragraphs

This paragraph contains an image: ![Inline image](https://example.com/image.jpg)

### Images in Lists

- Item with image: ![List image](https://example.com/image.jpg)
- Another item with image: ![Another image](https://example.com/photo.png)

### Images in Blockquotes

> This blockquote contains an image: ![Blockquote image](https://example.com/image.jpg)

## Relative and Absolute URLs

Links can use both relative and absolute URLs.

This is a [relative link](../page.html).

This is an [absolute link](https://example.com/page.html).

This is a [protocol-relative link](//example.com/page.html).

## Links with Special Characters

Links can contain special characters, but URLs with spaces should be encoded.

This is a [link with encoded space](https://example.com/my%20page.html).

This is a [link with parentheses](https://example.com/page%28with%29parentheses.html).

## Edge Cases

### Empty Link Text

[](https://example.com)

### Link with Only Spaces

[   ](https://example.com)

### Image with Empty Alt Text

![](https://example.com/image.jpg)

### Image with Only Spaces in Alt Text

![   ](https://example.com/image.jpg)

### Link Without URL

[Link text]()

### Reference Link Without Definition

This is a [broken reference link][broken].

### Very Long URLs

This is a [link with a very long URL](https://example.com/very/long/path/to/a/resource/that/extends/beyond/normal/width/and/tests/how/the/renderer/handles/extended/urls.html).

### Links with Numbers

[Link 123](https://example.com)

[123 Link](https://example.com)

### Images with Special Characters in Alt Text

![Image with !@#$%](https://example.com/image.jpg)

![Image with "quotes"](https://example.com/image.jpg)

## Best Practices

### URL Encoding

For compatibility, encode spaces in URLs with `%20`.

✅ [Correct link](https://example.com/my%20page.html)

❌ [Incorrect link](https://example.com/my page.html)

### Parentheses in URLs

Encode opening parenthesis as `%28` and closing parenthesis as `%29`.

✅ [Correct link](https://example.com/page%28with%29parentheses.html)

❌ [Incorrect link](https://example.com/page(with)parentheses.html)

---

**Source:** [test/markdown](https://github.com/dergigi/boris/tree/master/test/markdown)


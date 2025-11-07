#!/bin/bash

# Script to publish markdown files from test/markdown/ to Nostr using nak
# Usage: 
#   ./scripts/publish-markdown.sh [filename] [relay1] [relay2] ...
#   ./scripts/publish-markdown.sh                    # Interactive mode
#   ./scripts/publish-markdown.sh tables.md          # Publish specific file
#   ./scripts/publish-markdown.sh tables.md wss://relay.example.com  # With relay

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MARKDOWN_DIR="$PROJECT_ROOT/test/markdown"
ENV_FILE="$PROJECT_ROOT/.env"

# Load .env file if it exists
if [ -f "$ENV_FILE" ]; then
    # Source the .env file, handling quoted values properly
    set -a  # Automatically export all variables
    # Use eval to properly handle quoted values (safe since we control the file)
    # This handles both unquoted and quoted values correctly
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip comments and empty lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "$line" ]] && continue
        # Remove leading/trailing whitespace
        line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        # Export the variable (handles quoted values)
        eval "export $line"
    done < "$ENV_FILE"
    set +a  # Stop automatically exporting
fi

# Check if nak is installed
if ! command -v nak &> /dev/null; then
    echo "Error: nak is not installed or not in PATH"
    echo "Install from: https://github.com/fiatjaf/nak"
    exit 1
fi

# Function to publish a markdown file
publish_file() {
    local file_path="$1"
    shift  # Remove first argument, rest are relay URLs
    local relays=("$@")
    local filename=$(basename "$file_path")
    local identifier="${filename%.md}"  # Remove .md extension
    
    echo "📝 Publishing: $filename"
    echo "   Identifier: $identifier"
    
    # Extract title from first H1 if available, otherwise use filename
    local title=$(grep -m 1 "^# " "$file_path" | sed 's/^# //' || echo "$identifier")
    
    # Add relays if provided
    if [ ${#relays[@]} -gt 0 ]; then
        echo "   Relays: ${relays[*]}"
    else
        echo "   Note: No relays specified. Event will be created but not published."
        echo "   Add relay URLs as arguments to publish, e.g.: wss://relay.example.com"
    fi
    
    # Publish as kind 30023 (NIP-23 blog post)
    # The "d" tag is required for replaceable events (kind 30023)
    # Using the filename (without extension) as the identifier
    # Build command array to avoid eval issues
    # Use @filename syntax to read content from file (nak supports this)
    local cmd_args=(
        "event"
        "-k" "30023"
        "-d" "$identifier"
        "-t" "title=\"$title\""
        "--content" "@$file_path"
    )
    
    # Add relays if provided
    if [ ${#relays[@]} -gt 0 ]; then
        cmd_args+=("${relays[@]}")
    fi
    
    nak "${cmd_args[@]}"
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully published: $filename"
    else
        echo "❌ Failed to publish: $filename"
        return 1
    fi
}

# Check for NOSTR_SECRET_KEY
if [ -z "$NOSTR_SECRET_KEY" ]; then
    echo "⚠️  Warning: NOSTR_SECRET_KEY environment variable not set"
    echo "   Set it in .env file or with: export NOSTR_SECRET_KEY=your_key_here"
    echo "   Or use --prompt-sec flag (nak will prompt for key)"
    echo ""
fi

# Parse RELAYS from environment if set
default_relays=()
if [ -n "$RELAYS" ]; then
    # Split RELAYS string into array
    read -ra default_relays <<< "$RELAYS"
fi

# Main logic
if [ $# -eq 0 ]; then
    # No arguments: list all markdown files and let user choose
    echo "Available markdown files:"
    echo ""
    
    files=("$MARKDOWN_DIR"/*.md)
    if [ ! -e "${files[0]}" ]; then
        echo "No markdown files found in $MARKDOWN_DIR"
        exit 1
    fi
    
    # Display files with numbers
    declare -a file_array
    i=1
    for file in "${files[@]}"; do
        filename=$(basename "$file")
        echo "  $i) $filename"
        file_array[$i]="$file"
        ((i++))
    done
    
    echo ""
    echo "Enter file number(s) to publish (space-separated), or 'all' for all files:"
    read -r selection
    
    echo ""
    if [ ${#default_relays[@]} -gt 0 ]; then
        echo "Enter relay URLs (space-separated, or press Enter to use defaults from .env):"
        echo "   Defaults: ${default_relays[*]}"
    else
        echo "Enter relay URLs (space-separated, or press Enter to skip):"
    fi
    read -r relay_input
    
    # Parse relay URLs
    relays=()
    if [ -n "$relay_input" ]; then
        read -ra relays <<< "$relay_input"
    elif [ ${#default_relays[@]} -gt 0 ]; then
        # Use defaults from .env
        relays=("${default_relays[@]}")
    fi
    
    if [ "$selection" = "all" ]; then
        # Publish all files
        for file in "${files[@]}"; do
            publish_file "$file" "${relays[@]}"
            echo ""
        done
    else
        # Publish selected files
        for num in $selection; do
            if [ -n "${file_array[$num]}" ]; then
                publish_file "${file_array[$num]}" "${relays[@]}"
                echo ""
            else
                echo "⚠️  Invalid selection: $num"
            fi
        done
    fi
else
    # Argument provided: publish specific file
    filename="$1"
    shift  # Remove filename, rest are relay URLs
    relays=("$@")
    
    # If no relays provided as arguments, use defaults from .env
    if [ ${#relays[@]} -eq 0 ] && [ ${#default_relays[@]} -gt 0 ]; then
        relays=("${default_relays[@]}")
    fi
    
    # If filename doesn't end with .md, add it
    if [[ ! "$filename" =~ \.md$ ]]; then
        filename="${filename}.md"
    fi
    
    file_path="$MARKDOWN_DIR/$filename"
    
    if [ ! -f "$file_path" ]; then
        echo "Error: File not found: $file_path"
        exit 1
    fi
    
    publish_file "$file_path" "${relays[@]}"
fi


# applesauce-core

AppleSauce is a collection of utilities for building reactive nostr applications. The core package provides an in-memory event database and reactive models to help you build nostr UIs with less code.

## Key Components

- **Helpers**: Core utility methods for parsing and extracting data from nostr events
- **EventStore**: In-memory database for storing and subscribing to nostr events
- **Models**: Complex subscriptions for common nostr data patterns

## Documentation

For detailed documentation and guides, visit:

- [Getting Started](https://hzrd149.github.io/applesauce/introduction/getting-started)
- [API Reference](https://hzrd149.github.io/applesauce/typedoc/)

## Example

```js
import { EventStore } from "applesauce-core";
import { ProfileModel, TimelineModel } from "applesauce-core/models";
import { Relay } from "nostr-tools/relay";

// Create a single EventStore instance for your app
const eventStore = new EventStore();

// Use any nostr library for relay connections (nostr-tools, ndk, nostrify, etc...)
const relay = await Relay.connect("wss://relay.example.com");

// Subscribe to events and add them to the store
const sub = relay.subscribe([{ authors: ["3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d"] }], {
  onevent(event) {
    eventStore.add(event);
  },
});

// Subscribe to profile changes using ProfileModel
const profile = eventStore.model(ProfileModel, "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d");

profile.subscribe((parsed) => {
  if (parsed) console.log(parsed);
});

// Subscribe to a timeline of events
const timeline = eventStore.model(TimelineModel, { kinds: [1] });

timeline.subscribe((events) => {
  console.log(events);
});
```

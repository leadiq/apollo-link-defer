# Defer Link

## Purpose
An Apollo Link to allow links to asynchronously be prepared, even after the `ApolloClient` has been constructed.

## Usage
```js
import { WebSocketLink } from 'apollo-link-ws'
import { SubscriptionClient } from 'subscriptions-transport-ws'
import { deferLink } from "apollo-link-defer";

const deferredSubscriptionLink =
  Promise.resolve('/api/v1/eventbus')
    .then(path => api.get(path))
    .then(({ uri, address }) => {
      const token = cookie.get()
      return new SubscriptionClient(
        `${uri}/bridge?token=${token}&play_uri=${API_SERVER}`,
        { reconnect: true, connectionParams: { type: 'register', address } },
        SockJS
      )
    })
    .then(client => new WebSocketLink(client))

// This prevents the underlying link from being created until we have the correct URL.
const wsLink = deferLink(resolveSubscriptionLink)

// The client can still be built while we wait for the link to finish setting up.
// It will transparently be used once the link is successfully instantiated.
const client = new ApolloClient({link: wsLink})

```

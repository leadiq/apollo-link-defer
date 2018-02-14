import {ApolloLink, FetchResult, NextLink, Observable, Operation, toPromise} from 'apollo-link'

export type FutureLink = Promise<ApolloLink> | Observable<ApolloLink>
export type LinkResolver = (resolveLink: Promise<ApolloLink> | Observable<ApolloLink>) => ApolloLink;

/**
 * Waits for the link resolver to complete before it starts passing requests to the underlying link
 */
export const deferLink: LinkResolver = (resolveLink: FutureLink) =>
    new DeferLink(isObservable(resolveLink) ? toPromise(resolveLink) : resolveLink);

class DeferLink extends ApolloLink {
    private resolvedLink: ApolloLink;

    constructor(private deferredLink: Promise<ApolloLink>) {
        super();
        // Allow this to resolve at some point in the future.
        this.deferredLink
            .then(link => this.resolvedLink = link);
    }

    public request(operation: Operation, forward?: NextLink): Observable<FetchResult> | null {
        const {resolvedLink, deferredLink} = this;
        // If the real link exists then transparently forward the request to it.
        if (resolvedLink) return resolvedLink.request(operation, forward);
        else return new Observable(observer => {
            let handle: SingleUseSubscription = new SingleUseSubscription();
            deferredLink
                .then(fulfilled => handle.set(fulfilled.request(operation, forward).subscribe(observer)))
                .catch(error => observer.error(error));

            // Allows the subscription to be cancelled appropriately
            return () => handle && handle.unsubscribe();
        });
    }
}

/**
 * Simple helper method for determining if the input is a Observable
 * @param {any | Observable<T>} value
 */
export function isObservable<T>(value: any | Observable<T>): value is Observable<T> {
    return value && typeof (<any>value).subscribe === 'function' && typeof (value as any).then !== 'function';
}

export function isSubscription(value: any | ZenObservable.Subscription): value is ZenObservable.Subscription {
    return value && typeof (<any>value).unsubscribe === 'function';
}

export class SingleUseSubscription implements ZenObservable.Subscription {
    public closed: boolean = false;
    private underlying: ZenObservable.Subscription;

    public unsubscribe(): void {
        const {closed, underlying} = this;
        if (!closed) {
          if (underlying) underlying.unsubscribe();
          this.closed = true;
        }
    }

    public set(subscription: ZenObservable.Subscription | (() => void)): void {
        const {underlying, closed} = this;

        let newSubscription: ZenObservable.Subscription;
        if (isSubscription(subscription)) {
            newSubscription = subscription;
        } else {
            newSubscription = {unsubscribe: subscription} as ZenObservable.Subscription
        }

        if (underlying) underlying.unsubscribe();

        if (closed) {
            newSubscription.unsubscribe();
            newSubscription = null;
        }

        this.underlying = newSubscription;
    }
}


import {ApolloLink, FetchResult, NextLink, Observable, Operation, toPromise} from 'apollo-link'
import ZenObservable from 'zen-observable'

export type DeferredLinkFn = () => Promise<ApolloLink>;
export type FutureLink = Promise<ApolloLink> | Observable<ApolloLink> | DeferredLinkFn;
export type LinkResolver = (resolveLink: FutureLink) => ApolloLink;

/**
 * Waits for the link resolver to complete before it starts passing requests to the underlying link
 */
export const deferLink: LinkResolver = (resolveLink: FutureLink) => {
  let linkFn: DeferredLinkFn;
  let lazy: boolean = false;
  if (isObservable(resolveLink)) {
    linkFn = () => toPromise(resolveLink);
  } else if (isNullaryFunction(resolveLink)) {
    linkFn = resolveLink;
    lazy = true;
  } else {
    linkFn = () => resolveLink
  }

  return new DeferLink(linkFn, lazy);
};

class DeferLink extends ApolloLink {
  private resolvedLink: ApolloLink;
  private promise: Promise<ApolloLink>;

  constructor(private deferredLink: DeferredLinkFn, private lazy: boolean) {
    super();

    // Allow this to resolve at some point in the future.
    if (!this.lazy) {
      this.promise = this._execute();
    }
  }

  public request(operation: Operation, forward?: NextLink): Observable<FetchResult> | null {
    const {resolvedLink, promise} = this;
    // If the real link exists then transparently forward the request to it.
    if (resolvedLink) return resolvedLink.request(operation, forward);
    // Handle if the link was lazily executed
    if (!promise) this.promise = this._execute();

    return new Observable(observer => {
      let handle: SingleUseSubscription = new SingleUseSubscription();

      this.promise
        .then(fulfilled => handle.set(fulfilled.request(operation, forward).subscribe(observer)))
        .catch(error => observer.error(error));

      // Allows the subscription to be cancelled appropriately
      return () => handle && handle.unsubscribe();
    });
  }

  private _execute(): Promise<ApolloLink> {
    return this.deferredLink()
      .then(link => this.resolvedLink = link);
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

function isNullaryFunction(value: any): value is Function {
  return value && typeof (value) === 'function';
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


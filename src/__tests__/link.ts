import {ApolloLink} from "apollo-link";
import {testLinkResults} from '../test-utils/test-utils';
import * as Observable from "zen-observable";
import {deferLink} from "../link";

jest.useFakeTimers();

describe('Defer', () => {
    it('should defer the request until the link has loaded', (done) => {
        const futureLink = new Promise<ApolloLink>((resolve) => {
            setTimeout(() =>
                resolve(new ApolloLink((request, forward) => Observable.of({data: {count: 1}}))),
                100
            )
        });

        const link = deferLink(futureLink);

        testLinkResults({link, done, results: [{count: 1}]});

        jest.advanceTimersByTime(200);
    });

    it('should fail requests if the link fails to load', (done) => {
        const error = new Error('Something amiss');
        const futureFailedLink = Promise.reject(error);
        testLinkResults({
            link: deferLink(futureFailedLink),
            results: [error],
            done
        })
    })
});

import matchCosmeticFilter from '../src/matching/cosmetics';
import matchNetworkFilter, { isAnchoredByHostname } from '../src/matching/network';

import { f } from '../src/parsing/list';
import { parseNetworkFilter } from '../src/parsing/network-filter';
import { processRawRequest } from '../src/request/raw';

import requests from './data/requests';

// TODO add tests with positive match in parameters, fragment, etc. (all
// possible parts of a URL).

// Extend jest Matchers with our custom `toMatchRequest` and `toMatchHostname`
declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchRequest: (arg: any) => object;
      toMatchHostname: (arg: any) => object;
    }
  }
}

expect.extend({
  toMatchRequest(filter, request) {
    const processedRequest = processRawRequest({
      cpt: 2,
      sourceUrl: '',
      url: '',
      ...request,
    });
    const match = matchNetworkFilter(filter, processedRequest);
    if (match) {
      return {
        message: () => `expected ${filter.toString()} to not match ${JSON.stringify(processedRequest)}`,
        pass: true,
      };
    }

    return {
      message: () => `expected ${filter.toString()} to match ${JSON.stringify(processedRequest)}`,
      pass: false,
    };
  },
  toMatchHostname(filter, hostname) {
    const match = matchCosmeticFilter(filter, hostname);
    if (match) {
      return {
        message: () => `expected ${filter.toString()} to not match ${hostname}`,
        pass: true,
      };
    }

    return {
      message: () => `expected ${filter.toString()} to match ${hostname}`,
      pass: false,
    };
  },
});

// TODO - put that in utils
interface Dict {
  [s: string]: number;
}

const types: Dict = {
  // maps string (web-ext) to int (FF cpt)
  beacon: 19,
  csp_report: 17,
  font: 14,
  image: 3,
  imageset: 21,
  main_frame: 6,
  media: 15,
  object: 5,
  object_subrequest: 12,
  other: 1,
  ping: 10,
  script: 2,
  stylesheet: 4,
  sub_frame: 7,
  web_manifest: 22,
  websocket: 16,
  xbl: 9,
  xml_dtd: 13,
  xmlhttprequest: 11,
  xslt: 18,
};

describe('#isAnchoredByHostname', () => {
  it('matches empty hostname', () => {
    expect(isAnchoredByHostname('', 'foo.com')).toBeTruthy();
  });

  it('does not match when filter hostname is longer than hostname', () => {
    expect(isAnchoredByHostname('bar.foo.com', 'foo.com')).toBeFalsy();
    expect(isAnchoredByHostname('b', '')).toBeFalsy();
    expect(isAnchoredByHostname('foo.com', 'foo.co')).toBeFalsy();
  });

  it('does not match if there is not match', () => {
    expect(isAnchoredByHostname('bar', 'foo.com')).toBeFalsy();
  });

  describe('prefix match', () => {
    it('matches exact match', () => {
      expect(isAnchoredByHostname('', '')).toBeTruthy();
      expect(isAnchoredByHostname('f', 'f')).toBeTruthy();
      expect(isAnchoredByHostname('foo', 'foo')).toBeTruthy();
      expect(isAnchoredByHostname('foo.com', 'foo.com')).toBeTruthy();
      expect(isAnchoredByHostname('.com', '.com')).toBeTruthy();
      expect(isAnchoredByHostname('com.', 'com.')).toBeTruthy();
    });

    it('matches partial', () => {
      // Single label
      expect(isAnchoredByHostname('foo', 'foo.com')).toBeTruthy();
      expect(isAnchoredByHostname('foo.', 'foo.com')).toBeTruthy();
      expect(isAnchoredByHostname('.foo', '.foo.com')).toBeTruthy();
      expect(isAnchoredByHostname('.foo.', '.foo.com')).toBeTruthy();

      // Multiple labels
      expect(isAnchoredByHostname('foo.com', 'foo.com.')).toBeTruthy();
      expect(isAnchoredByHostname('foo.com.', 'foo.com.')).toBeTruthy();
      expect(isAnchoredByHostname('.foo.com.', '.foo.com.')).toBeTruthy();
      expect(isAnchoredByHostname('.foo.com', '.foo.com')).toBeTruthy();

      expect(isAnchoredByHostname('foo.bar', 'foo.bar.com')).toBeTruthy();
      expect(isAnchoredByHostname('foo.bar.', 'foo.bar.com')).toBeTruthy();
    });

    it('does not match partial prefix', () => {
      // Single label
      expect(isAnchoredByHostname('foo', 'foobar.com')).toBeFalsy();
      expect(isAnchoredByHostname('fo', 'foo.com')).toBeFalsy();
      expect(isAnchoredByHostname('.foo', 'foobar.com')).toBeFalsy();

      // Multiple labels
      expect(isAnchoredByHostname('foo.bar', 'foo.barbaz.com')).toBeFalsy();
      expect(isAnchoredByHostname('.foo.bar', '.foo.barbaz.com')).toBeFalsy();
    });
  });

  describe('suffix match', () => {
    it('matches partial', () => {
      // Single label
      expect(isAnchoredByHostname('com', 'foo.com')).toBeTruthy();
      expect(isAnchoredByHostname('.com', 'foo.com')).toBeTruthy();
      expect(isAnchoredByHostname('.com.', 'foo.com.')).toBeTruthy();
      expect(isAnchoredByHostname('com.', 'foo.com.')).toBeTruthy();

      // Multiple labels
      expect(isAnchoredByHostname('foo.com.', '.foo.com.')).toBeTruthy();
      expect(isAnchoredByHostname('foo.com', '.foo.com')).toBeTruthy();
    });

    it('does not match partial', () => {
      // Single label
      expect(isAnchoredByHostname('om', 'foo.com')).toBeFalsy();
      expect(isAnchoredByHostname('com', 'foocom')).toBeFalsy();

      // Multiple labels
      expect(isAnchoredByHostname('foo.bar.com', 'baz.bar.com')).toBeFalsy();
      expect(isAnchoredByHostname('fo.bar.com', 'foo.bar.com')).toBeFalsy();
      expect(isAnchoredByHostname('.fo.bar.com', 'foo.bar.com')).toBeFalsy();
      expect(isAnchoredByHostname('bar.com', 'foobar.com')).toBeFalsy();
      expect(isAnchoredByHostname('.bar.com', 'foobar.com')).toBeFalsy();
    });
  });

  describe('infix match', () => {
    it('matches partial', () => {
      expect(isAnchoredByHostname('bar', 'foo.bar.com')).toBeTruthy();
      expect(isAnchoredByHostname('bar.', 'foo.bar.com')).toBeTruthy();
      expect(isAnchoredByHostname('.bar.', 'foo.bar.com')).toBeTruthy();
    });
  });
});

describe('#matchNetworkFilter', () => {
  requests.forEach(({ filter, exception, cpt, sourceUrl, url }) => {
    it(`${filter}, ${exception}, ${cpt}, ${url}, ${sourceUrl}`, () => {
      let networkFilter;
      if (filter !== undefined) {
        networkFilter = parseNetworkFilter(filter);
      } else if (exception !== undefined) {
        networkFilter = parseNetworkFilter(exception);
      }

      expect(networkFilter).not.toBeUndefined();
      expect(networkFilter).not.toBeNull();
      expect(networkFilter).toMatchRequest({
        cpt: types[cpt],
        sourceUrl,
        url,
      });
    });
  });

  it('pattern', () => {
    expect(f`foo`).toMatchRequest({ url: 'https://bar.com/foo' });
    expect(f`foo`).toMatchRequest({ url: 'https://bar.com/baz/foo' });
    expect(f`foo`).toMatchRequest({ url: 'https://bar.com/q=foo/baz' });
    expect(f`foo`).toMatchRequest({ url: 'https://foo.com' });
    expect(f`-foo-`).toMatchRequest({ url: 'https://bar.com/baz/42-foo-q' });
    expect(f`&fo.o=+_-`).toMatchRequest({ url: 'https://bar.com?baz=42&fo.o=+_-' });
    expect(f`foo/bar/baz`).toMatchRequest({ url: 'https://bar.com/foo/bar/baz' });
    expect(f`com/bar/baz`).toMatchRequest({ url: 'https://bar.com/bar/baz' });
    expect(f`https://bar.com/bar/baz`).toMatchRequest({ url: 'https://bar.com/bar/baz' });
  });

  it('pattern$fuzzy', () => {
    expect(f`foo$fuzzy`).toMatchRequest({ url: 'https://bar.com/foo' });
    expect(f`foo$fuzzy`).toMatchRequest({ url: 'https://bar.com/foo/baz' });
    expect(f`foo/bar$fuzzy`).toMatchRequest({ url: 'https://bar.com/foo/baz' });
    expect(f`foo bar$fuzzy`).toMatchRequest({ url: 'https://bar.com/foo/baz' });
    expect(f`foo bar baz$fuzzy`).toMatchRequest({ url: 'http://bar.foo.baz' });

    expect(f`foo bar baz 42$fuzzy`).not.toMatchRequest({ url: 'http://bar.foo.baz' });
  });

  it('||pattern', () => {
    expect(f`||foo.com`).toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||foo.com/bar`).toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||foo`).toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||foo`).toMatchRequest({ url: 'https://baz.foo.com/bar' });
    expect(f`||foo`).toMatchRequest({ url: 'https://foo.baz.com/bar' });
    expect(f`||foo.baz`).toMatchRequest({ url: 'https://foo.baz.com/bar' });
    expect(f`||foo.baz.`).toMatchRequest({ url: 'https://foo.baz.com/bar' });

    expect(f`||foo`).not.toMatchRequest({ url: 'https://baz.com' });
    expect(f`||foo`).not.toMatchRequest({ url: 'https://foo-bar.baz.com/bar' });
    expect(f`||foo.com`).not.toMatchRequest({ url: 'https://foo.de' });
    expect(f`||foo.com`).not.toMatchRequest({ url: 'https://bar.foo.de' });
  });

  it('||pattern$fuzzy', () => {
    expect(f`||bar.foo/baz$fuzzy`).toMatchRequest({ url: 'http://bar.foo/baz' });
    expect(f`||bar.foo/baz$fuzzy`).toMatchRequest({ url: 'http://bar.foo/id/baz' });
    expect(f`||bar.foo/baz$fuzzy`).toMatchRequest({ url: 'http://bar.foo?id=42&baz=1' });
    expect(f`||foo.com/id bar$fuzzy`).toMatchRequest({ url: 'http://foo.com?bar&id=42' });

    expect(f`||bar.com/id bar$fuzzy`).not.toMatchRequest({ url: 'http://foo.com?bar&id=42' });
    expect(f`||bar.com/id bar baz foo 42 id$fuzzy`).not.toMatchRequest({ url: 'http://foo.com?bar&id=42' });
  });

  it('||pattern|', () => {
    expect(f`||foo.com|`).toMatchRequest({ url: 'https://foo.com' });
    expect(f`||foo.com/bar|`).toMatchRequest({ url: 'https://foo.com/bar' });

    expect(f`||foo.com/bar|`).not.toMatchRequest({ url: 'https://foo.com/bar/baz' });
    expect(f`||foo.com/bar|`).not.toMatchRequest({ url: 'https://foo.com/' });
    expect(f`||bar.com/bar|`).not.toMatchRequest({ url: 'https://foo.com/' });
  });

  it('pattern|', () => {
    expect(f`foo.com`).toMatchRequest({ url: 'https://foo.com' });
    expect(f`foo|`).toMatchRequest({ url: 'https://bar.com/foo' });
    expect(f`foo|`).not.toMatchRequest({ url: 'https://bar.com/foo/' });
    expect(f`foo|`).not.toMatchRequest({ url: 'https://bar.com/foo/baz' });
  });

  it('|pattern', () => {
    expect(f`|http`).toMatchRequest({ url: 'http://foo.com' });
    expect(f`|http`).toMatchRequest({ url: 'https://foo.com' });
    expect(f`|https://`).toMatchRequest({ url: 'https://foo.com' });

    expect(f`https`).not.toMatchRequest({ url: 'http://foo.com' });
  });

  it('|pattern|', () => {
    expect(f`|https://foo.com|`).toMatchRequest({ url: 'https://foo.com' });
  });

  it('||hostname^*/pattern', () => {
    expect(f`||foo.com^*/bar`).not.toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||com^*/bar`).not.toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||foo^*/bar`).not.toMatchRequest({ url: 'https://foo.com/bar' });

    // @see https://github.com/cliqz-oss/adblocker/issues/29
    expect(f`||foo.co^aaa/`).not.toMatchRequest({ url: 'https://bar.foo.com/bbb/aaa/' });
    // Not sure if this one should fail. It could be expected that the regexp
    // part could match anywhere in the URL.
    // expect(f`||foo.com^aaa/`).not.toMatchRequest({ url: 'https://bar.foo.com/bbb/aaa/' });

    expect(f`||com*^bar`).toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||foo.com^bar`).toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||com^bar`).toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||foo*^bar`).toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||foo*/bar`).toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||foo*com/bar`).toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||foo*com*/bar`).toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||foo*com*^bar`).toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||*foo*com*^bar`).toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||*/bar`).toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||*^bar`).toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||*com/bar`).toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||*.com/bar`).toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||*foo.com/bar`).toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||*com/bar`).toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||*com*/bar`).toMatchRequest({ url: 'https://foo.com/bar' });
    expect(f`||*com*^bar`).toMatchRequest({ url: 'https://foo.com/bar' });
  });

  it('options', () => {
    // cpt test
    expect(f`||foo$image`).toMatchRequest({ url: 'https://foo.com/bar', cpt: types.image });
    expect(f`||foo$image`).not.toMatchRequest({ url: 'https://foo.com/bar', cpt: types.script });
    expect(f`||foo$~image`).toMatchRequest({ url: 'https://foo.com/bar', cpt: types.script });

    // ~third-party
    expect(f`||foo$~third-party`).toMatchRequest({ url: 'https://foo.com/bar', sourceUrl: 'http://baz.foo.com' });
    expect(f`||foo$~third-party`).not.toMatchRequest({ url: 'https://foo.com/bar', sourceUrl: 'http://baz.bar.com' });

    // ~first-party
    expect(f`||foo$~first-party`).toMatchRequest({ url: 'https://foo.com/bar', sourceUrl: 'http://baz.bar.com' });
    expect(f`||foo$~first-party`).not.toMatchRequest({ url: 'https://foo.com/bar', sourceUrl: 'http://baz.foo.com' });

    // opt-domain
    expect(f`||foo$domain=foo.com`).toMatchRequest({ url: 'https://foo.com/bar', sourceUrl: 'http://foo.com' });
    expect(f`||foo$domain=foo.com`).not.toMatchRequest({ url: 'https://foo.com/bar', sourceUrl: 'http://bar.com' });

    // opt-not-domain
    expect(f`||foo$domain=~bar.com`).toMatchRequest({ url: 'https://foo.com/bar', sourceUrl: 'http://foo.com' });
    expect(f`||foo$domain=~bar.com`).not.toMatchRequest({ url: 'https://foo.com/bar', sourceUrl: 'http://bar.com' });
  });
});

describe('#matchCosmeticFilter', () => {
  it('single domain', () => {
    expect(f`foo.com##.selector`).toMatchHostname('foo.com');
  });

  it('multiple domains', () => {
    expect(f`foo.com,test.com##.selector`).toMatchHostname('foo.com');
    expect(f`foo.com,test.com##.selector`).toMatchHostname('test.com');
  });

  it('subdomain', () => {
    expect(f`foo.com,test.com##.selector`).toMatchHostname('sub.test.com');
    expect(f`foo.com,sub.test.com##.selector`).toMatchHostname('sub.test.com');
  });

  it('entity', () => {
    expect(f`foo.com,sub.test.*##.selector`).toMatchHostname('sub.test.com');
    expect(f`foo.com,sub.test.*##.selector`).toMatchHostname('sub.test.fr');
    expect(f`foo.*##.selector`).toMatchHostname('foo.co.uk');
  });

  it('does not match', () => {
    expect(f`foo.*##.selector`).not.toMatchHostname('foo.bar.com');
    expect(f`foo.*##.selector`).not.toMatchHostname('bar-foo.com');
  });
});

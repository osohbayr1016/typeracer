import { describe, expect, it } from 'vitest';
import { authorizedCosmetic, CAR_IDS } from './catalog';

describe('authoritative multiplayer cosmetic entitlements', () => {
  it('allows only free starters without receipts or earned XP', () => {
    for (const id of ['mint','sunset','purple'])
      expect(authorizedCosmetic('car',id,[])).toBe(true);
    for (const id of CAR_IDS.filter(v=>!['mint','sunset','purple'].includes(v)))
      expect(authorizedCosmetic('car',id,[])).toBe(false);
    for (const [kind,id] of [['trail','none'],['sticker','none'],['title','rookie']])
      expect(authorizedCosmetic(kind,id,[])).toBe(true);
    expect(authorizedCosmetic('trail','gold',[])).toBe(false);
    expect(authorizedCosmetic('title','supporter',[])).toBe(false);
  });
  it('honors XP thresholds but never browser-local claimed shop IDs', () => {
    expect(authorizedCosmetic('car','lime',[],249)).toBe(false);
    expect(authorizedCosmetic('car','lime',[],250)).toBe(true);
    expect(authorizedCosmetic('car','phantom',[],649)).toBe(false);
    expect(authorizedCosmetic('car','phantom',[],650)).toBe(true);
    expect(authorizedCosmetic('car','dragon',[],100000)).toBe(false);
    expect(authorizedCosmetic('car','dragon',['car:dragon'],0)).toBe(true);
    expect(authorizedCosmetic('car','not-a-car',['car:not-a-car'])).toBe(false);
    expect(authorizedCosmetic('trail','gold',['trail:gold'])).toBe(true);
    expect(authorizedCosmetic('title','supporter',['title:supporter'])).toBe(true);
    expect(authorizedCosmetic('sticker','crown',['sticker:crown'])).toBe(true);
    expect(authorizedCosmetic('__proto__','none',[])).toBe(false);
  });
});

describe('canonical car ownership parity', () => {
  it('requires an earned/paid receipt for every non-free shop car', () => {
    for (const id of CAR_IDS.filter(id=>!['mint','sunset','purple','lime','phantom'].includes(id))) {
      expect(authorizedCosmetic('car',id,[])).toBe(false);
      expect(authorizedCosmetic('car',id,['car:'+id])).toBe(true);
    }
  });
});

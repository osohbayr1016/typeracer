import { describe, expect, it } from 'vitest';
import { starterProfile } from './progression';
import { emptyWallet, withPaidInventory } from './payments';

describe('paid appearance across browser account changes', () => {
  it('removes paid-exclusive client claims until the server confirms ownership', () => {
    const profile={...starterProfile(),owned:['trail:gold','title:supporter','sticker:crown','trail:ember'],
      trail:'gold' as const,title:'supporter' as const,sticker:'crown' as const};
    const guest=withPaidInventory(profile,emptyWallet());
    expect(guest).toMatchObject({trail:'none',title:'rookie',sticker:'none',owned:['trail:ember']});
    const paid=withPaidInventory(profile,{...emptyWallet(),owned:['trail:gold','title:supporter','sticker:crown']});
    expect(paid).toMatchObject({trail:'gold',title:'supporter',sticker:'crown'});
  });
});

import { describe, expect, it } from 'vitest';
import { navActive } from './SiteNavigation';

describe('single active navigation context',()=>{
  it('keeps live, solo and results under Play instead of adding extra nav links',()=>{
    for(const p of ['play','race','results','quickRace','quickResults']){
      expect(navActive(p,'play')).toBe(true);
      expect(navActive(p,'friends')).toBe(false);
    }
  });
  it('groups private rooms with friends and keeps leaderboard, garage and profile distinct',()=>{
    for(const p of ['friends','multiplayer','multiplayerRace'])
      expect(navActive(p,'friends')).toBe(true);
    expect(navActive('leaderboard','leaderboard')).toBe(true);
    expect(navActive('garage','garage')).toBe(true);
    expect(navActive('profile','profile')).toBe(true);
    expect(navActive('shop','garage')).toBe(false);
  });
});

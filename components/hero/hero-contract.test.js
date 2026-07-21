/**
 * @fileoverview Unit tests for hero-contract.js
 *
 * All tested functions are pure — no DOM, no event-bus, no SQLite needed.
 * Run with:  npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    TILE, ROWS, COLS, LOG_MAX,
    rng, randomItem, newHero, buildLevel,
    addLogEntry, applyLevelUp,
    reduceMove, reduceAttack, reduceMonsterTurn, reduceFlee, reduceNewGame,
} from './hero-contract.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeState(overrides = {}) {
    return {
        hero:   newHero(),
        floor:  1,
        grid:   buildLevel(1),
        player: { row: 1, col: 1 },
        combat: null,
        log:    [],
        ...overrides,
    };
}

function makeCombat(monsterOverrides = {}) {
    return {
        row: 2, col: 1,
        monster: {
            name: 'Goblin', hp: 10, maxHp: 10,
            attack: 4, defense: 1, xpValue: 5, goldValue: 3,
            ...monsterOverrides,
        },
        turn: 'player',
    };
}

// ── rng ───────────────────────────────────────────────────────────────────────

describe('rng', () => {
    it('returns an integer within [min, max]', () => {
        for (let i = 0; i < 200; i++) {
            const v = rng(3, 7);
            expect(v).toBeGreaterThanOrEqual(3);
            expect(v).toBeLessThanOrEqual(7);
            expect(Number.isInteger(v)).toBe(true);
        }
    });

    it('handles min === max', () => {
        expect(rng(5, 5)).toBe(5);
    });
});

// ── newHero ───────────────────────────────────────────────────────────────────

describe('newHero', () => {
    it('returns level 1 hero with expected starting stats', () => {
        const hero = newHero();
        expect(hero.level).toBe(1);
        expect(hero.hp).toBe(hero.maxHp);
        expect(hero.xp).toBe(0);
        expect(hero.gold).toBe(0);
        expect(hero.inventory).toEqual([]);
    });
});

// ── buildLevel ────────────────────────────────────────────────────────────────

describe('buildLevel', () => {
    it('returns a 10×10 grid', () => {
        const grid = buildLevel(1);
        expect(grid).toHaveLength(ROWS);
        grid.forEach(row => expect(row).toHaveLength(COLS));
    });

    it('borders are all walls', () => {
        const grid = buildLevel(1);
        for (let c = 0; c < COLS; c++) {
            expect(grid[0][c].type).toBe(TILE.WALL);
            expect(grid[ROWS - 1][c].type).toBe(TILE.WALL);
        }
        for (let r = 0; r < ROWS; r++) {
            expect(grid[r][0].type).toBe(TILE.WALL);
            expect(grid[r][COLS - 1].type).toBe(TILE.WALL);
        }
    });

    it('spawn cell [1][1] is always floor', () => {
        for (let i = 0; i < 20; i++) {
            expect(buildLevel(1)[1][1].type).toBe(TILE.FLOOR);
        }
    });

    it('contains at least one exit', () => {
        const flat = buildLevel(1).flat();
        expect(flat.some(t => t.type === TILE.EXIT)).toBe(true);
    });

    it('monster tiles carry stats', () => {
        const flat = buildLevel(1).flat();
        const monsters = flat.filter(t => t.type === TILE.MONSTER);
        expect(monsters.length).toBeGreaterThan(0);
        monsters.forEach(t => {
            expect(t.monster).not.toBeNull();
            expect(t.monster.hp).toBeGreaterThan(0);
        });
    });
});

// ── addLogEntry ───────────────────────────────────────────────────────────────

describe('addLogEntry', () => {
    it('prepends the message', () => {
        const log = ['old'];
        const out = addLogEntry(log, 'new');
        expect(out[0]).toBe('new');
        expect(out[1]).toBe('old');
    });

    it('caps at LOG_MAX', () => {
        let log = Array.from({ length: LOG_MAX }, (_, i) => `msg${i}`);
        log = addLogEntry(log, 'overflow');
        expect(log).toHaveLength(LOG_MAX);
        expect(log[0]).toBe('overflow');
    });

    it('does not mutate the original array', () => {
        const original = ['a'];
        addLogEntry(original, 'b');
        expect(original).toHaveLength(1);
    });
});

// ── applyLevelUp ─────────────────────────────────────────────────────────────

describe('applyLevelUp', () => {
    it('no-ops when XP is below threshold', () => {
        const hero = { ...newHero(), xp: 5, xpNext: 10 };
        const { hero: out, log } = applyLevelUp(hero, []);
        expect(out.level).toBe(1);
        expect(log).toHaveLength(0);
    });

    it('levels up when xp >= xpNext', () => {
        const hero = { ...newHero(), xp: 10, xpNext: 10 };
        const { hero: out, log } = applyLevelUp(hero, []);
        expect(out.level).toBe(2);
        expect(out.attack).toBe(7);
        expect(out.defense).toBe(3);
        expect(out.hp).toBe(out.maxHp);
        expect(log[0]).toContain('LEVEL UP');
    });

    it('handles multiple consecutive level-ups', () => {
        const hero = { ...newHero(), xp: 100, xpNext: 10 };
        const { hero: out } = applyLevelUp(hero, []);
        expect(out.level).toBeGreaterThan(2);
    });
});

// ── reduceMove ────────────────────────────────────────────────────────────────

describe('reduceMove', () => {
    it('no-ops when combat is active', () => {
        const state = makeState({ combat: makeCombat() });
        const out   = reduceMove(state, { dr: 0, dc: 1 });
        expect(out).toBe(state);
    });

    it('no-ops when target is out of bounds', () => {
        const state = makeState({ player: { row: 0, col: 0 } });
        expect(reduceMove(state, { dr: -1, dc: 0 })).toBe(state);
    });

    it('no-ops when target is a wall', () => {
        const state = makeState();
        // row 0 is always a wall
        const moved = reduceMove({ ...state, player: { row: 1, col: 1 } }, { dr: -1, dc: 0 });
        expect(moved.player).toEqual({ row: 1, col: 1 });
    });

    it('moves player to floor tile', () => {
        const state = makeState();
        // Place a guaranteed floor tile adjacent to [1][1]
        state.grid[1][2] = { type: TILE.FLOOR, monster: null };
        const out = reduceMove(state, { dr: 0, dc: 1 });
        expect(out.player).toEqual({ row: 1, col: 2 });
    });

    it('entering monster tile starts combat, player does not move', () => {
        const state = makeState();
        state.grid[1][2] = { type: TILE.MONSTER, monster: { name: 'Goblin', hp: 5, maxHp: 5, attack: 3, defense: 1, xpValue: 3, goldValue: 2 } };
        const out = reduceMove(state, { dr: 0, dc: 1 });
        expect(out.combat).not.toBeNull();
        expect(out.combat.monster.name).toBe('Goblin');
        expect(out.player).toEqual({ row: 1, col: 1 }); // did not move
        expect(out.log[0]).toContain('encounter');
    });

    it('chest grants gold and item, tile becomes floor', () => {
        const state = makeState();
        state.grid[1][2] = { type: TILE.CHEST, monster: null };
        const out = reduceMove(state, { dr: 0, dc: 1 });
        expect(out.hero.gold).toBeGreaterThan(0);
        expect(out.hero.inventory).toHaveLength(1);
        expect(out.grid[1][2].type).toBe(TILE.FLOOR);
        expect(out.log[0]).toContain('Found');
    });

    it('potion restores HP, tile becomes floor', () => {
        const state = makeState({ hero: { ...newHero(), hp: 5, maxHp: 20 } });
        state.grid[1][2] = { type: TILE.POTION, monster: null };
        const out = reduceMove(state, { dr: 0, dc: 1 });
        expect(out.hero.hp).toBeGreaterThan(5);
        expect(out.grid[1][2].type).toBe(TILE.FLOOR);
        expect(out.log[0]).toContain('potion');
    });

    it('exit increments floor, resets position, builds new grid', () => {
        const state = makeState();
        state.grid[1][2] = { type: TILE.EXIT, monster: null };
        const out = reduceMove(state, { dr: 0, dc: 1 });
        expect(out.floor).toBe(2);
        expect(out.player).toEqual({ row: 1, col: 1 });
        expect(out.grid).not.toBe(state.grid);
        expect(out.log[0]).toContain('Floor 2');
    });

    it('does not mutate the original state', () => {
        const state = makeState();
        state.grid[1][2] = { type: TILE.FLOOR, monster: null };
        const originalPlayer = { ...state.player };
        reduceMove(state, { dr: 0, dc: 1 });
        expect(state.player).toEqual(originalPlayer);
    });
});

// ── reduceMonsterTurn ─────────────────────────────────────────────────────────

describe('reduceMonsterTurn', () => {
    it('no-ops when combat is null', () => {
        const state = makeState();
        expect(reduceMonsterTurn(state)).toBe(state);
    });

    it('deals damage to hero', () => {
        const state = makeState({ combat: makeCombat(), hero: { ...newHero(), hp: 20 } });
        const out   = reduceMonsterTurn(state);
        expect(out.hero.hp).toBeLessThanOrEqual(20);
    });

    it('hero slain when hp reaches 0', () => {
        const state = makeState({
            hero:   { ...newHero(), hp: 1, defense: 0 },
            combat: makeCombat({ attack: 100 }),
        });
        const out = reduceMonsterTurn(state);
        expect(out.hero.hp).toBe(0);
        expect(out.combat).toBeNull();
        expect(out.log[0]).toContain('slain');
    });

    it('returns turn to player when hero survives', () => {
        const state = makeState({
            hero:   { ...newHero(), hp: 20, defense: 100 }, // immune
            combat: makeCombat({ turn: 'monster' }),
        });
        const out = reduceMonsterTurn(state);
        expect(out.combat.turn).toBe('player');
    });
});

// ── reduceAttack ──────────────────────────────────────────────────────────────

describe('reduceAttack', () => {
    it('no-ops when combat is null', () => {
        const state = makeState();
        expect(reduceAttack(state)).toBe(state);
    });

    it('no-ops when it is not the player turn', () => {
        const state = makeState({ combat: { ...makeCombat(), turn: 'monster' } });
        expect(reduceAttack(state)).toBe(state);
    });

    it('deals damage to the monster', () => {
        const state = makeState({ combat: makeCombat({ hp: 100, defense: 0 }) });
        const out   = reduceAttack(state);
        const monsterHp = out.combat ? out.combat.monster.hp : 0;
        expect(monsterHp).toBeLessThan(100);
    });

    it('killing the monster clears combat and awards XP/gold', () => {
        const state = makeState({
            hero:   { ...newHero(), attack: 100 },
            combat: makeCombat({ hp: 1, xpValue: 10, goldValue: 5 }),
        });
        const out = reduceAttack(state);
        expect(out.combat).toBeNull();
        expect(out.hero.xp).toBeGreaterThanOrEqual(10);
        expect(out.hero.gold).toBeGreaterThanOrEqual(5);
    });

    it('killing a monster clears the tile on the grid', () => {
        const combat = makeCombat({ hp: 1 });
        const state  = makeState({ combat, hero: { ...newHero(), attack: 100 } });
        state.grid[combat.row][combat.col] = { type: TILE.MONSTER, monster: combat.monster };
        const out = reduceAttack(state);
        expect(out.grid[combat.row][combat.col].type).toBe(TILE.FLOOR);
    });

    it('surviving monster triggers a monster turn', () => {
        // Give hero near-zero attack and monster high defense so it survives
        const state = makeState({
            hero:   { ...newHero(), attack: 1, hp: 20, defense: 100 }, // immune to monster return hit
            combat: makeCombat({ hp: 100, defense: 99 }),
        });
        const out = reduceAttack(state);
        // After player attacked (monster survived), monster hit back → combat.turn should be 'player' again
        expect(out.combat?.turn).toBe('player');
    });
});

// ── reduceFlee ────────────────────────────────────────────────────────────────

describe('reduceFlee', () => {
    it('no-ops when combat is null', () => {
        const state = makeState();
        expect(reduceFlee(state)).toBe(state);
    });

    it('no-ops when it is not the player turn', () => {
        const state = makeState({ combat: { ...makeCombat(), turn: 'monster' } });
        expect(reduceFlee(state)).toBe(state);
    });

    it('clears combat on successful flee', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.5 → success
        const state = makeState({ combat: makeCombat() });
        const out   = reduceFlee(state);
        expect(out.combat).toBeNull();
        expect(out.log[0]).toContain('Fled');
        vi.restoreAllMocks();
    });

    it('keeps combat active on failed flee (monster counter-attacks)', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.9); // >= 0.5 → failure
        const state = makeState({
            hero:   { ...newHero(), hp: 20, defense: 100 }, // immune to return hit
            combat: makeCombat(),
        });
        const out = reduceFlee(state);
        // Combat continues (monster hit back, turn returned to player)
        expect(out.combat).not.toBeNull();
        expect(out.log[0]).toContain('Flee failed') || expect(out.log[0]).toContain('hits you');
        vi.restoreAllMocks();
    });
});

// ── reduceNewGame ─────────────────────────────────────────────────────────────

describe('reduceNewGame', () => {
    it('returns floor 1, player at [1][1], no combat', () => {
        const state = reduceNewGame();
        expect(state.floor).toBe(1);
        expect(state.player).toEqual({ row: 1, col: 1 });
        expect(state.combat).toBeNull();
    });

    it('initialises log with the opening message', () => {
        const state = reduceNewGame();
        expect(state.log).toHaveLength(1);
        expect(state.log[0]).toContain('quest begins');
    });

    it('hero starts at level 1', () => {
        expect(reduceNewGame().hero.level).toBe(1);
    });

    it('returns a distinct state on each call', () => {
        const a = reduceNewGame();
        const b = reduceNewGame();
        expect(a).not.toBe(b);
        expect(a.hero).not.toBe(b.hero);
    });
});

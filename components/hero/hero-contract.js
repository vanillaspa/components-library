/**
 * @fileoverview Hero Quest — Event-Bus Contract
 *
 * This file is the single source of truth for the Hero Quest game protocol.
 * Read it top-to-bottom as a rules handbook.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMMANDS  (dispatched BY UI components, consumed BY hero-quest engine)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  hero:move     { dr: number, dc: number }
 *    Move the player one tile in direction (dr, dc).
 *    Silently ignored when combat is active.
 *
 *  hero:attack   {}
 *    Player attacks the current combat target.
 *    Silently ignored when it is not the player's turn.
 *
 *  hero:flee     {}
 *    Player attempts to flee combat (50 % success).
 *    On failure the monster gets a free counter-attack.
 *
 *  hero:newgame  {}
 *    Reset all state and start a fresh game.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTIFICATIONS  (dispatched BY hero-quest engine, consumed BY UI components)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  hero:state  { hero, floor, grid, player, combat }
 *    Broadcast after every state mutation.
 *    hero    — { name, level, hp, maxHp, attack, defense, xp, xpNext, gold, inventory }
 *    floor   — current dungeon floor number (number)
 *    grid    — 10×10 array of Tile objects (Tile[][])
 *    player  — { row: number, col: number }
 *    combat  — { row, col, monster, turn: 'player'|'monster' } | null
 *
 *  hero:log    { log: string[] }
 *    Broadcast when a new log entry is added.
 *    log — array of messages, newest first, capped at LOG_MAX entries.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TILE TYPES
 * ─────────────────────────────────────────────────────────────────────────────
 *  floor   — passable empty tile
 *  wall    — impassable tile (borders + random obstacles ~13 %)
 *  monster — an enemy occupies this tile; full stats in tile.monster
 *  chest   — treasure chest; grants gold + random item on entry, then becomes floor
 *  potion  — healing potion; restores 5–10 HP on entry, then becomes floor
 *  exit    — staircase; descends to the next floor on entry
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GAME STATE SHAPE  (managed by hero-quest, persisted via SqliteContract)
 * ─────────────────────────────────────────────────────────────────────────────
 *  {
 *    hero: {
 *      name:      string,
 *      level:     number,          // character level, starts at 1
 *      hp:        number,
 *      maxHp:     number,
 *      attack:    number,
 *      defense:   number,
 *      xp:        number,
 *      xpNext:    number,          // XP needed for next level-up
 *      gold:      number,
 *      inventory: string[],
 *    },
 *    floor:  number,               // dungeon floor, starts at 1
 *    grid:   Tile[][],             // 10 rows × 10 cols
 *    player: { row: number, col: number },
 *    combat: {
 *      row:     number,
 *      col:     number,
 *      monster: Monster,
 *      turn:    'player' | 'monster',
 *    } | null,
 *    log:    string[],             // newest first, max LOG_MAX entries
 *  }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PERSISTENCE  (handled by hero-quest via SqliteContract)
 * ─────────────────────────────────────────────────────────────────────────────
 *  Database : 'heroquest'
 *  Table    : hero_save (id INTEGER PRIMARY KEY, data TEXT, saved_at INTEGER)
 *  Strategy : single-row upsert after every state mutation; loaded on mount.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DISPATCH RULES
 * ─────────────────────────────────────────────────────────────────────────────
 *  • Commands are dispatched without a routing context so they broadcast to
 *    all registered listeners (hero-quest is the sole listener per type).
 *  • Notifications are also broadcast without context so every subscribed UI
 *    component receives the update in one pass — no per-element dispatch.
 *  • No event bubbling. No composed:true. Shadow boundaries are never crossed.
 *
 * @module HeroContract
 */

/** Module name — frozen on window as window.HeroContract by main.js. */
export const name      = 'HeroContract';

/** Event-bus namespace shared by all hero events. */
export const namespace = 'hero';

// ── Board dimensions ──────────────────────────────────────────────────────────

export const ROWS = 10;
export const COLS = 10;

// ── Tile type constants ───────────────────────────────────────────────────────

export const TILE = Object.freeze({
    FLOOR:   'floor',
    WALL:    'wall',
    MONSTER: 'monster',
    CHEST:   'chest',
    POTION:  'potion',
    EXIT:    'exit',
});

// ── Command event types ───────────────────────────────────────────────────────

/**
 * Event types dispatched BY the UI, consumed BY the engine.
 * Use these constants everywhere instead of raw strings.
 */
export const commands = Object.freeze({
    /** Move the player one tile.  detail: { dr: number, dc: number } */
    MOVE:    'hero:move',
    /** Player attacks in combat.  detail: {} */
    ATTACK:  'hero:attack',
    /** Player attempts to flee.   detail: {} */
    FLEE:    'hero:flee',
    /** Start a new game.          detail: {} */
    NEWGAME: 'hero:newgame',
});

// ── Notification event types ──────────────────────────────────────────────────

/**
 * Event types dispatched BY the engine, subscribed to BY the UI.
 * Broadcast without a routing context — all subscribers receive each event.
 */
export const notifications = Object.freeze({
    /** Full game state snapshot. detail: { hero, floor, grid, player, combat } */
    STATE: 'hero:state',
    /** Log update.               detail: { log: string[] } */
    LOG:   'hero:log',
});

// ── Log ───────────────────────────────────────────────────────────────────────

/** Maximum number of log messages retained. */
export const LOG_MAX = 30;

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Inclusive integer random in [min, max].
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function rng(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const ITEM_POOL = [
    'Rusty Sword', 'Iron Axe',    'Silver Blade', 'Dragon Lance',
    'Leather Vest', 'Chain Mail', 'Plate Armor',  'Dragon Scale',
];

/**
 * Pick a random item from the pool, capped at the hero's tier.
 * @param {number} tier - Hero level used as max pool index.
 * @returns {string}
 */
export function randomItem(tier) {
    return ITEM_POOL[rng(0, Math.min(tier, ITEM_POOL.length - 1))];
}

// ── State factories ───────────────────────────────────────────────────────────

/** @returns {object} A blank hero object at level 1. */
export function newHero() {
    return {
        name: 'Hero', level: 1, hp: 20, maxHp: 20,
        attack: 5, defense: 2, xp: 0, xpNext: 10,
        gold: 0, inventory: [],
    };
}

/**
 * Generate a 10×10 dungeon grid for the given hero level.
 *
 * Rules:
 *  - All border cells are walls.
 *  - ~13 % of interior cells are random walls.
 *  - Places 4–7 monsters, 2–4 chests, 2–3 potions, exactly 1 exit.
 *  - Cell [1][1] is always cleared as the guaranteed spawn point.
 *  - Monster stats scale with heroLevel.
 *
 * @param {number} heroLevel
 * @returns {object[][]} 10×10 grid of tile objects.
 */
export function buildLevel(heroLevel) {
    const grid = Array.from({ length: ROWS }, () =>
        Array.from({ length: COLS }, () => ({ type: TILE.FLOOR, monster: null }))
    );

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
                grid[r][c].type = TILE.WALL;
            } else if (Math.random() < 0.13) {
                grid[r][c].type = TILE.WALL;
            }
        }
    }

    function place(type, count) {
        let placed = 0;
        while (placed < count) {
            const r = rng(1, ROWS - 2), c = rng(1, COLS - 2);
            if (grid[r][c].type === TILE.FLOOR) {
                grid[r][c].type = type;
                if (type === TILE.MONSTER) {
                    const t = heroLevel;
                    grid[r][c].monster = {
                        name:      t < 3 ? 'Goblin' : t < 5 ? 'Orc' : 'Dragon',
                        hp:        rng(5, 8) * t,
                        maxHp:     rng(5, 8) * t,
                        attack:    rng(2, 4) + t,
                        defense:   rng(0, 2) + Math.floor(t / 2),
                        xpValue:   rng(3, 6) * t,
                        goldValue: rng(2, 5) * t,
                    };
                }
                placed++;
            }
        }
    }

    place(TILE.MONSTER, rng(4, 7));
    place(TILE.CHEST,   rng(2, 4));
    place(TILE.POTION,  rng(2, 3));
    place(TILE.EXIT,    1);
    grid[1][1].type = TILE.FLOOR; // guaranteed clear spawn
    return grid;
}

// ── Pure state reducers ───────────────────────────────────────────────────────
// Each reducer receives the full current state and returns a NEW state object.
// No side effects. Safe to call in unit tests without a DOM or event-bus.

/**
 * Prepend a message to the log array and cap at LOG_MAX.
 * @param {string[]} log
 * @param {string}   msg
 * @returns {string[]}
 */
export function addLogEntry(log, msg) {
    return [msg, ...log].slice(0, LOG_MAX);
}

/**
 * Apply hero level-up(s) until XP is below the next threshold.
 *
 * Gains per level: +8 maxHp (and full heal), +2 attack, +1 defense.
 * xpNext scales by ×1.6 per level.
 *
 * @param {object}   hero
 * @param {string[]} log
 * @returns {{ hero: object, log: string[] }}
 */
export function applyLevelUp(hero, log) {
    let h   = { ...hero };
    let out = [...log];
    while (h.xp >= h.xpNext) {
        h.xp     -= h.xpNext;
        h.level++;
        h.xpNext  = Math.floor(h.xpNext * 1.6);
        h.maxHp  += 8;
        h.hp      = h.maxHp;
        h.attack += 2;
        h.defense++;
        out = addLogEntry(out, `🌟 LEVEL UP! Now level ${h.level}.`);
    }
    return { hero: h, log: out };
}

/**
 * Try to move the player one tile in direction (dr, dc).
 *
 * Movement rules:
 *  - No-op when combat is active.
 *  - Out-of-bounds or wall targets are rejected.
 *  - MONSTER tile → enter combat; player stays in place this turn.
 *  - CHEST tile   → collect gold (5–15 × hero.level) + random item; tile becomes floor.
 *  - POTION tile  → restore 5–10 HP (capped at maxHp); tile becomes floor.
 *  - EXIT tile    → descend (floor++, +5 maxHp, full heal, +1 attack, new grid, reset position).
 *  - All other floor tiles → player moves.
 *
 * @param {object} state               - Full current game state.
 * @param {{ dr: number, dc: number }} detail
 * @returns {object} New game state.
 */
export function reduceMove(state, { dr, dc }) {
    if (state.combat) return state;

    const nr = state.player.row + dr;
    const nc = state.player.col + dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return state;

    const grid = state.grid.map(row => row.map(tile => ({ ...tile })));
    const tile = grid[nr][nc];
    if (tile.type === TILE.WALL) return state;

    let hero   = { ...state.hero };
    let log    = state.log;
    let floor  = state.floor;
    let player = state.player;
    let combat = null;

    if (tile.type === TILE.MONSTER) {
        combat = { row: nr, col: nc, monster: { ...tile.monster }, turn: 'player' };
        log = addLogEntry(log, `⚔️ You encounter a ${combat.monster.name}!`);
        return { ...state, grid, hero, floor, player, combat, log };
    }

    if (tile.type === TILE.CHEST) {
        const gold = rng(5, 15) * hero.level;
        const item = randomItem(hero.level);
        hero.gold += gold;
        hero.inventory = [...hero.inventory, item];
        log  = addLogEntry(log, `🎁 Found ${gold} gold and a ${item}!`);
        tile.type = TILE.FLOOR;
    }

    if (tile.type === TILE.POTION) {
        const heal = rng(5, 10);
        hero.hp = Math.min(hero.hp + heal, hero.maxHp);
        log  = addLogEntry(log, `🧪 Drank a potion — +${heal} HP.`);
        tile.type = TILE.FLOOR;
    }

    if (tile.type === TILE.EXIT) {
        floor++;
        hero.maxHp += 5;
        hero.hp     = hero.maxHp;
        hero.attack++;
        log    = addLogEntry(log, `🚪 You descend deeper… Floor ${floor}!`);
        return { ...state, hero, floor, grid: buildLevel(hero.level), player: { row: 1, col: 1 }, combat: null, log };
    }

    player = { row: nr, col: nc };
    return { ...state, hero, floor, grid, player, combat, log };
}

/**
 * Execute the player's attack against the current combat monster.
 *
 * Attack rules:
 *  - No-op if not in combat or not the player's turn.
 *  - Damage = max(1, hero.attack − monster.defense + rng(−1, +2))
 *  - Monster hp ≤ 0 → defeated: award XP + gold, clear tile, run level-up check.
 *  - Otherwise → hand turn to the monster (calls reduceMonsterTurn internally).
 *
 * @param {object} state - Full current game state.
 * @returns {object} New game state.
 */
export function reduceAttack(state) {
    if (!state.combat || state.combat.turn !== 'player') return state;

    const hero    = { ...state.hero };
    const monster = { ...state.combat.monster };
    const grid    = state.grid.map(row => row.map(tile => ({ ...tile })));
    let   log     = state.log;

    const dmg = Math.max(1, hero.attack - monster.defense + rng(-1, 2));
    monster.hp -= dmg;
    log = addLogEntry(log, `🗡 Hit ${monster.name} for ${dmg} dmg.`);

    if (monster.hp <= 0) {
        log = addLogEntry(log, `💀 ${monster.name} defeated! +${monster.xpValue} XP, +${monster.goldValue} gold.`);
        const rewarded = { ...hero, xp: hero.xp + monster.xpValue, gold: hero.gold + monster.goldValue };
        grid[state.combat.row][state.combat.col].type = TILE.FLOOR;
        const { hero: leveled, log: leveledLog } = applyLevelUp(rewarded, log);
        return { ...state, hero: leveled, grid, combat: null, log: leveledLog };
    }

    const combat = { ...state.combat, monster, turn: 'monster' };
    return reduceMonsterTurn({ ...state, hero, grid, combat, log });
}

/**
 * Process the monster's counter-attack turn.
 *
 * Monster turn rules:
 *  - No-op if combat is null.
 *  - Damage = max(0, monster.attack − hero.defense + rng(−1, +1))
 *  - Hero hp ≤ 0 → slain: combat clears, hero.hp clamped to 0 (game over state).
 *  - Otherwise → return turn to player.
 *
 * Called internally by reduceAttack (missed kill) and reduceFlee (failed escape).
 *
 * @param {object} state - Full current game state (combat.turn === 'monster').
 * @returns {object} New game state.
 */
export function reduceMonsterTurn(state) {
    if (!state.combat) return state;

    const monster = state.combat.monster;
    let hero      = { ...state.hero };
    let log       = state.log;

    const dmg = Math.max(0, monster.attack - hero.defense + rng(-1, 1));
    hero.hp  -= dmg;
    log       = addLogEntry(log, `💢 ${monster.name} hits you for ${dmg} dmg.`);

    if (hero.hp <= 0) {
        hero.hp = 0;
        log = addLogEntry(log, `💀 You have been slain! Start a New Game.`);
        return { ...state, hero, combat: null, log };
    }

    return { ...state, hero, combat: { ...state.combat, turn: 'player' }, log };
}

/**
 * Attempt to flee from combat.
 *
 * Flee rules:
 *  - No-op if not in combat or not the player's turn.
 *  - 50 % chance of success → combat cleared.
 *  - Failure → monster gets a free attack (calls reduceMonsterTurn internally).
 *
 * @param {object} state - Full current game state.
 * @returns {object} New game state.
 */
export function reduceFlee(state) {
    if (!state.combat || state.combat.turn !== 'player') return state;

    let log = state.log;

    if (Math.random() < 0.5) {
        log = addLogEntry(log, `🏃 Fled successfully!`);
        return { ...state, combat: null, log };
    }

    log = addLogEntry(log, `🚫 Flee failed!`);
    return reduceMonsterTurn({ ...state, combat: { ...state.combat, turn: 'monster' }, log });
}

/**
 * Build a brand-new game state ready to play.
 *
 * @returns {object} Fresh game state.
 */
export function reduceNewGame() {
    return {
        hero:   newHero(),
        floor:  1,
        grid:   buildLevel(1),
        player: { row: 1, col: 1 },
        combat: null,
        log:    ['⚔️ Your quest begins!'],
    };
}

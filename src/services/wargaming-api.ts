/**
 * Wargaming API Service for World of Warships stats lookup
 */

const API_BASE_URL = 'https://api.worldofwarships.com/wows';
const APP_ID = process.env.WARGAMING_APP_ID || '007e439533b8d74a7d831b1822603499';

export interface PlayerSearchResult {
  account_id: number;
  nickname: string;
}

export interface PlayerStats {
  account_id: number;
  nickname: string;
  statistics?: {
    pvp?: {
      battles: number;
      wins: number;
      damage_dealt: number;
      frags: number;
      xp: number;
      survived_battles: number;
    };
  };
  hidden_profile?: boolean;
  last_battle_time?: number;
}

export interface ClanData {
  clan_id: number;
  tag: string;
  name: string;
}

export interface ClanSearchResult {
  clan_id: number;
  tag: string;
  name: string;
  members_count: number;
  created_at: number;
}

export interface ClanMemberData {
  account_id: number;
  account_name: string;
  role: string;
  joined_at: number;
}

export interface ClanFullInfo {
  clan_id: number;
  tag: string;
  name: string;
  description: string | null;
  members_count: number;
  members_ids: number[];
  members?: Record<string, ClanMemberData>;
  leader_id: number;
  leader_name: string;
  creator_id: number;
  creator_name: string;
  created_at: number;
  updated_at: number;
  renamed_at: number | null;
  old_name: string | null;
  old_tag: string | null;
  is_clan_disbanded: boolean;
}

export interface ClanMember {
  accountId: number;
  nickname: string;
  role: string;
  joinedAt: number;
}

export interface FormattedClanInfo {
  clanId: number;
  tag: string;
  name: string;
  description: string | null;
  membersCount: number;
  membersIds: number[];
  members?: ClanMember[];
  leaderName: string;
  leaderId: number;
  creatorName: string;
  createdAt: number;
  updatedAt: number;
  oldName: string | null;
  oldTag: string | null;
  isDisbanded: boolean;
}

export interface FormattedStats {
  accountId: number;
  nickname: string;
  battles: number;
  winRate: string;
  avgDamage: number;
  avgFrags: string;
  survivalRate: string;
  pr: number;
  prRating: string;
  clan?: {
    tag: string;
    name: string;
  };
  hiddenProfile: boolean;
  lastBattle?: number;
}

export interface ShipInfo {
  ship_id: number;
  name: string;
  tier: number;
  type: string; // Destroyer, Cruiser, Battleship, AirCarrier, Submarine
  nation: string;
  is_premium: boolean;
  is_special: boolean;
}

export interface ShipStats {
  ship_id: number;
  pvp?: {
    battles: number;
    wins: number;
    damage_dealt: number;
    frags: number;
    xp: number;
    survived_battles: number;
    main_battery?: {
      hits: number;
      shots: number;
    };
  };
  last_battle_time?: number;
}

export interface FormattedShipStats {
  shipId: number;
  name: string;
  tier: number;
  type: string;
  typeEmoji: string;
  nation: string;
  isPremium: boolean;
  isSpecial: boolean;
  battles: number;
  winRate: string;
  avgDamage: number;
  avgFrags: string;
  survivalRate: string;
  pr: number;
  prRating: string;
  lastBattle?: number;
  accuracy?: string;
}

// Ship type emoji mapping
const SHIP_TYPE_EMOJI: Record<string, string> = {
  'Destroyer': '🔱',
  'Cruiser': '⚓',
  'Battleship': '🛡️',
  'AirCarrier': '✈️',
  'Submarine': '🌊',
};

// Tier Roman numerals
const TIER_ROMAN: Record<number, string> = {
  1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
  6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI',
};

/**
 * Get PR rating category based on value
 * PR (Personal Rating) is a WoWS community metric for player skill
 */
function getPRRating(pr: number): string {
  if (pr >= 2450) return 'Elite';
  if (pr >= 2100) return 'Excellent';
  if (pr >= 1750) return 'Very Good';
  if (pr >= 1400) return 'Good';
  if (pr >= 1100) return 'Average';
  if (pr >= 750) return 'Below Average';
  return 'Poor';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

/**
 * Search for a player by name
 */
export async function searchPlayer(playerName: string): Promise<PlayerSearchResult | null> {
  // Try exact match first
  const exactUrl = `${API_BASE_URL}/account/list/?application_id=${APP_ID}&search=${encodeURIComponent(playerName)}&type=exact`;
  const exactResponse = await fetch(exactUrl);
  const exactData: ApiResponse = await exactResponse.json();

  if (exactData.status === 'ok' && exactData.data && exactData.data.length > 0) {
    return exactData.data[0];
  }

  // Fall back to startswith search
  const startsWithUrl = `${API_BASE_URL}/account/list/?application_id=${APP_ID}&search=${encodeURIComponent(playerName)}&type=startswith&limit=1`;
  const startsWithResponse = await fetch(startsWithUrl);
  const startsWithData: ApiResponse = await startsWithResponse.json();

  if (startsWithData.status === 'ok' && startsWithData.data && startsWithData.data.length > 0) {
    return startsWithData.data[0];
  }

  return null;
}

/**
 * Get player stats by account ID
 */
export async function getPlayerStats(accountId: number): Promise<PlayerStats | null> {
  const url = `${API_BASE_URL}/account/info/?application_id=${APP_ID}&account_id=${accountId}`;
  const response = await fetch(url);
  const data: ApiResponse = await response.json();

  if (data.status === 'ok' && data.data && data.data[accountId]) {
    return data.data[accountId];
  }

  return null;
}

/**
 * Get player's clan info
 */
export async function getPlayerClan(accountId: number): Promise<ClanData | null> {
  const url = `${API_BASE_URL}/clans/accountinfo/?application_id=${APP_ID}&account_id=${accountId}`;
  const response = await fetch(url);
  const data: ApiResponse = await response.json();

  if (data.status === 'ok' && data.data && data.data[accountId]?.clan_id) {
    const clanId = data.data[accountId].clan_id;

    // Get clan details
    const clanUrl = `${API_BASE_URL}/clans/info/?application_id=${APP_ID}&clan_id=${clanId}`;
    const clanResponse = await fetch(clanUrl);
    const clanData: ApiResponse = await clanResponse.json();

    if (clanData.status === 'ok' && clanData.data && clanData.data[clanId]) {
      return {
        clan_id: clanId,
        tag: clanData.data[clanId].tag,
        name: clanData.data[clanId].name,
      };
    }
  }

  return null;
}

/**
 * Get full player info with stats and clan
 */
export async function getFullPlayerInfo(playerName: string): Promise<FormattedStats | null> {
  // Search for player
  const player = await searchPlayer(playerName);
  if (!player) {
    return null;
  }

  // Get stats
  const stats = await getPlayerStats(player.account_id);
  if (!stats) {
    return null;
  }

  // Get clan info
  const clan = await getPlayerClan(player.account_id);

  // Format stats
  if (stats.hidden_profile) {
    return {
      accountId: player.account_id,
      nickname: player.nickname,
      battles: 0,
      winRate: '0',
      avgDamage: 0,
      avgFrags: '0',
      survivalRate: '0',
      pr: 0,
      prRating: 'Hidden',
      clan: clan ? { tag: clan.tag, name: clan.name } : undefined,
      hiddenProfile: true,
      lastBattle: stats.last_battle_time,
    };
  }

  if (!stats.statistics?.pvp) {
    return {
      accountId: player.account_id,
      nickname: player.nickname,
      battles: 0,
      winRate: '0',
      avgDamage: 0,
      avgFrags: '0',
      survivalRate: '0',
      pr: 0,
      prRating: 'No PvP Data',
      clan: clan ? { tag: clan.tag, name: clan.name } : undefined,
      hiddenProfile: false,
      lastBattle: stats.last_battle_time,
    };
  }

  const pvp = stats.statistics.pvp;
  const battles = pvp.battles || 1;

  // Calculate PR (simplified formula)
  const avgDamage = pvp.damage_dealt / battles;
  const winRate = (pvp.wins / battles) * 100;
  const avgFrags = pvp.frags / battles;
  const pr = Math.round((avgDamage / 10) + (winRate * 10) + (avgFrags * 100));

  return {
    accountId: player.account_id,
    nickname: player.nickname,
    battles: pvp.battles,
    winRate: winRate.toFixed(2),
    avgDamage: Math.round(avgDamage),
    avgFrags: avgFrags.toFixed(2),
    survivalRate: ((pvp.survived_battles / battles) * 100).toFixed(2),
    pr,
    prRating: getPRRating(pr),
    clan: clan ? { tag: clan.tag, name: clan.name } : undefined,
    hiddenProfile: false,
    lastBattle: stats.last_battle_time,
  };
}

/**
 * Search for similar player names (for suggestions)
 */
export async function searchPlayerSuggestions(playerName: string, limit: number = 5): Promise<string[]> {
  const url = `${API_BASE_URL}/account/list/?application_id=${APP_ID}&search=${encodeURIComponent(playerName)}&type=startswith&limit=${limit}`;
  const response = await fetch(url);
  const data: ApiResponse = await response.json();

  if (data.status === 'ok' && data.data && data.data.length > 0) {
    return data.data.map((p: PlayerSearchResult) => p.nickname);
  }

  return [];
}

// Cache for ship encyclopedia data (ship_id -> ShipInfo)
let shipEncyclopediaCache: Map<number, ShipInfo> | null = null;
let shipCacheTimestamp: number = 0;
const SHIP_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get ship encyclopedia data (cached)
 */
async function getShipEncyclopedia(): Promise<Map<number, ShipInfo>> {
  // Return cached data if still valid
  if (shipEncyclopediaCache && Date.now() - shipCacheTimestamp < SHIP_CACHE_DURATION) {
    return shipEncyclopediaCache;
  }

  const ships = new Map<number, ShipInfo>();
  let pageNo = 1;
  let hasMore = true;

  // Fetch all pages of ship data
  while (hasMore) {
    const url = `${API_BASE_URL}/encyclopedia/ships/?application_id=${APP_ID}&page_no=${pageNo}&fields=ship_id,name,tier,type,nation,is_premium,is_special`;
    const response = await fetch(url);
    const data: ApiResponse = await response.json();

    if (data.status === 'ok' && data.data) {
      for (const shipId of Object.keys(data.data)) {
        const ship = data.data[shipId];
        if (ship) {
          ships.set(Number(shipId), {
            ship_id: ship.ship_id,
            name: ship.name,
            tier: ship.tier,
            type: ship.type,
            nation: ship.nation,
            is_premium: ship.is_premium || false,
            is_special: ship.is_special || false,
          });
        }
      }

      // Check if there are more pages
      if (data.meta && data.meta.page_total > pageNo) {
        pageNo++;
      } else {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  shipEncyclopediaCache = ships;
  shipCacheTimestamp = Date.now();
  return ships;
}

/**
 * Get player's ship statistics
 */
export async function getPlayerShipStats(accountId: number): Promise<ShipStats[]> {
  const url = `${API_BASE_URL}/ships/stats/?application_id=${APP_ID}&account_id=${accountId}&fields=ship_id,pvp,last_battle_time`;
  const response = await fetch(url);
  const data: ApiResponse = await response.json();

  if (data.status === 'ok' && data.data && data.data[accountId]) {
    return data.data[accountId] || [];
  }

  return [];
}

/**
 * Get formatted ship stats for a player
 */
export async function getPlayerShipsFormatted(
  playerName: string,
  options: {
    tier?: number;
    type?: string;
    sortBy?: 'battles' | 'winrate' | 'damage' | 'recent';
    limit?: number;
  } = {}
): Promise<{ player: PlayerSearchResult; ships: FormattedShipStats[] } | null> {
  const { tier, type, sortBy = 'battles', limit = 10 } = options;

  // Search for player
  const player = await searchPlayer(playerName);
  if (!player) {
    return null;
  }

  // Get ship stats and encyclopedia in parallel
  const [shipStats, shipEncyclopedia] = await Promise.all([
    getPlayerShipStats(player.account_id),
    getShipEncyclopedia(),
  ]);

  if (shipStats.length === 0) {
    return { player, ships: [] };
  }

  // Format ship stats
  const formattedShips: FormattedShipStats[] = [];

  for (const stats of shipStats) {
    const shipInfo = shipEncyclopedia.get(stats.ship_id);
    if (!shipInfo) continue;

    // Apply filters
    if (tier !== undefined && shipInfo.tier !== tier) continue;
    if (type && shipInfo.type.toLowerCase() !== type.toLowerCase()) continue;

    const pvp = stats.pvp;
    if (!pvp || pvp.battles === 0) continue;

    const battles = pvp.battles;
    const avgDamage = pvp.damage_dealt / battles;
    const winRate = (pvp.wins / battles) * 100;
    const avgFrags = pvp.frags / battles;
    const pr = Math.round((avgDamage / 10) + (winRate * 10) + (avgFrags * 100));

    let accuracy: string | undefined;
    if (pvp.main_battery && pvp.main_battery.shots > 0) {
      accuracy = ((pvp.main_battery.hits / pvp.main_battery.shots) * 100).toFixed(1);
    }

    formattedShips.push({
      shipId: stats.ship_id,
      name: shipInfo.name,
      tier: shipInfo.tier,
      type: shipInfo.type,
      typeEmoji: SHIP_TYPE_EMOJI[shipInfo.type] || '🚢',
      nation: shipInfo.nation,
      isPremium: shipInfo.is_premium,
      isSpecial: shipInfo.is_special,
      battles: pvp.battles,
      winRate: winRate.toFixed(2),
      avgDamage: Math.round(avgDamage),
      avgFrags: avgFrags.toFixed(2),
      survivalRate: ((pvp.survived_battles / battles) * 100).toFixed(2),
      pr,
      prRating: getPRRating(pr),
      lastBattle: stats.last_battle_time,
      accuracy,
    });
  }

  // Sort ships
  switch (sortBy) {
    case 'winrate':
      formattedShips.sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate));
      break;
    case 'damage':
      formattedShips.sort((a, b) => b.avgDamage - a.avgDamage);
      break;
    case 'recent':
      formattedShips.sort((a, b) => (b.lastBattle || 0) - (a.lastBattle || 0));
      break;
    case 'battles':
    default:
      formattedShips.sort((a, b) => b.battles - a.battles);
      break;
  }

  // Apply limit
  const limitedShips = formattedShips.slice(0, limit);

  return { player, ships: limitedShips };
}

/**
 * Get Tier X ships for a player (useful for recruitment evaluation)
 */
export async function getPlayerTierXShips(playerName: string): Promise<{ player: PlayerSearchResult; ships: FormattedShipStats[] } | null> {
  return getPlayerShipsFormatted(playerName, { tier: 10, sortBy: 'battles', limit: 50 });
}

/**
 * Format tier as Roman numeral
 */
export function formatTier(tier: number): string {
  return TIER_ROMAN[tier] || String(tier);
}

/**
 * Search for a clan by tag or name
 */
export async function searchClan(query: string): Promise<ClanSearchResult | null> {
  const url = `${API_BASE_URL}/clans/list/?application_id=${APP_ID}&search=${encodeURIComponent(query)}&limit=10`;
  const response = await fetch(url);
  const data: ApiResponse = await response.json();

  if (data.status === 'ok' && data.data && data.data.length > 0) {
    // Try to find exact tag match first (case insensitive)
    const exactTagMatch = data.data.find((c: ClanSearchResult) =>
      c.tag.toLowerCase() === query.toLowerCase()
    );
    if (exactTagMatch) {
      return exactTagMatch;
    }
    // Otherwise return first result
    return data.data[0];
  }

  return null;
}

/**
 * Get detailed clan info by clan ID
 */
export async function getClanInfo(clanId: number, includeMembers: boolean = false): Promise<ClanFullInfo | null> {
  const extra = includeMembers ? '&extra=members' : '';
  const url = `${API_BASE_URL}/clans/info/?application_id=${APP_ID}&clan_id=${clanId}${extra}`;
  const response = await fetch(url);
  const data: ApiResponse = await response.json();

  if (data.status === 'ok' && data.data && data.data[clanId]) {
    return data.data[clanId];
  }

  return null;
}

/**
 * Search for clan suggestions (for autocomplete)
 */
export async function searchClanSuggestions(query: string, limit: number = 5): Promise<string[]> {
  const url = `${API_BASE_URL}/clans/list/?application_id=${APP_ID}&search=${encodeURIComponent(query)}&limit=${limit}`;
  const response = await fetch(url);
  const data: ApiResponse = await response.json();

  if (data.status === 'ok' && data.data && data.data.length > 0) {
    return data.data.map((c: ClanSearchResult) => `[${c.tag}] ${c.name}`);
  }

  return [];
}

/**
 * Get full formatted clan info
 */
export async function getFullClanInfo(query: string, includeMembers: boolean = false): Promise<FormattedClanInfo | null> {
  // Search for clan
  const clanSearch = await searchClan(query);
  if (!clanSearch) {
    return null;
  }

  // Get detailed info (with members if requested)
  const clanInfo = await getClanInfo(clanSearch.clan_id, includeMembers);
  if (!clanInfo) {
    return null;
  }

  // Convert members from API format to our format
  let members: ClanMember[] | undefined;
  if (clanInfo.members) {
    members = Object.values(clanInfo.members)
      .map(m => ({
        accountId: m.account_id,
        nickname: m.account_name,
        role: m.role,
        joinedAt: m.joined_at
      }))
      .sort((a, b) => {
        // Sort by role priority: commander > executive_officer > recruitment_officer > commissioned_officer > officer > private
        const rolePriority: Record<string, number> = {
          'commander': 0,
          'executive_officer': 1,
          'recruitment_officer': 2,
          'commissioned_officer': 3,
          'officer': 4,
          'private': 5
        };
        const aPriority = rolePriority[a.role] ?? 6;
        const bPriority = rolePriority[b.role] ?? 6;
        if (aPriority !== bPriority) return aPriority - bPriority;
        // Same role, sort alphabetically
        return a.nickname.localeCompare(b.nickname);
      });
  }

  return {
    clanId: clanInfo.clan_id,
    tag: clanInfo.tag,
    name: clanInfo.name,
    description: clanInfo.description,
    membersCount: clanInfo.members_count,
    membersIds: clanInfo.members_ids || [],
    members,
    leaderName: clanInfo.leader_name,
    leaderId: clanInfo.leader_id,
    creatorName: clanInfo.creator_name,
    createdAt: clanInfo.created_at,
    updatedAt: clanInfo.updated_at,
    oldName: clanInfo.old_name,
    oldTag: clanInfo.old_tag,
    isDisbanded: clanInfo.is_clan_disbanded,
  };
}

export type GameState =
  | 'MENU'
  | 'BRIEFING'
  | 'IN_MISSION'
  | 'MISSION_SUCCESS'
  | 'MISSION_FAILED'
  | 'GAME_OVER'
  | 'PAUSED';

export type VisionMode = 'NORMAL' | 'NIGHT_VISION' | 'THERMAL';

export type ZoomLevel = 2 | 4 | 8;

export type HeadwearType = 'fedora' | 'beanie' | 'cap' | 'none';
export type AccessoryType = 'briefcase' | 'umbrella' | 'cigarette' | 'headset' | 'phone' | 'none';
export type CoatStyle = 'trench' | 'suit' | 'hoodie' | 'jacket';

export interface TargetPerson {
  id: string;
  name: string;
  codeName: string;
  isTarget: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  walkY: number;
  direction: 1 | -1;
  speed: number;
  coatColor: string;
  coatStyle: CoatStyle;
  pantsColor: string;
  headwear: HeadwearType;
  accessory: AccessoryType;
  hairColor: string;
  state: 'walking' | 'standing' | 'panicking' | 'eliminated';
  animTimer: number;
  animFrame: number;
  isDead: boolean;
  deadTimer: number;
  headshot: boolean;
  deathAngle: number;
  layer: 'foreground' | 'midground' | 'background';
  minX: number;
  maxX: number;
}

export interface MissionContract {
  contractNumber: number;
  codename: string;
  locationName: string;
  targetPerson: TargetPerson;
  intelClues: string[];
  timeLimit: number;
  windKnots: number; // e.g. -7 (left) to +7 (right)
  rewardBounty: number;
  weather: 'rain' | 'clear' | 'fog';
}

export interface BulletImpact {
  x: number;
  y: number;
  timestamp: number;
  headshot: boolean;
  hitTarget: boolean;
  hitCivilian: boolean;
  missed: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  type?: 'spark' | 'blood' | 'smoke' | 'rain' | 'glass';
}

export interface SniperStats {
  score: number;
  highScore: number;
  contractsCompleted: number;
  shotsFired: number;
  shotsHit: number;
  headshots: number;
  civiliansHarm: number;
}

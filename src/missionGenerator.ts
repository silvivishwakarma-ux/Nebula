import {
  MissionContract,
  TargetPerson,
  HeadwearType,
  AccessoryType,
  CoatStyle,
} from './types';

const CODENAMES = [
  'NIGHTFALL',
  'VIPER-9',
  'BLUEPRINT',
  'SILVER FOX',
  'SHADOW COURIER',
  'IRON ROOK',
  'GHOSTLINE',
  'VECTOR-X',
  'OBSIDIAN',
  'CHRONOS',
];

const LOCATIONS = [
  'Sector 7 - Nexus Skybridge',
  'Cobalt Bay - Helipad Terrace',
  'Neo-Verona - Grand Promenade',
  'District 4 - Metro Skywalk',
  'Blackwood - Penthouse Balcony',
];

const FIRST_NAMES = ['Viktor', 'Dmitri', 'Elena', 'Kaelen', 'Sloane', 'Ren', 'Marcus', 'Zane', 'Talia', 'Cassian'];
const LAST_NAMES = ['Vance', 'Cross', 'Sterling', 'Black', 'Mercer', 'Novak', 'Winter', 'Reyes', 'Drake', 'Cole'];

const COAT_COLORS = [
  { name: 'Crimson Red', hex: '#EF4444' },
  { name: 'Neon Cyan', hex: '#06B6D4' },
  { name: 'Cobalt Blue', hex: '#3B82F6' },
  { name: 'Khaki Trench', hex: '#D97706' },
  { name: 'Charcoal Grey', hex: '#4B5563' },
  { name: 'Pure White', hex: '#F3F4F6' },
  { name: 'Emerald Green', hex: '#10B981' },
  { name: 'Midnight Purple', hex: '#8B5CF6' },
];

const HEADWEAR_OPTIONS: HeadwearType[] = ['fedora', 'beanie', 'cap', 'none'];
const ACCESSORY_OPTIONS: AccessoryType[] = ['briefcase', 'umbrella', 'cigarette', 'headset', 'phone', 'none'];
const COAT_STYLES: CoatStyle[] = ['trench', 'suit', 'hoodie', 'jacket'];

// Urban walking levels (Y coordinates on canvas of 800x550)
export const WALK_LEVELS = [
  { y: 470, heightScale: 1.0, minX: 40, maxX: 760, layer: 'foreground' as const },
  { y: 320, heightScale: 0.85, minX: 80, maxX: 720, layer: 'midground' as const },
  { y: 190, heightScale: 0.7, minX: 120, maxX: 680, layer: 'background' as const },
];

export function generateContract(contractNum: number): { contract: MissionContract; civilians: TargetPerson[] } {
  const codename = CODENAMES[(contractNum - 1) % CODENAMES.length] + `-${contractNum}`;
  const location = LOCATIONS[(contractNum - 1) % LOCATIONS.length];

  // Distinct target traits
  const targetColorObj = COAT_COLORS[Math.floor(Math.random() * COAT_COLORS.length)];
  const targetCoatStyle = COAT_STYLES[Math.floor(Math.random() * COAT_STYLES.length)];
  const targetHeadwear = HEADWEAR_OPTIONS[Math.floor(Math.random() * (HEADWEAR_OPTIONS.length - 1))]; // prefer a headwear
  let targetAccessory = ACCESSORY_OPTIONS[Math.floor(Math.random() * (ACCESSORY_OPTIONS.length - 1))]; // prefer accessory
  if (targetHeadwear === 'none' && targetAccessory === 'none') {
    targetAccessory = 'briefcase';
  }

  // Pick walking level
  const targetLevel = WALK_LEVELS[Math.floor(Math.random() * WALK_LEVELS.length)];
  const targetDir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
  // Slower, deliberate walking speed so the player has comfortable time to identify and lead targets
  const targetSpeed = (0.22 + Math.random() * 0.18) * targetLevel.heightScale;

  const targetPerson: TargetPerson = {
    id: 'target-' + Date.now(),
    name: `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`,
    codeName: codename,
    isTarget: true,
    x: targetDir === 1 ? targetLevel.minX + 30 : targetLevel.maxX - 30,
    y: targetLevel.y,
    width: 22 * targetLevel.heightScale,
    height: 48 * targetLevel.heightScale,
    walkY: targetLevel.y,
    direction: targetDir,
    speed: targetSpeed,
    coatColor: targetColorObj.hex,
    coatStyle: targetCoatStyle,
    pantsColor: '#1E293B',
    headwear: targetHeadwear,
    accessory: targetAccessory,
    hairColor: '#334155',
    state: 'walking',
    animTimer: 0,
    animFrame: 0,
    isDead: false,
    deadTimer: 0,
    headshot: false,
    deathAngle: 0,
    layer: targetLevel.layer,
    minX: targetLevel.minX,
    maxX: targetLevel.maxX,
  };

  // Compile Intel Clues
  const intelClues: string[] = [];
  intelClues.push(`Wearing ${targetColorObj.name.toLowerCase()} ${targetCoatStyle}`);
  if (targetHeadwear !== 'none') {
    intelClues.push(`Equipped with a ${targetHeadwear}`);
  }
  if (targetAccessory !== 'none') {
    if (targetAccessory === 'cigarette') {
      intelClues.push('Observed smoking a cigarette');
    } else if (targetAccessory === 'briefcase') {
      intelClues.push('Carrying an executive briefcase');
    } else if (targetAccessory === 'umbrella') {
      intelClues.push('Holding an urban umbrella');
    } else if (targetAccessory === 'headset') {
      intelClues.push('Communicating via cyber headset');
    } else if (targetAccessory === 'phone') {
      intelClues.push('Looking at encrypted burner phone');
    }
  }

  // Location clue
  if (targetLevel.layer === 'background') {
    intelClues.push('Reported scouting the top rooftop terrace');
  } else if (targetLevel.layer === 'midground') {
    intelClues.push('Seen crossing the mid-level skybridge');
  } else {
    intelClues.push('Patrolling the street-level promenade');
  }

  // Generate civilians (decoy crowd)
  const numCivilians = Math.min(6 + contractNum * 2, 14);
  const civilians: TargetPerson[] = [];

  for (let i = 0; i < numCivilians; i++) {
    const level = WALK_LEVELS[i % WALK_LEVELS.length];
    const dir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
    // Slower, smooth walking speed for realistic urban pedestrian pacing
    const speed = (0.18 + Math.random() * 0.20) * level.heightScale;

    // Pick a coat color (decoy can sometimes share color, but different headwear/accessory)
    let civColorObj = COAT_COLORS[Math.floor(Math.random() * COAT_COLORS.length)];
    let civCoatStyle = COAT_STYLES[Math.floor(Math.random() * COAT_STYLES.length)];
    let civHeadwear = HEADWEAR_OPTIONS[Math.floor(Math.random() * HEADWEAR_OPTIONS.length)];
    let civAccessory = ACCESSORY_OPTIONS[Math.floor(Math.random() * ACCESSORY_OPTIONS.length)];

    // Ensure civilian NEVER matches all clues simultaneously!
    const matchesColor = civColorObj.hex === targetColorObj.hex;
    const matchesStyle = civCoatStyle === targetCoatStyle;
    const matchesHead = civHeadwear === targetHeadwear;
    const matchesAcc = civAccessory === targetAccessory;
    const matchesLevel = level.layer === targetLevel.layer;

    if (matchesColor && matchesStyle && matchesHead && matchesAcc && matchesLevel) {
      // Diverge one trait
      civColorObj = COAT_COLORS.find(c => c.hex !== targetColorObj.hex) || COAT_COLORS[0];
    }

    const startX = level.minX + Math.random() * (level.maxX - level.minX);

    civilians.push({
      id: `civ-${i}-${Date.now()}`,
      name: `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`,
      codeName: 'CIVILIAN',
      isTarget: false,
      x: startX,
      y: level.y,
      width: 22 * level.heightScale,
      height: 48 * level.heightScale,
      walkY: level.y,
      direction: dir,
      speed: speed,
      coatColor: civColorObj.hex,
      coatStyle: civCoatStyle,
      pantsColor: '#334155',
      headwear: civHeadwear,
      accessory: civAccessory,
      hairColor: '#475569',
      state: 'walking',
      animTimer: Math.floor(Math.random() * 20),
      animFrame: 0,
      isDead: false,
      deadTimer: 0,
      headshot: false,
      deathAngle: 0,
      layer: level.layer,
      minX: level.minX,
      maxX: level.maxX,
    });
  }

  // Wind speed scales with contract
  const windMagnitude = Math.min(1.5 + contractNum * 0.8, 8.0);
  const windSign = Math.random() > 0.5 ? 1 : -1;
  const windKnots = Math.round(windMagnitude * windSign * 10) / 10;

  // Time limit
  const timeLimit = Math.max(30 - contractNum * 2, 16);

  // Weather
  const weatherRoll = Math.random();
  const weather = weatherRoll > 0.6 ? 'rain' : weatherRoll > 0.35 ? 'fog' : 'clear';

  const contract: MissionContract = {
    contractNumber: contractNum,
    codename,
    locationName: location,
    targetPerson,
    intelClues,
    timeLimit,
    windKnots,
    rewardBounty: 1000 + contractNum * 500,
    weather,
  };

  return { contract, civilians };
}

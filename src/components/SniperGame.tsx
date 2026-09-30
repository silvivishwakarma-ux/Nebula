import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  GameState,
  VisionMode,
  ZoomLevel,
  TargetPerson,
  MissionContract,
  BulletImpact,
  Particle,
  SniperStats,
} from '../types';
import { generateContract } from '../missionGenerator';
import { tacticalSound } from '../sound';
import {
  Crosshair,
  Wind,
  Clock,
  Eye,
  Volume2,
  VolumeX,
  RotateCcw,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ZoomIn,
  Disc,
} from 'lucide-react';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const MAG_CAPACITY = 5;

export function SniperGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // High-level React Game States
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [currentContract, setCurrentContract] = useState<MissionContract | null>(null);
  const [contractNum, setContractNum] = useState<number>(1);
  const [ammo, setAmmo] = useState<number>(MAG_CAPACITY);
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [isScoped, setIsScoped] = useState<boolean>(false);
  const [zoom, setZoom] = useState<ZoomLevel>(4);
  const [visionMode, setVisionMode] = useState<VisionMode>('NORMAL');
  const [breathStamina, setBreathStamina] = useState<number>(100);
  const [isHoldingBreath, setIsHoldingBreath] = useState<boolean>(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const [isMuted, setIsMuted] = useState<boolean>(tacticalSound.isMuted);

  // Player Stats
  const [stats, setStats] = useState<SniperStats>(() => {
    const savedHigh = localStorage.getItem('rook_high_bounty');
    const savedContracts = localStorage.getItem('rook_contracts_won');
    return {
      score: 0,
      highScore: savedHigh ? parseInt(savedHigh, 10) : 0,
      contractsCompleted: savedContracts ? parseInt(savedContracts, 10) : 0,
      shotsFired: 0,
      shotsHit: 0,
      headshots: 0,
      civiliansHarm: 0,
    };
  });

  const [endReport, setEndReport] = useState<{
    success: boolean;
    reason: string;
    bountyEarned: number;
    headshot: boolean;
    distanceMeters: number;
    accuracyBonus: number;
    timeBonus: number;
  } | null>(null);

  // Game Engine Simulation Ref
  const gameRef = useRef({
    state: 'MENU' as GameState,
    mouse: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
    scopePos: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
    targetScopePos: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
    swayOffset: { x: 0, y: 0 },
    swayTime: 0,
    isHoldingBreath: false,
    stamina: 100,
    isScoped: false,
    zoom: 4 as ZoomLevel,
    visionMode: 'NORMAL' as VisionMode,
    screenShake: 0,
    recoilKick: 0,
    contract: null as MissionContract | null,
    civilians: [] as TargetPerson[],
    allPersons: [] as TargetPerson[],
    particles: [] as Particle[],
    impacts: [] as BulletImpact[],
    ammo: MAG_CAPACITY,
    isReloading: false,
    reloadTimer: 0,
    boltTimer: 0,
    timeRemaining: 30,
    timeTimer: 0,
    slowMoTimer: 0,
    rainDrops: [] as { x: number; y: number; speed: number; len: number }[],
    steamVents: [
      { x: 140, y: 310, timer: 0 },
      { x: 520, y: 175, timer: 15 },
      { x: 740, y: 460, timer: 30 },
    ],
    neonSigns: [
      { text: 'NEXUS CYBER', x: 260, y: 220, color: '#06B6D4', pulse: 0 },
      { text: 'ROOK INTEL', x: 640, y: 130, color: '#EF4444', pulse: 1.5 },
      { text: 'HOTEL OBSIDIAN', x: 410, y: 370, color: '#F59E0B', pulse: 2.8 },
    ],
    tick: 0,
  });

  // Keep ref synchronized with state
  useEffect(() => {
    gameRef.current.isScoped = isScoped;
    gameRef.current.zoom = zoom;
    gameRef.current.visionMode = visionMode;
    gameRef.current.isHoldingBreath = isHoldingBreath;
  }, [isScoped, zoom, visionMode, isHoldingBreath]);

  // Initialize Rain drops
  useEffect(() => {
    const drops = [];
    for (let i = 0; i < 90; i++) {
      drops.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        speed: 8 + Math.random() * 6,
        len: 12 + Math.random() * 8,
      });
    }
    gameRef.current.rainDrops = drops;
  }, []);

  // Start / Load Next Contract
  const loadNewContract = useCallback((cNum: number) => {
    const { contract, civilians } = generateContract(cNum);
    setCurrentContract(contract);
    setContractNum(cNum);
    setTimeRemaining(contract.timeLimit);
    setAmmo(MAG_CAPACITY);
    setIsReloading(false);
    setBreathStamina(100);
    setIsScoped(false);
    setEndReport(null);

    const g = gameRef.current;
    g.contract = contract;
    g.civilians = civilians;
    g.allPersons = [contract.targetPerson, ...civilians];
    g.ammo = MAG_CAPACITY;
    g.isReloading = false;
    g.timeRemaining = contract.timeLimit;
    g.timeTimer = 0;
    g.particles = [];
    g.impacts = [];
    g.slowMoTimer = 0;

    g.state = 'BRIEFING';
    setGameState('BRIEFING');
  }, []);

  // Launch initial game
  const handleStartGame = useCallback(() => {
    loadNewContract(1);
  }, [loadNewContract]);

  // Accept Briefing and Enter Scope/Surveillance
  const handleDeployContract = useCallback(() => {
    const g = gameRef.current;
    g.state = 'IN_MISSION';
    setGameState('IN_MISSION');
    setIsScoped(true);
    g.isScoped = true;
    tacticalSound.playVisionToggle();
  }, []);

  // Reload action
  const handleReload = useCallback(() => {
    const g = gameRef.current;
    if (g.isReloading || g.ammo === MAG_CAPACITY) return;

    g.isReloading = true;
    setIsReloading(true);
    tacticalSound.playReload();

    setTimeout(() => {
      g.ammo = MAG_CAPACITY;
      g.isReloading = false;
      setIsReloading(false);
      setAmmo(MAG_CAPACITY);
    }, 1400);
  }, []);

  // Fire Trigger Action
  const handleFire = useCallback(() => {
    const g = gameRef.current;
    if (g.state !== 'IN_MISSION') return;

    if (g.isReloading) return;

    if (g.ammo <= 0) {
      tacticalSound.playEmptyClick();
      return;
    }

    // Spend Ammo
    g.ammo -= 1;
    setAmmo(g.ammo);
    setStats((prev) => ({ ...prev, shotsFired: prev.shotsFired + 1 }));

    // Sound & Gunshot
    tacticalSound.playShot(false);
    setTimeout(() => tacticalSound.playShellDrop(), 380);
    setTimeout(() => {
      if (g.ammo > 0) {
        tacticalSound.playBoltAction();
      }
    }, 550);

    // Recoil Kick and Screen Shake
    g.screenShake = 16;
    g.recoilKick = 22;

    // Bullet physics & Reticle calculation
    // Calculate aiming center taking wind offset into account
    // Wind knots drift the bullet: e.g. 5 knots moves bullet to the right
    const windDrift = (g.contract?.windKnots || 0) * (3.8 / (g.zoom / 2));
    const reticleX = g.scopePos.x;
    const reticleY = g.scopePos.y;
    const bulletLandingX = reticleX + windDrift;
    const bulletLandingY = reticleY;

    // Distance calculation based on vertical level
    const distanceMeters = Math.round(280 + (CANVAS_HEIGHT - reticleY) * 0.85);

    // Muzzle blast particles at viewport edge
    for (let i = 0; i < 8; i++) {
      g.particles.push({
        x: CANVAS_WIDTH / 2 + (Math.random() * 200 - 100),
        y: CANVAS_HEIGHT - 20,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 8,
        radius: Math.random() * 6 + 3,
        color: '#F97316',
        alpha: 0.8,
        life: 0,
        maxLife: 15,
        type: 'smoke',
      });
    }

    // Check hit against persons
    let hitPerson: TargetPerson | null = null;
    let isHeadshot = false;

    // Check persons closest to foreground first
    const sortedPersons = [...g.allPersons].sort((a, b) => b.y - a.y);

    for (const p of sortedPersons) {
      if (p.isDead) continue;

      // Hitbox bounds
      const pLeft = p.x - p.width / 2;
      const pRight = p.x + p.width / 2;
      const pTop = p.y - p.height;
      const pBottom = p.y;

      if (
        bulletLandingX >= pLeft &&
        bulletLandingX <= pRight &&
        bulletLandingY >= pTop &&
        bulletLandingY <= pBottom
      ) {
        hitPerson = p;
        // Headshot detection: top 25% of height
        if (bulletLandingY <= pTop + p.height * 0.28) {
          isHeadshot = true;
        }
        break;
      }
    }

    if (hitPerson) {
      // Hit a human
      hitPerson.isDead = true;
      hitPerson.state = 'eliminated';
      hitPerson.headshot = isHeadshot;
      hitPerson.deathAngle = (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.4);

      if (isHeadshot) {
        tacticalSound.playHeadshot();
      } else {
        tacticalSound.playTargetHit();
      }

      // Blood / spark vector particles
      for (let i = 0; i < 20; i++) {
        g.particles.push({
          x: bulletLandingX,
          y: bulletLandingY,
          vx: (Math.random() - 0.5) * 7 + (hitPerson.direction * 2),
          vy: Math.random() * -5 - 1,
          radius: Math.random() * 3 + 1.5,
          color: '#DC2626',
          alpha: 1,
          life: 0,
          maxLife: 24,
          type: 'blood',
        });
      }

      g.impacts.push({
        x: bulletLandingX,
        y: bulletLandingY,
        timestamp: Date.now(),
        headshot: isHeadshot,
        hitTarget: hitPerson.isTarget,
        hitCivilian: !hitPerson.isTarget,
        missed: false,
      });

      // PANIC all other nearby persons!
      g.allPersons.forEach((other) => {
        if (!other.isDead && other.id !== hitPerson!.id) {
          other.state = 'panicking';
          other.speed = Math.min(other.speed * 2.2, 1.1);
        }
      });

      if (hitPerson.isTarget) {
        // TARGET ELIMINATED! SUCCESS!
        g.state = 'MISSION_SUCCESS';
        g.slowMoTimer = 60;
        tacticalSound.playMissionComplete();

        const baseBounty = g.contract?.rewardBounty || 1000;
        const timeBonus = Math.round(g.timeRemaining * 40);
        const headshotBonus = isHeadshot ? 500 : 0;
        const totalBounty = baseBounty + timeBonus + headshotBonus;

        setEndReport({
          success: true,
          reason: isHeadshot ? 'CLEAN HEADSHOT - TARGET NEUTRALIZED' : 'TARGET CONFIRMED ELIMINATED',
          bountyEarned: totalBounty,
          headshot: isHeadshot,
          distanceMeters,
          accuracyBonus: headshotBonus,
          timeBonus,
        });

        setStats((prev) => {
          const nextScore = prev.score + totalBounty;
          const nextContracts = prev.contractsCompleted + 1;
          const nextHigh = Math.max(prev.highScore, nextScore);
          localStorage.setItem('rook_high_bounty', String(nextHigh));
          localStorage.setItem('rook_contracts_won', String(nextContracts));
          return {
            ...prev,
            score: nextScore,
            highScore: nextHigh,
            contractsCompleted: nextContracts,
            shotsHit: prev.shotsHit + 1,
            headshots: isHeadshot ? prev.headshots + 1 : prev.headshots,
          };
        });

        setTimeout(() => {
          setGameState('MISSION_SUCCESS');
        }, 1200);
      } else {
        // CIVILIAN / COLLATERAL DAMAGE - MISSION FAILED!
        g.state = 'MISSION_FAILED';
        tacticalSound.playMissionFailed();

        setEndReport({
          success: false,
          reason: 'COLLATERAL DAMAGE: INNOCENT CIVILIAN CASUALTY',
          bountyEarned: 0,
          headshot: isHeadshot,
          distanceMeters,
          accuracyBonus: 0,
          timeBonus: 0,
        });

        setStats((prev) => ({
          ...prev,
          civiliansHarm: prev.civiliansHarm + 1,
        }));

        setTimeout(() => {
          setGameState('MISSION_FAILED');
        }, 1100);
      }
    } else {
      // MISSED SHOT - Wall impact / ricochet
      tacticalSound.playRicochet();

      // Masonry spark particles
      for (let i = 0; i < 12; i++) {
        g.particles.push({
          x: bulletLandingX,
          y: bulletLandingY,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          radius: Math.random() * 2.5 + 1,
          color: '#FEF08A',
          alpha: 1,
          life: 0,
          maxLife: 18,
          type: 'spark',
        });
      }

      g.impacts.push({
        x: bulletLandingX,
        y: bulletLandingY,
        timestamp: Date.now(),
        headshot: false,
        hitTarget: false,
        hitCivilian: false,
        missed: true,
      });

      // Pedestrians panic on near miss!
      g.allPersons.forEach((person) => {
        if (!person.isDead) {
          person.state = 'panicking';
          person.speed = Math.min(person.speed * 2.2, 1.1);
        }
      });
    }
  }, []);

  // Mouse / Pointer Tracking on Canvas
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    gameRef.current.mouse.x = Math.max(30, Math.min(CANVAS_WIDTH - 30, mouseX));
    gameRef.current.mouse.y = Math.max(40, Math.min(CANVAS_HEIGHT - 40, mouseY));
  }, []);

  // Toggle ADS Scope
  const toggleScope = useCallback(() => {
    setIsScoped((prev) => {
      const next = !prev;
      gameRef.current.isScoped = next;
      tacticalSound.playZoomClick();
      return next;
    });
  }, []);

  // Zoom Switcher
  const cycleZoom = useCallback(() => {
    setZoom((prev) => {
      const next: ZoomLevel = prev === 2 ? 4 : prev === 4 ? 8 : 2;
      gameRef.current.zoom = next;
      tacticalSound.playZoomClick();
      return next;
    });
  }, []);

  // Vision Mode Switcher
  const cycleVision = useCallback(() => {
    setVisionMode((prev) => {
      const next: VisionMode =
        prev === 'NORMAL' ? 'NIGHT_VISION' : prev === 'NIGHT_VISION' ? 'THERMAL' : 'NORMAL';
      gameRef.current.visionMode = next;
      tacticalSound.playVisionToggle();
      return next;
    });
  }, []);

  // Audio Toggle
  const toggleMute = useCallback(() => {
    const m = tacticalSound.toggleMute();
    setIsMuted(m);
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') {
        e.preventDefault();
        handleReload();
      } else if (e.code === 'Space') {
        e.preventDefault();
        toggleScope();
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault();
        setIsHoldingBreath(true);
      } else if (e.code === 'KeyZ' || e.code === 'KeyQ') {
        e.preventDefault();
        cycleZoom();
      } else if (e.code === 'KeyV' || e.code === 'KeyN') {
        e.preventDefault();
        cycleVision();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault();
        setIsHoldingBreath(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleReload, toggleScope, cycleZoom, cycleVision, toggleMute]);

  // Main Canvas Render & Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const g = gameRef.current;
      g.tick++;

      // Canvas High DPI setup
      const dpr = window.devicePixelRatio || 1;
      const expectedWidth = CANVAS_WIDTH * dpr;
      const expectedHeight = CANVAS_HEIGHT * dpr;
      if (canvas.width !== expectedWidth || canvas.height !== expectedHeight) {
        canvas.width = expectedWidth;
        canvas.height = expectedHeight;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // -------------------------------------------------------------
      // 1. UPDATE TIMER & STAMINA
      // -------------------------------------------------------------
      if (g.state === 'IN_MISSION') {
        g.timeTimer++;
        if (g.timeTimer >= 60) {
          g.timeTimer = 0;
          g.timeRemaining -= 1;
          setTimeRemaining(g.timeRemaining);

          if (g.timeRemaining <= 5 && g.timeRemaining > 0) {
            tacticalSound.playHeartbeat();
          }

          if (g.timeRemaining <= 0) {
            // TIME RAN OUT!
            g.state = 'MISSION_FAILED';
            tacticalSound.playMissionFailed();
            setEndReport({
              success: false,
              reason: 'TIME EXPIRED - TARGET EVADED SURVEILLANCE',
              bountyEarned: 0,
              headshot: false,
              distanceMeters: 350,
              accuracyBonus: 0,
              timeBonus: 0,
            });
            setTimeout(() => setGameState('MISSION_FAILED'), 1000);
          }
        }

        // Breath Stamina Logic
        if (g.isHoldingBreath && g.stamina > 0) {
          g.stamina = Math.max(0, g.stamina - 0.7);
          setBreathStamina(Math.round(g.stamina));
          if (g.tick % 45 === 0) {
            tacticalSound.playHeartbeat();
          }
        } else {
          g.stamina = Math.min(100, g.stamina + 0.45);
          setBreathStamina(Math.round(g.stamina));
        }
      }

      // -------------------------------------------------------------
      // 2. SWAY & RETICLE DRIFT (Lissajous Realistic Breathing)
      // -------------------------------------------------------------
      g.swayTime += 0.035;
      const swayFactor = g.isHoldingBreath && g.stamina > 0 ? 0.15 : 1.0;
      const zoomFactor = g.isScoped ? (g.zoom === 8 ? 1.6 : g.zoom === 4 ? 1.0 : 0.6) : 0.3;

      // Figure-8 breathing curve
      const naturalSwayX = Math.sin(g.swayTime * 0.9) * 8 * swayFactor * zoomFactor;
      const naturalSwayY = Math.sin(g.swayTime * 1.8) * 5 * swayFactor * zoomFactor;

      // Smooth lag towards mouse pointer
      g.targetScopePos.x = g.mouse.x + naturalSwayX;
      g.targetScopePos.y = g.mouse.y + naturalSwayY;

      // Interpolate scope position
      const lerpSpeed = g.isScoped ? 0.22 : 0.4;
      g.scopePos.x += (g.targetScopePos.x - g.scopePos.x) * lerpSpeed;
      g.scopePos.y += (g.targetScopePos.y - g.scopePos.y) * lerpSpeed;

      // Decay recoil kick
      if (g.recoilKick > 0) {
        g.scopePos.y -= g.recoilKick * 0.4;
        g.recoilKick = Math.max(0, g.recoilKick - 2.5);
      }

      // Screen shake translation
      if (g.screenShake > 0) {
        const shakeMag = (g.screenShake / 16) * 7;
        const sx = (Math.random() - 0.5) * shakeMag;
        const sy = (Math.random() - 0.5) * shakeMag;
        ctx.translate(sx, sy);
        g.screenShake--;
      }

      // -------------------------------------------------------------
      // 3. UPDATE MOVING PERSONS & PEDESTRIANS
      // -------------------------------------------------------------
      g.allPersons.forEach((person) => {
        if (!person.isDead) {
          person.animTimer++;
          const strideRate = person.state === 'panicking' ? 5 : 12;
          if (person.animTimer % strideRate === 0) {
            person.animFrame = (person.animFrame + 1) % 4;
          }

          // Move along walk line
          person.x += person.speed * person.direction;

          // Turn around at ledge/patrol bounds
          if (person.x >= person.maxX) {
            person.direction = -1;
            person.x = person.maxX;
          } else if (person.x <= person.minX) {
            person.direction = 1;
            person.x = person.minX;
          }
        }
      });

      // Update rain
      g.rainDrops.forEach((drop) => {
        drop.y += drop.speed;
        drop.x -= 1.8;
        if (drop.y > CANVAS_HEIGHT) {
          drop.y = -20;
          drop.x = Math.random() * (CANVAS_WIDTH + 100);
        }
      });

      // Update Particles
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const p = g.particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);
        if (p.type === 'blood') {
          p.vy += 0.25;
        }
        if (p.life >= p.maxLife) {
          g.particles.splice(i, 1);
        }
      }

      // -------------------------------------------------------------
      // 4. DRAW URBAN SURVEILLANCE CITYSCAPE
      // -------------------------------------------------------------
      const vMode = g.visionMode;

      // Palette definition based on vision mode
      let bgGradTop = '#060B18';
      let bgGradBottom = '#0F172A';
      let buildingFar = '#0A1224';
      let buildingMid = '#0F1D38';
      let buildingNear = '#16284C';
      let winColor = '#FDE047';
      let neonFilter = true;

      if (vMode === 'NIGHT_VISION') {
        bgGradTop = '#021808';
        bgGradBottom = '#052D12';
        buildingFar = '#03200B';
        buildingMid = '#073B17';
        buildingNear = '#0C5222';
        winColor = '#86EFAC';
        neonFilter = false;
      } else if (vMode === 'THERMAL') {
        bgGradTop = '#030712';
        bgGradBottom = '#081734';
        buildingFar = '#0B1D45';
        buildingMid = '#11295D';
        buildingNear = '#17367B';
        winColor = '#38BDF8';
      }

      // Sky Background
      const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      skyGrad.addColorStop(0, bgGradTop);
      skyGrad.addColorStop(1, bgGradBottom);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Tactical Grid / Blueprint lines
      ctx.strokeStyle = vMode === 'NIGHT_VISION' ? 'rgba(74, 222, 128, 0.06)' : 'rgba(56, 189, 248, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < CANVAS_WIDTH; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < CANVAS_HEIGHT; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // Far Cyber Skyscrapers
      ctx.fillStyle = buildingFar;
      const farTowers = [
        { x: 30, w: 110, h: 420 },
        { x: 160, w: 90, h: 470 },
        { x: 270, w: 140, h: 390 },
        { x: 440, w: 80, h: 450 },
        { x: 540, w: 130, h: 430 },
        { x: 690, w: 100, h: 480 },
        { x: 810, w: 120, h: 400 },
      ];
      farTowers.forEach((b) => {
        ctx.fillRect(b.x, CANVAS_HEIGHT - b.h, b.w, b.h);
        // Tower red beacon
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, CANVAS_HEIGHT - b.h - 4, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = buildingFar;
      });

      // Midground Complex with Windows & Catwalk 3 (Top level, y = 190)
      ctx.fillStyle = buildingMid;
      ctx.fillRect(90, 190, 620, CANVAS_HEIGHT - 190);

      // Midground Balcony / Catwalk 3
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(90, 190, 620, 14);
      // Railing
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(100, 172, 600, 18);
      for (let rx = 100; rx <= 700; rx += 25) {
        ctx.beginPath();
        ctx.moveTo(rx, 172);
        ctx.lineTo(rx, 190);
        ctx.stroke();
      }

      // Mid Windows
      for (let wy = 220; wy < 300; wy += 28) {
        for (let wx = 120; wx < 680; wx += 42) {
          const lit = (wx + wy) % 3 === 0;
          ctx.fillStyle = lit ? (vMode === 'NIGHT_VISION' ? 'rgba(74, 222, 128, 0.4)' : winColor) : 'rgba(15, 23, 42, 0.8)';
          ctx.fillRect(wx, wy, 20, 16);
        }
      }

      // Midground Skybridge / Balcony Level 2 (y = 320)
      ctx.fillStyle = buildingNear;
      ctx.fillRect(60, 320, 680, 24);
      // Skybridge Support Beams
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.strokeRect(60, 320, 680, 24);
      // Railing
      ctx.strokeRect(70, 302, 660, 18);
      for (let rx = 70; rx <= 730; rx += 30) {
        ctx.beginPath();
        ctx.moveTo(rx, 302);
        ctx.lineTo(rx, 320);
        ctx.stroke();
      }

      // Neon Signs
      if (neonFilter) {
        g.neonSigns.forEach((sign) => {
          ctx.save();
          ctx.font = '700 13px "Chakra Petch", sans-serif';
          ctx.fillStyle = sign.color;
          ctx.shadowColor = sign.color;
          ctx.shadowBlur = 10;
          ctx.fillText(sign.text, sign.x, sign.y);
          ctx.restore();
        });
      }

      // Foreground Street / Promenade (y = 470)
      ctx.fillStyle = '#090E17';
      ctx.fillRect(0, 470, CANVAS_WIDTH, CANVAS_HEIGHT - 470);
      // Sidewalk edge
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, 470, CANVAS_WIDTH, 12);
      ctx.strokeStyle = '#475569';
      ctx.strokeRect(0, 470, CANVAS_WIDTH, 12);

      // Street Lamp Posts
      [80, 280, 480, 680, 880].forEach((lx) => {
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(lx, 470);
        ctx.lineTo(lx, 415);
        ctx.lineTo(lx + 14, 415);
        ctx.stroke();

        // Lamp glow
        ctx.fillStyle = vMode === 'NIGHT_VISION' ? '#86EFAC' : '#FDE047';
        ctx.beginPath();
        ctx.arc(lx + 14, 417, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Rain if weather is rain
      if (g.contract?.weather === 'rain') {
        ctx.strokeStyle = vMode === 'NIGHT_VISION' ? 'rgba(74, 222, 128, 0.35)' : 'rgba(147, 197, 253, 0.28)';
        ctx.lineWidth = 1;
        g.rainDrops.forEach((d) => {
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - 2, d.y + d.len);
          ctx.stroke();
        });
      }

      // Draw Persons / Pedestrians & Targets
      // Render in order of layers (background -> midground -> foreground)
      const layers = ['background', 'midground', 'foreground'] as const;
      layers.forEach((layerName) => {
        g.allPersons
          .filter((p) => p.layer === layerName)
          .forEach((person) => {
            renderPerson(ctx, person, vMode);
          });
      });

      // Draw Particles
      g.particles.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // -------------------------------------------------------------
      // 5. SNIPER SCOPE LENS OVERLAY (If Scoped ADS)
      // -------------------------------------------------------------
      if (g.isScoped) {
        renderScopeOverlay(ctx, g, vMode);
      } else {
        // Unscoped standard crosshair dot
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(g.scopePos.x, g.scopePos.y, 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(g.scopePos.x, g.scopePos.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Helper: Draw stylized vector human character
  const renderPerson = (ctx: CanvasRenderingContext2D, p: TargetPerson, vMode: VisionMode) => {
    ctx.save();
    ctx.translate(p.x, p.y);

    if (p.isDead) {
      ctx.rotate(p.deathAngle);
    }

    const scale = p.height / 48;
    const dir = p.direction;

    // Thermal color override
    let coatCol = p.coatColor;
    let pantsCol = p.pantsColor;
    let skinCol = '#FED7AA';

    if (vMode === 'THERMAL') {
      coatCol = p.isDead ? '#3B82F6' : '#F97316';
      pantsCol = p.isDead ? '#1D4ED8' : '#EA580C';
      skinCol = p.isDead ? '#60A5FA' : '#FACC15';
    } else if (vMode === 'NIGHT_VISION') {
      coatCol = p.isTarget ? '#BBF7D0' : '#4ADE80';
      pantsCol = '#166534';
      skinCol = '#DCFCE7';
    }

    // Legs animation
    const legSwing = p.isDead ? 0 : Math.sin(p.animFrame * (Math.PI / 2)) * 6 * scale;
    ctx.strokeStyle = pantsCol;
    ctx.lineWidth = 4 * scale;

    // Left leg
    ctx.beginPath();
    ctx.moveTo(-3 * scale, -18 * scale);
    ctx.lineTo((-3 + legSwing) * scale, 0);
    ctx.stroke();

    // Right leg
    ctx.beginPath();
    ctx.moveTo(3 * scale, -18 * scale);
    ctx.lineTo((3 - legSwing) * scale, 0);
    ctx.stroke();

    // Torso / Coat
    ctx.fillStyle = coatCol;
    ctx.beginPath();
    if (p.coatStyle === 'trench') {
      // Long trenchcoat
      ctx.roundRect(-8 * scale, -36 * scale, 16 * scale, 24 * scale, 3 * scale);
    } else {
      ctx.roundRect(-7 * scale, -36 * scale, 14 * scale, 18 * scale, 2 * scale);
    }
    ctx.fill();

    // Head
    ctx.fillStyle = skinCol;
    ctx.beginPath();
    ctx.arc(0, -41 * scale, 5.5 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Headwear
    if (p.headwear === 'fedora') {
      ctx.fillStyle = vMode === 'THERMAL' ? '#EA580C' : '#1E293B';
      // Fedora Brim
      ctx.fillRect(-10 * scale, -44 * scale, 20 * scale, 2.5 * scale);
      // Fedora Crown
      ctx.fillRect(-6 * scale, -50 * scale, 12 * scale, 6 * scale);
    } else if (p.headwear === 'beanie') {
      ctx.fillStyle = vMode === 'THERMAL' ? '#EA580C' : '#334155';
      ctx.beginPath();
      ctx.arc(0, -43 * scale, 6.5 * scale, Math.PI, 0);
      ctx.fill();
    } else if (p.headwear === 'cap') {
      ctx.fillStyle = vMode === 'THERMAL' ? '#EA580C' : '#0F172A';
      ctx.fillRect(-6 * scale, -46 * scale, 12 * scale, 4 * scale);
      ctx.fillRect(dir === 1 ? 2 * scale : -10 * scale, -44 * scale, 8 * scale, 2 * scale);
    }

    // Accessories
    if (p.accessory === 'briefcase' && !p.isDead) {
      ctx.fillStyle = vMode === 'THERMAL' ? '#FDE047' : '#D4AF37'; // gold/brass silver briefcase
      ctx.fillRect((dir * 8) * scale, -22 * scale, 7 * scale, 9 * scale);
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1;
      ctx.strokeRect((dir * 8) * scale, -22 * scale, 7 * scale, 9 * scale);
    } else if (p.accessory === 'umbrella' && !p.isDead) {
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.moveTo((dir * 7) * scale, -10 * scale);
      ctx.lineTo((dir * 7) * scale, -32 * scale);
      ctx.stroke();
    } else if (p.accessory === 'cigarette' && !p.isDead) {
      // Glow tip
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc((dir * 7) * scale, -39 * scale, 1.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.accessory === 'headset' && !p.isDead) {
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 1.8 * scale;
      ctx.beginPath();
      ctx.arc(0, -41 * scale, 7 * scale, Math.PI * 0.8, Math.PI * 0.2);
      ctx.stroke();
    }

    ctx.restore();
  };

  // Helper: Draw Military Mil-Dot Sniper Scope Reticle
  const renderScopeOverlay = (
    ctx: CanvasRenderingContext2D,
    g: typeof gameRef.current,
    vMode: VisionMode
  ) => {
    const cx = g.scopePos.x;
    const cy = g.scopePos.y;
    const radius = 230;

    // 1. Dark Vignette / Viewport Mask outside the circular lens
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
    ctx.fill();

    // Scope Bezel Edge Shadow
    const bezelGrad = ctx.createRadialGradient(cx, cy, radius - 15, cx, cy, radius + 2);
    bezelGrad.addColorStop(0, 'rgba(0,0,0,0)');
    bezelGrad.addColorStop(0.7, 'rgba(0,0,0,0.5)');
    bezelGrad.addColorStop(1, 'rgba(0,0,0,0.95)');
    ctx.fillStyle = bezelGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Subtle Glass Lens Tint & Reflection
    const lensGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    if (vMode === 'NIGHT_VISION') {
      lensGrad.addColorStop(0, 'rgba(34, 197, 94, 0.08)');
      lensGrad.addColorStop(1, 'rgba(21, 128, 61, 0.15)');
    } else if (vMode === 'THERMAL') {
      lensGrad.addColorStop(0, 'rgba(56, 189, 248, 0.06)');
      lensGrad.addColorStop(1, 'rgba(125, 211, 252, 0.12)');
    } else {
      lensGrad.addColorStop(0, 'rgba(59, 130, 246, 0.04)');
      lensGrad.addColorStop(1, 'rgba(239, 68, 68, 0.03)');
    }
    ctx.fillStyle = lensGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // 2. Reticle Lines & Mil-Dots
    const reticleColor = vMode === 'NIGHT_VISION' ? '#22C55E' : vMode === 'THERMAL' ? '#38BDF8' : '#EF4444';
    ctx.strokeStyle = reticleColor;
    ctx.fillStyle = reticleColor;
    ctx.lineWidth = 1.5;

    // Crosshair Lines
    // Horizontal
    ctx.beginPath();
    ctx.moveTo(cx - radius + 15, cy);
    ctx.lineTo(cx - 20, cy);
    ctx.moveTo(cx + 20, cy);
    ctx.lineTo(cx + radius - 15, cy);
    // Vertical
    ctx.moveTo(cx, cy - radius + 15);
    ctx.lineTo(cx, cy - 20);
    ctx.moveTo(cx, cy + 20);
    ctx.lineTo(cx, cy + radius - 15);
    ctx.stroke();

    // Center Red Aiming Dot
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();

    // Elevation & Windage Hash Marks (Mil-dots)
    const milSpacing = 28;
    for (let i = 1; i <= 6; i++) {
      // Horizontal marks
      ctx.beginPath();
      ctx.moveTo(cx + i * milSpacing, cy - 4);
      ctx.lineTo(cx + i * milSpacing, cy + 4);
      ctx.moveTo(cx - i * milSpacing, cy - 4);
      ctx.lineTo(cx - i * milSpacing, cy + 4);
      // Vertical marks
      ctx.moveTo(cx - 4, cy + i * milSpacing);
      ctx.lineTo(cx + 4, cy + i * milSpacing);
      ctx.moveTo(cx - 4, cy - i * milSpacing);
      ctx.lineTo(cx + 4, cy - i * milSpacing);
      ctx.stroke();

      // Mil numbers on vertical elevation
      if (i % 2 === 0) {
        ctx.font = '10px "Share Tech Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(String(i), cx + 8, cy + i * milSpacing + 3);
      }
    }

    // 3. Rangefinder & Optical Data readouts inside lens
    ctx.font = '11px "Share Tech Mono", monospace';
    ctx.fillStyle = reticleColor;
    ctx.textAlign = 'center';
    ctx.fillText(`${g.zoom}X MAG`, cx, cy - radius + 38);

    const distanceEst = Math.round(280 + (CANVAS_HEIGHT - cy) * 0.85);
    ctx.fillText(`RNG: ${distanceEst}m`, cx, cy + radius - 35);

    // Windage indicator arrow on reticle
    const windVal = g.contract?.windKnots || 0;
    ctx.textAlign = windVal >= 0 ? 'right' : 'left';
    ctx.fillText(`WIND ${windVal > 0 ? '+' : ''}${windVal}kt`, cx + (windVal >= 0 ? -45 : 45), cy + 18);

    ctx.restore();
  };

  return (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto px-2 sm:px-4 py-2">
      {/* ============================================================== */}
      {/* TOP TACTICAL COMMAND BAR                                       */}
      {/* ============================================================== */}
      <header className="w-full flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/90 rounded-xl border border-slate-800 shadow-xl mb-3">
        {/* Brand Codename */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-950/80 border border-red-500/50 flex items-center justify-center text-red-400">
            <Crosshair className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm tracking-wider text-white">
                ROOK SNIPER
              </span>
              <span className="text-[10px] font-tactical px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 uppercase">
                URBAN TARGET
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-tactical block">
              CONTRACT #{contractNum}: {currentContract?.codename || 'STANDBY'}
            </span>
          </div>
        </div>

        {/* Tactical HUD Data: Wind, Ammo, Timer, Score */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Wind Indicator */}
          <div className="flex items-center gap-1.5 bg-slate-950/70 border border-slate-800 px-2.5 py-1.5 rounded-lg">
            <Wind className="w-4 h-4 text-cyan-400" />
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-tactical text-slate-400 leading-tight">Wind</span>
              <span className="text-xs font-tactical font-bold text-cyan-300">
                {currentContract?.windKnots !== undefined
                  ? `${currentContract.windKnots > 0 ? '→' : '←'} ${Math.abs(currentContract.windKnots)} KT`
                  : '0.0 KT'}
              </span>
            </div>
          </div>

          {/* Ammo Magazine */}
          <div className="flex items-center gap-1.5 bg-slate-950/70 border border-slate-800 px-2.5 py-1.5 rounded-lg">
            <Disc className="w-4 h-4 text-amber-400" />
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-tactical text-slate-400 leading-tight">Mag</span>
              <div className="flex items-center gap-1">
                <span className={`text-xs font-tactical font-bold ${ammo === 0 ? 'text-red-500 animate-bounce' : 'text-amber-300'}`}>
                  {isReloading ? 'RELOAD...' : `${ammo} / ${MAG_CAPACITY}`}
                </span>
              </div>
            </div>
          </div>

          {/* Mission Timer */}
          <div className="flex items-center gap-1.5 bg-slate-950/70 border border-slate-800 px-2.5 py-1.5 rounded-lg">
            <Clock className={`w-4 h-4 ${timeRemaining <= 7 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`} />
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-tactical text-slate-400 leading-tight">Time</span>
              <span className={`text-xs font-tactical font-bold ${timeRemaining <= 7 ? 'text-red-400 animate-pulse' : 'text-emerald-300'}`}>
                {String(Math.floor(timeRemaining / 60)).padStart(2, '0')}:
                {String(timeRemaining % 60).padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Total Bounty Score */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-950/70 border border-slate-800 px-2.5 py-1.5 rounded-lg">
            <Flame className="w-4 h-4 text-amber-400" />
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-tactical text-slate-400 leading-tight">Bounty</span>
              <span className="text-xs font-tactical font-bold text-amber-300 tabular-nums">
                ${stats.score.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={toggleMute}
            aria-label="Toggle Audio"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* TARGET INTEL CLUES STRIP                                      */}
      {/* ============================================================== */}
      {gameState === 'IN_MISSION' && currentContract && (
        <div className="w-full bg-slate-900/80 border border-red-900/40 rounded-lg p-2.5 mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-tactical text-[11px] font-bold text-red-400 px-2 py-0.5 rounded bg-red-950 border border-red-800">
              TARGET INTEL
            </span>
            <div className="flex flex-wrap items-center gap-2 text-slate-300">
              {currentContract.intelClues.map((clue, idx) => (
                <span
                  key={idx}
                  className="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 font-tactical text-[11px]"
                >
                  • {clue}
                </span>
              ))}
            </div>
          </div>
          <span className="text-amber-400 font-tactical text-[11px]">
            BOUNTY: ${currentContract.rewardBounty.toLocaleString()}
          </span>
        </div>
      )}

      {/* ============================================================== */}
      {/* MAIN SURVEILLANCE CANVAS VIEWPORT                              */}
      {/* ============================================================== */}
      <div className="relative w-full aspect-[16/9] max-h-[580px] rounded-xl overflow-hidden border-2 border-slate-800 shadow-2xl bg-black">
        <canvas
          ref={canvasRef}
          onPointerMove={handlePointerMove}
          onContextMenu={(e) => {
            e.preventDefault();
            toggleScope();
          }}
          onClick={(e) => {
            e.preventDefault();
            handleFire();
          }}
          className={`w-full h-full block cursor-crosshair ${
            visionMode === 'NIGHT_VISION' ? 'filter hue-rotate-90' : ''
          }`}
        />

        {/* Scanlines Effect Overlay */}
        <div className="absolute inset-0 crt-scanlines opacity-40 pointer-events-none" />

        {/* IN-MISSION TACTICAL CONTROLS OVERLAY (BOTTOM LEFT / RIGHT) */}
        {gameState === 'IN_MISSION' && (
          <>
            {/* Bottom-left Scope Controls & Breath meter */}
            <div className="absolute bottom-3 left-3 flex flex-col gap-2 pointer-events-auto">
              {/* Breath Stamina Bar */}
              <div className="bg-slate-950/80 backdrop-blur-xs p-2 rounded-lg border border-slate-700 w-44">
                <div className="flex justify-between text-[10px] font-tactical mb-1 text-slate-300">
                  <span>STEADY BREATH (SHIFT)</span>
                  <span className={breathStamina < 20 ? 'text-red-400 animate-pulse' : 'text-cyan-400'}>
                    {breathStamina}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 ${
                      breathStamina < 20 ? 'bg-red-500' : 'bg-cyan-400'
                    }`}
                    style={{ width: `${breathStamina}%` }}
                  />
                </div>
              </div>

              {/* Action Buttons for Mobile / Quick Toggles */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleScope}
                  className={`px-3 py-1.5 rounded text-xs font-tactical font-semibold border transition-all ${
                    isScoped
                      ? 'bg-red-600 text-white border-red-500 shadow-md'
                      : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                >
                  {isScoped ? 'EXIT SCOPE' : 'SCOPE ADS [SPACE]'}
                </button>

                <button
                  onClick={cycleZoom}
                  className="px-2.5 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded text-xs font-tactical flex items-center gap-1"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  {zoom}X
                </button>

                <button
                  onClick={cycleVision}
                  className="px-2.5 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded text-xs font-tactical flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {visionMode}
                </button>

                <button
                  onClick={handleReload}
                  disabled={isReloading || ammo === MAG_CAPACITY}
                  className="px-2.5 py-1.5 bg-slate-900/90 hover:bg-slate-800 disabled:opacity-50 text-amber-300 border border-slate-700 rounded text-xs font-tactical flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  RELOAD [R]
                </button>
              </div>
            </div>

            {/* Mobile Big Fire Button (Bottom Right) */}
            <div className="absolute bottom-3 right-3 sm:hidden pointer-events-auto">
              <button
                onClick={handleFire}
                className="w-16 h-16 rounded-full bg-red-600/90 active:bg-red-500 border-2 border-red-400 text-white font-tactical font-bold text-xs flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
              >
                FIRE
              </button>
            </div>
          </>
        )}

        {/* ============================================================== */}
        {/* OVERLAYS: START MENU                                           */}
        {/* ============================================================== */}
        {gameState === 'MENU' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-950 border-2 border-red-500 flex items-center justify-center text-red-500 mb-4 shadow-red-500/20 shadow-2xl animate-pulse">
              <Crosshair className="w-9 h-9" />
            </div>

            <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-white tracking-widest mb-1">
              ROOK SNIPER
            </h1>
            <p className="font-tactical text-xs sm:text-sm text-red-400 tracking-wider mb-6">
              TACTICAL SURVEILLANCE & LONG-RANGE INTERCEPTION
            </p>

            <div className="max-w-md bg-slate-900/90 rounded-xl p-4 border border-slate-800 text-left mb-6 text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 font-tactical text-cyan-400 font-bold border-b border-slate-800 pb-1">
                <span>OPERATIONAL DIRECTIVES:</span>
              </div>
              <p>• Scrutinize surveillance footage and identify the high-value target from intel clues.</p>
              <p>• Wind knots cause horizontal bullet drift—compensate with your mil-dot scope.</p>
              <p>• Hold breath <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono text-cyan-300">Shift</kbd> to eliminate sway.</p>
              <p>• Avoid civilian casualties. Collateral damage aborts the contract immediately.</p>
            </div>

            <button
              onClick={handleStartGame}
              className="px-8 py-3 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-tactical text-sm tracking-widest font-bold rounded-lg border border-red-400 shadow-xl shadow-red-600/30 transition-all flex items-center gap-2"
            >
              <Crosshair className="w-4 h-4" />
              COMMENCE SURVEILLANCE
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* OVERLAYS: MISSION DOSSIER / BRIEFING                          */}
        {/* ============================================================== */}
        {gameState === 'BRIEFING' && currentContract && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-lg bg-slate-900 rounded-xl p-5 border-2 border-red-500/60 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  <span className="font-display font-bold text-sm tracking-wider text-white">
                    CLASSIFIED CONTRACT #{currentContract.contractNumber}
                  </span>
                </div>
                <span className="font-tactical text-xs px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
                  {currentContract.codename}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                {/* Silhouette & Target Info */}
                <div className="bg-slate-950/80 rounded-lg p-3 border border-slate-800 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 rounded-full bg-slate-900 border-2 border-dashed border-red-500/50 flex items-center justify-center mb-2">
                    <span className="text-3xl">👤</span>
                  </div>
                  <span className="font-display font-bold text-xs text-white">
                    {currentContract.targetPerson.name}
                  </span>
                  <span className="font-tactical text-[11px] text-red-400">
                    STATUS: ACTIVE IN SECTOR
                  </span>
                </div>

                {/* Intel Details */}
                <div className="flex flex-col justify-between text-xs space-y-2">
                  <div className="space-y-1.5 font-tactical">
                    <span className="text-[10px] text-slate-400 block uppercase">Intelligence Clues:</span>
                    {currentContract.intelClues.map((clue, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-slate-200">
                        <span className="text-red-400">▸</span>
                        <span>{clue}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between font-tactical text-[11px]">
                    <span className="text-slate-400">Estimated Wind:</span>
                    <span className="text-cyan-400 font-bold">
                      {currentContract.windKnots > 0 ? '+' : ''}{currentContract.windKnots} KT
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <button
                onClick={handleDeployContract}
                className="w-full py-3 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-tactical font-bold text-sm rounded-lg border border-red-400 shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2"
              >
                <Crosshair className="w-4 h-4" />
                ACCEPT CONTRACT & TAKE AIM
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* OVERLAYS: MISSION SUCCESS REPORT                              */}
        {/* ============================================================== */}
        {gameState === 'MISSION_SUCCESS' && endReport && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 rounded-xl p-5 border-2 border-emerald-500/70 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-emerald-950 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <h2 className="font-display font-bold text-xl text-white tracking-wider mb-1">
                CONTRACT COMPLETED
              </h2>
              <p className="font-tactical text-xs text-emerald-400 mb-4">
                {endReport.reason}
              </p>

              {/* Payout Breakdown */}
              <div className="bg-slate-950/90 rounded-lg p-3 border border-slate-800 text-xs font-tactical text-left space-y-2 mb-4">
                <div className="flex justify-between text-slate-300">
                  <span>Base Contract Reward</span>
                  <span className="text-amber-300 font-bold">${currentContract?.rewardBounty.toLocaleString()}</span>
                </div>
                {endReport.headshot && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Precision Headshot Bonus</span>
                    <span>+${endReport.accuracyBonus}</span>
                  </div>
                )}
                <div className="flex justify-between text-cyan-400">
                  <span>Time Efficiency Bonus</span>
                  <span>+${endReport.timeBonus}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-white text-sm">
                  <span>TOTAL BOUNTY EARNED</span>
                  <span className="text-amber-400">${endReport.bountyEarned.toLocaleString()}</span>
                </div>
              </div>

              {/* Next Contract */}
              <button
                onClick={() => loadNewContract(contractNum + 1)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-tactical font-bold text-xs rounded-lg transition-transform active:scale-95 shadow-lg"
              >
                PROCEED TO CONTRACT #{contractNum + 1}
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* OVERLAYS: MISSION FAILED REPORT                               */}
        {/* ============================================================== */}
        {gameState === 'MISSION_FAILED' && endReport && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 rounded-xl p-5 border-2 border-red-600 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-red-950 border-2 border-red-500 flex items-center justify-center text-red-500 mx-auto mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <h2 className="font-display font-bold text-xl text-white tracking-wider mb-1">
                MISSION ABORTED
              </h2>
              <p className="font-tactical text-xs text-red-400 mb-4">
                {endReport.reason}
              </p>

              <div className="bg-slate-950/90 rounded-lg p-3 border border-slate-800 text-xs font-tactical text-left space-y-1.5 mb-4 text-slate-300">
                <div className="flex justify-between">
                  <span>Contracts Completed:</span>
                  <span className="text-white">{stats.contractsCompleted}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Career Bounty:</span>
                  <span className="text-amber-400">${stats.score.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadNewContract(contractNum)}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-tactical font-bold text-xs rounded-lg transition-transform active:scale-95 shadow-md flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  RETRY CONTRACT
                </button>
                <button
                  onClick={() => {
                    setGameState('MENU');
                    gameRef.current.state = 'MENU';
                  }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-tactical text-xs rounded-lg"
                >
                  MAIN MENU
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* TACTICAL BRIEFING & SHORTCUTS FOOTER CARDS                    */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full mt-3">
        {/* Card 1: Keybinds */}
        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
          <span className="font-tactical font-bold text-slate-400 uppercase text-[10px] block mb-2">
            Weapon Controls
          </span>
          <div className="space-y-1 font-tactical text-slate-300">
            <div className="flex justify-between items-center">
              <span>Fire Weapon</span>
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-red-400 rounded text-[10px]">Left Click</kbd>
            </div>
            <div className="flex justify-between items-center">
              <span>Toggle Scope (ADS)</span>
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-cyan-400 rounded text-[10px]">Space / Right Click</kbd>
            </div>
            <div className="flex justify-between items-center">
              <span>Hold Breath (Stabilize)</span>
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-cyan-400 rounded text-[10px]">Shift</kbd>
            </div>
            <div className="flex justify-between items-center">
              <span>Reload Magazine</span>
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-amber-400 rounded text-[10px]">R</kbd>
            </div>
          </div>
        </div>

        {/* Card 2: Optical Modes */}
        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
          <span className="font-tactical font-bold text-slate-400 uppercase text-[10px] block mb-2">
            Optics & Vision
          </span>
          <div className="space-y-1 font-tactical text-slate-300">
            <div className="flex justify-between items-center">
              <span>Cycle Magnification (2x/4x/8x)</span>
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-cyan-400 rounded text-[10px]">Z / Q</kbd>
            </div>
            <div className="flex justify-between items-center">
              <span>Toggle Thermal / Night Vision</span>
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-emerald-400 rounded text-[10px]">V / N</kbd>
            </div>
            <div className="flex justify-between items-center">
              <span>Audio Mute</span>
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px]">M</kbd>
            </div>
          </div>
        </div>

        {/* Card 3: Performance Records */}
        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
          <span className="font-tactical font-bold text-slate-400 uppercase text-[10px] block mb-2">
            Service Record
          </span>
          <div className="space-y-1 font-tactical text-slate-300">
            <div className="flex justify-between items-center">
              <span>Contracts Neutralized:</span>
              <span className="text-white font-bold">{stats.contractsCompleted}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Precision Headshots:</span>
              <span className="text-emerald-400 font-bold">{stats.headshots}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Highest Bounty Career:</span>
              <span className="text-amber-400 font-bold">${stats.highScore.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

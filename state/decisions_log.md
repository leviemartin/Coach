# Decisions Log — OCR Training Coach

**Purpose:** Complete record of all information gathered, key decisions taken, and reasoning behind them. Referenced by all coaching agents for continuity.

---

## Date: March 9, 2026 — System Initialization

### Information Gathering Phase

#### Body Measurements (Taken March 9, 2026)
| Measurement | Value |
|-------------|-------|
| Height | 1.78m |
| Weight | 98.5kg |
| Waist at navel | 109cm |
| Wrist circumference | 20.5cm |
| Chest circumference | 109cm |
| Neck circumference | 42cm |
| BMI | 31.1 |
| Frame Size | Extra-large (wrist >20cm) |

#### Body Composition Cross-Validation
| Method | Body Fat % |
|--------|-----------|
| Garmin Scale | 29.5% |
| US Navy Formula | 29.8% |
| **Agreement** | **Within 0.3% — Garmin scale trustworthy for trend tracking** |

#### Derived Metrics
| Metric | Value | Interpretation |
|--------|-------|----------------|
| Fat Mass | ~29.2kg | Primary target for reduction |
| Lean Mass | ~69.3kg | Must be preserved or grown |
| Muscle Mass (Garmin) | 37.44kg | Floor: do not drop below 36kg |
| Bone Mass (Garmin) | 5.8kg | Above average, consistent with extra-large frame |
| Waist-to-Height Ratio | 0.612 | Above 0.6 = elevated metabolic risk. Expected to improve rapidly with visceral fat loss. |
| Waist-to-Chest Ratio | 1.0 | Indicates significant abdominal fat. Target: 0.80-0.85 |

#### Athlete Background (Gathered March 9, 2026)

**Racing History:**
- 6+ years of Spartan racing prior to July 2024 pause
- Completed Spartan Ultra Dallas, October 2022
- Regular Trifecta weekend competitor (Sprint + Super + Beast in one weekend)
- 2 marathons completed
- 3x Morzine Trifecta weekends (knows the venue, not the Ultra-specific loop)
- Training paused after second son born July 2024
- This is a COMEBACK, not a build-from-scratch

**Known Obstacle Weaknesses (All Grip-Dependent):**
- Multi-rig
- Bender
- Ape Hanger
- Twister (worst)

**Current Bodyweight Capacity:**
- Strict pull-ups: ~2
- Push-ups: 15+ (tested after fatigue, likely more fresh)
- Appreciates calisthenics and functional movements
- Interested in plyometrics (never tried, heard positive things from Ultra community)

**Baker's Cyst Status (March 9, 2026):**
- Currently pain-free at current training load
- Previous discomfort has resolved
- No physio assessment done — athlete willing to see physio if it recurs
- Decision: Monitor weekly. Physio visit triggered if symptoms return, especially before impact introduction.

**Other Physical Considerations:**
- Lower back and back fatigue from lifting toddlers daily
- No other injuries or chronic pain points

**Work & Schedule:**
- Office 2-3 days/week (dynamic, varies)
- WFH remaining days
- Gym near home AND near office — high flexibility
- Can do midday, early afternoon, or evening workouts depending on meeting load
- Some days evening is the only option
- Training window is genuinely flexible — not locked to any time

**Bedtime Issue Root Cause:**
- Organizing house while toddlers sleep (task-oriented personality: "if I start something it needs to get done")
- Finishes with 1 TV show
- Late dog walk to give morning flexibility
- Goal is bed by 23:00 (feels best at this time)
- Too early → wakes frequently; too late → known problem
- Mild insomnia, believes manageable
- Compounded by wife's pregnancy (more to do around the house)
- **This is a behavioral/system problem, not medical insomnia. Fix = shutdown routine with hard boundaries that satisfy his completionist need.**

**Partner & Family:**
- Partner very supportive of training
- Agreement: 1 weekend day for 90-min training session (will continue even with newborn)
- Shares weekly training schedule with partner for planning
- Partner can arrange help when he's away for training
- Baby #3 arriving August 2026
- 2 months paternity leave planned

**Stress Profile:**
- Task-oriented, not anxiety-driven
- No exceptional work stress
- Normal married-couple-with-kids-and-pregnancy stress
- "Life is busy but fun"

**Gym Equipment (TrainMore Network):**
- Access to all Black Label, Regular, and 1 Red Label gym (Roelofhartplein)
- Equipment confirmed: monkey bars (varying distances), pull-up bars, battle ropes, StairMaster (TechnoGym), some SkillMills
- No proper sled (or only ~10m distance). Some TechnoGym treadmills with sled function.
- TRX: not available at TrainMore. Could buy for home use.
- Equipment varies by location — must be strategic about which gym for which session

**Outdoor Access (Laren, Netherlands):**
- Near Hoge Veluwe, forests, heather fields, dunes
- Multiple outdoor options within 30-minute drive
- Monthly can go 60 minutes away (Limburg hills, Belgian Ardennes potential)
- Holland is FLAT — major challenge for Morzine elevation prep
- Known elevation locations: Haarlemmermeer pyramid (walkable). Piramide van Austerlitz (closed for renovation).
- Multi-day trail trips not realistic during pregnancy/baby phase; potentially possible 2027

**Swimming:** Yes, indoor and outdoor. Prefers seasonal appropriateness (no winter outdoor).

**Travel:** Infrequent. Always books hotel with gym. Will indicate travel during weekly check-ins.

**Race-Specific:**
- Zandvoort Super confirmed (10km / 25 obstacles, May 2026)
- Competing age-group at Morzine (earlier start time, stricter penalties — must complete obstacles or take penalty loop)
- Race goal: Finish in ~12 hours (vs 14-hour cutoff) — performance goal, not just survival
- No knowledge of Ultra-specific loop at Morzine — needs research

**Non-Negotiables:**
- 1 weekend day = family time, no training (no exceptions unless family is away)
- Preferred training day: Sunday (with occasional Saturday swaps for planning conflicts)
- All other time restrictions communicated via weekly check-ins

---

### Decision 1: Multi-Agent Coaching Architecture
**Decision:** Implement 8-agent expert coaching team
**Date:** March 9, 2026
**Status:** APPROVED

**Agents:**
1. Head Coach (Coordinator) — synthesizes, resolves conflicts, owns schedule
2. Strength & Hypertrophy Specialist — progressive overload, structural integrity, muscle preservation
3. Endurance & Energy Systems Coach — aerobic base, threshold, ultra-distance prep
4. OCR & Functional Movement Specialist — grip, carries, obstacle skills, race-specific training
5. Nutrition & Body Composition Strategist — caloric management, protein, fueling, hydration
6. Recovery & Sleep Scientist — sleep, HRV, stress, deload programming
7. Mobility & Injury Prevention Specialist — Baker's Cyst, prehab, joint health
8. Mental Performance & Habit Coach — behavioral change, accountability, race psychology

**Reasoning:** Single-coach model has blind spots. OCR Ultra demands simultaneous optimization across conflicting domains (strength vs endurance, weight loss vs muscle preservation, volume vs recovery). Multi-agent system forces conflicts into the open and ensures no domain is neglected.

**Collaboration Model:** All agents receive same data → individual analysis → cross-review with challenges → Head Coach resolves conflicts → unified schedule output. Athlete sees the inter-agent debate during check-ins.

---

### Decision 2: Zandvoort Super Strategy
**Decision:** Option C — Hybrid approach
**Date:** March 9, 2026
**Status:** APPROVED

**What this means:**
- Start conservative treadmill walk-to-jog progression (incline walking → jog intervals) in controlled gym environment only
- Accept that Zandvoort will be mostly walking with short jog segments on flats
- Treat Zandvoort as a systems check: test obstacles, race nutrition (Maurten), mental readiness
- NOT a performance race — but a critical milestone for confidence and obstacle assessment

**Reasoning:** Zero running base + Baker's Cyst history (no physio clearance) makes aggressive running introduction risky. Gym treadmill provides controlled, cushioned surface. 10km is walkable in ~90-100 min even without running. The real value of Zandvoort is obstacle testing and identifying grip weaknesses under race fatigue, not run time.

---

### Decision 3: Pull-Up Progression Priority
**Decision:** Option B — Integrated (3x/week)
**Date:** March 9, 2026
**Status:** APPROVED

**What this means:**
- Pull-up progression work embedded in all 3 upper body sessions per week
- Methods: negatives, band-assisted, dead hangs, scapular pull-ups, lat pulldown as assistance
- Target: 5-6 strict pull-ups by Zandvoort (May 2026)
- Long-term target: 10 strict pull-ups by race day (performance benchmark)

**Reasoning:** Aggressive 4-5x/week risks tendon overuse (especially at 98.5kg bodyweight). Integrated 3x/week provides sufficient stimulus with adequate recovery. Pull-up improvement also benefits from weight loss — every kg dropped improves relative pulling strength automatically.

---

### Decision 4: Race Weight Target
**Decision:** 89kg committed / 87kg conditional stretch
**Date:** March 9, 2026
**Status:** APPROVED

**Agent Consensus:**
| Agent | Position | Reasoning |
|-------|----------|-----------|
| Strength | 89kg target, 87kg min | Extra-large frame (20.5cm wrist). Lean mass floor ~70-72kg for this frame. Below 87kg risks muscle loss. |
| Endurance | 89kg (revised from 85-87) | Mountain energy cost matters but frame data makes <87kg unsustainable during baby phase |
| OCR | 89kg (performance-gated) | Weight number less important than functional benchmarks (pull-ups, grip, carries) |
| Nutrition | 89kg (DEXA-dependent) | Navy formula confirms Garmin accuracy. 22% BF at 89kg is athletic and sustainable for this frame. |
| Recovery | 89kg (87 only if sleep improves) | Aggressive cut + sleep deprivation + newborn = injury/illness risk |
| Mobility | No number opinion | Flags rapid loss during impact introduction as compounding injury risk |
| Mental Performance | 89kg committed, 87kg bonus | Protects psychology during Dad Mode. Hitting 89 creates momentum. |

**Conditions for pursuing 87kg stretch:**
1. DEXA scan confirms lean mass >70kg
2. Sleep score consistently >70 by Phase 4
3. Baby #3 sleep stabilizes by November 2026
4. No Baker's Cyst recurrence during impact phases
5. Functional benchmarks met (10 pull-ups, 60s dead hang, farmer carry 2x30kg/100m, 5 rope ascents in <3 min)

**Body composition at targets:**
| Weight | Fat Mass | Body Fat % | BMI |
|--------|----------|-----------|-----|
| 89kg | 19.7kg | 22.1% | 28.1 |
| 87kg | 17.7kg | 20.3% | 27.5 |

---

### Decision 5: Phase Milestone Weights
**Decision:** Phased weight targets with Dad Mode maintenance
**Date:** March 9, 2026
**Status:** APPROVED

| Phase | Timeline | Weight Target | Rationale |
|-------|----------|---------------|-----------|
| Phase 1 Exit | End Mar 2026 | ≤96kg | Structural integrity confirmed, impact-ready |
| Phase 2 Exit | End Jun 2026 | ~92-93kg | Running established, Zandvoort complete |
| Phase 3 (Dad Mode) | Jul-Oct 2026 | Hold 92-93kg | Baby #3. Maintain, do not regress. Do NOT exceed 95kg. |
| Phase 4 Exit | End Feb 2027 | ~89kg | DEXA #2 validates, cutting resumes |
| Phase 5-6 | Mar-Jul 2027 | 87-89kg | Performance benchmarks gate final push |

**Protein scaling:**
- Current → 95kg: 180g/day
- Below 95kg: 190g/day
- Below 92kg: 200g/day
- Reasoning: Leaner body requires more aggressive muscle protein synthesis support to prevent lean mass loss during deficit

---

### Decision 6: DEXA Scan Schedule
**Decision:** 3 strategically timed scans
**Date:** March 9, 2026
**Status:** APPROVED

| Scan | Timing | Purpose |
|------|--------|---------|
| #1 | March 2026 (ASAP) | Baseline ground truth. Validate Garmin accuracy. Confirm lean mass to assess 87kg feasibility. Regional fat distribution (visceral risk). |
| #2 | November 2026 | Post-Dad Mode. Did lean mass survive baby phase? Fat regain assessment. Informs Phase 4 cutting strategy. |
| #3 | May 2027 | Pre-race composition. Final race weight validation. Taper nutrition calibration. |

**Reasoning:** 3 scans at critical transition points. Scan #1 most urgent — could shift entire weight framework. Scan #2 catches any Dad Mode damage. Scan #3 ensures race-readiness.

---

### Decision 7: Lower Body Plyometrics Gate
**Decision:** Upper body plyo starts now, lower body gated by conditions
**Date:** March 9, 2026
**Status:** APPROVED

**Upper body plyo (immediate):**
- Medicine ball throws (chest pass, overhead, rotational)
- Explosive push-up progressions (hands off ground, clap progression)

**Lower body plyo gate conditions (ALL must be met):**
1. Weight under 93kg
2. Baker's Cyst: zero symptoms for 6+ consecutive weeks
3. Completed 4-week low-impact progression:
   - Weeks 1-2: Box step-ups with controlled descent (no jump)
   - Weeks 3-4: Depth drops from 15cm box (step off, land softly, no rebound)
4. Can squat bodyweight for 5 reps (goblet or front squat)

**Estimated timeline:** Phase 2, approximately Week 20-24 (May-June 2026)

**Reasoning:** At 98.5kg, plyometric ground reaction forces reach 3-5x bodyweight (up to 492kg through knees). Baker's Cyst history demands conservative approach. Weight reduction to <93kg drops peak forces to <465kg. Upper body plyo carries no knee risk and develops explosive power needed for wall climbs and burpees immediately.

---

### Decision 8: Training Day Preference
**Decision:** Sunday primary, Saturday swap when needed
**Date:** March 9, 2026
**Status:** APPROVED

**What this means:**
- Long session (ruck, outdoor) defaults to Sunday
- 1 weekend day is sacred family time (typically Saturday)
- Athlete will communicate swaps during weekly check-in or ad-hoc
- Sunday check-in (/checkin) may occur before or after the training session

---

### Decision 9: Zandvoort Registration
**Decision:** Register for Super (10km / 25 obstacles)
**Date:** March 9, 2026
**Status:** APPROVED

**Reasoning:** Athlete felt it would be a "missed opportunity" not to compete. Super provides better obstacle density for testing grip weaknesses than Sprint. Approached as a systems check, not a performance race.

---

## Key Coaching Principles Established

1. **This is a comeback, not a beginner program.** Neuromuscular patterns and race psychology are dormant, not absent. Body will re-adapt faster but injury risk during re-ramp is higher.
2. **Sleep is the #1 performance limiter.** Behavioral fix needed (shutdown routine), not medical intervention.
3. **Grip is the #1 race-specific weakness.** All identified problem obstacles are grip-dependent. Weight loss directly improves grip-to-weight ratio.
4. **Holland is flat.** Morzine has 4000m+ elevation. StairMaster is the primary elevation simulator. Monthly trips to hills (Limburg, Ardennes) when possible.
5. **Dad Mode (Phase 3) is the danger zone.** Minimum effective dose. Home equipment (C2 rower, kettlebells) is the backbone. Survival, not progression.
6. **Extra-large frame changes everything.** 20.5cm wrist = higher lean mass floor, higher caloric needs, higher minimum healthy weight than average 1.78m male.
7. **Athlete is task-oriented.** Systems and routines work better than willpower. Design completion-based habits.
8. **Lower back fatigue from kids is a chronic stressor.** Core stability and hip hinge reinforcement are non-negotiable.

---

*This document is append-only. New decisions and information are added with dates as the coaching relationship evolves.*

---
name: checkin
description: Sunday weekly check-in — multi-agent analysis, Garmin data, generate next week's training schedule
user_invocable: true
---

# /checkin — Weekly Coach Check-In (Multi-Agent)

You are executing the Sunday weekly check-in protocol with the full 8-agent coaching team. Follow these steps precisely.

## Step 1: Pull Garmin Data

Run the Garmin connector to get fresh data:

```bash
cd /Users/martinlevie/garmin-coach && python3 garmin_connector.py
```

If the script fails (auth issues, network), fall back to reading the most recent export:
`/Users/martinlevie/garmin-coach/garmin_coach_data.json`

## Step 2: Load Context

Read these files in parallel:
- `/Users/martinlevie/garmin-coach/garmin_coach_data.json` — Garmin data
- `state/current_ceilings.json` — Current working weights
- `state/training_history.md` — Historical comparison
- `state/periodization.md` — Current phase context
- `state/decisions_log.md` — Active decisions and gates
- `state/athlete_profile.md` — Athlete context and targets

## Step 3: Multi-Agent Analysis

Run all 7 specialist agents against the data. Each agent has a persona file in `coaches/` that defines their domain, what they monitor, their red flags, and their output format.

### Agent Execution
Spawn specialist agents in parallel. Each agent receives:
1. The Garmin JSON data
2. Their persona file from `coaches/`
3. The current ceilings, training history, and athlete profile
4. Instruction to produce their domain-specific analysis AND flag any concerns or challenges to other agents

The 7 agents to run:
1. **Strength & Hypertrophy** (`coaches/01_strength_hypertrophy.md`) — Analyze lifts, ceilings, pull-up progression, muscle mass trend
2. **Endurance & Energy Systems** (`coaches/02_endurance_energy.md`) — Analyze training effects, load focus, aerobic/anaerobic status, ACWR
3. **OCR & Functional Movement** (`coaches/03_ocr_functional.md`) — Assess obstacle readiness, grip status, functional benchmarks, upper body plyo
4. **Nutrition & Body Composition** (`coaches/04_nutrition_body_comp.md`) — Analyze calories, protein, hydration, weight trend, body comp
5. **Recovery & Sleep** (`coaches/05_recovery_sleep.md`) — Analyze sleep scores, bedtimes, readiness, HRV, Vampire Protocol compliance
6. **Mobility & Injury Prevention** (`coaches/06_mobility_injury.md`) — Assess Baker's Cyst, lower back, Rug Protocol, injury risk, core stability
7. **Mental Performance & Habits** (`coaches/07_mental_performance.md`) — Assess protocol compliance, habit tracking, psychological state

### Agent Output Collection
Each agent produces:
- Domain-specific assessment
- Red flags or concerns
- Recommendations for next week
- Challenges to other agents (if any)

## Step 4: Conflict Resolution

As Head Coach (`coaches/00_head_coach.md`), review all agent outputs and:

1. **Identify conflicts** between agent recommendations
2. **Present the debate** to the athlete using the format:
   ```
   ### Agent Debate: [Topic]
   **[Agent A]** recommended: [X]
   **[Agent B]** challenged: [Y]
   **Head Coach decision:** [Final call + reasoning]
   ```
3. **Apply the priority hierarchy:**
   - Injury prevention > Recovery > Race-specific > Long-term progression > Sustainability > Optimization

## Step 5: Unified Diagnostic Briefing

Present the synthesized briefing in this order:

### A. Sleep & Recovery (Recovery Agent — LEAD)
- Sleep scores, bedtimes, Vampire Protocol compliance
- Training readiness trend and decision (train/reduce/deload/rest)
- HRV and body battery status

### B. Body Composition & Nutrition (Nutrition Agent — LEAD)
- Weight trend and body comp changes
- Caloric and protein adherence
- Hydration tracking status
- Cortisol Floor Rule application if relevant

### C. Training Load & Performance (Endurance + Strength Agents — LEAD)
- Aerobic high / anaerobic status and shortage flags
- ACWR and load trend
- Strength ceiling changes, pull-up progression
- Activities completed vs planned

### D. Obstacle Readiness (OCR Agent — LEAD)
- Functional benchmark progress
- Grip training status
- Upper body plyo progression
- Zandvoort/Morzine preparation status

### E. Mobility & Injury Risk (Mobility Agent — LEAD)
- Baker's Cyst status
- Lower back status
- Rug Protocol compliance
- Core stability completion
- Phase transition readiness

### F. Behavioral & Mental (Mental Performance Agent — LEAD)
- Protocol compliance scorecard
- Habit tracking
- Psychological observations
- Accountability notes

## Step 6: Request Hevy Data

Ask the athlete:
> "Paste your Hevy CSV for this week. I need it to verify progressive overload and update your ceilings."

Wait for response. If not available, proceed with Garmin-only data and note strength tracking is incomplete.

## Step 7: Interactive Check-In

Walk through:
1. Sessions completed vs planned — what was missed and why?
2. Baker's Cyst — any posterior knee tightness? Pain level 1-10?
3. Lower back — fatigue level from kids?
4. Strength wins — what felt strong?
5. Struggles — what didn't work?
6. Sleep — what happened with bedtimes? Was the Shutdown Routine attempted?
7. Hydration — did you start tracking?
8. Rug Protocol — how many days?
9. Upcoming conflicts for next week?
10. Goal or focus for next week?

## Step 8: Generate Next Week's Schedule

Based on all agent inputs and athlete feedback:

1. Read current ceilings from `state/current_ceilings.json`
2. Apply progressive overload rules (Strength Agent):
   - Upper body: +2-2.5kg/week if all sets clean
   - Lower body: +5kg/week if all sets clean
   - Failed sets: hold current weight
3. Apply Training Readiness Decision Matrix (Recovery Agent)
4. Address training load shortages (Endurance Agent)
5. Include pull-up progression and upper body plyo (OCR Agent)
6. Include core stability 3x/week (Mobility Agent)
7. Consider lifestyle conflicts and schedule (Mental Performance Agent)
8. Apply protein target for current weight phase (Nutrition Agent)

Output as pipe-separated table:

```
| Done? | Day | Session Type | Focus | Est. Starting Weight (Hevy) | Detailed Workout Plan | Coach's Cues & Mobility | My Notes |
|-------|-----|-------------|-------|-------------------------------|----------------------|------------------------|----------|
```

### Workout Cell Content Format (CRITICAL)
Use standard gym notation with letter-number labels:
- Same letter = done together (superset/tri-set)
- Different letter = done sequentially
- Numbers indicate order within a group
- Standalone exercises use letter + 1 (e.g., C1:)

**Exercise format:** `[Label]: [Exercise]: [weight] x[reps] [annotations]`
**Group notes:** `[rounds, rest]` on own line after the group

Example:
```
Warm-up:
- 5min row easy
- Band pull-aparts 2x15

A1: Band-Assisted Pull-ups: Max reps (aim 5-8)
A2: Dead Hang: 30s
[3 rounds, 90s rest]

B1: Lat Pulldown: 45kg x12
B2: Band Pull-aparts: x20
[3 rounds, 90s rest]

C1: Cable Row: 50kg x12
[3 sets, 90s rest]

D1: Negative Pull-ups: 3 reps (3-second descent)
D2: Hammer Curls: 10kg x12
[3 rounds, 60s rest]

Finisher:
- 15min Treadmill Walk @ 10% incline
```

**Rules:**
- Warm-up and cool-down: section headers with dash-prefix exercises
- All main work: letter-number labels (A1:, B1:/B2:, C1:, etc.)
- Round/rest info: square brackets on own line after group
- One exercise per line
- Do NOT use free-form section headers like "Superset A (3 rounds, 90s rest):" or "Pull-Up Bar Block:"
- Do NOT use `<br>`, `**bold**`, or `•`
- Do NOT use period-separated lists on a single line

### Session Duration Target
**50-60 minutes** including warm-up and mobility. This is a hard cap.

Time budget per session:
- Warm-up: 5 min
- Main work (A-D blocks): 35-40 min
- Finisher/cardio: 10-15 min
- Cool-down: 5 min

If total exceeds 60 minutes, reduce accessory sets first. Never cut core stability or pull-up progression.

### No Duplicate Exercises
Each exercise appears ONCE in the session plan. If an exercise serves multiple goals (e.g., dead hangs for grip AND pull-up progression), place it in ONE block — not two. Combine the volume in that single block.

If band pull-aparts appear in the warm-up, do NOT also include them in a superset. Pick one location.

### Superset Equipment Rules (TrainMore — Busy Commercial Gym)
The athlete can hold ONE machine at a time. Valid superset pairings:
- Same station: Lat Pulldown → Straight-arm Pulldown (same cable)
- Machine + portable: Cable Row + Band Pull-aparts
- Machine + bodyweight: Leg Press + Bodyweight Lunges (at the machine)
- Two portable items: DB Bench + DB Curls (same dumbbells)

INVALID (requires 2 machines simultaneously):
- Lat Pulldown + Cable Row (two different cable stations)
- Chest Press Machine + Seated Row Machine
- Leg Press + Hamstring Curl (two separate machines)

For machine pairings that can't share equipment, use SEQUENTIAL blocks with full rest, NOT supersets.

### Circuit Equipment Rules (TrainMore — Busy Commercial Gym)
In a circuit (3+ exercises rotated continuously), the athlete leaves each station for 4-5 minutes per round. Machines WILL be taken by other gym members.

**Rule:** Only the FIRST exercise in a circuit may be a stationary machine (StairMaster or Rower — to start the circuit with cardio). All subsequent exercises must use portable equipment or bodyweight.

Portable = dumbbells, kettlebells, bands, medicine ball, plates
Stationary = any cable machine, any selectorized machine, Smith machine

VALID circuit example:
- Rower: 250m sprint (circuit opener)
- DB Goblet Squat: 24kg x10
- Band Woodchops: Medium band x12/side
- Med Ball Slams: 6kg x8
- Push-ups: 12

INVALID circuit example:
- Rower: 250m sprint
- DB Goblet Squat: 24kg x10
- Cable Woodchops: 15kg x12 ← INVALID (cable machine mid-circuit)
- Med Ball Slams: 6kg x8

**Common cable exercise replacements for circuits:**
- Cable Woodchops → Band Woodchops or DB Woodchops (single DB held at end)
- Cable Face Pulls → Band Pull-aparts or Band Face Pulls
- Cable Pallof Press → Band Pallof Press
- Cable Tricep Pushdown → Band Tricep Pushdown or DB Skull Crushers

### Pull-Up Bar Zone Rule (TrainMore Layout)
The pull-up bar is in the barbell/free weight area, NOT near cable machines. Pull-up bar exercises are in their OWN zone.

Pull-up bar exercises: pull-ups, negative pull-ups, band-assisted pull-ups, dead hangs, chin-ups, hanging knee raises

Pull-up bar can ONLY be superset with:
- Other pull-up bar exercises (pull-ups + dead hangs)
- Portable equipment brought to the bar (bands, DBs for weighted pull-ups)
- Bodyweight exercises doable at the bar area (push-ups, dips if dip station is adjacent)

INVALID pull-up bar supersets:
- Lat Pulldown + Pull-ups ✗ (pull-up bar is far from cable zone)
- Cable Row + Negative Pull-ups ✗ (two locations)
- Any cable machine + any pull-up bar exercise ✗

VALID pull-up bar supersets:
- Band-Assisted Pull-ups + Dead Hang ✓ (same bar)
- Pull-ups + DB Curls ✓ (bring DBs to bar area)
- Pull-ups + Push-ups ✓ (bodyweight at bar area)
- Pull-ups + Band Pull-aparts ✓ (band at bar area)

### Sunday Ruck Sessions (Outdoor Only)
Sunday ruck sessions with the Vizsla are OUTDOOR ONLY. The ruck happens in nature (woods, parks, trails).

ALLOWED during a Sunday ruck:
- Bodyweight exercises at outdoor locations (push-ups, air squats at a park bench, step-ups on a log)
- Walking lunges on the path
- Bear crawls on grass

NOT ALLOWED on Sunday ruck sessions:
- "At Gym (Pre or Post Ruck)" blocks — no gym visits on ruck day
- Monkey bars, pull-up bar dead hangs, or any gym-dependent exercise
- Any exercise requiring gym equipment

Gym-dependent exercises (monkey bars, dead hangs on pull-up bar, cable work) belong on WEEKDAY gym sessions. Schedule them there instead.

### Weight Notation (MANDATORY — No Exceptions for Loaded Exercises)
Every exercise using external load MUST show weight in the workout plan:
- Machines/cables: `- Lat Pulldown: 45kg x10`
- Dumbbells: `- DB Bench: 22kg x10`
- Medicine ball: `- Med Ball Slams: 6kg x8`
- Plates: `- Russian Twists w/10kg plate: 20 total`
- Bands: `- Band Pull-aparts: Light band x20`
- Farmer carry: `- Farmer Walk: 24kg/hand x40m`

Bodyweight-only exercises are the ONLY exception — show reps/duration only:
- `- Pull-ups: Max reps`
- `- Dead Hang: Max time (target 60s)`
- `- Plank: 45s hold`

Reference `state/current_ceilings.json` for tracked exercises. For untracked equipment, assign a conservative starting weight and note it for ceiling tracking.

### Exercise Description Clarity (ZERO AMBIGUITY)
The athlete must NEVER guess what to do. Every line = one clear instruction.

FORBIDDEN patterns:
- "DB Bench or 20kg+pauses: 3x10" — NEVER use "or" between exercises/weights
- "Lateral Raises: 5-6kg x12" — pick ONE weight
- "Band-assisted/negative pull-ups" — pick ONE variation

CORRECT pattern for alternatives:
- `- DB Bench: 22kg x10`
- `IF 22kg too heavy: DB Bench: 20kg x10 (2s pause at bottom)`

CORRECT pattern for testing:
- `- DB Bench: Test 22kg x8-10`
- `Note: If 22kg fails at rep 6, drop to 20kg and complete set`

Every exercise MUST match one of these templates:
- `- Exercise: Xkg x reps` (weighted)
- `- Exercise: Xkg x reps/side` (unilateral)
- `- Exercise: reps or duration` (bodyweight only)

## Step 9: Close the Briefing

End the athlete-facing output with the mandated sign-off:
> *"Time to work."* or *"Go get it done."*

**Important:** The sign-off is the LAST thing the athlete sees. Nothing after this is athlete-facing.

## Step 10: Update State Files

After the sign-off, update internal state files. These are system operations, NOT part of the athlete briefing. Do NOT include them in the weekly log's Head Coach Synthesis section.

1. **Append to `state/training_history.md`** — New week section with key metrics from all agents
2. **Update `state/current_ceilings.json`** — If progressive overload applied, update ceilings and progression_history
3. **Save full check-in to `state/weekly_logs/week_NN_YYYY-MM-DD.md`** — Include agent analyses, debates, athlete responses, and schedule. If state update notes are included, place them under a `## State Updates Required` heading AFTER the sign-off so the dashboard can exclude them.
4. **Update `state/decisions_log.md`** — If any new decisions were made during the check-in

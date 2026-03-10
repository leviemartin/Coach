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

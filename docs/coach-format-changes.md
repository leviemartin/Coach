# Coach Format Changes for Workout Tracker

The workout tracker parser (`dashboard/lib/workout-parser.ts`) expects specific formatting in the weekly schedule's "Detailed Workout Plan" column. These changes require athlete approval before the Head Coach adopts them.

## Required Format Changes

### 1. Exercise Labels: Letter-Number Notation
Every exercise MUST start with a label like `A1:`, `B1:`, `C1:`.

**Before:** `Pull-ups 5×3`
**After:** `A1: Pull-ups 5×3`

### 2. Superset Grouping: Same Letter, Different Number
Exercises in a superset share the same letter.

**Before:**
```
Lat Pulldown 3×10 @50kg (superset with Face Pulls)
Face Pulls 3×15 @15kg
```
**After:**
```
A1: Lat Pulldown 3×10 @50kg
A2: Face Pulls 3×15 @15kg
```

### 3. Weight Notation: @Xkg
Prescribed weights use `@` prefix with `kg` suffix.

**Before:** `DB Rows 3×10 (22.5kg)`
**After:** `C1: DB Rows 3×10 @22.5kg`

### 4. Timed Exercises: Xs suffix
Duration-based exercises use `s` suffix on the rep count.

**Before:** `Dead Hang 3×30 seconds`
**After:** `B1: Dead Hang 3×30s`

### 5. Rest and Round Annotations: Square Brackets
Rest periods and round counts go in square brackets.

**Before:** `Rest 90 seconds between sets`
**After:** `A1: Lat Pulldown 3×10 @50kg [3 rounds, 90s rest]`

### 6. Cardio Format: Colon-Separated Specs
Cardio exercises use `Name: specs` format.

**Before:** `Rower sprints - 8 rounds of 20 second work with 1:40 rest targeting >300W`
**After:** `Rower Sprints: 8 rounds, 20s work / 1:40 rest, >300W target`

## Backward Compatibility

The parser includes fuzzy matching and will attempt to parse non-standard formats, but accuracy improves significantly with these conventions.

## Status

- [x] Athlete reviewed and approved (2026-03-22)
- [x] Head Coach updated schedule template (00_head_coach.md + 02_endurance_energy.md)

#!/usr/bin/env python3
"""
Garmin Connect Data Connector for Personal Coach (v2)
=====================================================
Extracts structured fitness data from Garmin Connect for use as
the data backbone of an AI personal coach built in Claude.

Usage:
    # First run (will prompt for credentials and save token):
    python3 garmin_connector.py

    # With environment variables:
    export GARMIN_EMAIL="your@email.com"
    export GARMIN_PASSWORD="your_password"
    python3 garmin_connector.py

    # Custom date range (default: last 28 days):
    python3 garmin_connector.py --days 28

    # Output to specific file:
    python3 garmin_connector.py --output my_data.json

    # Skip auto-archiving:
    python3 garmin_connector.py --no-archive

Output structure (v2.1):
    Each section has "daily" (entry per day) + "summary" (min/max/avg),
    giving the coach both trend visibility and quick stats at a glance.
    
    - activities:         This week's sessions (strength + cardio summaries)
    - health_stats_7d:    Daily entries + summaries (HR, stress, sleep, body battery, body comp)
    - performance_stats:  Training readiness daily (7d) + HRV daily (4w) + training effects
    - nutrition_stats_7d: Daily entries + summaries + goals
    - four_week_context:  Weekly breakdowns for progressive overload tracking

Archive:
    Each export is auto-archived to ./archive/garmin_YYYY-MM-DD.json
    so you can track progress over time and compare across weeks.
"""

import argparse
import datetime
import getpass
import json
import logging
import os
import shutil
import sys
from pathlib import Path

try:
    from garminconnect import Garmin
except ImportError:
    print("ERROR: garminconnect package not installed.")
    print("Install it with: pip3 install garminconnect")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
TOKEN_DIR = Path.home() / ".garmin_coach_tokens"
DEFAULT_OUTPUT = "garmin_coach_data.json"
LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"

logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
def prompt_for_mfa() -> str:
    """Prompt the user for their MFA code with clear instructions."""
    print()
    print("=" * 60)
    print("🔐 Garmin is asking for a verification code (MFA/2FA).")
    print()
    print("   This is normal! Garmin sends a code to your email.")
    print("   1. Check your email (the one linked to Garmin)")
    print("   2. Find the email from Garmin with a verification code")
    print("   3. Type that code below and press Enter")
    print()
    print("   (You only need to do this once — the login token")
    print("    will be saved and is valid for about a year.)")
    print("=" * 60)
    print()
    code = input("   Enter verification code: ").strip()
    return code


def authenticate() -> Garmin:
    """Authenticate with Garmin Connect. Uses saved tokens if available,
    otherwise prompts for credentials and saves tokens for next time."""

    email = os.getenv("GARMIN_EMAIL", "")
    password = os.getenv("GARMIN_PASSWORD", "")

    # Try to resume from saved tokens first
    if TOKEN_DIR.exists():
        try:
            logger.info("Attempting to resume session from saved tokens...")
            client = Garmin()
            client.login(str(TOKEN_DIR))
            logger.info("✅ Resumed session successfully.")
            return client
        except Exception:
            logger.info("Saved tokens expired or invalid, logging in fresh...")

    # Fresh login
    if not email:
        email = input("Garmin Connect email: ").strip()
    if not password:
        password = getpass.getpass("Garmin Connect password: ")

    try:
        client = Garmin(email, password, prompt_mfa=prompt_for_mfa)
        client.login()

        # Save tokens for next time
        TOKEN_DIR.mkdir(parents=True, exist_ok=True)
        client.garth.dump(str(TOKEN_DIR))
        logger.info("✅ Logged in and tokens saved to %s", TOKEN_DIR)
        logger.info("   (Next time you run this, no password or MFA needed!)")

        return client
    except Exception as e:
        logger.error("❌ Authentication failed: %s", e)
        logger.error("")
        logger.error("Troubleshooting:")
        logger.error("  1. Double-check your email and password")
        logger.error("  2. If MFA code didn't arrive, check your spam folder")
        logger.error("  3. To start fresh, run: rm -rf ~/.garmin_coach_tokens")
        logger.error("  4. Then try running this script again")
        sys.exit(1)


# ---------------------------------------------------------------------------
# Data Extraction Helpers
# ---------------------------------------------------------------------------
def safe_call(func, *args, label="API call", **kwargs):
    """Safely call a Garmin API method, returning None on failure."""
    try:
        result = func(*args, **kwargs)
        return result
    except Exception as e:
        logger.warning("⚠️  %s failed: %s", label, e)
        return None


def ensure_dict(data) -> dict:
    """Garmin API sometimes returns a list where we expect a dict.
    This normalizes the response by picking the first item if it's a list."""
    if isinstance(data, list):
        return data[0] if data else {}
    if isinstance(data, dict):
        return data
    return {}


def extract_daily_stats(client: Garmin, date: datetime.date) -> dict:
    """Extract daily summary stats (steps, calories, distance, etc.)."""
    date_str = date.isoformat()
    stats = safe_call(client.get_stats, date_str, label=f"Stats {date_str}")
    if not stats:
        return {}
    stats = ensure_dict(stats)

    return {
        "date": date_str,
        "total_steps": stats.get("totalSteps"),
        "total_distance_m": stats.get("totalDistanceMeters"),
        "calories_total": stats.get("totalKilocalories"),
        "calories_active": stats.get("activeKilocalories"),
        "calories_bmr": stats.get("bmrKilocalories"),
        "calories_consumed": stats.get("consumedCalories"),
        "moderate_intensity_min": stats.get("moderateIntensityMinutes"),
        "vigorous_intensity_min": stats.get("vigorousIntensityMinutes"),
        "floors_climbed": stats.get("floorsAscended"),
        "min_heart_rate": stats.get("minHeartRate"),
        "max_heart_rate": stats.get("maxHeartRate"),
        "resting_heart_rate": stats.get("restingHeartRate"),
        "avg_stress_level": stats.get("averageStressLevel"),
        "max_stress_level": stats.get("maxStressLevel"),
        "body_battery_high": stats.get("bodyBatteryHighestValue"),
        "body_battery_low": stats.get("bodyBatteryLowestValue"),
    }


def extract_sleep(client: Garmin, date: datetime.date) -> dict:
    """Extract sleep data for a given date."""
    date_str = date.isoformat()
    sleep = safe_call(client.get_sleep_data, date_str, label=f"Sleep {date_str}")
    if not sleep:
        return {}
    sleep = ensure_dict(sleep)

    daily = sleep.get("dailySleepDTO", {})

    # Extract bedtime and wake time from timestamps
    bedtime = None
    wake_time = None
    sleep_start = daily.get("sleepStartTimestampLocal") or daily.get("sleepStart")
    sleep_end = daily.get("sleepEndTimestampLocal") or daily.get("sleepEnd")
    if sleep_start:
        # Could be epoch ms or ISO string
        if isinstance(sleep_start, (int, float)):
            bedtime = datetime.datetime.fromtimestamp(sleep_start / 1000).strftime("%H:%M")
        elif isinstance(sleep_start, str) and "T" in sleep_start:
            bedtime = sleep_start.split("T")[1][:5]
    if sleep_end:
        if isinstance(sleep_end, (int, float)):
            wake_time = datetime.datetime.fromtimestamp(sleep_end / 1000).strftime("%H:%M")
        elif isinstance(sleep_end, str) and "T" in sleep_end:
            wake_time = sleep_end.split("T")[1][:5]

    return {
        "date": date_str,
        "sleep_score": daily.get("sleepScores", {}).get("overall", {}).get("value"),
        "sleep_quality": daily.get("sleepScores", {}).get("overall", {}).get("qualifierKey"),
        "sleep_duration_sec": daily.get("sleepTimeSeconds"),
        "sleep_need_sec": daily.get("sleepNeedSeconds") or (
            daily.get("sleepNeed") if isinstance(daily.get("sleepNeed"), (int, float)) else None
        ),
        "deep_sleep_sec": daily.get("deepSleepSeconds"),
        "light_sleep_sec": daily.get("lightSleepSeconds"),
        "rem_sleep_sec": daily.get("remSleepSeconds"),
        "awake_sec": daily.get("awakeSleepSeconds"),
        "bedtime": bedtime,
        "wake_time": wake_time,
        "avg_spo2": daily.get("averageSpO2Value"),
        "avg_respiration": daily.get("averageRespirationValue"),
    }


def extract_hrv(client: Garmin, date: datetime.date) -> dict:
    """Extract HRV data for a given date."""
    date_str = date.isoformat()
    hrv = safe_call(client.get_hrv_data, date_str, label=f"HRV {date_str}")
    if not hrv:
        return {}
    hrv = ensure_dict(hrv)

    summary = hrv.get("hrvSummary", {})
    return {
        "date": date_str,
        "weekly_avg_hrv": summary.get("weeklyAvg"),
        "last_night_avg_hrv": summary.get("lastNightAvg"),
        "last_night_5min_high": summary.get("lastNight5MinHigh"),
        "baseline_balanced_low": summary.get("baseline", {}).get("balancedLow"),
        "baseline_balanced_upper": summary.get("baseline", {}).get("balancedUpper"),
        "status": summary.get("status"),
    }


def extract_training_readiness(client: Garmin, date: datetime.date) -> dict:
    """Extract training readiness score and all component factors."""
    date_str = date.isoformat()
    tr = safe_call(client.get_training_readiness, date_str, label=f"Training Readiness {date_str}")
    if not tr:
        return {}
    tr = ensure_dict(tr)

    return {
        "date": date_str,
        "score": tr.get("score"),
        "level": tr.get("level"),
        "feedback": tr.get("feedbackShort"),
        # Component scores (each 0-100 percent)
        "sleep_score_pct": tr.get("sleepScoreFactorPercent"),
        "sleep_score_feedback": tr.get("sleepScoreFactorFeedback"),
        "recovery_time_pct": tr.get("recoveryTimeFactorPercent"),
        "recovery_time_feedback": tr.get("recoveryTimeFactorFeedback"),
        "recovery_time_hours": tr.get("recoveryTime"),
        "training_load_pct": tr.get("acwrFactorPercent"),
        "training_load_feedback": tr.get("acwrFactorFeedback"),
        "acute_load": tr.get("acuteLoad"),
        "hrv_pct": tr.get("hrvFactorPercent"),
        "hrv_feedback": tr.get("hrvFactorFeedback"),
        "hrv_weekly_avg": tr.get("hrvWeeklyAverage"),
        "stress_history_pct": tr.get("stressHistoryFactorPercent"),
        "stress_history_feedback": tr.get("stressHistoryFactorFeedback"),
        "sleep_history_pct": tr.get("sleepHistoryFactorPercent"),
        "sleep_history_feedback": tr.get("sleepHistoryFactorFeedback"),
    }


def extract_body_composition(client: Garmin, start: datetime.date, end: datetime.date) -> list:
    """Extract body composition data for a date range."""
    result = safe_call(
        client.get_body_composition,
        start.isoformat(),
        end.isoformat(),
        label="Body composition",
    )
    if not result:
        return []

    entries = []
    for entry in result.get("dateWeightList", []):
        e = {
            "date": entry.get("calendarDate"),
            "weight_kg": round(entry.get("weight", 0) / 1000, 2) if entry.get("weight") else None,
            "bmi": entry.get("bmi"),
            "body_fat_pct": entry.get("bodyFat"),
            "body_water_pct": entry.get("bodyWater"),
            "muscle_mass_kg": round(entry.get("muscleMass", 0) / 1000, 2) if entry.get("muscleMass") else None,
            "bone_mass_kg": round(entry.get("boneMass", 0) / 1000, 2) if entry.get("boneMass") else None,
        }
        entries.append({k: v for k, v in e.items() if v is not None})
    return entries


def extract_hydration(client: Garmin, date: datetime.date) -> dict:
    """Extract hydration data for a date."""
    date_str = date.isoformat()
    hydration = safe_call(client.get_hydration_data, date_str, label=f"Hydration {date_str}")
    if not hydration:
        return {}
    hydration = ensure_dict(hydration)

    result = {
        "date": date_str,
        "intake_ml": hydration.get("valueInML"),
        "goal_ml": hydration.get("goalInML"),
    }
    return {k: v for k, v in result.items() if v is not None}


def extract_nutrition(client: Garmin, date: datetime.date) -> dict:
    """Extract nutrition/calorie data from Garmin Connect+ nutrition service.

    Uses the discovered endpoints (all via connectapi):
    - /nutrition-service/food/logs/{date}  → daily totals (dailyNutritionContent)
    - /nutrition-service/meals/{date}      → per-meal breakdown
    - /nutrition-service/settings/{date}   → goals and targets
    """
    date_str = date.isoformat()
    nutrition = {"date": date_str}

    # --- 1) food/logs: PRIMARY source for daily totals ---
    food_logs = safe_call(
        client.connectapi,
        f"/nutrition-service/food/logs/{date_str}",
        label=f"Nutrition food/logs {date_str}",
    )
    if food_logs and isinstance(food_logs, dict):
        # dailyNutritionContent has the actual consumed totals
        content = food_logs.get("dailyNutritionContent", {})
        if content:
            nutrition["calories_consumed"] = round(content.get("calories", 0), 1)
            nutrition["protein_g"] = round(content.get("protein", 0), 1)
            nutrition["carbs_g"] = round(content.get("carbs", 0), 1)
            nutrition["fat_g"] = round(content.get("fat", 0), 1)
            if content.get("fiber"):
                nutrition["fiber_g"] = round(content["fiber"], 1)

        # dailyNutritionGoals embedded in same response
        goals = food_logs.get("dailyNutritionGoals", {})
        if goals:
            nutrition["calorie_goal"] = goals.get("calories")
            nutrition["goal_protein_g"] = goals.get("protein")
            nutrition["goal_carbs_g"] = goals.get("carbs")
            nutrition["goal_fat_g"] = goals.get("fat")

    # --- 2) meals: per-meal breakdown for coaching detail ---
    meals_resp = safe_call(
        client.connectapi,
        f"/nutrition-service/meals/{date_str}",
        label=f"Nutrition meals {date_str}",
    )
    if meals_resp and isinstance(meals_resp, dict):
        meals_list = meals_resp.get("meals", [])
        if isinstance(meals_list, list) and meals_list:
            parsed_meals = []
            for meal in meals_list:
                if not isinstance(meal, dict):
                    continue
                # Each meal has a "goals" sub-object with per-meal macro targets
                # and logged food items with actual consumed values
                meal_info = {
                    "name": meal.get("mealName"),
                    "start_time": meal.get("startTime"),
                    "end_time": meal.get("endTime"),
                }

                # Per-meal goals (Garmin splits daily goals across meals)
                meal_goals = meal.get("goals", {})
                if meal_goals:
                    meal_info["goal_calories"] = meal_goals.get("calories")
                    meal_info["goal_protein_g"] = meal_goals.get("protein")
                    meal_info["goal_carbs_g"] = meal_goals.get("carbs")
                    meal_info["goal_fat_g"] = meal_goals.get("fat")

                # Per-meal consumed (from food items within the meal)
                meal_content = meal.get("nutritionContent", meal.get("content", {}))
                if meal_content:
                    meal_info["calories"] = round(meal_content.get("calories", 0), 1)
                    meal_info["protein_g"] = round(meal_content.get("protein", 0), 1)
                    meal_info["carbs_g"] = round(meal_content.get("carbs", 0), 1)
                    meal_info["fat_g"] = round(meal_content.get("fat", 0), 1)

                # Food items logged in this meal
                food_items = meal.get("foodItems", meal.get("items", []))
                if isinstance(food_items, list) and food_items:
                    meal_info["food_items"] = [
                        {
                            "name": item.get("foodName") or item.get("name"),
                            "calories": item.get("calories"),
                            "protein_g": item.get("protein"),
                            "carbs_g": item.get("carbs"),
                            "fat_g": item.get("fat"),
                            "serving": item.get("servingSize") or item.get("amount"),
                        }
                        for item in food_items
                        if isinstance(item, dict)
                    ]

                parsed_meals.append({k: v for k, v in meal_info.items() if v is not None})

            if parsed_meals:
                nutrition["meals"] = parsed_meals

            # If food/logs didn't provide totals, sum from meals
            if not nutrition.get("calories_consumed") and parsed_meals:
                total_cal = sum(m.get("calories", 0) for m in parsed_meals)
                if total_cal > 0:
                    nutrition["calories_consumed"] = round(total_cal, 1)
                    nutrition["protein_g"] = round(
                        sum(m.get("protein_g", 0) for m in parsed_meals), 1
                    )
                    nutrition["carbs_g"] = round(
                        sum(m.get("carbs_g", 0) for m in parsed_meals), 1
                    )
                    nutrition["fat_g"] = round(
                        sum(m.get("fat_g", 0) for m in parsed_meals), 1
                    )

    # --- 3) settings: weight goals context (if not already from food/logs) ---
    if not nutrition.get("calorie_goal"):
        settings = safe_call(
            client.connectapi,
            f"/nutrition-service/settings/{date_str}",
            label=f"Nutrition settings {date_str}",
        )
        if settings and isinstance(settings, dict):
            nutrition["calorie_goal"] = settings.get("calorieGoal")
            macro_goals = settings.get("macroGoals", {})
            if macro_goals:
                nutrition["goal_protein_g"] = macro_goals.get("protein")
                nutrition["goal_carbs_g"] = macro_goals.get("carbs")
                nutrition["goal_fat_g"] = macro_goals.get("fat")
            if settings.get("targetWeightGoal"):
                nutrition["weight_goal_kg"] = round(settings["targetWeightGoal"] / 1000, 1)
            if settings.get("startingWeight"):
                nutrition["starting_weight_kg"] = round(settings["startingWeight"] / 1000, 1)
            if settings.get("targetDate"):
                nutrition["weight_goal_date"] = settings["targetDate"]
            if settings.get("weightChangeType"):
                nutrition["weight_change_type"] = settings["weightChangeType"].lower()

    # --- 4) Fallback: consumed calories from daily stats ---
    if not nutrition.get("calories_consumed"):
        stats = safe_call(client.get_stats, date_str, label=f"Stats nutrition fallback {date_str}")
        if stats:
            stats = ensure_dict(stats)
            if stats.get("consumedCalories"):
                nutrition["calories_consumed"] = stats["consumedCalories"]

    # Clean up None values
    nutrition = {k: v for k, v in nutrition.items() if v is not None}

    return nutrition


# ---------------------------------------------------------------------------
# Activity Extraction (Strength + Cardio)
# ---------------------------------------------------------------------------
STRENGTH_TYPES = {"strength_training", "indoor_cardio", "fitness_equipment"}
CARDIO_TYPES = {"running", "treadmill_running", "indoor_running", "trail_running",
                "cycling", "indoor_cycling", "walking", "hiking", "swimming",
                "open_water_swimming", "elliptical", "stair_climbing"}


def classify_activity(activity: dict) -> str:
    """Classify activity as 'strength', 'cardio', or 'other'."""
    act_type = (activity.get("activityType", {}).get("typeKey", "") or "").lower()
    if act_type in STRENGTH_TYPES or "strength" in act_type:
        return "strength"
    elif act_type in CARDIO_TYPES:
        return "cardio"
    return "other"


def extract_hr_zones(client: Garmin, activity_id) -> list:
    """Extract HR time-in-zone data for an activity."""
    zones = safe_call(
        client.get_activity_hr_in_timezones,
        activity_id,
        label=f"HR zones for {activity_id}",
    )
    if not zones:
        return []
    logger.debug("HR zones raw response type=%s, sample=%s", type(zones), str(zones)[:200])
    return [
        {
            "zone_number": z.get("zoneNumber"),
            "seconds_in_zone": z.get("secsInZone"),
        }
        for z in zones if isinstance(z, dict) and z.get("secsInZone")
    ]


def hr_zones_to_minutes(hr_zones: list) -> dict:
    """Convert HR zone seconds to a {z1: mins, z2: mins, ...} dict."""
    zone_minutes = {}
    for z in hr_zones:
        zn = z.get("zone_number")
        secs = z.get("seconds_in_zone", 0)
        if zn is not None:
            zone_minutes[f"z{zn}"] = round(secs / 60, 1)
    return zone_minutes


def extract_strength_details(client: Garmin, activity: dict) -> dict:
    """Extract strength training summary (no per-exercise breakdown)."""
    activity_id = activity.get("activityId")

    # Get exercise sets for volume calculation only
    sets_data = safe_call(
        client.get_activity_exercise_sets,
        activity_id,
        label=f"Exercise sets for {activity_id}",
    )

    total_sets = 0
    total_reps = 0
    total_volume_kg = 0
    exercise_names = []

    if sets_data and "exerciseSets" in sets_data:
        current_exercise = None
        for s in sets_data["exerciseSets"]:
            if s.get("setType") == "ACTIVE":
                total_sets += 1
                reps = s.get("repetitionCount") or 0
                total_reps += reps
                weight = round(s.get("weight", 0) / 1000, 2) if s.get("weight") else 0
                total_volume_kg += reps * weight

            # Track unique exercise names
            if s.get("exercises"):
                name = s["exercises"][0].get("exerciseName") or s["exercises"][0].get("category")
                if name and name != current_exercise:
                    exercise_names.append(name)
                    current_exercise = name

    hr_zones = extract_hr_zones(client, activity_id)
    zone_minutes = hr_zones_to_minutes(hr_zones)

    result = {
        "activity_id": activity_id,
        "type": "strength",
        "name": activity.get("activityName", "Strength Training"),
        "date": activity.get("startTimeLocal", "")[:10],
        "start_time": activity.get("startTimeLocal"),
        "duration_sec": activity.get("duration"),
        "calories": activity.get("calories"),
        "avg_hr": activity.get("averageHR"),
        "max_hr": activity.get("maxHR"),
        "training_effect_aerobic": activity.get("aerobicTrainingEffect"),
        "training_effect_anaerobic": activity.get("anaerobicTrainingEffect"),
        "total_sets": total_sets,
        "total_reps": total_reps,
        "total_volume_kg": round(total_volume_kg, 1),
        "exercises_performed": exercise_names,
        "hr_zones": hr_zones if hr_zones else None,
        "zone_minutes": zone_minutes if zone_minutes else None,
    }
    return {k: v for k, v in result.items() if v is not None}


def extract_cardio_details(client: Garmin, activity: dict) -> dict:
    """Extract cardio activity summary."""
    activity_id = activity.get("activityId")
    act_type = (activity.get("activityType", {}).get("typeKey", "") or "").lower()

    hr_zones = extract_hr_zones(client, activity_id)
    zone_minutes = hr_zones_to_minutes(hr_zones)

    result = {
        "activity_id": activity_id,
        "type": "cardio",
        "sport": act_type,
        "name": activity.get("activityName", act_type),
        "date": activity.get("startTimeLocal", "")[:10],
        "start_time": activity.get("startTimeLocal"),
        "duration_sec": activity.get("duration"),
        "distance_m": activity.get("distance"),
        "calories": activity.get("calories"),
        "avg_hr": activity.get("averageHR"),
        "max_hr": activity.get("maxHR"),
        "avg_speed_mps": activity.get("averageSpeed"),
        "avg_pace_min_km": round(1000 / activity["averageSpeed"] / 60, 2) if activity.get("averageSpeed") and activity["averageSpeed"] > 0 else None,
        "elevation_gain_m": activity.get("elevationGain"),
        "avg_cadence": activity.get("averageRunningCadenceInStepsPerMinute"),
        "training_effect_aerobic": activity.get("aerobicTrainingEffect"),
        "training_effect_anaerobic": activity.get("anaerobicTrainingEffect"),
        "vo2max": activity.get("vO2MaxValue"),
        "hr_zones": hr_zones if hr_zones else None,
        "zone_minutes": zone_minutes if zone_minutes else None,
    }
    return {k: v for k, v in result.items() if v is not None}


def extract_activities(client: Garmin, start: datetime.date, end: datetime.date) -> list:
    """Extract all activities in date range with full details."""
    activities = safe_call(
        client.get_activities_by_date,
        start.isoformat(),
        end.isoformat(),
        label="Activities",
    )
    if not activities:
        return []

    results = []
    for act in activities:
        category = classify_activity(act)
        if category == "strength":
            results.append(extract_strength_details(client, act))
        elif category == "cardio":
            results.append(extract_cardio_details(client, act))
        else:
            # Still capture basic info for uncategorized activities
            other = {
                "activity_id": act.get("activityId"),
                "type": "other",
                "sport": (act.get("activityType", {}).get("typeKey", "") or "").lower(),
                "name": act.get("activityName", "Unknown"),
                "date": act.get("startTimeLocal", "")[:10],
                "duration_sec": act.get("duration"),
                "calories": act.get("calories"),
                "avg_hr": act.get("averageHR"),
                "training_effect_aerobic": act.get("aerobicTrainingEffect"),
                "training_effect_anaerobic": act.get("anaerobicTrainingEffect"),
            }
            results.append({k: v for k, v in other.items() if v is not None})

    return sorted(results, key=lambda x: x.get("date", ""))


# ---------------------------------------------------------------------------
# Trend Computation
# ---------------------------------------------------------------------------
def compute_trends(daily_data: list, field: str) -> dict:
    """Compute min/max/avg for a numeric field across daily data."""
    values = [d.get(field) for d in daily_data if d.get(field) is not None]
    if not values:
        return {"count": 0}
    return {
        "min": round(min(values), 2),
        "max": round(max(values), 2),
        "avg": round(sum(values) / len(values), 2),
        "count": len(values),
    }


def compute_weekly_summary(activities: list) -> dict:
    """Compute summary stats for a set of activities."""
    strength = [a for a in activities if a.get("type") == "strength"]
    cardio = [a for a in activities if a.get("type") == "cardio"]

    total_strength_volume = sum(s.get("total_volume_kg", 0) for s in strength)
    total_strength_sets = sum(s.get("total_sets", 0) for s in strength)
    total_strength_reps = sum(s.get("total_reps", 0) for s in strength)

    total_cardio_distance = sum(a.get("distance_m", 0) or 0 for a in cardio)
    total_cardio_duration = sum(a.get("duration_sec", 0) or 0 for a in cardio)
    total_calories = sum(a.get("calories", 0) or 0 for a in activities)

    return {
        "total_activities": len(activities),
        "strength_sessions": len(strength),
        "cardio_sessions": len(cardio),
        "total_strength_sets": total_strength_sets,
        "total_strength_reps": total_strength_reps,
        "total_strength_volume_kg": round(total_strength_volume, 1),
        "total_cardio_distance_km": round(total_cardio_distance / 1000, 2),
        "total_cardio_duration_min": round(total_cardio_duration / 60, 1),
        "total_activity_calories": total_calories,
    }


def compute_zone_totals(activities: list) -> dict:
    """Compute total minutes spent in each HR zone across all activities."""
    zone_totals = {}
    for act in activities:
        zm = act.get("zone_minutes", {})
        for zone_key, minutes in zm.items():
            zone_totals[zone_key] = round(zone_totals.get(zone_key, 0) + minutes, 1)
    return {f"zone_{k.replace('z', '')}_minutes": v for k, v in sorted(zone_totals.items())}


def compute_weekly_averages(daily_stats, daily_sleep, daily_readiness, daily_hrv, daily_nutrition) -> dict:
    """Compute pre-computed 7-day averages for coaches."""
    def avg(data, field):
        vals = [d.get(field) for d in data if d.get(field) is not None]
        return round(sum(vals) / len(vals), 2) if vals else None

    # Bedtime compliance: count nights with bedtime before 23:00
    nights_before_2300 = 0
    nights_tracked = 0
    for d in daily_sleep:
        bt = d.get("bedtime")
        if bt:
            nights_tracked += 1
            # bedtime format is "HH:MM" (e.g. "22:45" or "01:30")
            try:
                hour_part = bt.split("T")[1] if "T" in bt else bt
                hour = int(hour_part.split(":")[0])
                # Hours 0-5 are post-midnight (late night), not early evening
                # Only 6-22 counts as "before 23:00" compliant
                if 6 <= hour < 23:
                    nights_before_2300 += 1
            except (IndexError, ValueError):
                pass

    return {
        "avg_sleep_score": avg(daily_sleep, "sleep_score"),
        "avg_sleep_duration_hours": avg(
            [{"v": round(d["sleep_duration_sec"] / 3600, 2)} for d in daily_sleep if d.get("sleep_duration_sec")],
            "v"
        ),
        "avg_deep_sleep_hours": avg(
            [{"v": round(d["deep_sleep_sec"] / 3600, 2)} for d in daily_sleep if d.get("deep_sleep_sec")],
            "v"
        ),
        "avg_readiness": avg(daily_readiness, "score"),
        "avg_rhr": avg(daily_stats, "resting_heart_rate"),
        "avg_stress": avg(daily_stats, "avg_stress_level"),
        "avg_body_battery_high": avg(daily_stats, "body_battery_high"),
        "avg_hrv_weekly": avg(daily_hrv, "weekly_avg_hrv"),
        "avg_calories_consumed": avg(daily_nutrition, "calories_consumed"),
        "avg_protein_g": avg(daily_nutrition, "protein_g"),
        "avg_carbs_g": avg(daily_nutrition, "carbs_g"),
        "avg_fat_g": avg(daily_nutrition, "fat_g"),
        "nights_before_2300": nights_before_2300,
        "nights_tracked": nights_tracked,
    }


# ---------------------------------------------------------------------------
# Main Export Pipeline
# ---------------------------------------------------------------------------
def build_export(client: Garmin, num_days: int = 28) -> dict:
    """Build the full structured data export.

    Structure:
    - Activities: full detail for the 7-day window (without per-exercise breakdown)
    - Health/Performance/Nutrition: 7-day summaries (avg/min/max)
    - 4-week context: fallback for metrics that need longer windows (HRV, training load)
    - Weekly breakdowns: 4 weeks for progressive overload tracking
    """
    today = datetime.date.today()
    start_28d = today - datetime.timedelta(days=num_days)
    start_7d = today - datetime.timedelta(days=7)

    logger.info("📊 Extracting data from %s to %s...", start_28d.isoformat(), today.isoformat())

    # --- Activities (full 28-day window for weekly breakdowns) ---
    logger.info("🏋️  Fetching activities...")
    all_activities = extract_activities(client, start_28d, today)
    activities_7d = [a for a in all_activities if a.get("date", "") >= start_7d.isoformat()]

    # --- Daily data (28-day loop) ---
    logger.info("📈 Fetching daily health data (this may take a minute)...")
    daily_stats = []
    daily_sleep = []
    daily_hrv = []
    daily_readiness = []
    daily_nutrition = []
    daily_hydration = []

    for i in range(num_days):
        date = today - datetime.timedelta(days=i)
        logger.info("   📅 %s (%d/%d)", date.isoformat(), i + 1, num_days)

        daily_stats.append(extract_daily_stats(client, date))
        daily_sleep.append(extract_sleep(client, date))
        daily_hrv.append(extract_hrv(client, date))
        daily_readiness.append(extract_training_readiness(client, date))
        daily_nutrition.append(extract_nutrition(client, date))
        daily_hydration.append(extract_hydration(client, date))

    # Filter out empty entries
    daily_stats = [d for d in daily_stats if d]
    daily_sleep = [d for d in daily_sleep if d]
    daily_hrv = [d for d in daily_hrv if d]
    daily_readiness = [d for d in daily_readiness if d]
    daily_nutrition = [d for d in daily_nutrition if d and len(d) > 1]
    daily_hydration = [d for d in daily_hydration if d]

    # --- Body composition (range query) ---
    logger.info("⚖️  Fetching body composition...")
    body_comp = extract_body_composition(client, start_28d, today)

    # --- Split into 7-day and 28-day windows ---
    def split_window(data, date_field="date"):
        recent = [d for d in data if d.get(date_field, "") >= start_7d.isoformat()]
        return recent, data

    stats_7d, stats_28d = split_window(daily_stats)
    sleep_7d, sleep_28d = split_window(daily_sleep)
    hrv_7d, hrv_28d = split_window(daily_hrv)
    readiness_7d, readiness_28d = split_window(daily_readiness)
    nutrition_7d, nutrition_28d = split_window(daily_nutrition)
    hydration_7d, hydration_28d = split_window(daily_hydration)
    body_7d, body_28d = split_window(body_comp)

    # --- Get nutrition goals from first available entry ---
    nutrition_goals = {}
    for n in nutrition_7d:
        if n.get("calorie_goal"):
            nutrition_goals = {
                "calorie_goal": n.get("calorie_goal"),
                "goal_protein_g": n.get("goal_protein_g"),
                "goal_carbs_g": n.get("goal_carbs_g"),
                "goal_fat_g": n.get("goal_fat_g"),
                "weight_goal_kg": n.get("weight_goal_kg"),
                "starting_weight_kg": n.get("starting_weight_kg"),
                "weight_goal_date": n.get("weight_goal_date"),
                "weight_change_type": n.get("weight_change_type"),
            }
            nutrition_goals = {k: v for k, v in nutrition_goals.items() if v is not None}
            break

    # --- Helper: make sleep entries coach-readable ---
    def format_sleep(entries):
        """Convert sleep entries to hours and add quality label."""
        formatted = []
        for d in sorted(entries, key=lambda x: x.get("date", "")):
            entry = {"date": d.get("date")}
            entry["score"] = d.get("sleep_score")
            entry["quality"] = d.get("sleep_quality")
            dur = d.get("sleep_duration_sec")
            entry["duration_hours"] = round(dur / 3600, 2) if dur else None
            need = d.get("sleep_need_sec")
            entry["sleep_need_hours"] = round(need / 3600, 2) if need else None
            deep = d.get("deep_sleep_sec")
            entry["deep_sleep_hours"] = round(deep / 3600, 2) if deep else None
            light = d.get("light_sleep_sec")
            entry["light_sleep_hours"] = round(light / 3600, 2) if light else None
            rem = d.get("rem_sleep_sec")
            entry["rem_sleep_hours"] = round(rem / 3600, 2) if rem else None
            awake = d.get("awake_sec")
            entry["awake_hours"] = round(awake / 3600, 2) if awake else None
            entry["bedtime"] = d.get("bedtime")
            entry["wake_time"] = d.get("wake_time")
            entry["avg_spo2"] = d.get("avg_spo2")
            entry["avg_respiration"] = d.get("avg_respiration")
            formatted.append({k: v for k, v in entry.items() if v is not None})
        return formatted

    # --- Helper: compact daily stats for coach ---
    def format_stats(entries):
        """Pick the fields the coach actually needs, sorted by date."""
        formatted = []
        for d in sorted(entries, key=lambda x: x.get("date", "")):
            entry = {
                "date": d.get("date"),
                "total_steps": d.get("total_steps"),
                "calories_total": d.get("calories_total"),
                "calories_active": d.get("calories_active"),
                "resting_heart_rate": d.get("resting_heart_rate"),
                "max_heart_rate": d.get("max_heart_rate"),
                "avg_stress_level": d.get("avg_stress_level"),
                "body_battery_high": d.get("body_battery_high"),
                "body_battery_low": d.get("body_battery_low"),
                "moderate_intensity_min": d.get("moderate_intensity_min"),
                "vigorous_intensity_min": d.get("vigorous_intensity_min"),
            }
            formatted.append({k: v for k, v in entry.items() if v is not None})
        return formatted

    # --- Helper: compact nutrition for coach ---
    def format_nutrition(entries):
        """Strip goals/weight info from daily nutrition (kept at top level)."""
        formatted = []
        keep_keys = {"date", "calories_consumed", "protein_g", "carbs_g", "fat_g",
                     "fiber_g", "meals"}
        for d in sorted(entries, key=lambda x: x.get("date", "")):
            entry = {k: v for k, v in d.items() if k in keep_keys and v is not None}
            if len(entry) > 1:  # more than just date
                formatted.append(entry)
        return formatted

    # --- Training status / load focus (4-week view from Garmin) ---
    logger.info("📊 Fetching training status & load focus...")
    training_status_data = {}

    # Try the get_training_status method first (returns nested structure)
    ts = None
    try:
        ts = client.get_training_status(today.isoformat())
        if ts:
            ts = ensure_dict(ts)
    except (AttributeError, Exception) as e:
        logger.warning("⚠️  get_training_status not available: %s", str(e)[:100])

    # Fallback to connectapi paths
    if not ts:
        for path in [
            "/training-status-service/trainingStatus/aggregated",
            "/training-status-service/trainingStatus/latest",
        ]:
            ts = safe_call(client.connectapi, path, label=f"Training status {path}")
            if ts:
                ts = ensure_dict(ts)
                break

    if ts and isinstance(ts, dict):
        # --- Load Focus (from mostRecentTrainingLoadBalance) ---
        load_balance = ts.get("mostRecentTrainingLoadBalance", {})
        load_map = load_balance.get("metricsTrainingLoadBalanceDTOMap", {})
        # Get first device's data (usually only one primary device)
        for device_id, lb in load_map.items():
            if isinstance(lb, dict):
                training_status_data["load_focus"] = {
                    "description": lb.get("trainingBalanceFeedbackPhrase"),
                    "anaerobic": round(lb.get("monthlyLoadAnaerobic", 0), 1),
                    "anaerobic_target_min": lb.get("monthlyLoadAnaerobicTargetMin"),
                    "anaerobic_target_max": lb.get("monthlyLoadAnaerobicTargetMax"),
                    "high_aerobic": round(lb.get("monthlyLoadAerobicHigh", 0), 1),
                    "high_aerobic_target_min": lb.get("monthlyLoadAerobicHighTargetMin"),
                    "high_aerobic_target_max": lb.get("monthlyLoadAerobicHighTargetMax"),
                    "low_aerobic": round(lb.get("monthlyLoadAerobicLow", 0), 1),
                    "low_aerobic_target_min": lb.get("monthlyLoadAerobicLowTargetMin"),
                    "low_aerobic_target_max": lb.get("monthlyLoadAerobicLowTargetMax"),
                }
                break

        # --- Training Status (from mostRecentTrainingStatus) ---
        status_data = ts.get("mostRecentTrainingStatus", {})
        latest_data = status_data.get("latestTrainingStatusData", {})
        for device_id, sd in latest_data.items():
            if isinstance(sd, dict):
                training_status_data["status_feedback"] = sd.get("trainingStatusFeedbackPhrase")
                training_status_data["training_paused"] = sd.get("trainingPaused")
                # Acute training load detail
                acute = sd.get("acuteTrainingLoadDTO", {})
                if acute:
                    training_status_data["acute_training_load"] = {
                        "daily_acute": acute.get("dailyTrainingLoadAcute"),
                        "acwr_percent": acute.get("acwrPercent"),
                        "acwr_status": acute.get("acwrStatus"),
                        "chronic_min": acute.get("minTrainingLoadChronic"),
                        "chronic_max": acute.get("maxTrainingLoadChronic"),
                    }
                    training_status_data["acute_training_load"] = {
                        k: v for k, v in training_status_data["acute_training_load"].items() if v is not None
                    }
                break

        # --- VO2 Max ---
        vo2 = ts.get("mostRecentVO2Max", {})
        if vo2.get("generic"):
            training_status_data["vo2_max_running"] = vo2["generic"]
        if vo2.get("cycling"):
            training_status_data["vo2_max_cycling"] = vo2["cycling"]

    # --- Build export ---
    logger.info("📊 Computing summaries...")

    export = {
        "_meta": {
            "generated_at": datetime.datetime.now().isoformat(),
            "period_start_28d": start_28d.isoformat(),
            "period_start_7d": start_7d.isoformat(),
            "period_end": today.isoformat(),
            "version": "2.1.0",
            "note": "Upload this file to Claude for your weekly coaching check-in.",
        },

        # =============================================================
        # ACTIVITIES (7-day — individual sessions)
        # =============================================================
        "activities": {
            "this_week": activities_7d,
            "summary": {
                **compute_weekly_summary(activities_7d),
                "hr_zone_totals": compute_zone_totals(activities_7d),
            },
        },

        # =============================================================
        # HEALTH STATS (daily entries + 7-day summary)
        # Coach sees each day to spot trends like the Garmin 7-day graphs
        # =============================================================
        "health_stats_7d": {
            "daily": format_stats(stats_7d),
            "summary": {
                "resting_heart_rate": compute_trends(stats_7d, "resting_heart_rate"),
                "avg_stress_level": compute_trends(stats_7d, "avg_stress_level"),
                "body_battery_high": compute_trends(stats_7d, "body_battery_high"),
                "body_battery_low": compute_trends(stats_7d, "body_battery_low"),
                "total_steps": compute_trends(stats_7d, "total_steps"),
                "calories_total": compute_trends(stats_7d, "calories_total"),
                "calories_active": compute_trends(stats_7d, "calories_active"),
            },
            "sleep": {
                "daily": format_sleep(sleep_7d),
                "summary": {
                    "score": compute_trends(sleep_7d, "sleep_score"),
                    "duration_hours": compute_trends(
                        [{"v": round(d["sleep_duration_sec"] / 3600, 2)} for d in sleep_7d if d.get("sleep_duration_sec")],
                        "v"
                    ),
                    "deep_sleep_hours": compute_trends(
                        [{"v": round(d["deep_sleep_sec"] / 3600, 2)} for d in sleep_7d if d.get("deep_sleep_sec")],
                        "v"
                    ),
                },
            },
            "hydration": {
                "daily": sorted(hydration_7d, key=lambda x: x.get("date", "")),
                "summary": {
                    "intake_ml": compute_trends(hydration_7d, "intake_ml"),
                },
            },
            "body_composition": {
                "daily": sorted(body_7d, key=lambda x: x.get("date", "")),
                "summary": {
                    "weight_kg": compute_trends(body_7d, "weight_kg"),
                    "body_fat_pct": compute_trends(body_7d, "body_fat_pct"),
                    "muscle_mass_kg": compute_trends(body_7d, "muscle_mass_kg"),
                },
            },
        },

        # =============================================================
        # PERFORMANCE STATS (daily entries + summaries)
        # Training readiness: 7-day daily | HRV: 4-week fallback
        # =============================================================
        "performance_stats": {
            "training_readiness": {
                "daily": sorted(readiness_7d, key=lambda x: x.get("date", "")),
                "summary": {
                    "score": compute_trends(readiness_7d, "score"),
                    "sleep_pct": compute_trends(readiness_7d, "sleep_score_pct"),
                    "recovery_time_pct": compute_trends(readiness_7d, "recovery_time_pct"),
                    "training_load_pct": compute_trends(readiness_7d, "training_load_pct"),
                    "hrv_pct": compute_trends(readiness_7d, "hrv_pct"),
                    "stress_history_pct": compute_trends(readiness_7d, "stress_history_pct"),
                    "sleep_history_pct": compute_trends(readiness_7d, "sleep_history_pct"),
                    "acute_load": compute_trends(readiness_7d, "acute_load"),
                },
            },
            # HRV needs 4-week context for baseline and status
            "hrv_4w": {
                "daily": sorted(hrv_28d, key=lambda x: x.get("date", "")),
                "summary": {
                    "weekly_avg": compute_trends(hrv_28d, "weekly_avg_hrv"),
                    "last_night_avg": compute_trends(hrv_28d, "last_night_avg_hrv"),
                },
                "latest_status": hrv_7d[0].get("status") if hrv_7d else (hrv_28d[0].get("status") if hrv_28d else None),
                "baseline_low": hrv_7d[0].get("baseline_balanced_low") if hrv_7d else None,
                "baseline_upper": hrv_7d[0].get("baseline_balanced_upper") if hrv_7d else None,
            },
            # Training effects from this week's activities
            "training_effects_7d": {
                "aerobic": compute_trends(activities_7d, "training_effect_aerobic"),
                "anaerobic": compute_trends(activities_7d, "training_effect_anaerobic"),
            },
            # Training status / load focus (if available)
            "training_status": training_status_data,
        },

        # =============================================================
        # NUTRITION STATS (daily entries + 7-day summary + goals)
        # =============================================================
        "nutrition_stats_7d": {
            "daily": format_nutrition(nutrition_7d),
            "summary": {
                "calories_consumed": compute_trends(nutrition_7d, "calories_consumed"),
                "protein_g": compute_trends(nutrition_7d, "protein_g"),
                "carbs_g": compute_trends(nutrition_7d, "carbs_g"),
                "fat_g": compute_trends(nutrition_7d, "fat_g"),
            },
            "goals": nutrition_goals,
        },

        # =============================================================
        # 4-WEEK CONTEXT (progressive overload tracking)
        # =============================================================
        "four_week_context": {
            "weekly_breakdowns": [],
            "body_composition_trend": sorted(body_28d, key=lambda x: x.get("date", "")),
            "trends_28d": {
                "weight_kg": compute_trends(body_28d, "weight_kg"),
                "body_fat_pct": compute_trends(body_28d, "body_fat_pct"),
                "resting_hr": compute_trends(stats_28d, "resting_heart_rate"),
                "sleep_score": compute_trends(sleep_28d, "sleep_score"),
                "training_readiness": compute_trends(readiness_28d, "score"),
                "calories_consumed": compute_trends(nutrition_28d, "calories_consumed"),
            },
        },
    }

    # --- Pre-computed weekly averages for coaches ---
    export["weekly_averages_7d"] = compute_weekly_averages(
        stats_7d, sleep_7d, readiness_7d, hrv_7d, nutrition_7d
    )

    # --- Compute weekly breakdowns (week 1 = most recent) ---
    for week_num in range(4):
        week_end = today - datetime.timedelta(days=week_num * 7)
        week_start = week_end - datetime.timedelta(days=6)
        week_activities = [
            a for a in all_activities
            if week_start.isoformat() <= a.get("date", "") <= week_end.isoformat()
        ]
        week_stats = [
            d for d in stats_28d
            if week_start.isoformat() <= d.get("date", "") <= week_end.isoformat()
        ]
        week_sleep = [
            d for d in sleep_28d
            if week_start.isoformat() <= d.get("date", "") <= week_end.isoformat()
        ]
        week_nutrition = [
            d for d in nutrition_28d
            if week_start.isoformat() <= d.get("date", "") <= week_end.isoformat()
        ]

        export["four_week_context"]["weekly_breakdowns"].append({
            "week": week_num + 1,
            "label": f"Week {week_num + 1} (most recent)" if week_num == 0 else f"Week {week_num + 1}",
            "period": f"{week_start.isoformat()} to {week_end.isoformat()}",
            "activity_summary": compute_weekly_summary(week_activities),
            "avg_resting_hr": compute_trends(week_stats, "resting_heart_rate").get("avg"),
            "avg_sleep_score": compute_trends(week_sleep, "sleep_score").get("avg"),
            "avg_stress": compute_trends(week_stats, "avg_stress_level").get("avg"),
            "avg_body_battery_high": compute_trends(week_stats, "body_battery_high").get("avg"),
            "avg_calories_consumed": compute_trends(week_nutrition, "calories_consumed").get("avg"),
            "avg_protein_g": compute_trends(week_nutrition, "protein_g").get("avg"),
        })

    return export


def archive_export(output_path: Path, archive_dir: Path) -> Path:
    """Copy the export to a dated archive file.

    Archive naming: garmin_YYYY-MM-DD.json (date of export).
    Returns the archive file path.
    """
    archive_dir.mkdir(parents=True, exist_ok=True)
    today_str = datetime.date.today().isoformat()
    archive_name = f"garmin_{today_str}.json"
    archive_path = archive_dir / archive_name

    # If same-day archive exists, add a sequence number
    if archive_path.exists():
        seq = 2
        while True:
            archive_name = f"garmin_{today_str}_{seq}.json"
            archive_path = archive_dir / archive_name
            if not archive_path.exists():
                break
            seq += 1

    shutil.copy2(output_path, archive_path)
    return archive_path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    global TOKEN_DIR  # Allow --token-dir to override module-level default
    parser = argparse.ArgumentParser(
        description="Garmin Connect Data Connector for Personal Coach",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 garmin_connector.py                        # Default: 28 days
  python3 garmin_connector.py --days 56              # 8 weeks of data
  python3 garmin_connector.py --output weekly.json   # Custom filename
  python3 garmin_connector.py --no-archive           # Skip archiving
  
Archive:
  Each export is automatically archived to ~/garmin-coach/archive/
  with date-stamped filenames (garmin_YYYY-MM-DD.json).
  Use --no-archive to disable. Use --archive-dir to change location.

Environment variables:
  GARMIN_EMAIL      Your Garmin Connect email
  GARMIN_PASSWORD   Your Garmin Connect password
        """,
    )
    parser.add_argument(
        "--days", type=int, default=28,
        help="Number of days to extract (default: 28 for 4-week trends)",
    )
    parser.add_argument(
        "--output", "-o", type=str, default=DEFAULT_OUTPUT,
        help=f"Output JSON filename (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--no-archive", action="store_true",
        help="Skip archiving the export",
    )
    parser.add_argument(
        "--archive-dir", type=str, default=None,
        help="Archive directory (default: ./archive/)",
    )
    parser.add_argument(
        "--token-dir", type=str, default=None,
        help="Directory to store auth tokens (default: ~/.garmin_coach_tokens)"
    )
    args = parser.parse_args()

    if args.token_dir:
        TOKEN_DIR = Path(args.token_dir)

    print()
    print("=" * 60)
    print("🏋️  Garmin Connect Data Connector for Personal Coach")
    print("=" * 60)
    print()

    # Authenticate
    client = authenticate()

    # Extract data
    export = build_export(client, num_days=args.days)

    # Write output
    output_path = Path(args.output)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(export, f, indent=2, ensure_ascii=False, default=str)

    file_size = output_path.stat().st_size
    logger.info("")
    logger.info("=" * 60)
    logger.info("✅ Export complete!")
    logger.info("   📁 File: %s", output_path.absolute())
    logger.info("   📊 Size: %s KB", round(file_size / 1024, 1))

    # Archive
    if not args.no_archive:
        archive_dir = Path(args.archive_dir) if args.archive_dir else output_path.parent / "archive"
        archive_path = archive_export(output_path, archive_dir)
        logger.info("   🗂️  Archived: %s", archive_path)

    logger.info("")
    logger.info("📋 Next steps:")
    logger.info("   1. Upload %s to a new Claude conversation", output_path.name)
    logger.info("   2. Ask Claude to review your weekly data")
    logger.info("   3. Claude will have full context of 7-day summaries + 4-week trends")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()

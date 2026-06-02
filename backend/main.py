from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import text
from database import engine, init_db
from etl import run_etl, load_mrt_stations
import atexit

app = FastAPI(title="台北交通儀表板 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

scheduler = BackgroundScheduler()

@app.on_event("startup")
def startup():
    init_db()
    load_mrt_stations()
    run_etl()
    scheduler.add_job(run_etl, "interval", minutes=3, id="etl_job")
    scheduler.start()

atexit.register(lambda: scheduler.shutdown())

@app.get("/")
def root():
    return {"status": "ok", "message": "台北交通儀表板 API"}

@app.get("/api/youbike/stations")
def get_youbike_stations():
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT s.station_id, s.station_name, s.area, s.lat, s.lng,
                   s.total_spaces, snap.available_bikes, snap.available_spaces,
                   snap.recorded_at
            FROM youbike_stations s
            LEFT JOIN LATERAL (
                SELECT available_bikes, available_spaces, recorded_at
                FROM youbike_snapshots
                WHERE station_id = s.station_id
                ORDER BY recorded_at DESC
                LIMIT 1
            ) snap ON true
            ORDER BY s.station_name
        """)).fetchall()
    return [dict(r._mapping) for r in rows]

@app.get("/api/youbike/trend/{station_id}")
def get_youbike_trend(station_id: str, hours: int = 24):
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT
                date_trunc('hour', recorded_at) +
                    (EXTRACT(MINUTE FROM recorded_at)::int / 30 * 30 || ' minutes')::interval AS time_bucket,
                ROUND(AVG(available_bikes)) AS avg_bikes,
                ROUND(AVG(available_spaces)) AS avg_spaces
            FROM youbike_snapshots
            WHERE station_id = :station_id
              AND recorded_at > NOW() - INTERVAL '1 hour' * :hours
            GROUP BY time_bucket
            ORDER BY time_bucket
        """), {"station_id": station_id, "hours": hours}).fetchall()
    return [dict(r._mapping) for r in rows]

@app.get("/api/youbike/heatmap")
def get_youbike_heatmap():
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT s.lat, s.lng, s.station_name,
                   snap.available_bikes, s.total_spaces,
                   CASE WHEN s.total_spaces > 0
                        THEN ROUND(snap.available_bikes::numeric / s.total_spaces * 100)
                        ELSE 0 END AS fill_rate
            FROM youbike_stations s
            LEFT JOIN LATERAL (
                SELECT available_bikes
                FROM youbike_snapshots
                WHERE station_id = s.station_id
                ORDER BY recorded_at DESC
                LIMIT 1
            ) snap ON true
            WHERE s.lat IS NOT NULL
        """)).fetchall()
    return [dict(r._mapping) for r in rows]

@app.get("/api/youbike/area-summary")
def get_area_summary():
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT s.area,
                   COUNT(*) AS station_count,
                   SUM(snap.available_bikes) AS total_available,
                   SUM(s.total_spaces) AS total_capacity
            FROM youbike_stations s
            LEFT JOIN LATERAL (
                SELECT available_bikes
                FROM youbike_snapshots
                WHERE station_id = s.station_id
                ORDER BY recorded_at DESC
                LIMIT 1
            ) snap ON true
            GROUP BY s.area
            ORDER BY total_available DESC
        """)).fetchall()
    return [dict(r._mapping) for r in rows]

@app.get("/api/bus/arrivals")
def get_bus_arrivals(route_id: str = None):
    with engine.connect() as conn:
        if route_id:
            rows = conn.execute(text("""
                SELECT route_id, stop_name, estimate_time, plate_numb, recorded_at
                FROM bus_arrivals
                WHERE route_id = :route_id
                  AND recorded_at > NOW() - INTERVAL '10 minutes'
                ORDER BY stop_name, estimate_time
            """), {"route_id": route_id}).fetchall()
        else:
            rows = conn.execute(text("""
                SELECT DISTINCT ON (route_id, stop_name)
                    route_id, stop_name, estimate_time, plate_numb, recorded_at
                FROM bus_arrivals
                WHERE recorded_at > NOW() - INTERVAL '10 minutes'
                ORDER BY route_id, stop_name, recorded_at DESC
            """)).fetchall()
    return [dict(r._mapping) for r in rows]

@app.get("/api/bus/busy-hours")
def get_bus_busy_hours():
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT EXTRACT(HOUR FROM recorded_at) AS hour,
                   ROUND(AVG(CASE WHEN estimate_time >= 0 THEN estimate_time END)) AS avg_wait
            FROM bus_arrivals
            WHERE recorded_at > NOW() - INTERVAL '7 days'
            GROUP BY hour
            ORDER BY hour
        """)).fetchall()
    return [dict(r._mapping) for r in rows]

@app.get("/api/mrt/stations")
def get_mrt_stations():
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT station_name, line, lat, lng FROM mrt_stations
        """)).fetchall()
    return [dict(r._mapping) for r in rows]

@app.get("/api/status")
def get_status():
    with engine.connect() as conn:
        youbike_count = conn.execute(text(
            "SELECT COUNT(*) FROM youbike_snapshots WHERE recorded_at > NOW() - INTERVAL '10 minutes'"
        )).scalar()
        bus_count = conn.execute(text(
            "SELECT COUNT(*) FROM bus_arrivals WHERE recorded_at > NOW() - INTERVAL '10 minutes'"
        )).scalar()
        last_update = conn.execute(text(
            "SELECT MAX(recorded_at) FROM youbike_snapshots"
        )).scalar()
    return {
        "youbike_recent_records": youbike_count,
        "bus_recent_records": bus_count,
        "last_update": last_update,
    }

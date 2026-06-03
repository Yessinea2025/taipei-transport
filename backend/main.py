from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import text
from database import engine, init_db
from etl import run_etl, load_mrt_stations
import math
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
    scheduler.add_job(run_etl, "interval", minutes=1, id="etl_job")
    scheduler.start()

atexit.register(lambda: scheduler.shutdown())

@app.get("/")
def root():
    return {"status": "ok", "message": "台北交通儀表板 API"}

@app.get("/api/mrt/stations")
def get_mrt_stations():
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT station_name, line, line_color, lat, lng FROM mrt_stations
        """)).fetchall()
    return [dict(r._mapping) for r in rows]

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

@app.get("/api/nearby")
def get_nearby(lat: float, lng: float, radius: int = 1000):
    def haversine(lat1, lng1, lat2, lng2):
        R = 6371000
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lng2 - lng1)
        a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    with engine.connect() as conn:
        # 附近 YouBike 站
        youbike_rows = conn.execute(text("""
            SELECT s.station_id, s.station_name, s.area, s.lat, s.lng,
                   s.total_spaces, snap.available_bikes, snap.available_spaces
            FROM youbike_stations s
            LEFT JOIN LATERAL (
                SELECT available_bikes, available_spaces
                FROM youbike_snapshots
                WHERE station_id = s.station_id
                ORDER BY recorded_at DESC
                LIMIT 1
            ) snap ON true
            WHERE s.lat BETWEEN :lat - 0.015 AND :lat + 0.015
              AND s.lng BETWEEN :lng - 0.015 AND :lng + 0.015
        """), {"lat": lat, "lng": lng}).fetchall()

        # 附近公車站（從 bus_stops 表）
        bus_rows = conn.execute(text("""
            SELECT DISTINCT stop_name, lat, lng
            FROM bus_stops
            WHERE lat BETWEEN :lat - 0.015 AND :lat + 0.015
              AND lng BETWEEN :lng - 0.015 AND :lng + 0.015
        """), {"lat": lat, "lng": lng}).fetchall()

    nearby_youbike = []
    for r in youbike_rows:
        d = haversine(lat, lng, r.lat, r.lng)
        if d <= radius:
            item = dict(r._mapping)
            item["distance"] = round(d)
            nearby_youbike.append(item)
    nearby_youbike.sort(key=lambda x: x["distance"])

    nearby_bus = []
    for r in bus_rows:
        d = haversine(lat, lng, r.lat, r.lng)
        if d <= radius:
            item = dict(r._mapping)
            item["distance"] = round(d)
            nearby_bus.append(item)
    nearby_bus.sort(key=lambda x: x["distance"])

    return {
        "youbike": nearby_youbike[:20],
        "bus_stops": nearby_bus[:20],
    }

@app.get("/api/bus/arrivals")
def get_bus_arrivals(stop_name: str = None, route_id: str = None, go_back: str = None):
    with engine.connect() as conn:
        conditions = ["recorded_at > NOW() - INTERVAL '10 minutes'"]
        params = {}
        if stop_name:
            conditions.append("stop_name = :stop_name")
            params["stop_name"] = stop_name
        if route_id:
            conditions.append("route_id = :route_id")
            params["route_id"] = route_id
        if go_back is not None:
            conditions.append("go_back = :go_back")
            params["go_back"] = go_back
        where = " AND ".join(conditions)
        rows = conn.execute(text(f"""
            SELECT DISTINCT ON (route_id, stop_name, go_back)
                route_id, stop_name, estimate_time, go_back, recorded_at
            FROM bus_arrivals
            WHERE {where}
            ORDER BY route_id, stop_name, go_back, recorded_at DESC
        """), params).fetchall()
    return [dict(r._mapping) for r in rows]

@app.get("/api/bus/shape/{route_name}")
def get_bus_shape(route_name: str, go_back: str = "0"):
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT coordinates FROM bus_shapes
            WHERE route_name = :route_name AND go_back = :go_back
            LIMIT 1
        """), {"route_name": route_name, "go_back": go_back}).fetchone()
    if not row:
        return {"coordinates": []}
    return {"coordinates": row.coordinates}

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

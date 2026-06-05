from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import text
from database import engine, init_db
from etl import run_etl, load_mrt_stations, load_mrt_exits, TRANSFER_STATIONS
import math
import gzip
import json
import requests as req
import atexit

app = FastAPI(title="台北市捷運出口即時交通儀表板 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

scheduler = BackgroundScheduler()

# 記憶體快取：RouteID(int) -> 路線名稱
_route_id_map: dict = {}
_stop_id_map: dict = {}

BUS_ROUTE_API = "https://tcgbusfs.blob.core.windows.net/blobbus/GetRoute.gz"
BUS_STOP_API  = "https://tcgbusfs.blob.core.windows.net/blobbus/GetStop.gz"
BUS_ESTIMATE_API = "https://tcgbusfs.blob.core.windows.net/blobbus/GetEstimateTime.gz"

def fetch_gz(url, timeout=15):
    resp = req.get(url, timeout=timeout)
    resp.raise_for_status()
    data = json.loads(gzip.decompress(resp.content).decode("utf-8"))
    if isinstance(data, dict) and "BusInfo" in data:
        return data["BusInfo"]
    return data

def build_route_map():
    global _route_id_map
    try:
        routes = fetch_gz(BUS_ROUTE_API)
        _route_id_map = {int(r["Id"]): r.get("nameZh", "").strip() for r in routes if r.get("Id") and r.get("nameZh")}
        print(f"  路線對照表建立完成：{len(_route_id_map)} 條")
    except Exception as e:
        print(f"  路線對照表建立失敗: {e}，使用資料庫 fallback")
        # fallback：從資料庫的 route_destinations 反推（名稱已知）
        try:
            with engine.connect() as conn:
                rows = conn.execute(text("SELECT DISTINCT route_name FROM route_destinations")).fetchall()
            # 無法建立數字->名稱的對照，但至少讓 map 非空避免重複失敗
            _route_id_map = {0: "unknown"} if not _route_id_map else _route_id_map
        except Exception:
            pass

def build_stop_map():
    global _stop_id_map
    try:
        stops = fetch_gz(BUS_STOP_API)
        _stop_id_map = {int(s["Id"]): s.get("nameZh", "") for s in stops if s.get("Id")}
        print(f"  站牌對照表建立完成：{len(_stop_id_map)} 個")
    except Exception as e:
        print(f"  站牌對照表建立失敗: {e}")

@app.on_event("startup")
def startup():
    init_db()
    load_mrt_stations()
    load_mrt_exits()
    build_route_map()
    build_stop_map()
    run_etl()
    scheduler.add_job(run_etl, "interval", minutes=1, id="etl_job")
    # 每小時重建路線/站牌對照表
    scheduler.add_job(build_route_map, "interval", hours=1, id="route_map_job")
    scheduler.add_job(build_stop_map, "interval", hours=6, id="stop_map_job")
    scheduler.start()

atexit.register(lambda: scheduler.shutdown())

@app.get("/")
def root():
    return {"status": "ok", "message": "台北市捷運出口即時交通儀表板 API"}

@app.get("/api/mrt/stations")
def get_mrt_stations():
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT DISTINCT ON (station_name) station_name, line, line_color, lat, lng
            FROM mrt_stations ORDER BY station_name, id
        """)).fetchall()
    result = []
    for r in rows:
        item = dict(r._mapping)
        name = item["station_name"].strip()
        item["colors"] = TRANSFER_STATIONS.get(name, [item["line_color"]])
        result.append(item)
    return result

@app.get("/api/mrt/exits")
def get_mrt_exits(station_name: str):
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT station_name, exit_name, exit_number, lat, lng
            FROM mrt_exits WHERE station_name = :name ORDER BY exit_name
        """), {"name": station_name}).fetchall()
        if not rows:
            rows = conn.execute(text("""
                SELECT station_name, exit_name, exit_number, lat, lng
                FROM mrt_exits WHERE station_name LIKE :name ORDER BY exit_name
            """), {"name": f"%{station_name}%"}).fetchall()
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
        youbike_rows = conn.execute(text("""
            SELECT s.station_id, s.station_name, s.area, s.lat, s.lng,
                   s.total_spaces, snap.available_bikes, snap.available_spaces
            FROM youbike_stations s
            LEFT JOIN LATERAL (
                SELECT available_bikes, available_spaces
                FROM youbike_snapshots
                WHERE station_id = s.station_id
                ORDER BY recorded_at DESC LIMIT 1
            ) snap ON true
            WHERE s.lat BETWEEN :lat - 0.015 AND :lat + 0.015
              AND s.lng BETWEEN :lng - 0.015 AND :lng + 0.015
        """), {"lat": lat, "lng": lng}).fetchall()

        bus_rows = conn.execute(text("""
            SELECT DISTINCT stop_name, lat, lng
            FROM bus_stops
            WHERE lat BETWEEN :lat - 0.015 AND :lat + 0.015
              AND lng BETWEEN :lng - 0.015 AND :lng + 0.015
              AND lat != 0 AND lng != 0
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
        "bus_stops": nearby_bus[:30],
    }

@app.get("/api/bus/arrivals")
def get_bus_arrivals(stop_name: str = None, go_back: str = None):
    if not stop_name:
        return []

    # 若對照表是空的，先重建
    if not _route_id_map:
        build_route_map()
    if not _stop_id_map:
        build_stop_map()

    # 找目標 stop_id
    target_stop_ids = {sid for sid, name in _stop_id_map.items() if name == stop_name}
    if not target_stop_ids:
        return []

    # 從資料庫取終點站對照
    with engine.connect() as conn:
        dest_rows = conn.execute(text("""
            SELECT route_name, go_back, destination FROM route_destinations
        """)).fetchall()
    dest_map = {(r.route_name, r.go_back): r.destination for r in dest_rows}

    try:
        estimates = fetch_gz(BUS_ESTIMATE_API, timeout=10)
    except Exception:
        return []

    result = []
    seen = set()
    for item in estimates:
        stop_id = int(item.get("StopID", 0))
        if stop_id not in target_stop_ids:
            continue
        item_go_back = str(item.get("GoBack", "0"))
        if go_back is not None and item_go_back != go_back:
            continue

        route_id_num = int(item.get("RouteID", 0))
        route_name = _route_id_map.get(route_id_num, str(route_id_num))

        key = (route_name, item_go_back)
        if key in seen:
            continue
        seen.add(key)

        try:
            est = int(item.get("EstimateTime", -1))
        except (ValueError, TypeError):
            est = -1

        result.append({
            "route_id": route_name,
            "stop_name": stop_name,
            "estimate_time": est,
            "go_back": item_go_back,
            "destination": dest_map.get((route_name, item_go_back), ""),
        })

    result.sort(key=lambda x: x["route_id"])
    return result

@app.get("/api/bus/stops/{route_name}")
def get_bus_route_stops(route_name: str, go_back: str = "0"):
    """回傳某路線某方向的所有站點座標和名稱"""
    # 找 route_id
    route_id_num = None
    for rid, name in _route_id_map.items():
        if name == route_name:
            route_id_num = rid
            break
    if route_id_num is None:
        return []

    try:
        stops = fetch_gz(BUS_STOP_API, timeout=10)
    except Exception:
        return []

    result = []
    for s in stops:
        if str(s.get("routeId", "")) != str(route_id_num):
            continue
        if str(s.get("goBack", "")) != go_back:
            continue
        try:
            lat = float(s.get("latitude", 0))
            lng = float(s.get("longitude", 0))
            if lat == 0 or lng == 0:
                continue
            result.append({
                "stop_id": s.get("Id", ""),
                "stop_name": s.get("nameZh", ""),
                "seq": int(s.get("seqNo", 0)),
                "lat": lat,
                "lng": lng,
            })
        except Exception:
            continue

    result.sort(key=lambda x: x["seq"])
    return result


@app.get("/api/bus/shape/{route_name}")
def get_bus_shape(route_name: str, go_back: str = "0"):
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT coordinates FROM bus_shapes
            WHERE route_name = :route_name AND go_back = :go_back LIMIT 1
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
        last_update = conn.execute(text(
            "SELECT MAX(recorded_at) FROM youbike_snapshots"
        )).scalar()
    return {
        "youbike_recent_records": youbike_count,
        "last_update": last_update,
        "route_map_size": len(_route_id_map),
        "stop_map_size": len(_stop_id_map),
    }

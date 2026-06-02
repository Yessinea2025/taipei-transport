import requests
import gzip
import json
from sqlalchemy import text
from database import engine
from datetime import datetime

YOUBIKE_API = "https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json"
BUS_ESTIMATE_API = "https://tcgbusfs.blob.core.windows.net/blobbus/GetEstimateTime.gz"
BUS_STOP_API = "https://tcgbusfs.blob.core.windows.net/blobbus/GetStop.gz"
BUS_ROUTE_API = "https://tcgbusfs.blob.core.windows.net/blobbus/GetRoute.gz"

MRT_STATIONS = [
    {"station_name": "台大醫院", "line": "淡水信義線", "lat": 25.0424, "lng": 121.5165},
    {"station_name": "中正紀念堂", "line": "淡水信義線", "lat": 25.0324, "lng": 121.5196},
    {"station_name": "古亭", "line": "淡水信義線", "lat": 25.0243, "lng": 121.5289},
    {"station_name": "公館", "line": "松山新店線", "lat": 25.0145, "lng": 121.5343},
    {"station_name": "台電大樓", "line": "松山新店線", "lat": 25.0212, "lng": 121.5322},
    {"station_name": "科技大樓", "line": "松山新店線", "lat": 25.0261, "lng": 121.5436},
    {"station_name": "大安", "line": "松山新店線", "lat": 25.0330, "lng": 121.5432},
    {"station_name": "忠孝新生", "line": "板南線", "lat": 25.0428, "lng": 121.5301},
    {"station_name": "忠孝復興", "line": "板南線", "lat": 25.0416, "lng": 121.5444},
    {"station_name": "忠孝敦化", "line": "板南線", "lat": 25.0408, "lng": 121.5509},
]

TARGET_ROUTE_NAMES = ["0東", "1", "2", "3", "5", "15", "20", "22", "30", "37",
                      "52", "74", "111", "204", "208", "214", "253", "295"]

def fetch_gz(url):
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    data = json.loads(gzip.decompress(resp.content).decode("utf-8"))
    # 資料包在 BusInfo 裡
    if isinstance(data, dict) and "BusInfo" in data:
        return data["BusInfo"]
    return data

def extract_youbike():
    resp = requests.get(YOUBIKE_API, timeout=10)
    resp.raise_for_status()
    return resp.json()

def extract_bus():
    routes = fetch_gz(BUS_ROUTE_API)
    # 建立路線名稱 -> RouteID 的對應表
    route_id_map = {}
    for r in routes:
        name = r.get("nameZh", "").strip()
        rid = r.get("Id")
        if name in TARGET_ROUTE_NAMES and rid:
            route_id_map[int(rid)] = name
    
    estimates = fetch_gz(BUS_ESTIMATE_API)
    stops = fetch_gz(BUS_STOP_API)
    
    # 建立 StopID -> 站名對應表
    stop_map = {int(s["Id"]): s.get("nameZh", "") for s in stops}
    
    return estimates, stop_map, route_id_map

def transform_youbike(raw):
    stations = []
    snapshots = []
    for item in raw:
        if item.get("act") != "1":
            continue
        station = {
            "station_id": item["sno"],
            "station_name": item["sna"],
            "area": item.get("sarea", ""),
            "lat": float(item["latitude"]),
            "lng": float(item["longitude"]),
            "total_spaces": int(item.get("Quantity", 0)),
        }
        snapshot = {
            "station_id": item["sno"],
            "available_bikes": int(item.get("available_rent_bikes", 0)),
            "available_spaces": int(item.get("available_return_bikes", 0)),
        }
        stations.append(station)
        snapshots.append(snapshot)
    return stations, snapshots

def transform_bus(estimates, stop_map, route_id_map):
    arrivals = []
    for item in estimates:
        route_id = int(item.get("RouteID", 0))
        if route_id not in route_id_map:
            continue
        route_name = route_id_map[route_id]
        stop_id = int(item.get("StopID", 0))
        stop_name = stop_map.get(stop_id, str(stop_id))
        try:
            est = int(item.get("EstimateTime", -1))
        except (ValueError, TypeError):
            est = -1
        arrivals.append({
            "route_id": route_name,
            "stop_name": stop_name,
            "estimate_time": est,
            "plate_numb": "",
        })
    return arrivals

def load_mrt_stations():
    with engine.connect() as conn:
        for s in MRT_STATIONS:
            conn.execute(text("""
                INSERT INTO mrt_stations (station_name, line, lat, lng)
                VALUES (:station_name, :line, :lat, :lng)
                ON CONFLICT DO NOTHING
            """), s)
        conn.commit()

def load_youbike(stations, snapshots):
    with engine.connect() as conn:
        for s in stations:
            conn.execute(text("""
                INSERT INTO youbike_stations
                    (station_id, station_name, area, lat, lng, total_spaces)
                VALUES
                    (:station_id, :station_name, :area, :lat, :lng, :total_spaces)
                ON CONFLICT (station_id) DO UPDATE SET
                    total_spaces = EXCLUDED.total_spaces
            """), s)
        now = datetime.utcnow()
        for snap in snapshots:
            snap["recorded_at"] = now
            conn.execute(text("""
                INSERT INTO youbike_snapshots
                    (station_id, available_bikes, available_spaces, recorded_at)
                VALUES
                    (:station_id, :available_bikes, :available_spaces, :recorded_at)
            """), snap)
        conn.commit()

def load_bus(arrivals):
    with engine.connect() as conn:
        now = datetime.utcnow()
        for a in arrivals:
            a["recorded_at"] = now
            conn.execute(text("""
                INSERT INTO bus_arrivals
                    (route_id, stop_name, estimate_time, plate_numb, recorded_at)
                VALUES
                    (:route_id, :stop_name, :estimate_time, :plate_numb, :recorded_at)
            """), a)
        conn.commit()

def cleanup_old_data():
    with engine.connect() as conn:
        conn.execute(text("""
            DELETE FROM youbike_snapshots
            WHERE recorded_at < NOW() - INTERVAL '7 days'
        """))
        conn.execute(text("""
            DELETE FROM bus_arrivals
            WHERE recorded_at < NOW() - INTERVAL '2 days'
        """))
        conn.commit()

def run_etl():
    print(f"[{datetime.utcnow()}] ETL 開始...")
    try:
        raw_youbike = extract_youbike()
        stations, snapshots = transform_youbike(raw_youbike)
        load_youbike(stations, snapshots)
        print(f"  YouBike: {len(snapshots)} 筆快照")
    except Exception as e:
        print(f"  YouBike ETL 失敗: {e}")
    try:
        estimates, stop_map, route_id_map = extract_bus()
        arrivals = transform_bus(estimates, stop_map, route_id_map)
        load_bus(arrivals)
        print(f"  公車: {len(arrivals)} 筆到站資料（{len(route_id_map)} 條路線）")
    except Exception as e:
        print(f"  公車 ETL 失敗: {e}")
    try:
        cleanup_old_data()
        print("  舊資料清理完成")
    except Exception as e:
        print(f"  清理失敗: {e}")
    print(f"[{datetime.utcnow()}] ETL 完成")

if __name__ == "__main__":
    run_etl()

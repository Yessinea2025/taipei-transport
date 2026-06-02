import requests
from sqlalchemy import text
from database import engine
from datetime import datetime

YOUBIKE_API = "https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json"
BUS_ROUTE_API = "https://tcgbusfs.blob.core.windows.net/busfs/GetBusInfo.json"
BUS_ARRIVAL_API = "https://tcgbusfs.blob.core.windows.net/busfs/GetEstimateTime.json"

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

TARGET_ROUTES = ["0東", "1", "2", "3", "5", "15", "20", "22", "30", "37",
                 "52", "74", "111", "204", "208", "214", "253", "295"]

def extract_youbike():
    resp = requests.get(YOUBIKE_API, timeout=10)
    resp.raise_for_status()
    return resp.json()

def extract_bus_arrivals():
    resp = requests.get(BUS_ARRIVAL_API, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    return data.get("BusInfo", [])

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

def transform_bus(raw):
    arrivals = []
    for item in raw:
        route = item.get("routeid", "")
        if route not in TARGET_ROUTES:
            continue
        try:
            est = int(item.get("EstimateTime", -1))
        except (ValueError, TypeError):
            est = -1
        arrivals.append({
            "route_id": route,
            "stop_name": item.get("stopname", ""),
            "estimate_time": est,
            "plate_numb": item.get("PlateNumb", ""),
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
                    available_bikes = EXCLUDED.available_bikes,
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
        raw_bus = extract_bus_arrivals()
        arrivals = transform_bus(raw_bus)
        load_bus(arrivals)
        print(f"  公車: {len(arrivals)} 筆到站資料")
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

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def init_db():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS mrt_stations (
                id SERIAL PRIMARY KEY,
                station_name VARCHAR(100) NOT NULL,
                station_code VARCHAR(10),
                line VARCHAR(50),
                line_color VARCHAR(20),
                lat FLOAT,
                lng FLOAT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS youbike_stations (
                id SERIAL PRIMARY KEY,
                station_id VARCHAR(50) UNIQUE NOT NULL,
                station_name VARCHAR(200),
                area VARCHAR(50),
                lat FLOAT,
                lng FLOAT,
                total_spaces INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS youbike_snapshots (
                id SERIAL PRIMARY KEY,
                station_id VARCHAR(50) NOT NULL,
                available_bikes INTEGER,
                available_spaces INTEGER,
                recorded_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_youbike_snapshots_station_id
            ON youbike_snapshots(station_id)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_youbike_snapshots_recorded_at
            ON youbike_snapshots(recorded_at)
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bus_stops (
                id SERIAL PRIMARY KEY,
                stop_id INTEGER UNIQUE,
                stop_name VARCHAR(100),
                lat FLOAT,
                lng FLOAT
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bus_arrivals (
                id SERIAL PRIMARY KEY,
                route_id VARCHAR(50) NOT NULL,
                stop_name VARCHAR(100),
                estimate_time INTEGER,
                go_back VARCHAR(5),
                recorded_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_bus_arrivals_recorded_at
            ON bus_arrivals(recorded_at)
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bus_shapes (
                id SERIAL PRIMARY KEY,
                route_name VARCHAR(50),
                go_back VARCHAR(5),
                coordinates JSONB,
                UNIQUE(route_name, go_back)
            )
        """))
        conn.commit()
    print("資料庫初始化完成")

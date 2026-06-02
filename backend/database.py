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
                line VARCHAR(50),
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
            CREATE TABLE IF NOT EXISTS bus_routes (
                id SERIAL PRIMARY KEY,
                route_id VARCHAR(50) UNIQUE NOT NULL,
                route_name VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bus_arrivals (
                id SERIAL PRIMARY KEY,
                route_id VARCHAR(50) NOT NULL,
                stop_name VARCHAR(100),
                estimate_time INTEGER,
                plate_numb VARCHAR(20),
                recorded_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_bus_arrivals_recorded_at
            ON bus_arrivals(recorded_at)
        """))
        conn.commit()
    print("資料庫初始化完成")

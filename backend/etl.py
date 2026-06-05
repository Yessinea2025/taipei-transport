import requests
import gzip
import json
import re
import csv
import io
from sqlalchemy import text
from database import engine
from datetime import datetime

YOUBIKE_TP_API = "https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json"
YOUBIKE_NTP_API = "https://data.ntpc.gov.tw/api/datasets/010e5b15-3823-4b20-b401-b1cf000550c5/json?size=1000"
BUS_ESTIMATE_API = "https://tcgbusfs.blob.core.windows.net/blobbus/GetEstimateTime.gz"
BUS_STOP_API = "https://tcgbusfs.blob.core.windows.net/blobbus/GetStop.gz"
BUS_ROUTE_API = "https://tcgbusfs.blob.core.windows.net/blobbus/GetRoute.gz"
BUS_SHAPE_API = "https://tcgbusfs.blob.core.windows.net/blobbus/GetBusShape.gz"
MRT_EXIT_API = "https://data.taipei/api/v1/dataset/307a7f61-e302-4108-a817-877ccbfca7c1?scope=resourceAquire&limit=500"

TRANSFER_STATIONS = {
    "台北車站":   ["#e3002c", "#0070bd"],
    "忠孝新生":   ["#0070bd", "#f8a217"],
    "忠孝復興":   ["#0070bd", "#a05a2c"],
    "南京復興":   ["#008659", "#a05a2c"],
    "古亭":       ["#008659", "#f8a217"],
    "民權西路":   ["#e3002c", "#f8a217"],
    "大安":       ["#e3002c", "#a05a2c"],
    "東門":       ["#e3002c", "#f8a217"],
    "中正紀念堂": ["#e3002c", "#008659"],
    "南港展覽館": ["#0070bd", "#a05a2c"],
    "中山":       ["#e3002c", "#008659"],
    "松江南京":   ["#008659", "#f8a217"],
    "西門":       ["#0070bd", "#008659"],
    # 環狀線接界站
    "頭前庄":     ["#ffd700", "#f8a217"],
    "景安":       ["#ffd700", "#f8a217"],
    "大坪林":     ["#ffd700", "#008659"],
}

MRT_STATIONS = [
    # 淡水信義線 (紅)
    {"station_name":"象山","station_code":"R02","line":"淡水信義線","line_color":"#e3002c","lat":25.032786,"lng":121.569958},
    {"station_name":"台北101/世貿","station_code":"R03","line":"淡水信義線","line_color":"#e3002c","lat":25.032965,"lng":121.562933},
    {"station_name":"信義安和","station_code":"R04","line":"淡水信義線","line_color":"#e3002c","lat":25.033104,"lng":121.552954},
    {"station_name":"大安","station_code":"R05","line":"淡水信義線","line_color":"#e3002c","lat":25.033414,"lng":121.542894},
    {"station_name":"大安森林公園","station_code":"R06","line":"淡水信義線","line_color":"#e3002c","lat":25.033482,"lng":121.535174},
    {"station_name":"東門","station_code":"R07","line":"淡水信義線","line_color":"#e3002c","lat":25.033903,"lng":121.5288},
    {"station_name":"中正紀念堂","station_code":"R08","line":"淡水信義線","line_color":"#e3002c","lat":25.033889,"lng":121.517488},
    {"station_name":"台大醫院","station_code":"R09","line":"淡水信義線","line_color":"#e3002c","lat":25.041955,"lng":121.516313},
    {"station_name":"台北車站","station_code":"R10","line":"淡水信義線","line_color":"#e3002c","lat":25.046778,"lng":121.517707},
    {"station_name":"中山","station_code":"R11","line":"淡水信義線","line_color":"#e3002c","lat":25.052689,"lng":121.520194},
    {"station_name":"雙連","station_code":"R12","line":"淡水信義線","line_color":"#e3002c","lat":25.057662,"lng":121.520601},
    {"station_name":"民權西路","station_code":"R13","line":"淡水信義線","line_color":"#e3002c","lat":25.062541,"lng":121.519789},
    {"station_name":"圓山","station_code":"R14","line":"淡水信義線","line_color":"#e3002c","lat":25.071281,"lng":121.520071},
    {"station_name":"劍潭","station_code":"R15","line":"淡水信義線","line_color":"#e3002c","lat":25.084196,"lng":121.524962},
    {"station_name":"士林","station_code":"R16","line":"淡水信義線","line_color":"#e3002c","lat":25.093483,"lng":121.526203},
    {"station_name":"芝山","station_code":"R17","line":"淡水信義線","line_color":"#e3002c","lat":25.102943,"lng":121.522486},
    {"station_name":"明德","station_code":"R18","line":"淡水信義線","line_color":"#e3002c","lat":25.109757,"lng":121.518806},
    {"station_name":"石牌","station_code":"R19","line":"淡水信義線","line_color":"#e3002c","lat":25.114242,"lng":121.515752},
    {"station_name":"唭哩岸","station_code":"R20","line":"淡水信義線","line_color":"#e3002c","lat":25.120782,"lng":121.506404},
    {"station_name":"奇岩","station_code":"R21","line":"淡水信義線","line_color":"#e3002c","lat":25.125427,"lng":121.501111},
    {"station_name":"北投","station_code":"R22","line":"淡水信義線","line_color":"#e3002c","lat":25.131676,"lng":121.498656},
    {"station_name":"新北投","station_code":"R22A","line":"淡水信義線","line_color":"#e3002c","lat":25.136901,"lng":121.502989},
    {"station_name":"復興崗","station_code":"R23","line":"淡水信義線","line_color":"#e3002c","lat":25.137497,"lng":121.485266},
    {"station_name":"忠義","station_code":"R24","line":"淡水信義線","line_color":"#e3002c","lat":25.131021,"lng":121.473408},
    {"station_name":"關渡","station_code":"R25","line":"淡水信義線","line_color":"#e3002c","lat":25.12545,"lng":121.467038},
    {"station_name":"竹圍","station_code":"R26","line":"淡水信義線","line_color":"#e3002c","lat":25.136902,"lng":121.459548},
    {"station_name":"紅樹林","station_code":"R27","line":"淡水信義線","line_color":"#e3002c","lat":25.154547,"lng":121.458883},
    {"station_name":"淡水","station_code":"R28","line":"淡水信義線","line_color":"#e3002c","lat":25.167876,"lng":121.445622},
    # 松山新店線 (綠)
    {"station_name":"松山","station_code":"G01","line":"松山新店線","line_color":"#008659","lat":25.050128,"lng":121.57731},
    {"station_name":"南京三民","station_code":"G02","line":"松山新店線","line_color":"#008659","lat":25.051441,"lng":121.563895},
    {"station_name":"台北小巨蛋","station_code":"G03","line":"松山新店線","line_color":"#008659","lat":25.05166,"lng":121.551952},
    {"station_name":"南京復興","station_code":"G04","line":"松山新店線","line_color":"#008659","lat":25.052016,"lng":121.543489},
    {"station_name":"忠孝復興","station_code":"G05","line":"松山新店線","line_color":"#008659","lat":25.041652,"lng":121.544102},
    {"station_name":"忠孝新生","station_code":"G06","line":"松山新店線","line_color":"#008659","lat":25.041813,"lng":121.53276},
    {"station_name":"古亭","station_code":"G07","line":"松山新店線","line_color":"#008659","lat":25.026695,"lng":121.522662},
    {"station_name":"台電大樓","station_code":"G08","line":"松山新店線","line_color":"#008659","lat":25.020553,"lng":121.528111},
    {"station_name":"公館","station_code":"G09","line":"松山新店線","line_color":"#008659","lat":25.014949,"lng":121.534187},
    {"station_name":"萬隆","station_code":"G10","line":"松山新店線","line_color":"#008659","lat":25.001942,"lng":121.539056},
    {"station_name":"景美","station_code":"G11","line":"松山新店線","line_color":"#008659","lat":24.992649,"lng":121.540919},
    {"station_name":"大坪林","station_code":"G12","line":"松山新店線","line_color":"#008659","lat":24.982837,"lng":121.541736},
    {"station_name":"七張","station_code":"G13","line":"松山新店線","line_color":"#008659","lat":24.975967,"lng":121.542855},
    {"station_name":"新店區公所","station_code":"G14","line":"松山新店線","line_color":"#008659","lat":24.967689,"lng":121.541426},
    {"station_name":"新店","station_code":"G15","line":"松山新店線","line_color":"#008659","lat":24.95784,"lng":121.53758},
    {"station_name":"小碧潭","station_code":"G15A","line":"松山新店線","line_color":"#008659","lat":24.972498,"lng":121.529923},
    # 板南線 (藍)
    {"station_name":"頂埔","station_code":"BL01","line":"板南線","line_color":"#0070bd","lat":24.959508,"lng":121.418986},
    {"station_name":"土城","station_code":"BL02","line":"板南線","line_color":"#0070bd","lat":24.973209,"lng":121.44437},
    {"station_name":"永寧","station_code":"BL03","line":"板南線","line_color":"#0070bd","lat":24.966863,"lng":121.436334},
    {"station_name":"海山","station_code":"BL04","line":"板南線","line_color":"#0070bd","lat":24.985674,"lng":121.448901},
    {"station_name":"亞東醫院","station_code":"BL05","line":"板南線","line_color":"#0070bd","lat":24.998687,"lng":121.452613},
    {"station_name":"板橋","station_code":"BL06","line":"板南線","line_color":"#0070bd","lat":25.014317,"lng":121.463269},
    {"station_name":"新埔","station_code":"BL07","line":"板南線","line_color":"#0070bd","lat":25.023206,"lng":121.46822},
    {"station_name":"江子翠","station_code":"BL08","line":"板南線","line_color":"#0070bd","lat":25.030249,"lng":121.47253},
    {"station_name":"龍山寺","station_code":"BL09","line":"板南線","line_color":"#0070bd","lat":25.035338,"lng":121.500317},
    {"station_name":"西門","station_code":"BL10","line":"板南線","line_color":"#0070bd","lat":25.042197,"lng":121.508381},
    {"station_name":"台北車站","station_code":"BL11","line":"板南線","line_color":"#0070bd","lat":25.046778,"lng":121.517707},
    {"station_name":"善導寺","station_code":"BL12","line":"板南線","line_color":"#0070bd","lat":25.044577,"lng":121.523955},
    {"station_name":"忠孝新生","station_code":"BL13","line":"板南線","line_color":"#0070bd","lat":25.041813,"lng":121.53276},
    {"station_name":"忠孝復興","station_code":"BL14","line":"板南線","line_color":"#0070bd","lat":25.041652,"lng":121.544102},
    {"station_name":"忠孝敦化","station_code":"BL15","line":"板南線","line_color":"#0070bd","lat":25.041477,"lng":121.550316},
    {"station_name":"國父紀念館","station_code":"BL16","line":"板南線","line_color":"#0070bd","lat":25.041347,"lng":121.557578},
    {"station_name":"市政府","station_code":"BL17","line":"板南線","line_color":"#0070bd","lat":25.041136,"lng":121.566213},
    {"station_name":"永春","station_code":"BL18","line":"板南線","line_color":"#0070bd","lat":25.040813,"lng":121.575971},
    {"station_name":"後山埤","station_code":"BL19","line":"板南線","line_color":"#0070bd","lat":25.044753,"lng":121.582245},
    {"station_name":"昆陽","station_code":"BL20","line":"板南線","line_color":"#0070bd","lat":25.050473,"lng":121.593245},
    {"station_name":"南港","station_code":"BL21","line":"板南線","line_color":"#0070bd","lat":25.051968,"lng":121.606893},
    {"station_name":"南港展覽館","station_code":"BL22","line":"板南線","line_color":"#0070bd","lat":25.05509,"lng":121.617612},
    # 中和新蘆線 (橘)
    {"station_name":"迴龍","station_code":"O01","line":"中和新蘆線","line_color":"#f8a217","lat":25.02185,"lng":121.41151},
    {"station_name":"丹鳳","station_code":"O02","line":"中和新蘆線","line_color":"#f8a217","lat":25.028866,"lng":121.422462},
    {"station_name":"輔大","station_code":"O03","line":"中和新蘆線","line_color":"#f8a217","lat":25.03276,"lng":121.435904},
    {"station_name":"新莊","station_code":"O04","line":"中和新蘆線","line_color":"#f8a217","lat":25.036158,"lng":121.452472},
    {"station_name":"頭前庄","station_code":"O05","line":"中和新蘆線","line_color":"#f8a217","lat":25.039756,"lng":121.461438},
    {"station_name":"先嗇宮","station_code":"O06","line":"中和新蘆線","line_color":"#f8a217","lat":25.046292,"lng":121.471423},
    {"station_name":"三重","station_code":"O07","line":"中和新蘆線","line_color":"#f8a217","lat":25.055701,"lng":121.484246},
    {"station_name":"菜寮","station_code":"O08","line":"中和新蘆線","line_color":"#f8a217","lat":25.059851,"lng":121.491297},
    {"station_name":"台北橋","station_code":"O09","line":"中和新蘆線","line_color":"#f8a217","lat":25.062966,"lng":121.500281},
    {"station_name":"大橋頭","station_code":"O10","line":"中和新蘆線","line_color":"#f8a217","lat":25.063362,"lng":121.512688},
    {"station_name":"民權西路","station_code":"O11","line":"中和新蘆線","line_color":"#f8a217","lat":25.062541,"lng":121.519789},
    {"station_name":"中山國小","station_code":"O12","line":"中和新蘆線","line_color":"#f8a217","lat":25.062653,"lng":121.526548},
    {"station_name":"行天宮","station_code":"O13","line":"中和新蘆線","line_color":"#f8a217","lat":25.059282,"lng":121.533193},
    {"station_name":"松江南京","station_code":"O14","line":"中和新蘆線","line_color":"#f8a217","lat":25.051877,"lng":121.53316},
    {"station_name":"忠孝新生","station_code":"O15","line":"中和新蘆線","line_color":"#f8a217","lat":25.041813,"lng":121.53276},
    {"station_name":"古亭","station_code":"O16","line":"中和新蘆線","line_color":"#f8a217","lat":25.026695,"lng":121.522662},
    {"station_name":"頂溪","station_code":"O17","line":"中和新蘆線","line_color":"#f8a217","lat":25.013559,"lng":121.51543},
    {"station_name":"永安市場","station_code":"O18","line":"中和新蘆線","line_color":"#f8a217","lat":25.002375,"lng":121.510962},
    {"station_name":"景安","station_code":"O19","line":"中和新蘆線","line_color":"#f8a217","lat":24.993731,"lng":121.50456},
    {"station_name":"南勢角","station_code":"O20","line":"中和新蘆線","line_color":"#f8a217","lat":24.990059,"lng":121.508829},
    # 文湖線 (深棕)
    {"station_name":"動物園","station_code":"BR01","line":"文湖線","line_color":"#a05a2c","lat":24.998135,"lng":121.579632},
    {"station_name":"木柵","station_code":"BR02","line":"文湖線","line_color":"#a05a2c","lat":24.998174,"lng":121.573417},
    {"station_name":"萬芳社區","station_code":"BR03","line":"文湖線","line_color":"#a05a2c","lat":24.998581,"lng":121.568409},
    {"station_name":"萬芳醫院","station_code":"BR04","line":"文湖線","line_color":"#a05a2c","lat":24.999383,"lng":121.557737},
    {"station_name":"辛亥","station_code":"BR05","line":"文湖線","line_color":"#a05a2c","lat":25.005119,"lng":121.557021},
    {"station_name":"麟光","station_code":"BR06","line":"文湖線","line_color":"#a05a2c","lat":25.018554,"lng":121.558606},
    {"station_name":"六張犁","station_code":"BR07","line":"文湖線","line_color":"#a05a2c","lat":25.023852,"lng":121.552737},
    {"station_name":"科技大樓","station_code":"BR08","line":"文湖線","line_color":"#a05a2c","lat":25.026154,"lng":121.543636},
    {"station_name":"大安","station_code":"BR09","line":"文湖線","line_color":"#a05a2c","lat":25.033414,"lng":121.542894},
    {"station_name":"忠孝復興","station_code":"BR10","line":"文湖線","line_color":"#a05a2c","lat":25.041652,"lng":121.544102},
    {"station_name":"南京復興","station_code":"BR11","line":"文湖線","line_color":"#a05a2c","lat":25.052016,"lng":121.543489},
    {"station_name":"中山國中","station_code":"BR12","line":"文湖線","line_color":"#a05a2c","lat":25.060826,"lng":121.543979},
    {"station_name":"松山機場","station_code":"BR13","line":"文湖線","line_color":"#a05a2c","lat":25.063446,"lng":121.551624},
    {"station_name":"大直","station_code":"BR14","line":"文湖線","line_color":"#a05a2c","lat":25.079795,"lng":121.54692},
    {"station_name":"劍南路","station_code":"BR15","line":"文湖線","line_color":"#a05a2c","lat":25.084802,"lng":121.555541},
    {"station_name":"西湖","station_code":"BR16","line":"文湖線","line_color":"#a05a2c","lat":25.082181,"lng":121.566894},
    {"station_name":"港墘","station_code":"BR17","line":"文湖線","line_color":"#a05a2c","lat":25.080098,"lng":121.575252},
    {"station_name":"文德","station_code":"BR18","line":"文湖線","line_color":"#a05a2c","lat":25.078512,"lng":121.585119},
    {"station_name":"內湖","station_code":"BR19","line":"文湖線","line_color":"#a05a2c","lat":25.08369,"lng":121.594439},
    {"station_name":"大湖公園","station_code":"BR20","line":"文湖線","line_color":"#a05a2c","lat":25.083785,"lng":121.602294},
    {"station_name":"葫洲","station_code":"BR21","line":"文湖線","line_color":"#a05a2c","lat":25.072522,"lng":121.607633},
    {"station_name":"東湖","station_code":"BR22","line":"文湖線","line_color":"#a05a2c","lat":25.067146,"lng":121.611386},
    {"station_name":"南港軟體園區","station_code":"BR23","line":"文湖線","line_color":"#a05a2c","lat":25.060253,"lng":121.616097},
    {"station_name":"南港展覽館","station_code":"BR24","line":"文湖線","line_color":"#a05a2c","lat":25.05509,"lng":121.617612},
    # 環狀線 (金色)
    {"station_name":"新北產業園區","station_code":"Y01","line":"環狀線","line_color":"#ffd700","lat":25.061564,"lng":121.459774},
    {"station_name":"幸福","station_code":"Y02","line":"環狀線","line_color":"#ffd700","lat":25.049943,"lng":121.460191},
    {"station_name":"頭前庄","station_code":"Y03","line":"環狀線","line_color":"#ffd700","lat":25.039756,"lng":121.461438},
    {"station_name":"新埔民生","station_code":"Y04","line":"環狀線","line_color":"#ffd700","lat":25.026125,"lng":121.466839},
    {"station_name":"板新","station_code":"Y05","line":"環狀線","line_color":"#ffd700","lat":25.014491,"lng":121.472212},
    {"station_name":"中原","station_code":"Y06","line":"環狀線","line_color":"#ffd700","lat":25.00841,"lng":121.484159},
    {"station_name":"橋和","station_code":"Y07","line":"環狀線","line_color":"#ffd700","lat":25.004803,"lng":121.490278},
    {"station_name":"中和","station_code":"Y08","line":"環狀線","line_color":"#ffd700","lat":25.002212,"lng":121.496491},
    {"station_name":"景安","station_code":"Y09","line":"環狀線","line_color":"#ffd700","lat":24.993731,"lng":121.50456},
    {"station_name":"景平","station_code":"Y10","line":"環狀線","line_color":"#ffd700","lat":24.991926,"lng":121.51625},
    {"station_name":"秀朗橋","station_code":"Y11","line":"環狀線","line_color":"#ffd700","lat":24.990537,"lng":121.525165},
    {"station_name":"十四張","station_code":"Y12","line":"環狀線","line_color":"#ffd700","lat":24.984467,"lng":121.527701},
    {"station_name":"大坪林","station_code":"Y13","line":"環狀線","line_color":"#ffd700","lat":24.982837,"lng":121.541736},
]

def parse_station_name(exit_name):
    if exit_name.startswith('台北車站'):
        return '台北車站'
    if '站出口' in exit_name:
        return exit_name.split('站出口')[0]
    if exit_name.endswith('站出口'):
        return exit_name[:-3]
    return exit_name.split('站')[0] if '站' in exit_name else exit_name

def fetch_gz(url):
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    data = json.loads(gzip.decompress(resp.content).decode("utf-8"))
    if isinstance(data, dict) and "BusInfo" in data:
        return data["BusInfo"]
    return data

def extract_youbike_taipei():
    resp = requests.get(YOUBIKE_TP_API, timeout=10)
    resp.raise_for_status()
    return resp.json()

def extract_youbike_ntpc():
    resp = requests.get(YOUBIKE_NTP_API, timeout=10)
    resp.raise_for_status()
    return resp.json()

def extract_bus():
    routes = fetch_gz(BUS_ROUTE_API)
    route_id_map = {}
    route_destinations = {}
    for r in routes:
        name = r.get("nameZh", "").strip()
        rid = r.get("Id")
        if rid and name:
            route_id_map[int(rid)] = name
            route_destinations[name] = {
                "0": r.get("destinationZh", ""),
                "1": r.get("departureZh", ""),
            }
    estimates = fetch_gz(BUS_ESTIMATE_API)
    stops = fetch_gz(BUS_STOP_API)
    stop_map = {int(s["Id"]): s.get("nameZh", "") for s in stops}
    return estimates, stop_map, route_id_map, stops, route_destinations

def parse_wkt_linestring(wkt):
    coords = []
    try:
        nums = re.findall(r'[-\d.]+\s+[-\d.]+', wkt)
        for pair in nums:
            parts = pair.strip().split()
            if len(parts) == 2:
                coords.append([float(parts[1]), float(parts[0])])
    except Exception:
        pass
    return coords

def transform_youbike_taipei(raw):
    stations, snapshots = [], []
    for item in raw:
        if item.get("act") != "1":
            continue
        stations.append({
            "station_id": item["sno"],
            "station_name": item["sna"],
            "area": item.get("sarea", ""),
            "lat": float(item["latitude"]),
            "lng": float(item["longitude"]),
            "total_spaces": int(item.get("Quantity", 0)),
        })
        snapshots.append({
            "station_id": item["sno"],
            "available_bikes": int(item.get("available_rent_bikes", 0)),
            "available_spaces": int(item.get("available_return_bikes", 0)),
        })
    return stations, snapshots

def transform_youbike_ntpc(raw):
    stations, snapshots = [], []
    for item in raw:
        try:
            # 新北欄位可能是 sno/sna 或 StationNo/StationName
            sid = item.get("sno") or item.get("StationNo", "")
            if not sid:
                continue
            lat = float(item.get("latitude") or item.get("Latitude") or 0)
            lng = float(item.get("longitude") or item.get("Longitude") or 0)
            if lat == 0 or lng == 0:
                continue
            stations.append({
                "station_id": f"NTP_{sid}",
                "station_name": item.get("sna") or item.get("StationName", ""),
                "area": item.get("sarea") or item.get("AreaName", ""),
                "lat": lat,
                "lng": lng,
                "total_spaces": int(item.get("tot_quantity") or item.get("tot") or item.get("BikesCapacity") or 0),
            })
            snapshots.append({
                "station_id": f"NTP_{sid}",
                "available_bikes": int(item.get("sbi_quantity") or item.get("sbi") or item.get("AvailableRentBikes") or 0),
                "available_spaces": int(item.get("bemp") or item.get("AvailableReturnBikes") or 0),
            })
        except Exception:
            continue
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
        go_back = str(item.get("GoBack", "0"))
        arrivals.append({
            "route_id": route_name,
            "stop_name": stop_name,
            "estimate_time": est,
            "go_back": go_back,
        })
    return arrivals

def load_mrt_stations():
    with engine.connect() as conn:
        existing = conn.execute(text("SELECT COUNT(*) FROM mrt_stations")).scalar()
        if existing > 0:
            conn.execute(text("UPDATE mrt_stations SET line_color = '#a05a2c' WHERE line = '文湖線'"))
            conn.commit()
            return
        for s in MRT_STATIONS:
            conn.execute(text("""
                INSERT INTO mrt_stations (station_name, station_code, line, line_color, lat, lng)
                VALUES (:station_name, :station_code, :line, :line_color, :lat, :lng)
                ON CONFLICT DO NOTHING
            """), s)
        conn.commit()
    print(f"  捷運站載入完成：{len(MRT_STATIONS)} 站")

def load_mrt_exits():
    with engine.connect() as conn:
        existing = conn.execute(text("SELECT COUNT(*) FROM mrt_exits")).scalar()
        if existing > 0:
            return
    try:
        resp = requests.get(MRT_EXIT_API, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("result", {}).get("results", [])
        with engine.connect() as conn:
            for r in results:
                try:
                    exit_name = r.get("出入口名稱", "")
                    exit_number = r.get("出入口編號", "")
                    station_name = parse_station_name(exit_name)
                    if not station_name:
                        continue
                    conn.execute(text("""
                        INSERT INTO mrt_exits (station_name, exit_name, exit_number, lat, lng)
                        VALUES (:station_name, :exit_name, :exit_number, :lat, :lng)
                    """), {
                        "station_name": station_name,
                        "exit_name": exit_name,
                        "exit_number": exit_number,
                        "lat": float(r.get("緯度", 0)),
                        "lng": float(r.get("經度", 0)),
                    })
                except Exception:
                    continue
            conn.commit()
        print(f"  捷運出口載入完成：{len(results)} 筆")
    except Exception as e:
        print(f"  捷運出口載入失敗: {e}")

def load_youbike(stations, snapshots):
    with engine.connect() as conn:
        for s in stations:
            conn.execute(text("""
                INSERT INTO youbike_stations
                    (station_id, station_name, area, lat, lng, total_spaces)
                VALUES (:station_id, :station_name, :area, :lat, :lng, :total_spaces)
                ON CONFLICT (station_id) DO UPDATE SET
                    total_spaces = EXCLUDED.total_spaces
            """), s)
        now = datetime.utcnow()
        for snap in snapshots:
            snap["recorded_at"] = now
            conn.execute(text("""
                INSERT INTO youbike_snapshots
                    (station_id, available_bikes, available_spaces, recorded_at)
                VALUES (:station_id, :available_bikes, :available_spaces, :recorded_at)
            """), snap)
        conn.commit()

def load_bus_stops(stops):
    with engine.connect() as conn:
        existing = conn.execute(text("SELECT COUNT(*) FROM bus_stops")).scalar()
        if existing > 0:
            return
        for s in stops:
            try:
                conn.execute(text("""
                    INSERT INTO bus_stops (stop_id, stop_name, lat, lng)
                    VALUES (:stop_id, :stop_name, :lat, :lng)
                    ON CONFLICT (stop_id) DO NOTHING
                """), {
                    "stop_id": int(s["Id"]),
                    "stop_name": s.get("nameZh", ""),
                    "lat": float(s.get("latitude", 0)),
                    "lng": float(s.get("longitude", 0)),
                })
            except Exception:
                continue
        conn.commit()

def load_bus_shapes(route_id_map):
    with engine.connect() as conn:
        existing = conn.execute(text("SELECT COUNT(*) FROM bus_shapes")).scalar()
        if existing > 0:
            return
    try:
        shapes = fetch_gz(BUS_SHAPE_API)
        route_name_by_id = {str(rid): name for rid, name in route_id_map.items()}
        with engine.connect() as conn:
            for shape in shapes:
                rid = str(shape.get("RouteID", ""))
                if rid not in route_name_by_id:
                    continue
                route_name = route_name_by_id[rid]
                go_back = str(shape.get("GoBack", "0"))
                wkt = shape.get("wkt", "")
                coords = parse_wkt_linestring(wkt)
                if not coords:
                    continue
                conn.execute(text("""
                    INSERT INTO bus_shapes (route_name, go_back, coordinates)
                    VALUES (:route_name, :go_back, :coordinates)
                    ON CONFLICT (route_name, go_back) DO UPDATE SET
                        coordinates = EXCLUDED.coordinates
                """), {
                    "route_name": route_name,
                    "go_back": go_back,
                    "coordinates": json.dumps(coords),
                })
            conn.commit()
        print("  路線軌跡載入完成")
    except Exception as e:
        print(f"  路線軌跡載入失敗: {e}")

def load_route_destinations(route_destinations):
    with engine.connect() as conn:
        for route_name, dests in route_destinations.items():
            for go_back, destination in dests.items():
                if not destination:
                    continue
                conn.execute(text("""
                    INSERT INTO route_destinations (route_name, go_back, destination)
                    VALUES (:route_name, :go_back, :destination)
                    ON CONFLICT (route_name, go_back) DO UPDATE SET
                        destination = EXCLUDED.destination
                """), {
                    "route_name": route_name,
                    "go_back": go_back,
                    "destination": destination,
                })
        conn.commit()

def load_bus(arrivals):
    with engine.connect() as conn:
        now = datetime.utcnow()
        for a in arrivals:
            a["recorded_at"] = now
            conn.execute(text("""
                INSERT INTO bus_arrivals
                    (route_id, stop_name, estimate_time, go_back, recorded_at)
                VALUES (:route_id, :stop_name, :estimate_time, :go_back, :recorded_at)
            """), a)
        conn.commit()

def cleanup_old_data():
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM youbike_snapshots WHERE recorded_at < NOW() - INTERVAL '7 days'"))
        conn.execute(text("DELETE FROM bus_arrivals WHERE recorded_at < NOW() - INTERVAL '2 days'"))
        conn.commit()

def run_etl():
    print(f"[{datetime.utcnow()}] ETL 開始...")
    try:
        raw_tp = extract_youbike_taipei()
        stations, snapshots = transform_youbike_taipei(raw_tp)
        load_youbike(stations, snapshots)
        print(f"  YouBike 台北: {len(snapshots)} 筆")
    except Exception as e:
        print(f"  YouBike 台北 ETL 失敗: {e}")
    try:
        raw_ntp = extract_youbike_ntpc()
        stations, snapshots = transform_youbike_ntpc(raw_ntp)
        load_youbike(stations, snapshots)
        print(f"  YouBike 新北: {len(snapshots)} 筆")
    except Exception as e:
        print(f"  YouBike 新北 ETL 失敗: {e}")
    try:
        estimates, stop_map, route_id_map, stops, route_destinations = extract_bus()
        load_bus_stops(stops)
        load_bus_shapes(route_id_map)
        load_route_destinations(route_destinations)
        arrivals = transform_bus(estimates, stop_map, route_id_map)
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

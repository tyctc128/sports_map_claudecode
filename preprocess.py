#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
資料預處理腳本：將 sports_20251201.csv 轉換為 GeoJSON
並修正異常經緯度（純 Python 版本，不依賴 pandas）
"""

import csv
import json
from collections import Counter

def fix_longitude(lon):
    """
    修正異常經度
    臺北市經度應在 121.x 範圍
    若 < 100 且 20 < lon < 30，視為少 100，做 lon += 100
    """
    try:
        lon = float(lon)
        if lon < 100 and 20 < lon < 30:
            return lon + 100
        return lon
    except (ValueError, TypeError):
        return None

def classify_venue_type(remark):
    """
    將備註欄位標準化為主要分類
    """
    if not remark:
        return "其他"

    remark = str(remark).strip()

    if "健身房" in remark:
        return "健身房"
    elif "瑜珈" in remark or "瑜伽" in remark:
        return "瑜珈教室"
    elif "游泳" in remark:
        # 細分游泳池類型
        if "室內外" in remark:
            return "室內外游泳池"
        elif "室外" in remark:
            return "室外游泳池"
        elif "室內" in remark:
            return "室內游泳池"
        else:
            return "游泳池"
    elif "撞球" in remark or "攀岩" in remark:
        return "撞球場及攀岩場"
    else:
        return remark

def get_icon_type(venue_type):
    """
    根據場館類型返回 icon 類型
    """
    icon_map = {
        "健身房": "dumbbell",
        "瑜珈教室": "yoga",
        "游泳池": "swimming",
        "室內游泳池": "swimming-indoor",
        "室外游泳池": "swimming-outdoor",
        "室內外游泳池": "swimming-both",
        "撞球場及攀岩場": "sports"
    }
    return icon_map.get(venue_type, "marker")

def clean_phone(value):
    """清理電話號碼（移除 .0 等）"""
    if not value or value in ['', 'nan', 'None']:
        return ""
    value = str(value)
    if value.endswith('.0'):
        value = value[:-2]
    return value

def convert_to_geojson(csv_file, output_file):
    """
    將 CSV 轉換為 GeoJSON 格式
    """
    features = []
    type_counter = Counter()
    district_counter = Counter()
    fixed_longitudes = []

    with open(csv_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)

        for row in reader:
            # 取得經緯度
            lon = fix_longitude(row.get('經度', ''))
            lat = row.get('緯度', '')

            # 跳過無效經緯度
            if lon is None or not lat:
                continue

            try:
                lat = float(lat)
            except (ValueError, TypeError):
                continue

            # 檢查是否修正了經度
            original_lon = float(row.get('經度', 0))
            if original_lon < 100 and lon > 100:
                fixed_longitudes.append({
                    'name': row.get('廠商名稱〈市招〉', ''),
                    'original': original_lon,
                    'fixed': lon
                })

            # 分類場館類型
            venue_type = classify_venue_type(row.get('備註', ''))
            icon = get_icon_type(venue_type)

            # 統計
            type_counter[venue_type] += 1
            district_counter[row.get('行政區', '')] += 1

            # 建立 feature
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [lon, lat]
                },
                "properties": {
                    "id": row.get('編號', ''),
                    "行政區": row.get('行政區', ''),
                    "名稱": row.get('廠商名稱〈市招〉', ''),
                    "所屬單位": row.get('所屬單位', ''),
                    "經營主體": row.get('經營主體', ''),
                    "市話": clean_phone(row.get('市話', '')),
                    "分機": clean_phone(row.get('分機', '')),
                    "行動電話": clean_phone(row.get('行動電話', '')),
                    "地址": row.get('地址', ''),
                    "場館類型": venue_type,
                    "原始備註": row.get('備註', ''),
                    "icon": icon
                }
            }
            features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "features": features
    }

    # 輸出 GeoJSON
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

    print(f"[OK] Successfully converted {len(features)} records")
    print(f"[OK] Saved to: {output_file}")

    # 顯示統計資訊
    print("\nVenue Type Statistics:")
    for venue_type, count in type_counter.most_common():
        print(f"  {venue_type}: {count}")

    print("\nDistrict Statistics (Top 5):")
    for district, count in district_counter.most_common(5):
        print(f"  {district}: {count}")

    # 檢查是否有修正的經度
    if fixed_longitudes:
        print(f"\n[WARNING] Fixed {len(fixed_longitudes)} abnormal longitude(s):")
        for item in fixed_longitudes:
            print(f"  {item['name']}: {item['original']} -> {item['fixed']}")

if __name__ == "__main__":
    convert_to_geojson("sports_20251201.csv", "sports_data.geojson")

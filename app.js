// 臺北市運動場館地圖應用

let map;
let markersLayer;
let allVenues = [];
let filteredVenues = [];
let userLocation = null;
let userMarker = null;
let currentRadius = 2; // 預設 2 公里
let venueMarkers = {}; // 儲存場館 ID 與 marker 的對應關係

// Icon 設定
const iconConfig = {
    'dumbbell': { icon: 'fa-dumbbell', className: 'marker-dumbbell' },
    'yoga': { icon: 'fa-spa', className: 'marker-yoga' },
    'swimming': { icon: 'fa-person-swimming', className: 'marker-swimming' },
    'swimming-indoor': { icon: 'fa-person-swimming', className: 'marker-swimming-indoor' },
    'swimming-outdoor': { icon: 'fa-person-swimming', className: 'marker-swimming-outdoor' },
    'swimming-both': { icon: 'fa-person-swimming', className: 'marker-swimming-both' },
    'sports': { icon: 'fa-baseball', className: 'marker-sports' }
};

// 初始化地圖
function initMap() {
    map = L.map('map').setView([25.0478, 121.5319], 12); // 臺北市中心

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    // 初始化 marker cluster 群組
    markersLayer = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true
    });

    map.addLayer(markersLayer);
}

// 創建自訂 marker icon
function createCustomIcon(iconType) {
    const config = iconConfig[iconType] || { icon: 'fa-map-marker', className: 'marker-default' };

    const html = `<div class="custom-marker ${config.className}">
        <i class="fas ${config.icon}"></i>
    </div>`;

    return L.divIcon({
        html: html,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    });
}

// 載入 GeoJSON 資料
async function loadData() {
    try {
        const response = await fetch('sports_data.geojson');
        const data = await response.json();

        allVenues = data.features.map(feature => ({
            ...feature.properties,
            coordinates: feature.geometry.coordinates
        }));

        filteredVenues = [...allVenues];
        updateMap();
        updateVenueList();

        // 隱藏載入中
        document.querySelector('.loading').classList.add('hidden');
    } catch (error) {
        console.error('載入資料失敗:', error);
        alert('載入資料失敗，請重新整理頁面');
    }
}

// 更新地圖上的 markers
function updateMap() {
    markersLayer.clearLayers();
    venueMarkers = {}; // 清空映射關係

    filteredVenues.forEach(venue => {
        const marker = L.marker(
            [venue.coordinates[1], venue.coordinates[0]],
            { icon: createCustomIcon(venue.icon) }
        );

        // 儲存 marker 與場館 ID 的對應關係
        venueMarkers[venue.id] = marker;

        // Hover tooltip
        const tooltipContent = `
            <div class="tooltip-name">${venue.名稱}</div>
            <div class="tooltip-type">${venue.場館類型}</div>
            <div class="tooltip-address">${venue.地址}</div>
        `;

        marker.bindTooltip(tooltipContent, {
            className: 'custom-tooltip',
            direction: 'top'
        });

        // Click 事件
        marker.on('click', () => {
            showVenueDetail(venue);
        });

        markersLayer.addLayer(marker);
    });
}

// 高亮特定 marker
function highlightMarker(venueId) {
    const marker = venueMarkers[venueId];
    if (!marker) {
        console.warn('找不到場館 marker:', venueId);
        return;
    }

    // 嘗試多次取得 marker 的 DOM 元素（因為群聚展開需要時間）
    let attempts = 0;
    const maxAttempts = 10;

    const tryHighlight = () => {
        const markerElement = marker.getElement();

        if (markerElement) {
            // 找到自訂 marker div
            const customMarker = markerElement.querySelector('.custom-marker');

            if (customMarker) {
                // 移除之前的高亮效果
                document.querySelectorAll('.custom-marker.highlight').forEach(el => {
                    el.classList.remove('highlight');
                });

                // 添加高亮動畫
                customMarker.classList.add('highlight');

                // 2 秒後移除高亮
                setTimeout(() => {
                    customMarker.classList.remove('highlight');
                }, 2000);

                return true; // 成功
            }
        }

        // 如果還沒找到且未達最大嘗試次數，繼續嘗試
        attempts++;
        if (attempts < maxAttempts) {
            setTimeout(tryHighlight, 100); // 每 100ms 重試一次
        } else {
            console.warn('無法高亮 marker（可能仍在群聚中）:', venueId);
        }

        return false;
    };

    tryHighlight();
}

// 顯示場館詳情
function showVenueDetail(venue) {
    const detailPanel = document.getElementById('detail-panel');
    const detailTitle = document.getElementById('detail-title');
    const detailType = document.getElementById('detail-type');
    const detailBody = document.getElementById('detail-body');

    detailTitle.textContent = venue.名稱;
    detailType.textContent = venue.場館類型;

    // 組合電話資訊
    let phoneInfo = '';
    if (venue.市話) phoneInfo += venue.市話;
    if (venue.分機) phoneInfo += ` 分機 ${venue.分機}`;
    if (venue.行動電話) phoneInfo += (phoneInfo ? ' / ' : '') + venue.行動電話;
    if (!phoneInfo) phoneInfo = '無';

    detailBody.innerHTML = `
        <div class="detail-item">
            <div class="detail-label">地址</div>
            <div class="detail-value">${venue.地址}</div>
            <div class="detail-action">
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.地址)}" target="_blank">
                    <i class="fas fa-directions"></i> 在 Google Maps 開啟
                </a>
            </div>
        </div>

        <div class="detail-item">
            <div class="detail-label">電話</div>
            <div class="detail-value">${phoneInfo}</div>
            ${phoneInfo !== '無' ? `<div class="detail-action">
                <a href="tel:${venue.市話 || venue.行動電話}">
                    <i class="fas fa-phone"></i> 撥打電話
                </a>
            </div>` : ''}
        </div>

        <div class="detail-item">
            <div class="detail-label">行政區</div>
            <div class="detail-value">${venue.行政區}</div>
        </div>

        <div class="detail-item">
            <div class="detail-label">所屬單位</div>
            <div class="detail-value">${venue.所屬單位 || '無'}</div>
        </div>

        <div class="detail-item">
            <div class="detail-label">經營主體</div>
            <div class="detail-value">${venue.經營主體 || '無'}</div>
        </div>
    `;

    detailPanel.classList.add('show');

    // 先放大地圖到足夠層級以展開群聚，然後移到該點
    // 使用 flyTo 而非 setView 以產生平滑動畫
    map.flyTo([venue.coordinates[1], venue.coordinates[0]], 18, {
        duration: 0.8 // 動畫持續 0.8 秒
    });

    // 等待地圖移動和群聚展開後再高亮顯示 marker
    setTimeout(() => {
        highlightMarker(venue.id);
    }, 900); // 稍微延遲以確保群聚已展開
}

// 更新右側場館列表
function updateVenueList(sortByDistance = false) {
    const venueList = document.getElementById('venue-list');
    const resultsCount = document.getElementById('results-count');

    let venues = [...filteredVenues];

    // 如果需要按距離排序
    if (sortByDistance && userLocation) {
        venues = venues.map(venue => ({
            ...venue,
            distance: calculateDistance(
                userLocation.lat,
                userLocation.lng,
                venue.coordinates[1],
                venue.coordinates[0]
            )
        })).sort((a, b) => a.distance - b.distance);
    }

    resultsCount.textContent = `共 ${venues.length} 個場館`;

    if (venues.length === 0) {
        venueList.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">沒有符合條件的場館</div>';
        return;
    }

    venueList.innerHTML = venues.map(venue => `
        <div class="venue-item" data-id="${venue.id}">
            <div class="venue-name">${venue.名稱}</div>
            <div class="venue-type">${venue.場館類型}</div>
            <div class="venue-address">${venue.地址}</div>
            ${venue.distance !== undefined ? `<div class="venue-distance">${venue.distance.toFixed(2)} 公里</div>` : ''}
        </div>
    `).join('');

    // 綁定點擊事件
    document.querySelectorAll('.venue-item').forEach(item => {
        item.addEventListener('click', () => {
            const venueId = item.getAttribute('data-id');
            const venue = allVenues.find(v => v.id == venueId);
            if (venue) {
                showVenueDetail(venue);

                // 標記選中
                document.querySelectorAll('.venue-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
            }
        });
    });
}

// 篩選功能
function applyFilters() {
    const checkedTypes = Array.from(document.querySelectorAll('.venue-filter:checked'))
        .map(checkbox => checkbox.getAttribute('data-type'));

    if (checkedTypes.length === 0) {
        filteredVenues = [];
    } else {
        filteredVenues = allVenues.filter(venue => {
            // 處理游泳池的多種類型
            if (checkedTypes.includes('游泳池')) {
                return checkedTypes.includes(venue.場館類型) ||
                    venue.場館類型.includes('游泳池');
            }
            return checkedTypes.includes(venue.場館類型);
        });
    }

    // 如果有使用者位置且設定了半徑，進一步篩選
    if (userLocation && document.getElementById('radius-section').style.display !== 'none') {
        filteredVenues = filteredVenues.filter(venue => {
            const distance = calculateDistance(
                userLocation.lat,
                userLocation.lng,
                venue.coordinates[1],
                venue.coordinates[0]
            );
            return distance <= currentRadius;
        });
    }

    updateMap();
    updateVenueList(userLocation !== null);
}

// 搜尋功能
let searchTimeout;
document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim().toLowerCase();

    if (query.length === 0) {
        document.getElementById('search-results').classList.remove('show');
        return;
    }

    searchTimeout = setTimeout(() => {
        const results = allVenues.filter(venue =>
            venue.名稱.toLowerCase().includes(query) ||
            venue.地址.toLowerCase().includes(query) ||
            venue.行政區.toLowerCase().includes(query)
        ).slice(0, 10);

        const searchResults = document.getElementById('search-results');

        if (results.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item">找不到符合的場館</div>';
        } else {
            searchResults.innerHTML = results.map(venue => `
                <div class="search-result-item" data-id="${venue.id}">
                    <div style="font-weight: 600;">${venue.名稱}</div>
                    <div style="font-size: 12px; color: #666;">${venue.場館類型} - ${venue.地址}</div>
                </div>
            `).join('');

            // 綁定點擊事件
            searchResults.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const venueId = item.getAttribute('data-id');
                    const venue = allVenues.find(v => v.id == venueId);
                    if (venue) {
                        showVenueDetail(venue);
                        searchResults.classList.remove('show');
                        document.getElementById('search-input').value = '';
                    }
                });
            });
        }

        searchResults.classList.add('show');
    }, 300);
});

// 點擊外部關閉搜尋結果
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-input-container')) {
        document.getElementById('search-results').classList.remove('show');
    }
});

// 定位功能（共用函數）
function locateUser(buttonElement = null, isMapButton = false) {
    if (!navigator.geolocation) {
        alert('您的瀏覽器不支援定位功能');
        return;
    }

    // 更新按鈕狀態
    if (buttonElement) {
        if (isMapButton) {
            buttonElement.classList.add('locating');
            buttonElement.querySelector('i').className = 'fas fa-spinner fa-spin';
        } else {
            buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 定位中...';
        }
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            // 移除舊的使用者標記
            if (userMarker) {
                map.removeLayer(userMarker);
            }

            // 新增使用者位置標記
            userMarker = L.marker([userLocation.lat, userLocation.lng], {
                icon: L.divIcon({
                    html: '<div class="custom-marker" style="background: #F44336;"><i class="fas fa-user"></i></div>',
                    className: '',
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                })
            }).addTo(map);

            userMarker.bindTooltip('你在這裡', { permanent: false });

            // 移動地圖到使用者位置
            map.setView([userLocation.lat, userLocation.lng], 14);

            // 顯示半徑篩選
            document.getElementById('radius-section').style.display = 'block';

            // 重新篩選並按距離排序
            applyFilters();

            // 恢復按鈕狀態
            if (buttonElement) {
                if (isMapButton) {
                    buttonElement.classList.remove('locating');
                    buttonElement.classList.add('located');
                    buttonElement.querySelector('i').className = 'fas fa-location-crosshairs';
                    setTimeout(() => {
                        buttonElement.classList.remove('located');
                    }, 2000);
                } else {
                    buttonElement.innerHTML = '<i class="fas fa-location-arrow"></i> 定位我';
                }
            }
        },
        (error) => {
            console.error('定位失敗:', error);
            alert('定位失敗，請檢查定位權限或使用「臺北車站」快速定位');

            // 恢復按鈕狀態
            if (buttonElement) {
                if (isMapButton) {
                    buttonElement.classList.remove('locating');
                    buttonElement.querySelector('i').className = 'fas fa-location-crosshairs';
                } else {
                    buttonElement.innerHTML = '<i class="fas fa-location-arrow"></i> 定位我';
                }
            }
        }
    );
}

// 左側面板定位按鈕
document.getElementById('locate-btn').addEventListener('click', (e) => {
    locateUser(e.currentTarget, false);
});

// 地圖浮動定位按鈕
document.getElementById('map-locate-btn').addEventListener('click', (e) => {
    locateUser(e.currentTarget, true);
});

// 臺北車站快速定位
document.getElementById('taipei-station-btn').addEventListener('click', () => {
    userLocation = {
        lat: 25.0478,
        lng: 121.5170
    };

    if (userMarker) {
        map.removeLayer(userMarker);
    }

    userMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
            html: '<div class="custom-marker" style="background: #F44336;"><i class="fas fa-train"></i></div>',
            className: '',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        })
    }).addTo(map);

    userMarker.bindTooltip('臺北車站', { permanent: false });

    map.setView([userLocation.lat, userLocation.lng], 14);

    document.getElementById('radius-section').style.display = 'block';

    applyFilters();
});

// 半徑滑桿
document.getElementById('radius-slider').addEventListener('input', (e) => {
    currentRadius = parseFloat(e.target.value);
    document.getElementById('radius-value').textContent = currentRadius;
    applyFilters();
});

// 篩選器事件
document.querySelectorAll('.venue-filter').forEach(checkbox => {
    checkbox.addEventListener('change', applyFilters);
});

// 全選功能
document.getElementById('filter-all').addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.querySelectorAll('.venue-filter').forEach(checkbox => {
        checkbox.checked = checked;
    });
    applyFilters();
});

// 監聽子篩選器變化，更新全選狀態
document.querySelectorAll('.venue-filter').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        const allChecked = Array.from(document.querySelectorAll('.venue-filter'))
            .every(cb => cb.checked);
        document.getElementById('filter-all').checked = allChecked;
    });
});

// 切換右側邊欄
document.getElementById('toggle-sidebar').addEventListener('click', () => {
    const sidebar = document.querySelector('.sidebar-right');
    sidebar.classList.toggle('collapsed');

    const icon = document.querySelector('#toggle-sidebar i');
    if (sidebar.classList.contains('collapsed')) {
        icon.className = 'fas fa-chevron-left';
    } else {
        icon.className = 'fas fa-chevron-right';
    }
});

// 關閉詳情面板
document.getElementById('detail-close').addEventListener('click', () => {
    document.getElementById('detail-panel').classList.remove('show');
    document.querySelectorAll('.venue-item').forEach(i => i.classList.remove('selected'));
});

// 計算兩點間距離（Haversine 公式）
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 地球半徑（公里）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 初始化應用
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadData();
});

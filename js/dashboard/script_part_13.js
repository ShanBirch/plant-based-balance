// ===== WEATHER BACKGROUND DATA COLLECTION =====
    // Fetches today's weather via Open-Meteo (no API key) and stores in weather_logs for analytics.
    // No UI card — data is used for correlating mood, sleep, workouts, and energy with weather.
    (function() {
        const WMO_LABELS = {
            0:'Clear sky', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
            45:'Fog', 48:'Icy fog', 51:'Light drizzle', 53:'Drizzle', 55:'Heavy drizzle',
            61:'Light rain', 63:'Rain', 65:'Heavy rain', 71:'Light snow', 73:'Snow',
            75:'Heavy snow', 77:'Snow grains', 80:'Light showers', 81:'Showers',
            82:'Heavy showers', 85:'Snow showers', 86:'Heavy snow showers',
            95:'Thunderstorm', 96:'Thunderstorm+hail', 99:'Thunderstorm+heavy hail',
        };

        async function fetchAndStoreWeather() {
            if (!window.currentUser) return;
            if (sessionStorage.getItem('weather_fetched')) return;
            if (!navigator.geolocation) return;

            navigator.geolocation.getCurrentPosition(async (pos) => {
                try {
                    const { latitude: lat, longitude: lon } = pos.coords;
                    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
                        `&current=temperature_2m,apparent_temperature,weather_code,is_day,` +
                        `relative_humidity_2m,precipitation,wind_speed_10m,uv_index` +
                        `&timezone=auto&forecast_days=1`;

                    const res  = await fetch(url);
                    if (!res.ok) return;
                    const data = await res.json();
                    const c    = data.current;
                    const tz   = data.timezone || null;
                    const today = getLocalDateString();
                    const code  = c.weather_code ?? null;

                    const row = {
                        user_id:          window.currentUser.id,
                        log_date:         today,
                        temp_c:           c.temperature_2m           ?? null,
                        feels_like_c:     c.apparent_temperature      ?? null,
                        weather_code:     code,
                        condition:        WMO_LABELS[code] || null,
                        is_day:           c.is_day === 1,
                        humidity_pct:     Math.round(c.relative_humidity_2m) || null,
                        precipitation_mm: c.precipitation             ?? null,
                        wind_speed_kmh:   c.wind_speed_10m            ?? null,
                        uv_index:         c.uv_index                  ?? null,
                        latitude:         parseFloat(lat.toFixed(6)),
                        longitude:        parseFloat(lon.toFixed(6)),
                        timezone:         tz,
                        fetched_at:       new Date().toISOString(),
                    };

                    sessionStorage.setItem('weather_fetched', '1');
                    await supabaseClient.from('weather_logs').upsert(row, { onConflict: 'user_id,log_date' });
                } catch (err) {
                    console.warn('Weather fetch error:', err);
                }
            }, () => {}, { timeout: 8000, maximumAge: 3600000 });
        }

        // Allow permissions modal to re-trigger weather fetch after location is granted
        window.requestWeatherLocation = function() {
            sessionStorage.removeItem('weather_fetched');
            fetchAndStoreWeather();
        };

        // Delay to allow currentUser to be set after auth.
        // On native apps with first-time permissions pending, skip the automatic
        // weather fetch — it would trigger a standalone OS location dialog that
        // races with the grouped permissions modal. The modal's close handler
        // calls requestWeatherLocation() after the user grants location there.
        setTimeout(function() {
            if (typeof isNativeApp === 'function' && isNativeApp() &&
                !localStorage.getItem('native_permissions_requested')) {
                return;
            }
            fetchAndStoreWeather();
        }, 3000);
    })();
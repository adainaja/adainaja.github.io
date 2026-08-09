/*
  AdaAja Complete Account — Current Location Add-on
  --------------------------------------------------
  Load AFTER complete-account.js.

  Uses:
  - Browser Geolocation API for latitude/longitude
  - Nominatim/OpenStreetMap reverse geocoding for a human-readable address
  - Existing EMSIFA region API from complete-account.js to resolve official
    region objects/IDs used by the current selected{} state.

  This add-on does not replace manual address selection.
*/

(() => {
  "use strict";

  const GPS_BUTTON_ID = "useCurrentLocationButton";
  const GPS_STATUS_ID = "gpsLocationStatus";
  const ATTRIBUTION_ID = "gpsLocationAttribution";

  const provinceEl = document.getElementById("province");
  const cityEl = document.getElementById("city");
  const districtEl = document.getElementById("district");
  const villageEl = document.getElementById("village");
  const postalCodeInput = document.getElementById("postalCodeInput");

  if (
    !provinceEl ||
    !cityEl ||
    !districtEl ||
    !villageEl ||
    !window.navigator.geolocation
  ) {
    console.warn("AdaAja GPS: complete-account structure/geolocation unavailable.");
  }

  function injectStyles() {
    if (document.getElementById("adaajaGpsStyles")) return;

    const style = document.createElement("style");
    style.id = "adaajaGpsStyles";
    style.textContent = `
      .gps-location-card{
        margin-top:16px;
        padding:13px;
        border:1px solid rgba(255,122,0,.12);
        border-radius:18px;
        background:
          radial-gradient(circle at 100% 0,rgba(255,122,0,.08),transparent 115px),
          linear-gradient(180deg,#fff,#fffdfa);
      }

      .gps-location-button{
        display:grid;
        grid-template-columns:42px minmax(0,1fr) 18px;
        gap:11px;
        align-items:center;
        width:100%;
        min-height:62px;
        padding:0;
        border:0;
        background:transparent;
        color:#092544;
        text-align:left;
      }

      .gps-location-icon{
        display:grid;
        width:42px;
        height:42px;
        place-items:center;
        border-radius:14px;
        background:#fff2e8;
        color:#ff7a00;
        box-shadow:0 8px 18px rgba(255,122,0,.10);
      }

      .gps-location-icon svg,
      .gps-location-arrow{
        width:18px;
        height:18px;
        fill:none;
        stroke:currentColor;
        stroke-width:1.8;
        stroke-linecap:round;
        stroke-linejoin:round;
      }

      .gps-location-copy{
        min-width:0;
      }

      .gps-location-copy strong{
        display:block;
        color:#092544;
        font-size:9px;
        font-weight:800;
      }

      .gps-location-copy small{
        display:block;
        margin-top:4px;
        color:#778394;
        font-size:6.4px;
        line-height:1.45;
      }

      .gps-location-arrow{
        color:#a1aab6;
      }

      .gps-location-button:disabled{
        cursor:wait;
        opacity:.72;
      }

      .gps-location-button.loading .gps-location-icon svg{
        animation:adaajaGpsSpin .8s linear infinite;
      }

      @keyframes adaajaGpsSpin{
        to{transform:rotate(360deg)}
      }

      .gps-location-status{
        display:none;
        margin-top:9px;
        padding-top:9px;
        border-top:1px solid #f0f2f5;
        font-size:6.4px;
        line-height:1.5;
      }

      .gps-location-status.show{display:block}
      .gps-location-status.success{color:#16834b}
      .gps-location-status.error{color:#d92d20}
      .gps-location-status.info{color:#5f6d7d}

      .gps-location-attribution{
        display:block;
        margin-top:7px;
        color:#9aa4b1;
        font-size:5.3px;
        text-decoration:none;
      }
    `;
    document.head.appendChild(style);
  }

  function injectUI() {
    if (document.getElementById(GPS_BUTTON_ID)) return;

    const locationFields = document.querySelector(".address-card .location-fields");
    if (!locationFields) {
      console.warn("AdaAja GPS: .location-fields not found.");
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "gps-location-card";
    wrapper.innerHTML = `
      <button class="gps-location-button" id="${GPS_BUTTON_ID}" type="button">
        <span class="gps-location-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2v3"></path>
            <path d="M12 19v3"></path>
            <path d="M2 12h3"></path>
            <path d="M19 12h3"></path>
            <circle cx="12" cy="12" r="6"></circle>
            <circle cx="12" cy="12" r="2"></circle>
          </svg>
        </span>

        <span class="gps-location-copy">
          <strong>Gunakan lokasi saat ini</strong>
          <small>Isi wilayah dan alamat berdasarkan lokasi perangkat</small>
        </span>

        <svg class="gps-location-arrow" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 18 6-6-6-6"></path>
        </svg>
      </button>

      <div class="gps-location-status" id="${GPS_STATUS_ID}"></div>
      <a
        class="gps-location-attribution"
        id="${ATTRIBUTION_ID}"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
      >Data lokasi © OpenStreetMap contributors</a>
    `;

    locationFields.parentNode.insertBefore(wrapper, locationFields);

    document
      .getElementById(GPS_BUTTON_ID)
      .addEventListener("click", useCurrentLocation);
  }

  function setGpsStatus(text = "", type = "info") {
    const status = document.getElementById(GPS_STATUS_ID);
    if (!status) return;

    status.textContent = text;
    status.className =
      `gps-location-status ${text ? "show" : ""} ${type}`.trim();
  }

  function setGpsLoading(loading) {
    const button = document.getElementById(GPS_BUTTON_ID);
    if (!button) return;

    button.disabled = loading;
    button.classList.toggle("loading", loading);

    const strong = button.querySelector(".gps-location-copy strong");
    const small = button.querySelector(".gps-location-copy small");

    if (strong) {
      strong.textContent = loading
        ? "Mendeteksi lokasi..."
        : "Gunakan lokasi saat ini";
    }

    if (small) {
      small.textContent = loading
        ? "Mohon tunggu, jangan tutup halaman"
        : "Isi wilayah dan alamat berdasarkan lokasi perangkat";
    }
  }

  function normalizeRegionName(value = "") {
    return String(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\b(provinsi|province|kota|kabupaten|kab\.?|kec\.?|kecamatan|kelurahan|desa|city|regency|district|subdistrict)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function scoreRegion(candidateName, targetName) {
    const a = normalizeRegionName(candidateName);
    const b = normalizeRegionName(targetName);

    if (!a || !b) return 0;
    if (a === b) return 100;
    if (a.includes(b) || b.includes(a)) return 80;

    const aa = new Set(a.split(" "));
    const bb = new Set(b.split(" "));
    const overlap = [...aa].filter((part) => bb.has(part)).length;

    return overlap * 15;
  }

  function findBestRegion(items, candidates) {
    let best = null;
    let bestScore = 0;

    for (const item of items || []) {
      for (const candidate of candidates.filter(Boolean)) {
        const score = scoreRegion(item.name, candidate);
        if (score > bestScore) {
          best = item;
          bestScore = score;
        }
      }
    }

    return bestScore >= 30 ? best : null;
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) {
      throw new Error("Layanan lokasi belum dapat dihubungi.");
    }

    return response.json();
  }

  async function reverseGeocode(latitude, longitude) {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("zoom", "18");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "id");

    return fetchJson(url.toString());
  }

  function reverseCandidates(address) {
    return {
      province: [
        address.state,
        address.region
      ],
      city: [
        address.city,
        address.town,
        address.municipality,
        address.county,
        address.city_district
      ],
      district: [
        address.city_district,
        address.district,
        address.suburb,
        address.borough
      ],
      village: [
        address.village,
        address.quarter,
        address.neighbourhood,
        address.hamlet,
        address.suburb
      ]
    };
  }

  async function resolveOfficialRegions(reverseAddress) {
    if (typeof REGION_API === "undefined") {
      throw new Error("Konfigurasi wilayah belum tersedia.");
    }

    const candidates = reverseCandidates(reverseAddress);

    const provinces =
      await fetchJson(`${REGION_API}provinces.json`);

    const province =
      findBestRegion(provinces, candidates.province);

    if (!province) {
      throw new Error("Provinsi dari lokasi GPS belum dapat dicocokkan.");
    }

    const cities =
      await fetchJson(`${REGION_API}regencies/${province.id}.json`);

    const city =
      findBestRegion(cities, candidates.city);

    if (!city) {
      return { province };
    }

    const districts =
      await fetchJson(`${REGION_API}districts/${city.id}.json`);

    const district =
      findBestRegion(districts, candidates.district);

    if (!district) {
      return { province, city };
    }

    const villages =
      await fetchJson(`${REGION_API}villages/${district.id}.json`);

    const village =
      findBestRegion(villages, candidates.village);

    return {
      province,
      city,
      district,
      village: village || null
    };
  }

  function buildDetailedAddress(reverseData) {
    const a = reverseData?.address || {};

    const parts = [
      a.road,
      a.pedestrian,
      a.residential,
      a.house_number ? `No. ${a.house_number}` : "",
      a.building,
      a.neighbourhood
    ].filter(Boolean);

    const unique = [...new Set(parts)];

    if (unique.length) return unique.join(", ");

    const display = String(reverseData?.display_name || "");
    if (!display) return "";

    return display
      .split(",")
      .slice(0, 3)
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ");
  }

  function applyOfficialRegions(regions) {
    if (regions.province) {
      selected.province = regions.province;
      provinceEl.textContent = formatLocation(regions.province.name);
    }

    if (regions.city) {
      selected.city = regions.city;
      cityEl.textContent = formatLocation(regions.city.name);
    } else {
      delete selected.city;
      cityEl.textContent = "Pilih kota";
    }

    if (regions.district) {
      selected.district = regions.district;
      districtEl.textContent = formatLocation(regions.district.name);
    } else {
      delete selected.district;
      districtEl.textContent = "Pilih kecamatan";
    }

    if (regions.village) {
      selected.village = regions.village;
      villageEl.textContent = formatLocation(regions.village.name);
    } else {
      delete selected.village;
      villageEl.textContent = "Pilih kelurahan";
    }
  }

  function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000
        }
      );
    });
  }

  function geolocationErrorMessage(error) {
    if (!error) return "Lokasi perangkat belum dapat dideteksi.";

    if (error.code === 1) {
      return "Izin lokasi ditolak. Aktifkan izin lokasi browser lalu coba kembali.";
    }

    if (error.code === 2) {
      return "Lokasi perangkat belum tersedia. Pastikan GPS/lokasi perangkat aktif.";
    }

    if (error.code === 3) {
      return "Pencarian lokasi terlalu lama. Silakan coba kembali.";
    }

    return error.message || "Lokasi perangkat belum dapat dideteksi.";
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      setGpsStatus(
        "Perangkat/browser ini belum mendukung pendeteksian lokasi.",
        "error"
      );
      return;
    }

    setGpsLoading(true);
    setGpsStatus(
      "Meminta izin lokasi perangkat...",
      "info"
    );

    try {
      const position = await getCurrentPosition();

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      setGpsStatus(
        "Lokasi ditemukan. Menyesuaikan alamat...",
        "info"
      );

      const reverseData =
        await reverseGeocode(latitude, longitude);

      const officialRegions =
        await resolveOfficialRegions(reverseData.address || {});

      applyOfficialRegions(officialRegions);

      const detailedAddress =
        buildDetailedAddress(reverseData);

      if (detailedAddress && typeof addressInput !== "undefined") {
        addressInput.value = detailedAddress;

        const counter =
          document.getElementById("addressCounter");

        if (counter) {
          counter.textContent =
            `${addressInput.value.length}/200`;
        }
      }

      const postcode =
        String(reverseData?.address?.postcode || "")
          .replace(/[^\d]/g, "")
          .slice(0, 10);

      if (postcode && postalCodeInput) {
        postalCodeInput.value = postcode;
      }

      // Keep coordinates available for future database expansion without
      // changing the current complete-profile backend contract.
      sessionStorage.setItem(
        "adaaja_detected_location",
        JSON.stringify({
          latitude,
          longitude,
          accuracy: position.coords.accuracy || null,
          detected_at: new Date().toISOString()
        })
      );

      const complete =
        officialRegions.province &&
        officialRegions.city &&
        officialRegions.district &&
        officialRegions.village;

      if (complete) {
        setGpsStatus(
          "Lokasi berhasil diisi. Periksa alamat detail dan nomor rumah sebelum menyimpan.",
          "success"
        );

        if (typeof setMessage === "function") {
          setMessage(
            "Lokasi berhasil dideteksi. Mohon periksa kembali detail alamat.",
            "success"
          );
        }
      } else {
        setGpsStatus(
          "Lokasi ditemukan, tetapi sebagian wilayah belum dapat dicocokkan otomatis. Lengkapi bagian yang masih kosong secara manual.",
          "info"
        );
      }
    } catch (error) {
      console.error("AdaAja current location error:", error);

      const text =
        typeof error?.code === "number"
          ? geolocationErrorMessage(error)
          : error?.message || "Alamat dari lokasi saat ini belum dapat ditemukan.";

      setGpsStatus(text, "error");

      if (typeof setMessage === "function") {
        setMessage(text, "error");
      }
    } finally {
      setGpsLoading(false);
    }
  }

  injectStyles();
  injectUI();
})();

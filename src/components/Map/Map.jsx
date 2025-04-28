import React, { useEffect, useState } from "react";
import Map, { Source, Layer, Popup } from "react-map-gl";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./MapComponent.css";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import MapGeocoder from "./MapGeocoder";

const adjustCoordinatesToIndia = (geojsonData) => {
  const withinBounds = (lon, lat) => {
    const newLon = lon < 68 ? 68 : lon > 98 ? 98 : lon;
    const newLat = lat < 8 ? 8 : lat > 37 ? 37 : lat;
    return [newLon, newLat];
  };

  const adjustedFeatures = geojsonData.features.map((feature) => {
    const [lon, lat] = feature.geometry.coordinates;
    const [newLon, newLat] = withinBounds(lon, lat);
    return {
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: [newLon, newLat],
      },
    };
  });

  return {
    ...geojsonData,
    features: adjustedFeatures,
  };
};

const formatArea = (area) => {
  return `${Number(area).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Ha`;
};

const formatCoordinates = (lng, lat) => {
  return `${lng.toFixed(2)}, ${lat.toFixed(2)}`;
};

const clusterLayer = {
  id: "clusters",
  type: "circle",
  source: "ponds",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": [
      "step",
      ["get", "point_count"],
      "#51bbd6",
      100,
      "#f1f075",
      750,
      "#f28cb1",
    ],
    "circle-radius": ["step", ["get", "point_count"], 20, 100, 30, 750, 40],
  },
};

const clusterCountLayer = {
  id: "cluster-count",
  type: "symbol",
  source: "ponds",
  filter: ["has", "point_count"],
  layout: {
    "text-field": "{point_count_abbreviated}",
    "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
    "text-size": 12,
  },
};

const unclusteredPointLayer = {
  id: "unclustered-point",
  type: "circle",
  source: "ponds",
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-color": "#11b4da",
    "circle-radius": 5,
    "circle-stroke-width": 1,
    "circle-stroke-color": "#fff",
  },
};

const subdistrictsLayer = {
  id: "subdistricts",
  type: "fill",
  source: "subdistricts",
  paint: {
    "fill-color": "#888888",
    "fill-opacity": 0.1,
  },
};

const subdistrictsLineLayer = {
  id: "subdistricts-line",
  type: "line",
  source: "subdistricts",
  paint: {
    "line-color": "#000000",
    "line-width": 2,
  },
};

const MapComponent = () => {
  const [geojsonData, setGeojsonData] = useState(null);
  const [subdistrictsData, setSubdistrictsData] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [popupInfo, setPopupInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const promises = [
      fetch("/west_bengal_subdistricts.geojson"),
      fetch("/west_bengal_ponds.geojson"),
    ];

    Promise.all(promises).then(async (result) => {
      const subdistricts = result[0];
      const godrej_data_final = result[1];
      if (!subdistricts.ok) {
        throw new Error(
          `Failed to fetch subdistricts GeoJSON data: ${subdistricts.statusText}`
        );
      }
      if (!godrej_data_final.ok) {
        throw new Error(
          `Failed to fetch GeoJSON data: ${godrej_data_final.statusText}`
        );
      }
      const subdistricts_data = await subdistricts.json();
      setSubdistrictsData(subdistricts_data);

      let godrej_data_final_data = await godrej_data_final.json();
      godrej_data_final_data = adjustCoordinatesToIndia(godrej_data_final_data);
      setGeojsonData(godrej_data_final_data);

      setIsLoading(false);
    });
  }, []);

  const handleMouseEnter = (event) => {
    const feature = event.features[0];
    const [longitude, latitude] = feature.geometry.coordinates;

    if (feature.layer.id === "clusters") {
      setHoverInfo({
        longitude,
        latitude,
        area: formatArea(feature.properties.sum_area) || "N/A",
        isCluster: true,
      });
    } else {
      setHoverInfo({
        longitude,
        latitude,
        state: feature.properties.STATE || "N/A",
        subdistrict: feature.properties.SUBDISTRICT || "N/A",
        district: feature.properties.DISTRICT || "N/A",
        village: feature.properties.VILLAGE || "N/A",
        coordinates: formatCoordinates(longitude, latitude),
        area: formatArea(feature.properties.area) || "N/A",
        isCluster: false,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoverInfo(null);
  };

  const handleClick = (event) => {
    const features = event.features;
    if (!features.length) {
      return;
    }

    const feature = features[0];
    const [longitude, latitude] = feature.geometry.coordinates;

    const clusterId = feature.properties.cluster_id;
    const mapSource = event.target.getSource("ponds");

    if (clusterId) {
      mapSource.getClusterExpansionZoom(clusterId).then((zoom) => {
        event.target.easeTo({
          center: feature.geometry.coordinates,
          zoom,
        });
      });
    } else {
      setPopupInfo({
        longitude,
        latitude,
        state: feature.properties.STATE || "N/A",
        subdistrict: feature.properties.SUBDISTRICT || "N/A",
        district: feature.properties.DISTRICT || "N/A",
        village: feature.properties.VILLAGE || "N/A",
        coordinates: formatCoordinates(longitude, latitude),
        area: formatArea(feature.properties.area) || "N/A",
      });
    }
  };

  const handleGoogleMapsRedirect = (longitude, latitude) => {
    window.open(
      `https://www.google.com/maps?q=${latitude},${longitude}`,
      "_blank"
    );
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {isLoading && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(255, 255, 255, 0.7)",
            zIndex: 1000,
          }}
        >
          <CircularProgress />
        </Box>
      )}
      {!isLoading && (
        <Map
          initialViewState={{
            longitude: 78.9629,
            latitude: 20.5937,
            zoom: 4,
          }}
          style={{ width: "100%", height: "100%" }}
          mapStyle={`https://api.maptiler.com/maps/streets/style.json?key=${
            import.meta.env.VITE_MAPTILER_KEY
          }`}
          mapLib={maplibregl}
          interactiveLayerIds={["clusters", "unclustered-point"]}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        >
          {subdistrictsData && (
            <Source id="subdistricts" type="geojson" data={subdistrictsData}>
              <Layer {...subdistrictsLayer} />
              <Layer {...subdistrictsLineLayer} />
            </Source>
          )}

          {geojsonData && (
            <Source
              id="ponds"
              type="geojson"
              data={geojsonData}
              cluster={true}
              clusterMaxZoom={14}
              clusterRadius={50}
              clusterProperties={{
                sum_area: ["+", ["get", "area"]],
              }}
            >
              <Layer {...clusterLayer} />
              <Layer {...clusterCountLayer} />
              <Layer {...unclusteredPointLayer} />
            </Source>
          )}

          <MapGeocoder />

          {hoverInfo && (
            <Popup
              longitude={hoverInfo.longitude}
              latitude={hoverInfo.latitude}
              closeButton={false}
              closeOnClick={false}
              anchor="top"
            >
              <div>
                {hoverInfo.isCluster ? (
                  <p>Area: {hoverInfo.area}</p>
                ) : (
                  <div>
                    <p>State: {hoverInfo.state}</p>
                    <p>Subdistrict: {hoverInfo.subdistrict}</p>
                    <p>District: {hoverInfo.district}</p>
                    <p>Village: {hoverInfo.village}</p>
                    <p>Coordinates: {hoverInfo.coordinates}</p>
                    <p>Area: {hoverInfo.area}</p>
                    <button
                      className="redirect-button"
                      onClick={() =>
                        handleGoogleMapsRedirect(
                          hoverInfo.longitude,
                          hoverInfo.latitude
                        )
                      }
                    >
                      Open in Google Maps
                    </button>
                  </div>
                )}
              </div>
            </Popup>
          )}

          {popupInfo && (
            <Popup
              longitude={popupInfo.longitude}
              latitude={popupInfo.latitude}
              closeButton={true}
              closeOnClick={true}
              anchor="top"
              onClose={() => setPopupInfo(null)}
            >
              <div>
                <p>State: {popupInfo.state}</p>
                <p>Subdistrict: {popupInfo.subdistrict}</p>
                <p>District: {popupInfo.district}</p>
                <p>Village: {popupInfo.village}</p>
                <p>Coordinates: {popupInfo.coordinates}</p>
                <p>Area: {popupInfo.area}</p>
                <button
                  className="redirect-button"
                  onClick={() =>
                    handleGoogleMapsRedirect(
                      popupInfo.longitude,
                      popupInfo.latitude
                    )
                  }
                >
                  Open in Google Maps
                </button>
              </div>
            </Popup>
          )}
        </Map>
      )}
    </div>
  );
};

export default MapComponent;

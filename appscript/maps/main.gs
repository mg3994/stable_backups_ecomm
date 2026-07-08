/**
 * MAPS Project
 * Handles Geocoding, Routing metrics, and Place suggestions.
 */

function doPost(e) {
  var payload;
  try {
    payload = parseRequestPayload(e);
  } catch (err) {
    return jsonError(err.toString());
  }

  var action = payload.action;
  var params = payload.params || {};

  switch (action) {
    case 'getPlaceSuggestions':
      return jsonSuccess({ suggestions: getPlaceSuggestions(params.inputToken) });
    case 'processLocationAndMetrics':
      return handleLocationAndMetrics(params);
    case 'processPinDropMetrics':
      return handlePinDropMetrics(params);
    default:
      return jsonError("Unknown action: " + action);
  }
}

function getPlaceSuggestions(inputToken) {
  if (!inputToken || inputToken.length < 3) return [];
  try {
    const response = Maps.newGeocoder().geocode(inputToken);
    return response.results ? response.results.map(r => r.formatted_address) : [];
  } catch (e) {
    return [];
  }
}

function handleLocationAndMetrics(params) {
  try {
    const geocode = Maps.newGeocoder().geocode(params.destinationQuery);
    if (!geocode.results || geocode.results.length === 0) throw new Error("Unresolved address");

    const result = geocode.results[0];
    return calculateMatrixMetrics(params.originLat, params.originLng, result.geometry.location.lat, result.geometry.location.lng, result.formatted_address);
  } catch (e) {
    return jsonError(e.toString());
  }
}

function handlePinDropMetrics(params) {
  try {
    const response = Maps.newGeocoder().reverseGeocode(params.pinLat, params.pinLng);
    let address = `Pinned Location (${params.pinLat.toFixed(4)}, ${params.pinLng.toFixed(4)})`;
    if (response.results && response.results.length > 0) address = response.results[0].formatted_address;

    return calculateMatrixMetrics(params.originLat, params.originLng, params.pinLat, params.pinLng, address);
  } catch (e) {
    return jsonError(e.toString());
  }
}

function calculateMatrixMetrics(originLat, originLng, targetLat, targetLng, targetAddress) {
  try {
    const directions = Maps.newDirectionFinder()
      .setOrigin(originLat, originLng)
      .setDestination(`${targetLat},${targetLng}`)
      .setMode(Maps.DirectionFinder.Mode.DRIVING)
      .getDirections();

    let distance = "N/A", duration = "N/A";
    if (directions.routes && directions.routes.length > 0) {
      const route = directions.routes[0].legs[0];
      distance = route.distance.text;
      duration = route.duration.text;
    }

    return jsonSuccess({
      address: targetAddress,
      lat: targetLat,
      lng: targetLng,
      distance: distance,
      duration: duration
    });
  } catch (e) {
    return jsonError("Matrix calculation failed");
  }
}

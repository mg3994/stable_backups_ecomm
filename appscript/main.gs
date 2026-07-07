/**
 * Apps Script Backend for Antinna Blogger Engine
 * Handles Geo-verification, Type-ahead suggestions, and Routing metrics.
 */

function doPost(e) {
  var postData;
  try {
    postData = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid JSON" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var action = postData.action;
  var params = postData.params || {};
  var result;

  switch (action) {
    case 'getPlaceSuggestions':
      result = getPlaceSuggestions(params.inputToken);
      break;
    case 'processLocationAndMetrics':
      result = processLocationAndMetrics(params.originLat, params.originLng, params.destinationQuery);
      break;
    case 'processPinDropMetrics':
      result = processPinDropMetrics(params.originLat, params.originLng, params.pinLat, params.pinLng);
      break;
    case 'createOrder':
      result = createOrder(postData.order, postData.authToken);
      break;
    default:
      result = { status: "error", message: "Unknown action: " + action };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 1. Fetches real-time type-ahead suggestions based on user input
 */
function getPlaceSuggestions(inputToken) {
  if (!inputToken || inputToken.length < 3) return [];

  try {
    const response = Maps.newGeocoder().geocode(inputToken);
    if (response.results && response.results.length > 0) {
      return response.results.map(result => result.formatted_address);
    }
    return [];
  } catch (e) {
    console.error("Suggestions processing error: " + e.toString());
    return [];
  }
}

/**
 * 2. Processes a textual address to extract coordinates and compute routing metrics
 */
function processLocationAndMetrics(originLat, originLng, destinationQuery) {
  try {
    const geocode = Maps.newGeocoder().geocode(destinationQuery);
    if (!geocode.results || geocode.results.length === 0) {
      throw new Error("Target destination coordinates could not be resolved.");
    }

    const result = geocode.results[0];
    const targetAddress = result.formatted_address;
    const targetLat = result.geometry.location.lat;
    const targetLng = result.geometry.location.lng;

    return calculateMatrixMetrics(originLat, originLng, targetLat, targetLng, targetAddress);
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

/**
 * 3. Processes raw latitude/longitude from a manual map Pin Drop
 */
function processPinDropMetrics(originLat, originLng, pinLat, pinLng) {
  try {
    const response = Maps.newGeocoder().reverseGeocode(pinLat, pinLng);
    let targetAddress = `Pinned Location (${pinLat.toFixed(4)}, ${pinLng.toFixed(4)})`;

    if (response.results && response.results.length > 0) {
      targetAddress = response.results[0].formatted_address;
    }

    return calculateMatrixMetrics(originLat, originLng, pinLat, pinLng, targetAddress);
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

/**
 * Helper to calculate Driving Distance and Duration Matrix metrics
 */
function calculateMatrixMetrics(originLat, originLng, targetLat, targetLng, targetAddress) {
  try {
    const directions = Maps.newDirectionFinder()
      .setOrigin(originLat, originLng)
      .setDestination(`${targetLat},${targetLng}`)
      .setMode(Maps.DirectionFinder.Mode.DRIVING)
      .getDirections();

    let distance = "N/A";
    let duration = "N/A";

    if (directions.routes && directions.routes.length > 0) {
      const route = directions.routes[0].legs[0];
      distance = route.distance.text;
      duration = route.duration.text;
    }

    return {
      status: "success",
      address: targetAddress,
      lat: targetLat,
      lng: targetLng,
      distance: distance,
      duration: duration
    };
  } catch (e) {
    return { status: "error", message: "Matrix calculation failed: " + e.toString() };
  }
}

/**
 * Dummy function to create an order in the backend.
 * In a real scenario, this would save to a Spreadsheet or Database.
 */
function createOrder(order, authToken) {
  try {
    // In a real implementation, you would verify the Firebase authToken here.
    // var user = verifyAuthToken(authToken);

    console.log("Processing Order:", JSON.stringify(order));

    // Optional: Save to Google Sheets
    // var ss = SpreadsheetApp.getActiveSpreadsheet();
    // var sheet = ss.getSheetByName("Orders") || ss.insertSheet("Orders");
    // sheet.appendRow([new Date(), order.orderId || "N/A", JSON.stringify(order.orderedItem), order.totalPrice, order.customer?.email]);

    return {
      status: "success",
      orderId: "ANT-" + Math.floor(Math.random() * 1000000),
      message: "Order recorded successfully. Proceed to payment.",
      receivedOrder: order // Echo back for confirmation
    };
  } catch (e) {
    return { status: "error", message: "Failed to create order: " + e.toString() };
  }
}

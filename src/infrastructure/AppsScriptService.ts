export class AppsScriptService {
  private static instance: AppsScriptService;

  // Specific endpoint for Map/Geo services via Apps Script
  private mapUrl: string = 'https://script.google.com/macros/s/AKfycbyca4Xz_AE6Om1okIMf0TQ9EE9uIifQcVZhsDwnZK0K4weG7VD0w3jEzM0aCcuBeoWIIA/exec';

  public static getInstance(): AppsScriptService {
    if (!AppsScriptService.instance) {
      AppsScriptService.instance = new AppsScriptService();
    }
    return AppsScriptService.instance;
  }

  public setMapUrl(url: string): void {
    this.mapUrl = url;
  }

  private async callAction<T>(action: string, params: any = {}): Promise<T> {
    const payload = { action, params };

    try {
      const response = await fetch(this.mapUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();

    } catch (e) {
      console.error(`AppsScriptService error [${action}]:`, e);
      throw e;
    }
  }

  public async getPlaceSuggestions(inputToken: string): Promise<string[]> {
    const res = await this.callAction<any>('getPlaceSuggestions', { inputToken });
    return res.suggestions || [];
  }

  public async processLocationAndMetrics(originLat: number, originLng: number, destinationQuery: string): Promise<any> {
    return this.callAction<any>('processLocationAndMetrics', { originLat, originLng, destinationQuery });
  }

  public async processPinDropMetrics(originLat: number, originLng: number, pinLat: number, pinLng: number): Promise<any> {
    return this.callAction<any>('processPinDropMetrics', { originLat, originLng, pinLat, pinLng });
  }

  private getDummyResponse(action: string, params: any): any {
      switch(action) {
          case 'getPlaceSuggestions': return ["123 Main St, New York, NY", "456 Park Ave, New York, NY", "789 Broadway, New York, NY"];
          case 'processLocationAndMetrics':
          case 'processPinDropMetrics':
              return {
                  status: "success",
                  address: params.destinationQuery || "Mock Address, India",
                  lat: params.pinLat || 28.6139,
                  lng: params.pinLng || 77.2090,
                  distance: "15.5 km",
                  duration: "35 mins",
                  addressDetails: {
                      extendedAddress: "3rd Floor, Plot No. 42, ABC Towers",
                      streetAddress: "Sector 14",
                      addressLocality: "Rohtak",
                      addressRegion: "HR",
                      postalCode: "124001",
                      addressCountry: "IN"
                  }
              };
          case 'createOrder': return { status: "success", orderId: "ANT-MOCK-123", message: "Mock order created" };
          default: return { status: "error", message: "Unknown action" };
      }
  }
}

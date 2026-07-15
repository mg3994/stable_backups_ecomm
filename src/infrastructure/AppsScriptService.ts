export class AppsScriptService {
  private static instance: AppsScriptService;

  // Specific endpoint for Map/Geo services via Apps Script
  private mapUrl: string = 'https://script.google.com/macros/s/AKfycbyca4Xz_AE6Om1okIMf0TQ9EE9uIifQcVZhsDwnZK0K4weG7VD0w3jEzM0aCcuBeoWIIA/exec';

  // Production API for orders, payments, and notifications (Cloudflare Workers)
  private apiUrl: string = 'https://api.antinna.in';

  public static getInstance(): AppsScriptService {
    if (!AppsScriptService.instance) {
      AppsScriptService.instance = new AppsScriptService();
    }
    return AppsScriptService.instance;
  }

  public setMapUrl(url: string): void {
    this.mapUrl = url;
  }

  private async callAction<T>(action: string, params: any = {}, extra: any = {}): Promise<T> {
    const isMapAction = ['getPlaceSuggestions', 'processLocationAndMetrics', 'processPinDropMetrics'].includes(action);
    const targetUrl = isMapAction ? this.mapUrl : `${this.apiUrl}/services`;

    const payload = {
      action,
      params,
      authToken: (window as any).firebaseAuthToken || (window as any).firebaseAuth?.currentUser?.accessToken,
      clientId: localStorage.getItem('antinna_client_id'),
      ...extra
    };

    try {
      const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();

    } catch (e) {
      console.error(`AppsScriptService error [${action}]:`, e);
      // Fallback for Map actions if Apps Script CORS issues occur (usually handled by SS redirect)
      throw e;
    }
  }

  public async getPlaceSuggestions(inputToken: string): Promise<string[]> {
    return this.callAction<string[]>('getPlaceSuggestions', { inputToken });
  }

  public async processLocationAndMetrics(originLat: number, originLng: number, destinationQuery: string): Promise<any> {
    return this.callAction<any>('processLocationAndMetrics', { originLat, originLng, destinationQuery });
  }

  public async processPinDropMetrics(originLat: number, originLng: number, pinLat: number, pinLng: number): Promise<any> {
    return this.callAction<any>('processPinDropMetrics', { originLat, originLng, pinLat, pinLng });
  }

  public async createOrder(order: any): Promise<any> {
    return this.callAction<any>('createOrder', {}, { order });
  }

  public async recordPayment(paymentData: any): Promise<any> {
      return this.callAction<any>('recordPayment', paymentData);
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

export class ProductionApiService {
  private static instance: ProductionApiService;
  private baseUrl: string = 'https://api.antinna.in';

  public static getInstance(): ProductionApiService {
    if (!ProductionApiService.instance) {
      ProductionApiService.instance = new ProductionApiService();
    }
    return ProductionApiService.instance;
  }

  private async callAction<T>(action: string, params: any = {}, extra: any = {}): Promise<T> {
    const payload = {
      action,
      params,
      authToken: (window as any).firebaseAuthToken || (window as any).firebaseAuth?.currentUser?.accessToken,
      clientId: localStorage.getItem('antinna_client_id'),
      ...extra
    };

    try {
      const response = await fetch(`${this.baseUrl}/services`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();

    } catch (e) {
      console.error(`ProductionApiService error [${action}]:`, e);
      throw e;
    }
  }

  public async createOrder(order: any): Promise<any> {
    return this.callAction<any>('createOrder', {}, { order });
  }

  public async recordPayment(paymentData: any): Promise<any> {
    return this.callAction<any>('recordPayment', paymentData);
  }

  public async isOrderPaid(orderId: string): Promise<any> {
    return this.callAction<any>('isOrderPaid', { orderId });
  }

  public async listNotifications(page: number = 1, pageSize: number = 20): Promise<any> {
    return this.callAction<any>('listNotifications', { page, pageSize });
  }
}

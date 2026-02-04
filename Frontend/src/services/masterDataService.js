import apiService from './apiService';

class MasterDataService {
  // Manufacturers
  async getManufacturers() {
    return await apiService.get('/manufacturers');
  }

  async createManufacturer(data) {
    return await apiService.post('/manufacturers', data);
  }

  // Brands
  async getBrands(manufacturerId = null) {
    const params = manufacturerId ? { manufacturer_id: manufacturerId } : {};
    return await apiService.get('/brands', { params });
  }

  async createBrand(data) {
    return await apiService.post('/brands', data);
  }

  // Units
  async getUnits(type = null) {
    const params = type ? { type } : {};
    return await apiService.get('/units', { params });
  }

  async createUnit(data) {
    return await apiService.post('/units', data);
  }

  // Categories
  async getCategories() {
    return await apiService.get('/categories');
  }

  async createCategory(data) {
    return await apiService.post('/categories', data);
  }
}

export const masterDataService = new MasterDataService();
export default masterDataService;
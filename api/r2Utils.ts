export function normalizeR2Url(url: string | null | undefined): string | null {
  if (!url) return null;
  
  if (url.startsWith('/api/r2-image/')) {
    return url;
  }
  
  const r2UrlPattern = /https:\/\/[\w-]+\.r2\.cloudflarestorage\.com\/[^\/]+\/(.+)/;
  const match = url.match(r2UrlPattern);
  
  if (match) {
    const key = match[1];
    return `/api/r2-image/${key}`;
  }
  
  if (url.startsWith('/uploads/')) {
    return url;
  }
  
  return url;
}

export function normalizeCompanyLogo(company: any): any {
  if (!company) return company;
  
  return {
    ...company,
    companyLogo: normalizeR2Url(company.companyLogo)
  };
}

export function normalizeCompanyLogos(companies: any[]): any[] {
  return companies.map(company => normalizeCompanyLogo(company));
}

export function normalizeStoreLogo(store: any): any {
  if (!store) return store;
  
  return {
    ...store,
    companyLogo: normalizeR2Url(store.companyLogo)
  };
}

export function normalizeStoreLogos(stores: any[]): any[] {
  return stores.map(store => normalizeStoreLogo(store));
}

export function normalizeProductImage(product: any): any {
  if (!product) return product;
  
  return {
    ...product,
    imageUrl: normalizeR2Url(product.imageUrl)
  };
}

export function normalizeProductImages(products: any[]): any[] {
  return products.map(product => normalizeProductImage(product));
}

export function normalizeUserProfileImage(user: any): any {
  if (!user) return user;
  
  return {
    ...user,
    profileImageUrl: normalizeR2Url(user.profileImageUrl)
  };
}

export function normalizeUserProfileImages(users: any[]): any[] {
  return users.map(user => normalizeUserProfileImage(user));
}

export function normalizeAllImageUrls(obj: any): any {
  if (!obj) return obj;
  
  const normalized = { ...obj };
  
  if (normalized.imageUrl) {
    normalized.imageUrl = normalizeR2Url(normalized.imageUrl);
  }
  if (normalized.companyLogo) {
    normalized.companyLogo = normalizeR2Url(normalized.companyLogo);
  }
  if (normalized.profileImageUrl) {
    normalized.profileImageUrl = normalizeR2Url(normalized.profileImageUrl);
  }
  
  return normalized;
}

export function normalizeAllImageUrlsInArray(arr: any[]): any[] {
  return arr.map(obj => normalizeAllImageUrls(obj));
}
